import sodium from "libsodium-wrappers-sumo";

/**
 * Vault KDF Parameters shape matching the database schema in user_vault_keys.
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

/**
 * Ensure libsodium is fully loaded and ready before any cryptographic operations.
 */
export const ensureSodiumReady = async (): Promise<typeof sodium> => {
  await sodium.ready;
  return sodium;
};

/**
 * Returns the default Argon2id KDF parameters matching OWASP interactive recommendations.
 */
export const getDefaultKdfParams = async (): Promise<VaultKdfParams> => {
  const s = await ensureSodiumReady();
  return {
    opslimit: s.crypto_pwhash_OPSLIMIT_INTERACTIVE,
    memlimit: s.crypto_pwhash_MEMLIMIT_INTERACTIVE,
    algo: s.crypto_pwhash_ALG_ARGON2ID13,
  };
};

/**
 * Generate a cryptographically secure random salt for Argon2id (16 bytes, base64url encoded).
 */
export const generateSalt = async (): Promise<string> => {
  const s = await ensureSodiumReady();
  const saltBytes = s.randombytes_buf(s.crypto_pwhash_SALTBYTES);
  return s.to_base64(saltBytes, s.base64_variants.URLSAFE_NO_PADDING);
};

/**
 * Generate a cryptographically secure random nonce for XChaCha20-Poly1305 (24 bytes, base64url encoded).
 */
export const generateNonce = async (): Promise<string> => {
  const s = await ensureSodiumReady();
  const nonceBytes = s.randombytes_buf(
    s.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES,
  );
  return s.to_base64(nonceBytes, s.base64_variants.URLSAFE_NO_PADDING);
};

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
export const generateDEK = async (): Promise<Uint8Array> => {
  const s = await ensureSodiumReady();
  // crypto_aead_xchacha20poly1305_ietf_KEYBYTES = 32
  return s.randombytes_buf(s.crypto_aead_xchacha20poly1305_ietf_KEYBYTES);
};

/**
 * Derive a 32-byte Key Encryption Key (KEK) using Argon2id via libsodium.
 *
 * Requirements:
 * - Deterministic for the same (password, salt, params).
 * - Runs completely client-side.
 * - Plaintext password and derived key are NEVER sent over the network or logged.
 *
 * @param password The user's plaintext password.
 * @param saltBase64 The base64url-encoded per-user salt.
 * @param params The Argon2id cost parameters.
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

  const s = await ensureSodiumReady();

  let saltBytes: Uint8Array;
  try {
    saltBytes = s.from_base64(saltBase64, s.base64_variants.URLSAFE_NO_PADDING);
  } catch {
    throw new VaultCryptoError(
      "Failed to decode base64url salt",
      "INVALID_SALT",
    );
  }

  if (saltBytes.length !== s.crypto_pwhash_SALTBYTES) {
    throw new VaultCryptoError(
      `Salt must be exactly ${s.crypto_pwhash_SALTBYTES} bytes`,
      "INVALID_SALT",
    );
  }

  try {
    return s.crypto_pwhash(
      32,
      password,
      saltBytes,
      params.opslimit,
      params.memlimit,
      params.algo,
    );
  } catch (error) {
    throw new VaultCryptoError(
      error instanceof Error ? error.message : "Argon2id key derivation failed",
      "INVALID_PARAMS",
    );
  }
};

/**
 * Unwrap an encrypted Data Encryption Key (DEK) using the derived KEK.
 * Uses libsodium's authenticated encryption: XChaCha20-Poly1305.
 *
 * @param wrappedDekBase64 The base64url-encoded wrapped DEK ciphertext.
 * @param nonceBase64 The base64url-encoded nonce used to wrap the DEK.
 * @param kek The 32-byte derived KEK.
 * @returns Uint8Array of 32 bytes representing the unwrapped DEK.
 */
