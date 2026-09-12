/**
 * App entry point.
 *
 * react-native-get-random-values MUST be the very first import.
 * It patches globalThis.crypto.getRandomValues using the platform's
 * native CSPRNG (SecureRandom on Android, SecRandomCopyBytes on iOS).
 *
 * libsodium-wrappers-sumo requires this shim to exist before its WASM
 * module initialises — without it the app crashes on Hermes with:
 *   "globalThis.crypto.getRandomValues is not available"
 */
import "react-native-get-random-values";

// Chain into the standard expo-router entry point.
import "expo-router/entry";
