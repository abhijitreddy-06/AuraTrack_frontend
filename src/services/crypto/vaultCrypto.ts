/**
 * vaultCrypto.ts — AuraTrack v2 vault cryptographic primitives.
 *
 * Replaces libsodium-wrappers-sumo (WASM) with pure-JS @noble libraries
 * that are compatible with React Native's Hermes engine:
 *
 *   @noble/hashes  →  Argon2id key derivation (no WASM, pure JS)
 *   @noble/ciphers →  XChaCha20-Poly1305 AEAD (no WASM, pure JS)
 *
 * Wire-format compatibility:
 *   - XChaCha20-Poly1305: same algorithm, key (32 B), nonce (24 B),
 *     ciphertext || 16-byte tag — binary-identical to libsodium output.
 *   - Argon2id: same algorithm with the same t/m/p parameters gives the
 *     same derived key as libsodium's crypto_pwhash.
 *   - Salt: 16 bytes, base64url-no-padding — same as before.
 *   - Nonce: 24 bytes, base64url-no-padding — same as before.
 *   - DEK: 32 bytes, base64url-no-padding — same as before.
 *
 * Randomness:
 *   crypto.getRandomValues is polyfilled by react-native-get-random-values
 *   (imported first in index.js) which calls Android SecureRandom /
 *   iOS SecRandomCopyBytes under the hood.
 *
 * Existing v2 users' wrapped DEKs and encrypted entries are fully
 * decryptable with this implementation — no re-encryption required.
 */

import { argon2id } from "@noble/hashes/argon2.js";
import { xchacha20poly1305 } from "@noble/ciphers/chacha.js";
import { utf8ToBytes } from "@noble/hashes/utils.js";

// ─── Libsodium constant equivalents ──────────────────────────────────────────
// These values are identical to libsodium's constants to maintain
// compatibility with all data already stored in the database.

/** Argon2id OWASP interactive iterations (= libsodium OPSLIMIT_INTERACTIVE) */
const ARGON2ID_T_INTERACTIVE = 2;

/**
 * Argon2id OWASP interactive memory — libsodium stores memlimit in BYTES
 * (67108864 = 64 MB). @noble/hashes argon2id takes memory in KIBIBYTES,
 * so we divide by 1024 (= 65536 KiB).
 */
const ARGON2ID_M_INTERACTIVE_KB = 67108864 / 1024; // 65536

/** Argon2id parallelism (libsodium always uses 1). */
const ARGON2ID_P = 1;

/** libsodium crypto_pwhash_ALG_ARGON2ID13 constant value */
export const ARGON2ID13_ALGO_CONSTANT = 2;

/** Salt size in bytes: libsodium crypto_pwhash_SALTBYTES = 16 */
const SALT_BYTES = 16;

/** Nonce size in bytes: libsodium crypto_aead_xchacha20poly1305_ietf_NPUBBYTES = 24 */
const NONCE_BYTES = 24;

/** DEK/key size in bytes: libsodium crypto_aead_xchacha20poly1305_ietf_KEYBYTES = 32 */
const KEY_BYTES = 32;

// ─── Base64url (no padding) helpers ──────────────────────────────────────────
// btoa / atob are available in Hermes. We replicate libsodium's
// base64_variants.URLSAFE_NO_PADDING: replace + → -, / → _, strip =.

const toBase64Url = (bytes: Uint8Array): string => {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
};