export const unwrapDEK = async (
  wrappedDekBase64: string,
  nonceBase64: string,
  kek: Uint8Array,
): Promise<Uint8Array> => {
  const s = await ensureSodiumReady();

  let ciphertext: Uint8Array;
  let nonce: Uint8Array;

  try {
    ciphertext = s.from_base64(
      wrappedDekBase64,
      s.base64_variants.URLSAFE_NO_PADDING,
    );
    nonce = s.from_base64(nonceBase64, s.base64_variants.URLSAFE_NO_PADDING);
  } catch {
    throw new VaultCryptoError(
      "Failed to decode base64url wrapped DEK or nonce",
      "UNWRAP_FAILED",
    );
  }

  try {
    return s.crypto_aead_xchacha20poly1305_ietf_decrypt(
      null,
      ciphertext,
      null,
      nonce,
      kek,
    );
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
 */
export const wrapDEK = async (
  dek: Uint8Array,
  kek: Uint8Array,
): Promise<{ wrappedDek: string; nonce: string }> => {
  const s = await ensureSodiumReady();
  const nonceBytes = s.randombytes_buf(
    s.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES,
  );
  const ciphertext = s.crypto_aead_xchacha20poly1305_ietf_encrypt(
    dek,
    null,
    null,
    nonceBytes,
    kek,
  );

  return {
    wrappedDek: s.to_base64(ciphertext, s.base64_variants.URLSAFE_NO_PADDING),
    nonce: s.to_base64(nonceBytes, s.base64_variants.URLSAFE_NO_PADDING),
  };
};

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
  if (!dek || dek.length !== 32) {
    throw new VaultCryptoError(
      "DEK must be a 32-byte Uint8Array",
      "ENCRYPT_FAILED",
    );
  }

  const s = await ensureSodiumReady();

  const nonce = s.randombytes_buf(
    s.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES,
  );

  try {
    const ciphertext = s.crypto_aead_xchacha20poly1305_ietf_encrypt(
      s.from_string(plaintext),
      null,
      null,
      nonce,
      dek,
    );

    const nonceB64 = s.to_base64(nonce, s.base64_variants.URLSAFE_NO_PADDING);
    const ciphertextB64 = s.to_base64(
      ciphertext,
      s.base64_variants.URLSAFE_NO_PADDING,
    );

    return `${nonceB64}.${ciphertextB64}`;
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
  if (!dek || dek.length !== 32) {
    throw new VaultCryptoError(
      "DEK must be a 32-byte Uint8Array",
      "DECRYPT_FAILED",
    );
  }

  const s = await ensureSodiumReady();

  const dotIndex = encoded.indexOf(".");
  const nonceB64 = encoded.slice(0, dotIndex);
  const ciphertextB64 = encoded.slice(dotIndex + 1);

  let nonce: Uint8Array;
  let ciphertext: Uint8Array;

  try {
    nonce = s.from_base64(nonceB64, s.base64_variants.URLSAFE_NO_PADDING);
    ciphertext = s.from_base64(
      ciphertextB64,
      s.base64_variants.URLSAFE_NO_PADDING,
    );
  } catch {
    throw new VaultCryptoError(
      "Failed to decode base64url ciphertext or nonce",
      "DECRYPT_FAILED",
    );
  }

  try {
    const plainBytes = s.crypto_aead_xchacha20poly1305_ietf_decrypt(
      null,
      ciphertext,
      null,
      nonce,
      dek,
    );
    return s.to_string(plainBytes);
  } catch {
    throw new VaultCryptoError(
      "Decryption failed — wrong DEK or tampered ciphertext.",
      "DECRYPT_FAILED",
    );
  }
};

/**
 * Safely wipe sensitive byte arrays from memory when no longer needed.
 */
export const wipeBytes = (buffer: Uint8Array | null | undefined): void => {
  if (buffer && buffer.fill) {
    buffer.fill(0);
  }
};

/**
 * Encode a 32-byte DEK to a base64url string for SecureStore persistence.
 */
export const encodeDEK = async (dek: Uint8Array): Promise<string> => {
  if (!dek || dek.length !== 32) {
    throw new VaultCryptoError(
      "DEK must be a 32-byte Uint8Array",
      "INIT_FAILED",
    );
  }
  const s = await ensureSodiumReady();
  return s.to_base64(dek, s.base64_variants.URLSAFE_NO_PADDING);
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
  const s = await ensureSodiumReady();
  let bytes: Uint8Array;
  try {
    bytes = s.from_base64(encoded.trim(), s.base64_variants.URLSAFE_NO_PADDING);
  } catch {
    throw new VaultCryptoError("Failed to decode base64url DEK", "INIT_FAILED");
  }
  if (bytes.length !== s.crypto_aead_xchacha20poly1305_ietf_KEYBYTES) {
    wipeBytes(bytes);
    throw new VaultCryptoError(
      `DEK must be exactly ${s.crypto_aead_xchacha20poly1305_ietf_KEYBYTES} bytes, got ${bytes.length}`,
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
  const s = await ensureSodiumReady();
  const rawBytes = s.randombytes_buf(32);
  const hex = s.to_hex(rawBytes).toUpperCase();
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
