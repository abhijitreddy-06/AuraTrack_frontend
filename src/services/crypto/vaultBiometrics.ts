import * as SecureStore from "expo-secure-store";
import * as LocalAuthentication from "expo-local-authentication";
import { encodeDEK, decodeAndValidateDEK } from "./vaultCrypto";

const BIOMETRIC_DEK_PREFIX = "auratrack.vault.dek.";

/**
 * Returns the user-specific SecureStore key for storing the biometric DEK.
 * Namespacing by user ID ensures DEKs are never shared or collided across accounts.
 */
export const getBiometricDekKey = (userId: string): string => {
  return `${BIOMETRIC_DEK_PREFIX}${userId}`;
};

/**
 * Checks if the current device possesses biometric hardware and has enrolled biometrics.
 */
export const isBiometricSupported = async (): Promise<boolean> => {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) return false;
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    return isEnrolled;
  } catch {
    return false;
  }
};

/**
 * Prompts the user for biometric or device authentication.
 *
 * @param promptMessage Descriptive message shown in the OS authentication dialog.
 * @returns true if authentication was successful, false otherwise.
 */
export const authenticateBiometric = async (
  promptMessage = "Unlock Password Vault",
): Promise<boolean> => {
  try {
    const supported = await isBiometricSupported();
    if (!supported) return false;

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      cancelLabel: "Cancel",
      disableDeviceFallback: false,
    });
    return result.success;
  } catch {
    return false;
  }
};

/**
 * Stores the 32-byte DEK into SecureStore for the given user.
 *
 * Security rules:
 * - Only the DEK is stored (encoded as base64url).
 * - Password and KEK are NEVER stored.
 * - Namespaced per user ID so account switches cannot reuse the key.
 */
export const saveBiometricDEK = async (
  userId: string,
  dek: Uint8Array,
): Promise<boolean> => {
  if (!userId || !dek || dek.length !== 32) return false;
  try {
    const encoded = await encodeDEK(dek);
    const key = getBiometricDekKey(userId);
    await SecureStore.setItemAsync(key, encoded, {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
    });
    return true;
  } catch {
    return false;
  }
};

/**
 * Retrieves and strictly validates the DEK from SecureStore for the given user.
 *
 * Security rules:
 * - Decodes the stored base64url string.
 * - Validates that the decoded buffer is exactly 32 bytes.
 * - If missing, corrupted, or malformed, safely removes the invalid record and returns null.
 */
export const getBiometricDEK = async (
  userId: string,
): Promise<Uint8Array | null> => {
  if (!userId) return null;
  const key = getBiometricDekKey(userId);
  try {
    const encoded = await SecureStore.getItemAsync(key);
    if (!encoded) return null;

    return await decodeAndValidateDEK(encoded);
  } catch {
    // Malformed or corrupted DEK in SecureStore — purge it safely
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      // Ignore deletion failure
    }
    return null;
  }
};

/**
 * Removes the biometric DEK from SecureStore for the given user.
 * Called when disabling biometric unlock or during account logout.
 */
export const removeBiometricDEK = async (userId: string): Promise<void> => {
  if (!userId) return;
  const key = getBiometricDekKey(userId);
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    // Ignore deletion errors if key does not exist
  }
};

/**
 * Checks whether a biometric DEK is already saved in SecureStore for the given user.
 */
export const hasStoredBiometricDEK = async (
  userId: string,
): Promise<boolean> => {
  if (!userId) return false;
  const key = getBiometricDekKey(userId);
  try {
    const item = await SecureStore.getItemAsync(key);
    return Boolean(item);
  } catch {
    return false;
  }
};