const fromBase64Url = (str: string): Uint8Array => {
  // Restore standard base64 characters and add padding.
  const b64 =
    str.replace(/-/g, "+").replace(/_/g, "/") +
    "=".repeat((4 - (str.length % 4)) % 4);
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

const toHex = (bytes: Uint8Array): string =>
  Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

// ─── Public types ─────────────────────────────────────────────────────────────

/**
 * Vault KDF Parameters shape matching the database schema in user_vault_keys.
 * Kept identical to the libsodium-era shape for full database compatibility.
 *
 * opslimit = Argon2id t (iterations)
 * memlimit = Argon2id memory in BYTES (divide by 1024 for @noble)
 * algo     = 2 (ARGON2ID13 constant, kept for schema compatibility)
 */
export type VaultKdfParams = {
  opslimit: number;
  memlimit: number;
  algo: number;
};

/**
 * Decrypted in-memory vault session holding the cryptographic keys.
 * Kept only in memory while the user is actively viewing/managing passwords.
 */
export type VaultCryptoSession = {
  kek: Uint8Array; // 32 bytes Key Encryption Key derived from password via Argon2id
  dek: Uint8Array | null; // 32 bytes Data Encryption Key (unwrapped from wrapped_dek)
};

/**
 * Custom error thrown when vault unlocking or key derivation fails.
 */
export class VaultCryptoError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "INIT_FAILED"
      | "INVALID_PASSWORD"
      | "INVALID_SALT"
      | "INVALID_PARAMS"
      | "UNWRAP_FAILED"
      | "ENCRYPT_FAILED"
      | "DECRYPT_FAILED",
  ) {
    super(message);
    this.name = "VaultCryptoError";
  }
}

// ─── Sodium-compat shim ───────────────────────────────────────────────────────

/**
 * No-op: @noble libraries need no async initialization.
 * Kept for API compatibility with callers that await ensureSodiumReady().
 */
export const ensureSodiumReady = async (): Promise<void> => {
  // @noble/hashes and @noble/ciphers are synchronous pure-JS — no WASM init.
};

// ─── Random bytes ─────────────────────────────────────────────────────────────

/** Fill a Uint8Array with cryptographically secure random bytes. */
const randomBytes = (n: number): Uint8Array => {
  const buf = new Uint8Array(n);
  // crypto.getRandomValues is polyfilled by react-native-get-random-values
  // in index.js (imported first, before everything else).
  crypto.getRandomValues(buf);
  return buf;
};

// ─── KDF params ───────────────────────────────────────────────────────────────

/**
 * Returns the default Argon2id KDF parameters matching OWASP interactive
 * recommendations — identical values to what libsodium produced, so
 * existing salts/wrapped DEKs remain fully decryptable.
 */
export const getDefaultKdfParams = async (): Promise<VaultKdfParams> => ({
  opslimit: ARGON2ID_T_INTERACTIVE,
  memlimit: ARGON2ID_M_INTERACTIVE_KB * 1024, // stored as bytes = 67108864
  algo: ARGON2ID13_ALGO_CONSTANT,
});

// ─── Salt / Nonce / DEK generation ───────────────────────────────────────────

/**
 * Generate a cryptographically secure random salt for Argon2id
 * (16 bytes, base64url-no-padding encoded).
 */
export const generateSalt = async (): Promise<string> =>
  toBase64Url(randomBytes(SALT_BYTES));

/**
 * Generate a cryptographically secure random nonce for XChaCha20-Poly1305
 * (24 bytes, base64url-no-padding encoded).
 */
export const generateNonce = async (): Promise<string> =>
  toBase64Url(randomBytes(NONCE_BYTES));

/**
 * Generate a cryptographically secure random 32-byte Data Encryption Key (DEK).
 *
 * The DEK is a RANDOM key — it is NOT derived from the user's password.
 * It is generated fresh on first vault initialisation and never regenerated
 * (unless the vault is fully reset). The plaintext DEK exists only in memory
 * and is immediately wrapped with the KEK before being sent anywhere.
 *
 * @returns Uint8Array of exactly 32 random bytes.
 */
export const generateDEK = async (): Promise<Uint8Array> =>
  randomBytes(KEY_BYTES);

// ─── Key Derivation ───────────────────────────────────────────────────────────

