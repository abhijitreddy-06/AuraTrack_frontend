import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import { authenticatedRequest } from "./auth";

const PUSH_TOKEN_KEY = "auratrack.expoPushToken";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export const registerForPushNotifications = async () => {
  if (!Device.isDevice) return false;

  const current = await Notifications.getPermissionsAsync();
  const permission =
    current.status === "granted"
      ? current
      : await Notifications.requestPermissionsAsync();

  if (permission.status !== "granted") return false;

  await Notifications.setNotificationChannelAsync("default", {
    name: "Default",
    importance: Notifications.AndroidImportance.HIGH,
  });

  /*
   * TEMPORARY DEBUG: FORCE PURGE ZOMBIE TOKENS
   * This calls FirebaseMessaging.getInstance().deleteToken() natively,
   * destroying any restored Auto-Backup tokens and forcing a fresh sync.
   *
   * try {
   *   await Notifications.unregisterForNotificationsAsync();
   *   console.info("Successfully purged existing native FCM tokens.");
   * } catch (error) {
   *   console.warn("Token purge skipped or failed", error);
   * }
   */

  // 2. ACQUIRE FRESH NATIVE TOKEN
  // try {
  //   const nativeDeviceToken = await Notifications.getDevicePushTokenAsync();
  //   console.info("TEMPORARY Native push token diagnostic", {
  //     token: String(nativeDeviceToken.data),
  //     type: nativeDeviceToken.type,
  //   });
  // } catch (error) {
  //   console.error("TEMPORARY Native push token diagnostic FAILED", error);
  // }

  const projectId =
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID ??
    Constants.easConfig?.projectId ??
    Constants.expoConfig?.extra?.eas?.projectId;

  if (!projectId) {
    throw new Error("Push notifications require an EAS project ID.");
  }

  // console.info("Expo push registration diagnostics", {
  //   projectId,
  //   isPhysicalDevice: Device.isDevice,
  //   permissionStatus: permission.status,
  // });

  // 3. REGISTER WITH EXPO
  const token = (
    await Notifications.getExpoPushTokenAsync({ projectId })
  ).data;

  //console.info("TEMPORARY Expo push token diagnostic", { token });

  await authenticatedRequest("/api/notifications/push-token", {
    method: "POST",
    body: { token },
  });

  await SecureStore.setItemAsync(PUSH_TOKEN_KEY, token);

  return true;
};

export const arePushNotificationsEnabled = async () =>
  (await Notifications.getPermissionsAsync()).status === "granted" &&
  Boolean(await SecureStore.getItemAsync(PUSH_TOKEN_KEY));

export const disablePushNotifications = async () => {
  const token = await SecureStore.getItemAsync(PUSH_TOKEN_KEY);

  if (token) {
    await authenticatedRequest("/api/notifications/push-token", {
      method: "DELETE",
      body: { token },
    }).catch(() => {});

    await SecureStore.deleteItemAsync(PUSH_TOKEN_KEY).catch(() => {});
    // Also unregister natively when disabling
    await Notifications.unregisterForNotificationsAsync().catch(() => {});
  }
};

/**
 * Called during logout to ensure backend stops dispatching notifications to this device,
 * and purges the local push token from SecureStore.
 */
export const unregisterPushTokenForLogout = async () => {
  try {
    const token = await SecureStore.getItemAsync(PUSH_TOKEN_KEY);
    if (token) {
      await authenticatedRequest("/api/notifications/push-token", {
        method: "DELETE",
        body: { token },
      }).catch((err) => {
        console.warn("Failed to delete push token from backend during logout:", err);
      });

      await SecureStore.deleteItemAsync(PUSH_TOKEN_KEY).catch(() => {});
      await Notifications.unregisterForNotificationsAsync().catch(() => {});
    }
  } catch (error) {
    console.warn("Error unregistering push token during logout:", error);
  }
};

/**
 * Called after successful login/signup to ensure the current device's Expo push token
 * is associated with the newly logged-in user ID without requiring manual re-toggle.
 */
export const syncPushTokenAfterLogin = async (): Promise<boolean> => {
  try {
    if (!Device.isDevice) return false;
    const permissions = await Notifications.getPermissionsAsync();
    if (permissions.status === "granted") {
      return await registerForPushNotifications();
    }
    return false;
  } catch (error) {
    console.warn("Failed to sync push token after login:", error);
    return false;
  }
};

