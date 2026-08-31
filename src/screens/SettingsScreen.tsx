import React, { useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "../hooks/useTheme";
import { spacing } from "../theme/spacing";
import { typography } from "../theme/typography";
import { FloatingNav } from "../components/navigation/FloatingNav";
import { logout } from "../services/auth";
import {
  deleteAccount,
  getSettings,
  updateEmail,
  updatePassword,
} from "../services/settings";
import type { ThemePreference } from "../services/settings";
import { useAppLock } from "../hooks/useAppLock";
import {
  arePushNotificationsEnabled,
  disablePushNotifications,
  registerForPushNotifications,
} from "../services/notifications";

type IconName = keyof typeof Feather.glyphMap;
const ACCOUNT_OPTIONS: {
  label: string;
  icon: IconName;
  destructive?: boolean;
}[] = [
  { label: "Profile", icon: "user" },
  { label: "Change email ID", icon: "mail" },
  { label: "Change password", icon: "key" },
  { label: "Logout", icon: "log-out" },
  { label: "Delete account", icon: "trash-2", destructive: true },
];

export const SettingsScreen: React.FC = () => {
  const { colors, isDark, theme, setTheme } = useTheme();
  const {
    isEnabled: appLockEnabled,
    setEnabled: setAppLockEnabled,
    clearForLogout,
  } = useAppLock();
  const router = useRouter();
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [email, setEmail] = useState("");
  const [modal, setModal] = useState<
    "email" | "password" | "delete-account" | null
  >(null);
  const [currentEmail, setCurrentEmail] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  React.useEffect(() => {
    getSettings()
      .then((result) => setEmail(result.data.user.email))
      .catch(() => undefined);
    void arePushNotificationsEnabled()
      .then(setNotificationsEnabled)
      .catch(() => setNotificationsEnabled(false));
  }, []);

  const handleNotificationsChange = async (enabled: boolean) => {
    try {
      if (enabled) {
        const registered = await registerForPushNotifications();
        setNotificationsEnabled(registered);
        if (!registered)
          Alert.alert(
            "Notifications disabled",
            "Allow notifications in your device settings to receive reminders.",
          );
      } else {
        await disablePushNotifications();
        setNotificationsEnabled(false);
      }
    } catch (error) {
      setNotificationsEnabled(false);
      Alert.alert(
        "Notifications unavailable",
        error instanceof Error
          ? error.message
          : "Unable to update notification settings.",
      );
    }
  };

  const handleAccountAction = async (label: string) => {
    if (label === "Logout") {
      clearForLogout();
      await logout();
      router.replace("/auth");
    } else if (label === "Change email ID") {
      setFormError("");
      setCurrentEmail(email);
      setModal("email");
    } else if (label === "Change password") {
      setFormError("");
      setCurrentPassword("");
      setNewPassword("");
      setModal("password");
    } else if (label === "Delete account") {
      setFormError("");
      setCurrentPassword("");
      setModal("delete-account");
    }
  };

  const handleSave = async () => {
    setFormError("");
    setIsSaving(true);
    try {
      if (modal === "email") {
        const result = await updateEmail(currentEmail, newEmail);
        setEmail(result.data.email);
        setNewEmail("");
      } else if (modal === "password") {
        await updatePassword(currentPassword, newPassword);
        setCurrentPassword("");
        setNewPassword("");
      } else if (modal === "delete-account") {
        Alert.alert(
          "Delete account",
          "This will permanently remove your account and all saved data. Do you want to continue?",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Delete",
              style: "destructive",
              onPress: async () => {
                await deleteAccount(currentPassword);
                clearForLogout();
                await logout();
                setModal(null);
                setCurrentPassword("");
                router.replace("/auth");
              },
            },
          ],
        );
        return;
      }
      setModal(null);
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Unable to save changes",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const renderRow = ({
    label,
    icon,
    destructive = false,
  }: {
    label: string;
    icon: IconName;
    destructive?: boolean;
  }) => (
    <Pressable
      key={label}
      style={({ pressed }) => [styles.row, pressed && styles.pressedRow]}
      onPress={() => handleAccountAction(label)}
    >
      <Feather
        name={icon}
        size={19}
        color={destructive ? colors.expense : colors.textSecondary}
      />
      <Text
        style={[
          styles.rowLabel,
          { color: destructive ? colors.expense : colors.textPrimary },
        ]}
      >
        {label}
      </Text>
      {!destructive && (
        <Feather name="chevron-right" size={18} color={colors.textSecondary} />
      )}
    </Pressable>
  );

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor={colors.background}
      />
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="Go back"
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Feather name="arrow-left" size={22} color={colors.textPrimary} />
        </Pressable>
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          Settings
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.intro, { color: colors.textSecondary }]}>
          Manage your account and app preferences.
        </Text>

        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
          Account
        </Text>
        <View
          style={[styles.group, { backgroundColor: colors.cardBackground }]}
        >
          {ACCOUNT_OPTIONS.map((option) => (
            <React.Fragment key={option.label}>
              {option.label === "Profile" ? (
                <Pressable
                  style={({ pressed }) => [
                    styles.row,
                    pressed && styles.pressedRow,
                  ]}
                  onPress={() => router.push("/profile")}
                >
                  <Feather name="user" size={19} color={colors.textSecondary} />
                  <Text
                    style={[styles.rowLabel, { color: colors.textPrimary }]}
                  >
                    Profile
                  </Text>
                  <Feather
                    name="chevron-right"
                    size={18}
                    color={colors.textSecondary}
                  />
                </Pressable>
              ) : (
                renderRow(option)
              )}
            </React.Fragment>
          ))}
        </View>

        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
          Security & Privacy
        </Text>
        <View
          style={[styles.group, { backgroundColor: colors.cardBackground }]}
        >
          <View style={styles.row}>
            <Feather name="lock" size={19} color={colors.textSecondary} />
            <View style={styles.rowCopy}>
              <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>
                App Lock
              </Text>
              <Text
                style={[styles.rowDescription, { color: colors.textSecondary }]}
              >
                Use your device authentication
              </Text>
            </View>
            <Switch
              value={appLockEnabled}
              onValueChange={(value) => void setAppLockEnabled(value)}
              trackColor={{ false: colors.divider, true: colors.primary }}
              thumbColor={colors.cardBackground}
            />
          </View>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
          Appearance
        </Text>
        <View
          style={[styles.group, { backgroundColor: colors.cardBackground }]}
        >
          <View style={styles.row}>
            <Feather name="sun" size={19} color={colors.textSecondary} />
            <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>
              Theme
            </Text>
            <Text style={[styles.themeValue, { color: colors.textSecondary }]}>
              {theme === "light" ? "Light" : "Dark"}
            </Text>
            <Switch
              value={theme === "dark"}
              onValueChange={(value) => {
                const nextTheme: ThemePreference = value ? "dark" : "light";
                setTheme(nextTheme);
              }}
              trackColor={{ false: colors.divider, true: colors.primary }}
              thumbColor={colors.cardBackground}
            />
          </View>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
          Notifications
        </Text>
        <View
          style={[styles.group, { backgroundColor: colors.cardBackground }]}
        >
          <View style={styles.row}>
            <Feather name="bell" size={19} color={colors.textSecondary} />
            <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>
              Enable notifications
            </Text>
            <Switch
              value={notificationsEnabled}
              onValueChange={(value) => void handleNotificationsChange(value)}
              trackColor={{ false: colors.divider, true: colors.primary }}
              thumbColor={colors.cardBackground}
            />
          </View>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
          About
        </Text>
        <View
          style={[styles.group, { backgroundColor: colors.cardBackground }]}
        >
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.pressedRow]}
            onPress={() => router.push("/about")}
          >
            <Feather name="info" size={19} color={colors.textSecondary} />
            <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>
              About AuraTrack
            </Text>
            <Feather
              name="chevron-right"
              size={18}
              color={colors.textSecondary}
            />
          </Pressable>
        </View>
      </ScrollView>
      <FloatingNav activeTab="settings" onTabPress={() => undefined} />
      {modal && (
        <View style={styles.modalOverlay}>
          <View
            style={[styles.modal, { backgroundColor: colors.cardBackground }]}
          >
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
              {modal === "email"
                ? "Change email ID"
                : modal === "password"
                  ? "Change password"
                  : "Delete account"}
            </Text>
            {modal === "email" ? (
              <>
                <TextInput
                  autoCapitalize="none"
                  keyboardType="email-address"
                  placeholder="Current email"
                  placeholderTextColor={colors.textSecondary}
                  value={currentEmail}
                  onChangeText={setCurrentEmail}
                  style={[
                    styles.input,
                    { borderColor: colors.divider, color: colors.textPrimary },
                  ]}
                />
                <TextInput
                  autoCapitalize="none"
                  keyboardType="email-address"
                  placeholder="New email"
                  placeholderTextColor={colors.textSecondary}
                  value={newEmail}
                  onChangeText={setNewEmail}
                  style={[
                    styles.input,
                    { borderColor: colors.divider, color: colors.textPrimary },
                  ]}
                />
              </>
            ) : modal === "password" ? (
              <>
                <View
                  style={[
                    styles.passwordInputRow,
                    { borderColor: colors.divider },
                  ]}
                >
                  <TextInput
                    placeholder="Current password"
                    placeholderTextColor={colors.textSecondary}
                    secureTextEntry={!showCurrentPassword}
                    value={currentPassword}
                    onChangeText={setCurrentPassword}
                    style={[
                      styles.passwordInput,
                      { color: colors.textPrimary },
                    ]}
                  />
                  <Pressable
                    onPress={() =>
                      setShowCurrentPassword((visible) => !visible)
                    }
                  >
                    <Feather
                      name={showCurrentPassword ? "eye-off" : "eye"}
                      size={18}
                      color={colors.textSecondary}
                    />
                  </Pressable>
                </View>
                <View
                  style={[
                    styles.passwordInputRow,
                    { borderColor: colors.divider },
                  ]}
                >
                  <TextInput
                    placeholder="New password (8+ characters)"
                    placeholderTextColor={colors.textSecondary}
                    secureTextEntry={!showNewPassword}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    style={[
                      styles.passwordInput,
                      { color: colors.textPrimary },
                    ]}
                  />
                  <Pressable
                    onPress={() => setShowNewPassword((visible) => !visible)}
                  >
                    <Feather
                      name={showNewPassword ? "eye-off" : "eye"}
                      size={18}
                      color={colors.textSecondary}
                    />
                  </Pressable>
                </View>
              </>
            ) : (
              <View
                style={[
                  styles.passwordInputRow,
                  { borderColor: colors.divider },
                ]}
              >
                <TextInput
                  placeholder="Enter your password"
                  placeholderTextColor={colors.textSecondary}
                  secureTextEntry={!showCurrentPassword}
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  style={[styles.passwordInput, { color: colors.textPrimary }]}
                />
                <Pressable
                  onPress={() => setShowCurrentPassword((visible) => !visible)}
                >
                  <Feather
                    name={showCurrentPassword ? "eye-off" : "eye"}
                    size={18}
                    color={colors.textSecondary}
                  />
                </Pressable>
              </View>
            )}
            {!!formError && (
              <Text style={[styles.formError, { color: colors.expense }]}>
                {formError}
              </Text>
            )}
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setModal(null)}
                style={styles.modalButton}
              >
                <Text style={{ color: colors.textSecondary }}>Cancel</Text>
              </Pressable>
              <Pressable
                disabled={isSaving}
                onPress={handleSave}
                style={[
                  styles.modalButton,
                  { backgroundColor: colors.primary },
                ]}
              >
                <Text style={{ color: "#FFFFFF", fontWeight: "600" }}>
                  {isSaving ? "Saving..." : "Save"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  backButton: { padding: spacing.sm },
  headerSpacer: { width: 38 },
  title: { fontFamily: typography.family, fontSize: 20, fontWeight: "700" },
  content: { padding: spacing.lg, paddingBottom: spacing["2xl"] },
  intro: {
    fontFamily: typography.family,
    fontSize: 14,
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontFamily: typography.family,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
    textTransform: "uppercase",
  },
  group: { borderRadius: 12, marginBottom: spacing.xl, overflow: "hidden" },
  row: {
    alignItems: "center",
    flexDirection: "row",
    minHeight: 58,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  pressedRow: { opacity: 0.65 },
  rowCopy: { flex: 1, marginLeft: spacing.md },
  rowLabel: {
    flex: 1,
    fontFamily: typography.family,
    fontSize: 15,
    marginLeft: spacing.md,
  },
  rowDescription: { fontFamily: typography.family, fontSize: 12, marginTop: 3 },
  themeChoices: {
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.md,
    paddingTop: 0,
  },
  themeChoice: {
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: "center",
  },
  themeChoiceText: {
    fontFamily: typography.family,
    fontSize: 13,
    fontWeight: "600",
  },
  themeValue: {
    fontFamily: typography.family,
    fontSize: 14,
    marginRight: spacing.md,
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    justifyContent: "center",
    padding: spacing.xl,
  },
  modal: { borderRadius: 12, padding: spacing.xl, width: "100%" },
  modalTitle: {
    fontFamily: typography.family,
    fontSize: 18,
    fontWeight: "700",
    marginBottom: spacing.lg,
  },
  input: {
    borderRadius: 8,
    borderWidth: 1,
    fontFamily: typography.family,
    fontSize: 15,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  passwordInputRow: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
  },
  passwordInput: {
    flex: 1,
    fontFamily: typography.family,
    fontSize: 15,
    paddingVertical: spacing.md,
  },
  formError: {
    fontFamily: typography.family,
    fontSize: 13,
    marginBottom: spacing.md,
  },
  modalActions: {
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "flex-end",
    marginTop: spacing.sm,
  },
  modalButton: {
    borderRadius: 8,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
});