/**
 * Derive a 32-byte Key Encryption Key (KEK) using Argon2id via @noble/hashes.
 *
 * Requirements:
 * - Deterministic for the same (password, salt, params).
 * - Runs completely client-side.
 * - Plaintext password and derived key are NEVER sent over the network or logged.
 *
 * Parameter mapping from libsodium schema:
 *   kdf_params.opslimit → t  (iterations)
 *   kdf_params.memlimit → m  (memory in KB; schema stores bytes, so ÷ 1024)
 *   kdf_params.algo     → ignored (always Argon2id)
 *
 * @param password The user's plaintext password.
 * @param saltBase64 The base64url-encoded per-user salt.
 * @param params The Argon2id cost parameters (libsodium schema shape).
 * @returns Uint8Array of 32 bytes representing the KEK.
 */
export const deriveKEK = async (
  password: string,
  saltBase64: string,
  params: VaultKdfParams,
): Promise<Uint8Array> => {
  if (!password || typeof password !== "string") {
    throw new VaultCryptoError(
      "Password is required for key derivation",
      "INVALID_PASSWORD",
    );
  }
  if (!saltBase64 || typeof saltBase64 !== "string") {
    throw new VaultCryptoError(
      "Salt is required for key derivation",
      "INVALID_SALT",
    );
  }
  if (!params || !params.opslimit || !params.memlimit || !params.algo) {
    throw new VaultCryptoError(
      "Valid KDF parameters are required",
      "INVALID_PARAMS",
    );
  }

  let saltBytes: Uint8Array;
  try {
    saltBytes = fromBase64Url(saltBase64);
  } catch {
    throw new VaultCryptoError(
      "Failed to decode base64url salt",
      "INVALID_SALT",
    );
  }

  if (saltBytes.length !== SALT_BYTES) {
    throw new VaultCryptoError(
      `Salt must be exactly ${SALT_BYTES} bytes`,
      "INVALID_SALT",
    );
  }

  try {
    // memlimit in schema is bytes; @noble argon2id expects kibibytes.
    const memKb = Math.floor(params.memlimit / 1024);
    return argon2id(utf8ToBytes(password), saltBytes, {
      t: params.opslimit,
      m: memKb,
      p: ARGON2ID_P,
      dkLen: KEY_BYTES,
    });
  } catch (error) {
    throw new VaultCryptoError(
      error instanceof Error ? error.message : "Argon2id key derivation failed",
      "INVALID_PARAMS",
    );
  }
};

// ─── DEK Wrap / Unwrap ────────────────────────────────────────────────────────

/**
 * Unwrap an encrypted Data Encryption Key (DEK) using the derived KEK.
 * Uses XChaCha20-Poly1305 via @noble/ciphers — wire-format identical to
 * libsodium crypto_aead_xchacha20poly1305_ietf_decrypt.
 *
 * @param wrappedDekBase64 The base64url-encoded wrapped DEK ciphertext (includes 16-byte tag).
 * @param nonceBase64 The base64url-encoded 24-byte nonce used to wrap the DEK.
 * @param kek The 32-byte derived KEK.
 * @returns Uint8Array of 32 bytes representing the unwrapped DEK.
 */
export const unwrapDEK = async (
  wrappedDekBase64: string,
  nonceBase64: string,
  kek: Uint8Array,
): Promise<Uint8Array> => {
  let ciphertext: Uint8Array;
  let nonce: Uint8Array;

  try {
    ciphertext = fromBase64Url(wrappedDekBase64);
    nonce = fromBase64Url(nonceBase64);
  } catch {
    throw new VaultCryptoError(
      "Failed to decode base64url wrapped DEK or nonce",
      "UNWRAP_FAILED",
    );
  }

  try {
    const cipher = xchacha20poly1305(kek, nonce);
    return cipher.decrypt(ciphertext);
  } catch {
    throw new VaultCryptoError(
      "Failed to unwrap DEK. Password may be incorrect or ciphertext was corrupted.",
      "UNWRAP_FAILED",
    );
  }
};

