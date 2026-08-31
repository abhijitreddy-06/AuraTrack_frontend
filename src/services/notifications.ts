import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import { authenticatedRequest } from "./auth";

const PUSH_TOKEN_KEY = "auratrack.expoPushToken";

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldPlaySound: true, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }),
});

export const registerForPushNotifications = async () => {
  if (!Device.isDevice) return false;
  const current = await Notifications.getPermissionsAsync();
  const permission = current.status === "granted" ? current : await Notifications.requestPermissionsAsync();
  if (permission.status !== "granted") return false;

  await Notifications.setNotificationChannelAsync("default", {
    name: "Default",
    importance: Notifications.AndroidImportance.HIGH,
  });

  const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID ?? Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) throw new Error("Push notifications require an EAS project ID.");
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  await authenticatedRequest("/api/notifications/push-token", { method: "POST", body: { token } });
  await SecureStore.setItemAsync(PUSH_TOKEN_KEY, token);
  return true;
};

export const arePushNotificationsEnabled = async () =>
  (await Notifications.getPermissionsAsync()).status === "granted" && Boolean(await SecureStore.getItemAsync(PUSH_TOKEN_KEY));

export const disablePushNotifications = async () => {
  const token = await SecureStore.getItemAsync(PUSH_TOKEN_KEY);
  if (token) {
    await authenticatedRequest("/api/notifications/push-token", { method: "DELETE", body: { token } });
    await SecureStore.deleteItemAsync(PUSH_TOKEN_KEY);
  }
};
