import { authenticatedRequest } from "./auth";

// ─── Entry types ──────────────────────────────────────────────────────────────

export type PasswordEntry = {
  id: string;
  title: string;
  /** Ciphertext string from the server: "<nonce_b64url>.<ciphertext_b64url>" */
  key: string;
  /** Ciphertext string from the server: "<nonce_b64url>.<ciphertext_b64url>" */
  value: string;
  created_at: string;
};

export type PasswordEntrySummary = {
  id: string;
  title: string;
  created_at: string;
};

type SecretResponse = { success: boolean; data: PasswordEntry };
type SummaryResponse = { success: boolean; data: PasswordEntrySummary };

// ─── Password entries API calls ───────────────────────────────────────────────

export const getPasswords = () =>
  authenticatedRequest<{ success: boolean; data: PasswordEntrySummary[] }>(
    "/api/passwords",
  );

export const getPasswordSecret = (id: string) =>
  authenticatedRequest<SecretResponse>(`/api/passwords/${id}/secret`);

export const deletePassword = (id: string) =>
  authenticatedRequest<{ success: boolean }>(`/api/passwords/${id}`, {
    method: "DELETE",
  });

// ─── v2 API calls (ciphertext fields — backend is blind storage) ──────────────

/**
 * Body for v2 POST / PATCH.
 * key_ and value_ are pre-encrypted ciphertext strings produced by encryptField().
 * The backend never decrypts them; it stores them opaquely.
 */
export type V2PasswordBody = {
  title: string;
  /** Encrypted ciphertext: "<nonce_b64url>.<ciphertext_b64url>" */
  key_: string;
  /** Encrypted ciphertext: "<nonce_b64url>.<ciphertext_b64url>" */
  value_: string;
};

export type V2PasswordPatchBody = Partial<V2PasswordBody> & { title?: string };

/**
 * POST /api/passwords
 * Sends pre-encrypted key_/value_ ciphertext; backend stores blindly.
 */
export const createPasswordV2 = (body: V2PasswordBody) =>
  authenticatedRequest<SummaryResponse>("/api/passwords", {
    method: "POST",
    body,
  });

/**
 * PATCH /api/passwords/:id
 * Sends pre-encrypted key_/value_ ciphertext for changed fields only.
 */
export const updatePasswordV2 = (id: string, body: V2PasswordPatchBody) =>
  authenticatedRequest<SummaryResponse>(`/api/passwords/${id}`, {
    method: "PATCH",
    body,
  });

// ─── Vault metadata types ─────────────────────────────────────────────────────

export type UserVaultMetadata = {
  vault_version: "v2";
  kdf_salt: string | null;
  kdf_params: {
    opslimit: number;
    memlimit: number;
    algo: number;
  } | null;
  wrapped_dek: string | null;
  wrapped_dek_nonce: string | null;
  recovery_kdf_salt?: string | null;
  recovery_kdf_params?: {
    opslimit: number;
    memlimit: number;
    algo: number;
  } | null;
  recovery_wrapped_dek?: string | null;
  recovery_wrapped_dek_nonce?: string | null;
};

export const getUserVaultMetadata = () =>
  authenticatedRequest<{ success: boolean; data: UserVaultMetadata }>(
    "/api/passwords/metadata",
  );

/** Body sent to POST /api/passwords/vault/init */
export type VaultInitPayload = {
  kdf_salt: string;
  kdf_params: {
    opslimit: number;
    memlimit: number;
    algo: number;
  };
  wrapped_dek: string;
  wrapped_dek_nonce: string;
  recovery_kdf_salt?: string;
  recovery_kdf_params?: {
    opslimit: number;
    memlimit: number;
    algo: number;
  };
  recovery_wrapped_dek?: string;
  recovery_wrapped_dek_nonce?: string;
};

export type VaultRecoveryPayload = {
  recovery_kdf_salt: string;
  recovery_kdf_params: {
    opslimit: number;
    memlimit: number;
    algo: number;
  };
  recovery_wrapped_dek: string;
  recovery_wrapped_dek_nonce: string;
};

export const setVaultRecoveryMetadata = (body: VaultRecoveryPayload) =>
  authenticatedRequest<{ success: boolean }>("/api/passwords/vault/recovery", {
    method: "POST",
    body,
  });

export type VaultInitResult = {
  alreadyInitialized: boolean;
  vault_version: "v2";
};

/**
 * Upload only the wrapped DEK (ciphertext) and KDF metadata to the backend.
 * The plaintext DEK, KEK, and account password are NEVER included in this request.
 */
export const initializeVault = (body: VaultInitPayload) =>
  authenticatedRequest<{ success: boolean; data: VaultInitResult }>(
    "/api/passwords/vault/init",
    { method: "POST", body },
  );