/**
 * Wrap a DEK with a KEK using XChaCha20-Poly1305.
 * Used when setting up a v2 vault or rotating the DEK.
 * Output is wire-format identical to libsodium crypto_aead_xchacha20poly1305_ietf_encrypt.
 */
export const wrapDEK = async (
  dek: Uint8Array,
  kek: Uint8Array,
): Promise<{ wrappedDek: string; nonce: string }> => {
  const nonceBytes = randomBytes(NONCE_BYTES);
  const cipher = xchacha20poly1305(kek, nonceBytes);
  const ciphertext = cipher.encrypt(dek); // ciphertext || 16-byte tag

  return {
    wrappedDek: toBase64Url(ciphertext),
    nonce: toBase64Url(nonceBytes),
  };
};

// ─── Field Encryption / Decryption ───────────────────────────────────────────

/**
 * Encrypt a plaintext string field using the DEK via XChaCha20-Poly1305.
 *
 * The ciphertext format is: base64url(nonce) + "." + base64url(ciphertext)
 * The nonce is prepended so the client has everything needed to decrypt.
 *
 * Rules:
 * - Every call generates a fresh random nonce (never reuse nonces with the same key).
 * - The DEK never leaves the client; only the output ciphertext is sent to the backend.
 * - The backend treats the output string as an opaque blob.
 *
 * @param plaintext UTF-8 string to encrypt.
 * @param dek 32-byte Data Encryption Key.
 * @returns Dot-separated base64url string: "<nonce>.<ciphertext>"
 */
export const encryptField = async (
  plaintext: string,
  dek: Uint8Array,
): Promise<string> => {
  if (typeof plaintext !== "string") {
    throw new VaultCryptoError("plaintext must be a string", "ENCRYPT_FAILED");
  }
  if (!dek || dek.length !== KEY_BYTES) {
    throw new VaultCryptoError(
      "DEK must be a 32-byte Uint8Array",
      "ENCRYPT_FAILED",
    );
  }

  try {
    const nonce = randomBytes(NONCE_BYTES);
    const cipher = xchacha20poly1305(dek, nonce);
    const ciphertext = cipher.encrypt(utf8ToBytes(plaintext));

    return `${toBase64Url(nonce)}.${toBase64Url(ciphertext)}`;
  } catch (error) {
    throw new VaultCryptoError(
      error instanceof Error ? error.message : "Encryption failed",
      "ENCRYPT_FAILED",
    );
  }
};

/**
 * Decrypt a field encrypted by encryptField().
 *
 * Expects format: "<nonce_base64url>.<ciphertext_base64url>"
 *
 * @param encoded The dot-separated encoded ciphertext string.
 * @param dek 32-byte Data Encryption Key.
 * @returns The original plaintext UTF-8 string.
 */
export const decryptField = async (
  encoded: string,
  dek: Uint8Array,
): Promise<string> => {
  if (typeof encoded !== "string" || !encoded.includes(".")) {
    throw new VaultCryptoError(
      "Invalid ciphertext format — expected '<nonce>.<ciphertext>'",
      "DECRYPT_FAILED",
    );
  }
  if (!dek || dek.length !== KEY_BYTES) {
    throw new VaultCryptoError(
      "DEK must be a 32-byte Uint8Array",
      "DECRYPT_FAILED",
    );
  }

  const dotIndex = encoded.indexOf(".");
  const nonceB64 = encoded.slice(0, dotIndex);
  const ciphertextB64 = encoded.slice(dotIndex + 1);

  let nonce: Uint8Array;
  let ciphertext: Uint8Array;

  try {
    nonce = fromBase64Url(nonceB64);
    ciphertext = fromBase64Url(ciphertextB64);
  } catch {
    throw new VaultCryptoError(
      "Failed to decode base64url ciphertext or nonce",
      "DECRYPT_FAILED",
    );
  }

  try {
    const cipher = xchacha20poly1305(dek, nonce);
    const plainBytes = cipher.decrypt(ciphertext);
    return new TextDecoder().decode(plainBytes);
  } catch {
    throw new VaultCryptoError(
      "Decryption failed — wrong DEK or tampered ciphertext.",
      "DECRYPT_FAILED",
    );
  }
};

