import { authenticatedRequest } from "./auth";

export type ThemePreference = "light" | "dark";

type SettingsResponse = {
  success: boolean;
  data: {
    user: {
      fullname: string;
      email: string;
      theme_preference: ThemePreference;
      app_lock_enabled: boolean;
    };
  };
};

export const getSettings = () =>
  authenticatedRequest<SettingsResponse>("/api/settings");

export const updateThemePreference = (themePreference: ThemePreference) =>
  authenticatedRequest<{ success: boolean }>("/api/settings/theme", {
    method: "PATCH",
    body: { themePreference },
  });

export const updateAppLockPreference = (appLockEnabled: boolean) =>
  authenticatedRequest<{ success: boolean; data: { appLockEnabled: boolean } }>(
    "/api/settings/app-lock",
    { method: "PATCH", body: { appLockEnabled } },
  );

export const updateEmail = (currentEmail: string, newEmail: string) =>
  authenticatedRequest<{ success: boolean; data: { email: string } }>(
    "/api/settings/email",
    { method: "PATCH", body: { currentEmail, newEmail } },
  );

export const updatePassword = (currentPassword: string, newPassword: string) =>
  authenticatedRequest<{ success: boolean }>("/api/settings/password", {
    method: "PATCH",
    body: { currentPassword, newPassword },
  });
export const deleteAccount = (password: string) =>
  authenticatedRequest<{ success: boolean; message: string }>(
    "/api/settings/account",
    { method: "DELETE", body: { password } },
  );
