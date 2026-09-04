import React, { useEffect, useState } from "react";
import { ActivityIndicator, StatusBar, View } from "react-native";
import { useRouter } from "expo-router";
import { HomeScreen } from "../src/screens/HomeScreen";
import {
  getCurrentUser,
  getAccessToken,
  getSessionUser,
  isNetworkFailure,
  verifySession,
} from "../src/services/auth";
import { useTheme } from "../src/hooks/useTheme";
import { useAppLock } from "../src/hooks/useAppLock";

export default function HomeRoute() {
  const router = useRouter();
  const { colors, isDark, loadThemePreference } = useTheme();
  const { initializeForUser, clearForLogout } = useAppLock();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;

    const authenticate = async () => {
      try {
        const authenticated = await verifySession();
        if (!mounted) return;
        if (authenticated) {
          await loadThemePreference();
          let user = await getSessionUser();
          if (await getAccessToken()) {
            try {
              user = await getCurrentUser();
            } catch (error) {
              if (!isNetworkFailure(error)) throw error;
            }
          }
          if (!mounted) return;
          initializeForUser(user || null);
          setIsAuthenticated(true);
          return;
        }

        clearForLogout();
        router.replace("/auth");
      } catch {
        if (!mounted) return;
        clearForLogout();
        router.replace("/auth");
      }
    };

    authenticate();
    return () => {
      mounted = false;
    };
  }, [clearForLogout, initializeForUser, loadThemePreference, router]);

  if (isAuthenticated !== true) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.background,
        }}
      >
        <StatusBar
          barStyle={isDark ? "light-content" : "dark-content"}
          backgroundColor={colors.background}
        />
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return <HomeScreen />;
}
