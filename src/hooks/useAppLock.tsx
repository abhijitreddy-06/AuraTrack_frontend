import * as LocalAuthentication from "expo-local-authentication";
import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  AppState,
  AppStateStatus,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "./useTheme";
import { spacing } from "../theme/spacing";
import { typography } from "../theme/typography";
import { updateAppLockPreference } from "../services/settings";
import {
  setSessionUserAppLockEnabled,
  type SessionUser,
} from "../services/auth";

const BACKGROUND_TIMEOUT_MS = 2 * 60 * 1000;

interface AppLockContextValue {
  isEnabled: boolean;
  isLocked: boolean;
  initializeForUser: (user: SessionUser | null) => void;
  setEnabled: (enabled: boolean) => Promise<boolean>;
  clearForLogout: () => void;
  authenticate: () => Promise<boolean>;
}

const AppLockContext = createContext<AppLockContextValue | undefined>(
  undefined,
);

export const AppLockProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const { colors } = useTheme();
  const [isEnabled, setIsEnabled] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const userIdRef = useRef<string | null>(null);
  const enabledRef = useRef(false);
  const lockedRef = useRef(false);
  const isAuthenticating = useRef(false);
  const backgroundedAt = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const appState = useRef<AppStateStatus>(AppState.currentState);

  const clearTimer = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const lock = useCallback(() => {
    lockedRef.current = true;
    setIsLocked(true);
  }, []);

  const authenticate = useCallback(async () => {
    if (isAuthenticating.current) return false;
    isAuthenticating.current = true;
    try {
      if (!(await LocalAuthentication.hasHardwareAsync())) return false;
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Unlock AuraTrack",
        cancelLabel: "Cancel",
        disableDeviceFallback: false,
      });
      if (result.success) {
        lockedRef.current = false;
        setIsLocked(false);
      }
      return result.success;
    } catch {
      return false;
    } finally {
      isAuthenticating.current = false;
    }
  }, []);

  const initializeForUser = useCallback(
    (user: SessionUser | null) => {
      clearTimer();
      backgroundedAt.current = null;
      const isNewSession = user?.id !== userIdRef.current;
      userIdRef.current = user?.id ?? null;
      const enabled = user?.app_lock_enabled === true;
      enabledRef.current = enabled;
      setIsEnabled(enabled);
      // A fresh authenticated session is locked when the app was terminated.
      // The effect below opens the device prompt after the lock screen is rendered.
      if (isNewSession && enabled) {
        lock();
      } else if (!enabled) {
        lockedRef.current = false;
        setIsLocked(false);
      }
    },
    [authenticate, clearTimer, lock],
  );

  const clearForLogout = useCallback(() => {
    clearTimer();
    backgroundedAt.current = null;
    userIdRef.current = null;
    enabledRef.current = false;
    lockedRef.current = false;
    setIsEnabled(false);
    setIsLocked(false);
  }, [clearTimer]);

  const setEnabled = useCallback(
    async (enabled: boolean) => {
      if (!userIdRef.current) return false;
      if (enabled && !(await authenticate())) return false;

      try {
        await updateAppLockPreference(enabled);
        await setSessionUserAppLockEnabled(enabled);
        enabledRef.current = enabled;
        setIsEnabled(enabled);
        if (!enabled) {
          clearTimer();
          backgroundedAt.current = null;
          lockedRef.current = false;
          setIsLocked(false);
        }
        return true;
      } catch {
        return false;
      }
    },
    [authenticate, clearTimer],
  );

  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (!enabledRef.current) return;

      const previousState = appState.current;
      appState.current = nextState;

      // Locking the phone changes the app to inactive before it is backgrounded.
      // React Native cannot distinguish that event from every other interruption,
      // so locking here also keeps protected content hidden during interruptions.
      if (
        (nextState === "inactive" && previousState === "active") ||
        (nextState === "background" && previousState !== "background")
      ) {
        lock();
      }

      if (nextState === "background" && previousState !== "background") {
        backgroundedAt.current = Date.now();
        clearTimer();
        timer.current = setTimeout(lock, BACKGROUND_TIMEOUT_MS);
      } else if (nextState === "active" && backgroundedAt.current !== null) {
        const elapsed = Date.now() - backgroundedAt.current;
        clearTimer();
        if (elapsed >= BACKGROUND_TIMEOUT_MS) lock();
        backgroundedAt.current = null;
      }

      if (nextState === "active" && lockedRef.current) {
        void authenticate();
      }
    };

    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange,
    );
    return () => {
      subscription.remove();
      clearTimer();
    };
  }, [authenticate, clearTimer, lock]);

  useEffect(() => {
    if (!isLocked || !enabledRef.current || isAuthenticating.current) return;

    // Wait until the lock screen has been committed. This makes the Android/iOS
    // biometric prompt reliably appear immediately after the splash animation.
    const frame = requestAnimationFrame(() => void authenticate());
    return () => cancelAnimationFrame(frame);
  }, [authenticate, isLocked]);

  return (
    <AppLockContext.Provider
      value={{
        isEnabled,
        isLocked,
        initializeForUser,
        setEnabled,
        clearForLogout,
        authenticate,
      }}
    >
      {children}
      {isLocked && (
        <View
          style={[styles.lockScreen, { backgroundColor: colors.background }]}
        >
          <View
            style={[
              styles.lockIcon,
              { backgroundColor: colors.cardBackground },
            ]}
          >
            <Feather name="lock" size={34} color={colors.primary} />
          </View>
          <Text style={[styles.lockTitle, { color: colors.textPrimary }]}>
            AuraTrack is locked
          </Text>
          <Text
            style={[styles.lockDescription, { color: colors.textSecondary }]}
          >
            Device authentication was not approved.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Try biometric unlock again"
            onPress={() => void authenticate()}
            style={({ pressed }) => [
              styles.retryButton,
              { backgroundColor: colors.primary },
              pressed && styles.retryButtonPressed,
            ]}
          >
            <Feather name="unlock" size={17} color="#FFFFFF" />
            <Text style={styles.retryButtonText}>Try again</Text>
          </Pressable>
          <Text style={[styles.securityNote, { color: colors.textSecondary }]}>
            Your device security is handled by the operating system.
          </Text>
        </View>
      )}
    </AppLockContext.Provider>
  );
};

export const useAppLock = () => {
  const context = useContext(AppLockContext);
  if (!context)
    throw new Error("useAppLock must be used within an AppLockProvider");
  return context;
};

const styles = StyleSheet.create({
  lockScreen: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing["2xl"],
    zIndex: 1000,
  },
  lockIcon: {
    alignItems: "center",
    borderRadius: 56,
    height: 112,
    justifyContent: "center",
    width: 112,
  },
  lockTitle: {
    fontFamily: typography.family,
    fontSize: 22,
    fontWeight: "700",
    marginTop: spacing.xl,
  },
  lockDescription: {
    fontFamily: typography.family,
    fontSize: 14,
    marginTop: spacing.sm,
    textAlign: "center",
  },
  retryButton: {
    alignItems: "center",
    borderRadius: 10,
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "center",
    marginTop: spacing.xl,
    minWidth: 150,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  retryButtonPressed: { opacity: 0.8 },
  retryButtonText: {
    color: "#FFFFFF",
    fontFamily: typography.family,
    fontSize: 15,
    fontWeight: "700",
  },
  securityNote: {
    fontFamily: typography.family,
    fontSize: 12,
    marginTop: spacing.xl,
    textAlign: "center",
  },
});