// ─── Memory wipe ──────────────────────────────────────────────────────────────

/**
 * Safely wipe sensitive byte arrays from memory when no longer needed.
 */
export const wipeBytes = (buffer: Uint8Array | null | undefined): void => {
  if (buffer && buffer.fill) {
    buffer.fill(0);
  }
};

// ─── DEK encode/decode for SecureStore ───────────────────────────────────────

/**
 * Encode a 32-byte DEK to a base64url string for SecureStore persistence.
 */
export const encodeDEK = async (dek: Uint8Array): Promise<string> => {
  if (!dek || dek.length !== KEY_BYTES) {
    throw new VaultCryptoError(
      "DEK must be a 32-byte Uint8Array",
      "INIT_FAILED",
    );
  }
  return toBase64Url(dek);
};

/**
 * Decode and strictly validate a base64url string as a 32-byte DEK.
 * Rejects and wipes corrupted or malformed buffers.
 */
export const decodeAndValidateDEK = async (
  encoded: string,
): Promise<Uint8Array> => {
  if (typeof encoded !== "string" || !encoded.trim()) {
    throw new VaultCryptoError("Invalid DEK encoding", "INIT_FAILED");
  }
  let bytes: Uint8Array;
  try {
    bytes = fromBase64Url(encoded.trim());
  } catch {
    throw new VaultCryptoError("Failed to decode base64url DEK", "INIT_FAILED");
  }
  if (bytes.length !== KEY_BYTES) {
    wipeBytes(bytes);
    throw new VaultCryptoError(
      `DEK must be exactly ${KEY_BYTES} bytes, got ${bytes.length}`,
      "INIT_FAILED",
    );
  }
  return bytes;
};

// ─── Phase 8: Recovery Key Utilities ──────────────────────────────────────────

/**
 * Generates a cryptographically secure 32-byte recovery key (256 bits of CSPRNG entropy).
 * Formats the key into 16 groups of 4 uppercase hex characters separated by hyphens.
 */
export const generateRecoveryKey = async (): Promise<{
  rawBytes: Uint8Array;
  formattedKey: string;
  normalizedKey: string;
}> => {
  const rawBytes = randomBytes(32);
  const hex = toHex(rawBytes).toUpperCase();
  const chunks = hex.match(/.{1,4}/g) || [];
  const formattedKey = chunks.join("-");
  return {
    rawBytes,
    formattedKey,
    normalizedKey: hex,
  };
};

/**
 * Formats a 64-character normalized hex string into 16 groups of 4 separated by hyphens.
 */
export const formatRecoveryKey = (hexKey: string): string => {
  const clean = hexKey.replace(/[^0-9a-fA-F]/g, "").toUpperCase();
  const chunks = clean.match(/.{1,4}/g) || [];
  return chunks.join("-");
};

/**
 * Normalizes user input for a recovery key:
 * - Trims whitespace, removes hyphens, spaces
 * - Converts to uppercase
 * - Strictly validates length (64 hex characters = 32 bytes)
 * Throws VaultCryptoError if malformed.
 */
export const normalizeRecoveryKey = (input: string): string => {
  if (typeof input !== "string" || !input.trim()) {
    throw new VaultCryptoError(
      "Recovery key cannot be empty",
      "INVALID_PARAMS",
    );
  }
  const clean = input.replace(/[\s-]/g, "").toUpperCase();
  if (clean.length !== 64 || !/^[0-9A-F]{64}$/.test(clean)) {
    throw new VaultCryptoError(
      "Invalid recovery key format. Expected 64 hexadecimal characters.",
      "INVALID_PARAMS",
    );
  }
  return clean;
};
