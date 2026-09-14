import { Alert, Linking, Platform } from "react-native";
import * as Device from "expo-device";
import Constants from "expo-constants";

const AGGRESSIVE_OEM_LIST = [
  "xiaomi",
  "redmi",
  "poco",
  "samsung",
  "huawei",
  "honor",
  "oppo",
  "vivo",
  "realme",
  "oneplus",
  "meizu",
  "asus",
];

const PACKAGE_NAME =
  Constants.expoConfig?.android?.package ?? "com.abhijitreddy.auratrack";

/**
 * Checks if the current device is known for aggressive battery kill policies
 * (e.g., Xiaomi MIUI/HyperOS, Samsung OneUI, OnePlus/Oppo ColorOS, etc.)
 */
export const isAggressiveBatterySaverDevice = (): boolean => {
  if (Platform.OS !== "android") return false;
  const manufacturer = (Device.manufacturer || "").toLowerCase().trim();
  return AGGRESSIVE_OEM_LIST.some((oem) => manufacturer.includes(oem));
};

/**
 * Returns the manufacturer name formatted for display.
 */
export const getDeviceBrandName = (): string => {
  if (Platform.OS !== "android") return "";
  const brand = Device.brand || Device.manufacturer || "";
  if (!brand) return "Android";
  return brand.charAt(0).toUpperCase() + brand.slice(1);
};

/**
 * Attempts to launch Android Battery Optimization settings directly.
 * Falls back to general App Info Settings if the intent is not supported.
 */
export const openBatteryOptimizationSettings = async (): Promise<void> => {
  if (Platform.OS !== "android") return;

  try {
    // 1. Try launching the direct ignore battery optimization intent with package uri
    await Linking.sendIntent(
      "android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS",
      [{ key: "data", value: `package:${PACKAGE_NAME}` }],
    );
  } catch {
    try {
      // 2. Fallback to general battery saver list
      await Linking.sendIntent(
        "android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS",
      );
    } catch {
      // 3. Ultimate fallback: open App Settings page
      await Linking.openSettings();
    }
  }
};

/**
 * Prompts the user to configure battery settings if on an aggressive OEM device.
 */
export const promptBatteryOptimizationNotice = (
  customTitle?: string,
  customMessage?: string,
): void => {
  if (Platform.OS !== "android") return;

  const brand = getDeviceBrandName();
  const title =
    customTitle ??
    (isAggressiveBatterySaverDevice()
      ? `Ensure Reliable Notifications on ${brand}`
      : "Enable Background Notifications");

  const message =
    customMessage ??
    `To ensure reminders and alerts arrive without delay, set AuraTrack's battery usage to 'Unrestricted' and allow autostart.`;

  Alert.alert(
    title,
    message,
    [
      {
        text: "Later",
        style: "cancel",
      },
      {
        text: "Configure Now",
        onPress: () => {
          void openBatteryOptimizationSettings();
        },
      },
    ],
    { cancelable: true },
  );
};

