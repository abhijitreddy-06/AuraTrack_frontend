import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
  ReactNode,
} from "react";
import { AppState, AppStateStatus } from "react-native";
import {
  deriveKEK,
  generateDEK,
  generateSalt,
  getDefaultKdfParams,
  unwrapDEK,
  wipeBytes,
  wrapDEK,
  encryptField,
  decryptField,
  VaultCryptoError,
  generateRecoveryKey,
  normalizeRecoveryKey,
} from "../services/crypto/vaultCrypto";
import {
  getUserVaultMetadata,
  initializeVault,
  setVaultRecoveryMetadata,
  startVaultMigration,
  exportV1EntriesForMigration,
  uploadMigratedEntries,
  completeVaultMigration,
  MigrationUploadEntry,
  UserVaultMetadata,
} from "../services/passwords";
import {
  getSessionUser,
  setSessionUserVaultVersion,
  setSessionUserAppLockEnabled,
} from "../services/auth";
import { updateAppLockPreference } from "../services/settings";
import { useAppLock } from "./useAppLock";
import {
  isBiometricSupported,
  authenticateBiometric,
  saveBiometricDEK,
  getBiometricDEK,
  removeBiometricDEK,
  hasStoredBiometricDEK,
} from "../services/crypto/vaultBiometrics";

interface VaultContextValue {
  vaultVersion: "v1" | "v2";
  migrationStatus: "not_started" | "in_progress" | "completed";
  isUnlocked: boolean;
  isLoading: boolean;
  metadata: UserVaultMetadata | null;
  /** KEK held in a ref — exposed for debugging/testing only; do not persist. */
  kek: Uint8Array | null;
  /** Unwrapped DEK held in a ref — available once vault is unlocked. */
  dek: Uint8Array | null;
  error: string | null;
  /** Whether the device hardware supports biometrics and app lock is enabled. */
  isBiometricAvailable: boolean;
  /** Whether a valid biometric DEK is stored in SecureStore for the active user. */
  hasBiometricSetup: boolean;
  /** One-time recovery key generated during v2 init or migration. */
  pendingRecoveryKey: string | null;
  loadMetadata: () => Promise<UserVaultMetadata | null>;
  unlockVaultWithPassword: (password: string) => Promise<boolean>;
  unlockVaultWithBiometrics: () => Promise<boolean>;
  unlockVaultWithRecoveryKey: (recoveryKey: string) => Promise<boolean>;
  clearPendingRecoveryKey: () => void;
  enableBiometricUnlock: () => Promise<boolean>;
  disableBiometricUnlock: () => Promise<boolean>;
  migrateVault: (
    password: string,
    onProgress?: (percent: number, stepText: string) => void,
  ) => Promise<boolean>;
  lockVault: () => void;
  clearError: () => void;
}

const VaultContext = createContext<VaultContextValue | undefined>(undefined);

