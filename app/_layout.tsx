import { Stack } from "expo-router";
import { StatusBar, View } from "react-native";
import { useEffect } from "react";
import { ThemeProvider } from "../src/hooks/useTheme";
import { useTheme } from "../src/hooks/useTheme";
import { AppLockProvider } from "../src/hooks/useAppLock";
import { subscribeToNetworkChanges } from "../src/offline/network";
import { syncPendingQueue } from "../src/offline/cache";

export const unstable_settings = {
  initialRouteName: "index",
};

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AppLockProvider>
        <RootNavigator />
      </AppLockProvider>
    </ThemeProvider>
  );
}

function RootNavigator() {
  const { colors, isDark, isReady } = useTheme();

  useEffect(() => {
    const unsubscribe = subscribeToNetworkChanges(async (state) => {
      if (state.isConnected || state.isInternetReachable) {
        await syncPendingQueue();
      }
    });

    return unsubscribe;
  }, []);

  if (!isReady) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <StatusBar
          barStyle={isDark ? "light-content" : "dark-content"}
          backgroundColor={colors.background}
        />
      </View>
    );
  }

  return (
    <Stack
      initialRouteName="index"
      screenOptions={{
        headerShown: false,
        animation: "none",
      }}
    />
  );
}