export const VaultProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const appLock = useAppLock();
  const [vaultVersion, setVaultVersion] = useState<"v1" | "v2">("v1");
  const [migrationStatus, setMigrationStatus] = useState<
    "not_started" | "in_progress" | "completed"
  >("not_started");
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [metadata, setMetadata] = useState<UserVaultMetadata | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [isBiometricAvailable, setIsBiometricAvailable] = useState(false);
  const [hasBiometricSetup, setHasBiometricSetup] = useState(false);
  const [pendingRecoveryKey, setPendingRecoveryKey] = useState<string | null>(
    null,
  );

  // Keys are stored in refs, not state, to avoid triggering re-renders on
  // every crypto operation and to make them harder to accidentally leak into
  // the React DevTools component tree.
  const kekRef = useRef<Uint8Array | null>(null);
  const dekRef = useRef<Uint8Array | null>(null);

  // ─── Lock ──────────────────────────────────────────────────────────────────

  const lockVault = useCallback(() => {
    wipeBytes(kekRef.current);
    kekRef.current = null;
    wipeBytes(dekRef.current);
    dekRef.current = null;
    setIsUnlocked(false);
    setPendingRecoveryKey(null);
  }, []);

  const clearPendingRecoveryKey = useCallback(() => {
    setPendingRecoveryKey(null);
  }, []);

  // ─── AppLock & Backgrounding Integration ────────────────────────────────────

  // 1. When AppLock locks (e.g. timeout or manual lock), wipe in-memory keys
  useEffect(() => {
    if (appLock.isLocked && vaultVersion === "v2") {
      lockVault();
    }
  }, [appLock.isLocked, vaultVersion, lockVault]);

  // 2. AppState change: when app is backgrounded or inactive while App Lock is enabled,
  // wipe in-memory keys immediately. The SecureStore copy remains for biometric re-unlock.
  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (
        (nextState === "inactive" || nextState === "background") &&
        vaultVersion === "v2" &&
        appLock.isEnabled
      ) {
        lockVault();
      }
    };

    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange,
    );
    return () => {
      subscription.remove();
    };
  }, [appLock.isEnabled, vaultVersion, lockVault]);

  // ─── Check Biometric Status ────────────────────────────────────────────────

  const refreshBiometricStatus = useCallback(async (userId?: string) => {
    try {
      const supported = await isBiometricSupported();
      const sessionUser = userId ? { id: userId } : await getSessionUser();
      const activeId = sessionUser?.id;

      if (!activeId) {
        setIsBiometricAvailable(false);
        setHasBiometricSetup(false);
        return;
      }

      setIsBiometricAvailable(supported);
      const hasKey = await hasStoredBiometricDEK(activeId);
      setHasBiometricSetup(hasKey && supported);
    } catch {
      setIsBiometricAvailable(false);
      setHasBiometricSetup(false);
    }
  }, []);

  // ─── Load metadata ─────────────────────────────────────────────────────────

  const loadMetadata =
    useCallback(async (): Promise<UserVaultMetadata | null> => {
      setIsLoading(true);
      setError(null);
      try {
        const sessionUser = await getSessionUser();
        const sessionVersion = sessionUser?.vault_version ?? "v1";

        const res = await getUserVaultMetadata();
        const meta = res.data;
        setMetadata(meta);

        const effectiveVersion = meta.vault_version ?? sessionVersion;
        setVaultVersion(effectiveVersion);
        setMigrationStatus(meta.migration_status ?? "not_started");

        // v1 users don't need client-side key derivation — mark them unlocked.
        if (effectiveVersion === "v1") {
          setIsUnlocked(true);
        }

        await refreshBiometricStatus(sessionUser?.id);
        return meta;
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Failed to load vault metadata";
        setError(msg);
        return null;
      } finally {
        setIsLoading(false);
      }
    }, [refreshBiometricStatus]);

  // ─── Unlock with Password (Phase 2 + Phase 3) ──────────────────────────────

  /**
   * Unlock the vault with the user's account password.
   *
   * Phase 2 path (already-initialized v2 vault):
   *   password → Argon2id → KEK → unwrap wrapped_dek → DEK in memory
   *
   * Phase 3 path (first-time v2 vault init, no wrapped_dek yet):
   *   password → Argon2id → KEK
   *   generate random DEK
   *   wrap DEK with KEK → wrapped_dek + nonce
   *   POST /api/passwords/vault/init (only ciphertext, never plaintext DEK)
   *   DEK stays in memory
   *
   * Phase 7 addition:
   *   If app_lock_enabled is true, the unwrapped DEK is automatically saved
   *   to SecureStore for future biometric unlocks.
   */
  const unlockVaultWithPassword = useCallback(
    async (password: string): Promise<boolean> => {
      if (!password) {
        setError("Password cannot be empty");
        return false;
      }

      setIsLoading(true);
      setError(null);

      try {
        let currentMeta = metadata;
        if (!currentMeta) {
          currentMeta = await loadMetadata();
        }

        if (!currentMeta) {
          throw new VaultCryptoError(
            "Could not fetch vault metadata from server",
            "INIT_FAILED",
          );
        }

        // ── v1 fast path (existing v1 users who have not migrated) ────────
        // A brand-new user starts with vault_version='v1' and kdf_salt=null.
        // That user must be initialized as v2 immediately — NOT treated as
        // a legacy v1 user. Distinguish by presence of kdf_salt:
        //   kdf_salt IS NULL   → never set up → do v2 init below
        //   kdf_salt NOT NULL  → genuine v1 with server-side encryption → fast path
        if (
          currentMeta.vault_version === "v1" &&
          currentMeta.kdf_salt !== null
        ) {
          setIsUnlocked(true);
          return true;
        }

        // New user (vault_version='v1', kdf_salt=null) falls through to v2 init.
        // After initializeVault() the backend flips their vault_version to 'v2'.

        // ── v2: ensure we have KDF metadata ────────────────────────────────
        // Existing v2 users: kdf_salt/params come from the backend.
        // Brand-new users (kdf_salt=null): generate them now client-side.
        // The generated salt is sent to the backend in initializeVault().
        let kdfSalt = currentMeta.kdf_salt;
        let kdfParams = currentMeta.kdf_params;

        if (!kdfSalt || !kdfParams) {
          kdfSalt = await generateSalt();
          kdfParams = await getDefaultKdfParams();
        }

        // Step 1 — Derive KEK via Argon2id (password never leaves this function).
        const derivedKek = await deriveKEK(password, kdfSalt, kdfParams);

        // Replace any stale KEK in memory.
        wipeBytes(kekRef.current);
        kekRef.current = derivedKek;

        const sessionUser = await getSessionUser();

        // Step 2a — If wrapped_dek already exists, unwrap it (Phase 2 path).
        if (currentMeta.wrapped_dek && currentMeta.wrapped_dek_nonce) {
          let unwrapped: Uint8Array;
          try {
            unwrapped = await unwrapDEK(
              currentMeta.wrapped_dek,
              currentMeta.wrapped_dek_nonce,
              derivedKek,
            );
          } catch (unwrapErr) {
            wipeBytes(derivedKek);
            kekRef.current = null;
            throw unwrapErr;
          }
          wipeBytes(dekRef.current);
          dekRef.current = unwrapped;
          setIsUnlocked(true);

          // Phase 8: If vault has no recovery key yet, generate and register one now
          if (
            !currentMeta.recovery_wrapped_dek ||
            !currentMeta.recovery_kdf_salt
          ) {
            try {
              const { formattedKey, normalizedKey } =
                await generateRecoveryKey();
              const recSalt = await generateSalt();
              const recParams = await getDefaultKdfParams();
              const recKek = await deriveKEK(normalizedKey, recSalt, recParams);
              const recWrapped = await wrapDEK(unwrapped, recKek);
              wipeBytes(recKek);

              await setVaultRecoveryMetadata({
                recovery_kdf_salt: recSalt,
                recovery_kdf_params: recParams,
                recovery_wrapped_dek: recWrapped.wrappedDek,
                recovery_wrapped_dek_nonce: recWrapped.nonce,
              });
              setPendingRecoveryKey(formattedKey);
            } catch {
              // Non-fatal if server update fails, unlock remains successful
            }
          }

          // Phase 7: Store DEK in SecureStore if app lock is enabled
          if (sessionUser?.id && sessionUser.app_lock_enabled) {
            await saveBiometricDEK(sessionUser.id, unwrapped);
            setHasBiometricSetup(true);
          }
          return true;
        }

        // Step 2b — No wrapped_dek yet: first-time Phase 3/8 init.
        let freshDek: Uint8Array | null = null;
        let recoveryKek: Uint8Array | null = null;
        try {
          freshDek = await generateDEK();

          const { wrappedDek, nonce } = await wrapDEK(freshDek, derivedKek);

          // Phase 8: Generate recovery key and wrap DEK with recovery KEK
          const { formattedKey, normalizedKey } = await generateRecoveryKey();
          const recSalt = await generateSalt();
          const recParams = await getDefaultKdfParams();
          recoveryKek = await deriveKEK(normalizedKey, recSalt, recParams);
          const recWrapped = await wrapDEK(freshDek, recoveryKek);
          wipeBytes(recoveryKek);
          recoveryKek = null;

          await initializeVault({
            kdf_salt: kdfSalt,
            kdf_params: kdfParams,
            wrapped_dek: wrappedDek,
            wrapped_dek_nonce: nonce,
            recovery_kdf_salt: recSalt,
            recovery_kdf_params: recParams,
            recovery_wrapped_dek: recWrapped.wrappedDek,
            recovery_wrapped_dek_nonce: recWrapped.nonce,
          });

          // Expose recovery key for exact one-time display in UI
          setPendingRecoveryKey(formattedKey);

          wipeBytes(dekRef.current);
          dekRef.current = freshDek;
          freshDek = null; // ownership transferred to dekRef
        } catch (initErr) {
          wipeBytes(recoveryKek);
          recoveryKek = null;
          wipeBytes(freshDek);
          freshDek = null;
          wipeBytes(derivedKek);
          kekRef.current = null;
          throw initErr;
        }

        setIsUnlocked(true);

        // Phase 7: Store DEK in SecureStore if app lock is enabled
        if (sessionUser?.id && sessionUser.app_lock_enabled && dekRef.current) {
          await saveBiometricDEK(sessionUser.id, dekRef.current);
          setHasBiometricSetup(true);
        }
        return true;
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Failed to unlock vault";
        setError(msg);
        lockVault();
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [metadata, loadMetadata, lockVault],
  );

  // ─── Phase 8: Unlock with Recovery Key ──────────────────────────────────────

  /**
   * Unlock v2 vault using the emergency 64-character recovery key.
   *
   * 1. Validate / normalize recovery key format (strips hyphens & whitespace).
   * 2. Derive recovery KEK via Argon2id using recovery_kdf_salt and params.
   * 3. Unwrap recovery_wrapped_dek using recovery_wrapped_dek_nonce.
   * 4. Zeroize recovery KEK immediately.
   * 5. Store unwrapped DEK in memory ref only and mark vault unlocked.
   */
  const unlockVaultWithRecoveryKey = useCallback(
    async (recoveryKeyInput: string): Promise<boolean> => {
      if (!recoveryKeyInput || !recoveryKeyInput.trim()) {
        setError("Recovery key cannot be empty");
        return false;
      }

      setIsLoading(true);
      setError(null);

      let recKek: Uint8Array | null = null;
      let unwrapped: Uint8Array | null = null;

      try {
        let currentMeta = metadata;
        if (!currentMeta) {
          currentMeta = await loadMetadata();
        }

        if (!currentMeta) {
          throw new VaultCryptoError(
            "Could not fetch vault metadata from server",
            "INIT_FAILED",
          );
        }

        if (currentMeta.vault_version === "v1") {
          setIsUnlocked(true);
          return true;
        }

        if (
          !currentMeta.recovery_kdf_salt ||
          !currentMeta.recovery_kdf_params ||
          !currentMeta.recovery_wrapped_dek ||
          !currentMeta.recovery_wrapped_dek_nonce
        ) {
          throw new VaultCryptoError(
            "No recovery key has been configured for this vault.",
            "INVALID_PARAMS",
          );
        }

        const normalized = normalizeRecoveryKey(recoveryKeyInput);
        recKek = await deriveKEK(
          normalized,
          currentMeta.recovery_kdf_salt,
          currentMeta.recovery_kdf_params,
        );

        unwrapped = await unwrapDEK(
          currentMeta.recovery_wrapped_dek,
          currentMeta.recovery_wrapped_dek_nonce,
          recKek,
        );

        wipeBytes(recKek);
        recKek = null;

        wipeBytes(dekRef.current);
        dekRef.current = unwrapped;
        unwrapped = null;
        setIsUnlocked(true);

        const sessionUser = await getSessionUser();
        if (sessionUser?.id && sessionUser.app_lock_enabled && dekRef.current) {
          await saveBiometricDEK(sessionUser.id, dekRef.current);
          setHasBiometricSetup(true);
        }

        return true;
      } catch (err) {
        wipeBytes(recKek);
        recKek = null;
        wipeBytes(unwrapped);
        unwrapped = null;
        const msg =
          err instanceof VaultCryptoError && err.code === "UNWRAP_FAILED"
            ? "Invalid recovery key. Please check and try again."
            : err instanceof Error
              ? err.message
              : "Failed to unlock vault with recovery key";
        setError(msg);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [metadata, loadMetadata],
  );

  // ─── Phase 7: Biometric Unlock Flow ────────────────────────────────────────

  /**
   * Unlock v2 vault using biometric authentication.
   *
   * 1. Check current account is v2 (v1 bypasses client DEK).
   * 2. Confirm biometric hardware & enrollment.
   * 3. Prompt device biometric authentication.
   * 4. Retrieve & strictly validate 32-byte DEK from SecureStore.
   * 5. Set DEK in memory only and mark vault unlocked.
   */
  const unlockVaultWithBiometrics = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const sessionUser = await getSessionUser();
      if (!sessionUser?.id) {
        throw new Error("No active user session found. Please log in.");
      }

      let currentMeta = metadata;
      if (!currentMeta) {
        currentMeta = await loadMetadata();
      }

      // v1 compatibility: bypass client-side DEK
      if (currentMeta?.vault_version === "v1") {
        setIsUnlocked(true);
        return true;
      }

      const supported = await isBiometricSupported();
      if (!supported) {
        setError(
          "Biometric authentication is not supported or enrolled on this device.",
        );
        return false;
      }

      // Prompt OS biometric authentication
      const authenticated = await authenticateBiometric(
        "Unlock Password Vault",
      );
      if (!authenticated) {
        // Cancelled or authentication failed — remain locked, allow password entry
        return false;
      }

      // Retrieve and strictly validate DEK from SecureStore
      const storedDek = await getBiometricDEK(sessionUser.id);
      if (!storedDek || storedDek.length !== 32) {
        setError(
          "Biometric key not found or corrupted. Please unlock with your password.",
        );
        setHasBiometricSetup(false);
        return false;
      }

      // Store in memory ref only — DEK is never exposed or logged
      wipeBytes(dekRef.current);
      dekRef.current = storedDek;
      setIsUnlocked(true);
      setHasBiometricSetup(true);
      return true;
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Biometric unlock failed";
      setError(msg);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [metadata, loadMetadata]);

  // ─── Phase 7: Enable / Disable Biometric Unlock ────────────────────────────

  const enableBiometricUnlock = useCallback(async (): Promise<boolean> => {
    try {
      const sessionUser = await getSessionUser();
      if (!sessionUser?.id) return false;

      const supported = await isBiometricSupported();
      if (!supported) {
        setError("Biometrics not supported or enrolled on this device.");
        return false;
      }

      const authenticated = await authenticateBiometric(
        "Enable Biometric Unlock",
      );
      if (!authenticated) return false;

      if (!dekRef.current || dekRef.current.length !== 32) {
        setError(
          "Vault must be unlocked with password before enabling biometric unlock.",
        );
        return false;
      }

      const saved = await saveBiometricDEK(sessionUser.id, dekRef.current);
      if (!saved) {
        setError("Failed to save biometric key to SecureStore.");
        return false;
      }

      await updateAppLockPreference(true);
      await setSessionUserAppLockEnabled(true);
      setHasBiometricSetup(true);
      setIsBiometricAvailable(true);
      return true;
    } catch {
      return false;
    }
  }, []);

  const disableBiometricUnlock = useCallback(async (): Promise<boolean> => {
    try {
      const sessionUser = await getSessionUser();
      if (sessionUser?.id) {
        await removeBiometricDEK(sessionUser.id);
      }
      setHasBiometricSetup(false);
      return true;
    } catch {
      return false;
    }
  }, []);

  // ─── Phase 6: Vault Migration Flow ─────────────────────────────────────────

  const migrateVault = useCallback(
    async (
      password: string,
      onProgress?: (percent: number, stepText: string) => void,
    ): Promise<boolean> => {
      if (!password) {
        setError("Password cannot be empty");
        return false;
      }

      setIsLoading(true);
      setError(null);

      let activeKek: Uint8Array | null = null;
      let activeDek: Uint8Array | null = null;

      try {
        onProgress?.(10, "Deriving encryption keys...");

        const res = await getUserVaultMetadata();
        const currentMeta = res.data;
        setMetadata(currentMeta);

        if (currentMeta.vault_version === "v2") {
          throw new Error("Vault is already upgraded to v2.");
        }

        let salt = currentMeta.kdf_salt;
        let params = currentMeta.kdf_params;
        let wrappedDek = currentMeta.wrapped_dek;
        let wrappedDekNonce = currentMeta.wrapped_dek_nonce;

        if (!salt || !params) {
          salt = await generateSalt();
          params = await getDefaultKdfParams();
        }

        activeKek = await deriveKEK(password, salt, params);

        let generatedRecoveryKey: string | null = null;
        let recSalt = currentMeta.recovery_kdf_salt;
        let recParams = currentMeta.recovery_kdf_params;
        let recWrappedDek = currentMeta.recovery_wrapped_dek;
        let recWrappedDekNonce = currentMeta.recovery_wrapped_dek_nonce;

        if (wrappedDek && wrappedDekNonce) {
          try {
            activeDek = await unwrapDEK(wrappedDek, wrappedDekNonce, activeKek);
          } catch {
            throw new VaultCryptoError(
              "Failed to unwrap existing migration key. Please check your password.",
              "UNWRAP_FAILED",
            );
          }
        } else {
          activeDek = await generateDEK();
          const wrapped = await wrapDEK(activeDek, activeKek);
          wrappedDek = wrapped.wrappedDek;
          wrappedDekNonce = wrapped.nonce;
        }

        onProgress?.(25, "Securing emergency recovery key...");

        if (!recWrappedDek || !recSalt || !recParams) {
          const { formattedKey, normalizedKey } = await generateRecoveryKey();
          generatedRecoveryKey = formattedKey;
          recSalt = await generateSalt();
          recParams = await getDefaultKdfParams();
          const recKek = await deriveKEK(normalizedKey, recSalt, recParams);
          const recWrapped = await wrapDEK(activeDek, recKek);
          wipeBytes(recKek);
          recWrappedDek = recWrapped.wrappedDek;
          recWrappedDekNonce = recWrapped.nonce;
        }

        onProgress?.(35, "Registering vault migration session...");

        // Always call startVaultMigration to ensure backend sets migration_status = 'in_progress'
        const startRes = await startVaultMigration({
          kdf_salt: salt,
          kdf_params: params,
          wrapped_dek: wrappedDek,
          wrapped_dek_nonce: wrappedDekNonce,
          recovery_kdf_salt: recSalt,
          recovery_kdf_params: recParams,
          recovery_wrapped_dek: recWrappedDek,
          recovery_wrapped_dek_nonce: recWrappedDekNonce,
        });

        if (startRes.data.alreadyStarted) {
          // Re-derive if server had an authoritative earlier salt/dek
          if (startRes.data.kdf_salt !== salt) {
            wipeBytes(activeKek);
            activeKek = await deriveKEK(
              password,
              startRes.data.kdf_salt,
              startRes.data.kdf_params,
            );
          }
          if (startRes.data.wrapped_dek !== wrappedDek) {
            wipeBytes(activeDek);
            activeDek = await unwrapDEK(
              startRes.data.wrapped_dek,
              startRes.data.wrapped_dek_nonce,
              activeKek,
            );
          }
        }

        onProgress?.(45, "Retrieving saved passwords for encryption...");

        const exportRes = await exportV1EntriesForMigration();
        const entries = exportRes.data;
        const unmigrated = entries.filter((e) => !e.already_migrated);

        onProgress?.(
          50,
          `Encrypting ${unmigrated.length} passwords on your device...`,
        );

        const entriesToUpload: MigrationUploadEntry[] = [];
        for (let i = 0; i < unmigrated.length; i++) {
          const item = unmigrated[i];
          if (item.key === null || item.value === null) {
            continue;
          }

          const encKey = await encryptField(item.key, activeDek);
          const encVal = await encryptField(item.value, activeDek);

          const decKey = await decryptField(encKey, activeDek);
          const decVal = await decryptField(encVal, activeDek);
          if (decKey !== item.key || decVal !== item.value) {
            throw new VaultCryptoError(
              "Local verification failed for re-encrypted password",
              "DECRYPT_FAILED",
            );
          }

          entriesToUpload.push({
            id: item.id,
            key_: encKey,
            value_: encVal,
          });

          const pct =
            50 + Math.round(((i + 1) / Math.max(unmigrated.length, 1)) * 30);
          onProgress?.(
            pct,
            `Encrypting passwords (${i + 1}/${unmigrated.length})...`,
          );
        }

        onProgress?.(85, "Saving encrypted passwords...");

        if (entriesToUpload.length > 0) {
          await uploadMigratedEntries(entriesToUpload);
        }

        onProgress?.(95, "Finalizing vault security upgrade...");

        await completeVaultMigration();

        if (generatedRecoveryKey) {
          setPendingRecoveryKey(generatedRecoveryKey);
        }

        await setSessionUserVaultVersion("v2");
        setVaultVersion("v2");
        setMigrationStatus("completed");
        setIsUnlocked(true);

        wipeBytes(kekRef.current);
        kekRef.current = activeKek;
        activeKek = null;

        wipeBytes(dekRef.current);
        dekRef.current = activeDek;
        activeDek = null;

        // Phase 7: Save DEK to SecureStore if app lock is enabled
        const sessionUser = await getSessionUser();
        if (sessionUser?.id && sessionUser.app_lock_enabled && dekRef.current) {
          await saveBiometricDEK(sessionUser.id, dekRef.current);
          setHasBiometricSetup(true);
        }

        await loadMetadata();
        onProgress?.(100, "Vault upgraded successfully!");
        return true;
      } catch (err) {
        wipeBytes(activeKek);
        wipeBytes(activeDek);
        const msg = err instanceof Error ? err.message : "Migration failed";
        setError(msg);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [loadMetadata],
  );

  // ─── Helpers ───────────────────────────────────────────────────────────────

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Wipe keys from memory when the provider unmounts (e.g. user logs out).
  useEffect(() => {
    return () => {
      lockVault();
    };
  }, [lockVault]);

  // ─── Provider ──────────────────────────────────────────────────────────────

  return (
    <VaultContext.Provider
      value={{
        vaultVersion,
        migrationStatus,
        isUnlocked,
        isLoading,
        metadata,
        kek: kekRef.current,
        dek: dekRef.current,
        error,
        isBiometricAvailable,
        hasBiometricSetup,
        pendingRecoveryKey,
        loadMetadata,
        unlockVaultWithPassword,
        unlockVaultWithBiometrics,
        unlockVaultWithRecoveryKey,
        clearPendingRecoveryKey,
        enableBiometricUnlock,
        disableBiometricUnlock,
        migrateVault,
        lockVault,
        clearError,
      }}
    >
      {children}
    </VaultContext.Provider>
  );
};

export const useVault = (): VaultContextValue => {
  const context = useContext(VaultContext);
  if (!context) {
    throw new Error("useVault must be used within a VaultProvider");
  }
  return context;
};
