import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert,
  StatusBar,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { useTheme } from "../hooks/useTheme";
import { useVault } from "../hooks/useVault";
import { spacing } from "../theme/spacing";
import { typography } from "../theme/typography";
import { encryptField, decryptField } from "../services/crypto/vaultCrypto";
import {
  PasswordEntrySummary,
  createPassword,
  createPasswordV2,
  deletePassword,
  getPasswordSecret,
  getPasswords,
  updatePassword,
  updatePasswordV2,
} from "../services/passwords";

export const PasswordManagerScreen: React.FC = () => {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const {
    vaultVersion,
    migrationStatus,
    isUnlocked,
    dek,
    isLoading: isVaultLoading,
    error: vaultError,
    isBiometricAvailable,
    hasBiometricSetup,
    pendingRecoveryKey,
    loadMetadata,
    unlockVaultWithPassword,
    unlockVaultWithBiometrics,
    unlockVaultWithRecoveryKey,
    clearPendingRecoveryKey,
    migrateVault,
    clearError: clearVaultError,
  } = useVault();

  const [unlockPassword, setUnlockPassword] = useState("");
  const [unlockPasswordVisible, setUnlockPasswordVisible] = useState(false);
  const [isDerivingKey, setIsDerivingKey] = useState(false);
  const [isBiometricAuthenticating, setIsBiometricAuthenticating] =
    useState(false);
  const hasAutoPromptedBiometrics = useRef(false);

  // Phase 8 Recovery Key state
  const [copiedRecoveryKey, setCopiedRecoveryKey] = useState(false);
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const [recoveryKeyInput, setRecoveryKeyInput] = useState("");
  const [isRecovering, setIsRecovering] = useState(false);

  // Phase 6 Migration state
  const [showMigrationModal, setShowMigrationModal] = useState(false);
  const [hasDismissedMigration, setHasDismissedMigration] = useState(false);
  const [migrationPassword, setMigrationPassword] = useState("");
  const [migrationPasswordVisible, setMigrationPasswordVisible] =
    useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationProgress, setMigrationProgress] = useState(0);
  const [migrationStepText, setMigrationStepText] = useState("");
  const [migrationSuccess, setMigrationSuccess] = useState(false);
  const [migrationError, setMigrationError] = useState<string | null>(null);

  const [entries, setEntries] = useState<PasswordEntrySummary[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [formPasswordVisible, setFormPasswordVisible] = useState(false);
  const [showPassword, setShowPassword] = useState<{ [id: string]: boolean }>(
    {},
  );
  const [revealedSecrets, setRevealedSecrets] = useState<{
    [id: string]: { key: string; value: string };
  }>({});
  const [loadingSecrets, setLoadingSecrets] = useState<{
    [id: string]: boolean;
  }>({});

  useEffect(() => {
    void loadMetadata();
  }, [loadMetadata]);

  useEffect(() => {
    if (isUnlocked || vaultVersion === "v1") {
      void loadEntries();
    }
  }, [isUnlocked, vaultVersion]);

  // Prompt eligible v1 users once on screen load
  useEffect(() => {
    if (
      vaultVersion === "v1" &&
      migrationStatus !== "completed" &&
      !hasDismissedMigration &&
      !showMigrationModal
    ) {
      setShowMigrationModal(true);
    }
  }, [
    vaultVersion,
    migrationStatus,
    hasDismissedMigration,
    showMigrationModal,
  ]);

  const handleUnlock = async () => {
    if (!unlockPassword.trim()) {
      Alert.alert(
        "Password Required",
        "Please enter your account password to unlock the vault.",
      );
      return;
    }
    setIsDerivingKey(true);
    try {
      const success = await unlockVaultWithPassword(unlockPassword);
      if (success) {
        setUnlockPassword(""); // Never keep password in component state once unlocked
      }
    } finally {
      setIsDerivingKey(false);
    }
  };

  const handleBiometricUnlock = async () => {
    setIsBiometricAuthenticating(true);
    try {
      const success = await unlockVaultWithBiometrics();
      if (success) {
        clearVaultError();
      }
    } finally {
      setIsBiometricAuthenticating(false);
    }
  };

  const handleCopyRecoveryKey = async () => {
    if (!pendingRecoveryKey) return;
    await Clipboard.setStringAsync(pendingRecoveryKey);
    setCopiedRecoveryKey(true);
    setTimeout(() => {
      setCopiedRecoveryKey(false);
    }, 4000);
  };

  const handleDismissRecoveryKeyModal = () => {
    if (!copiedRecoveryKey) {
      Alert.alert(
        "Confirm Recovery Key Saved",
        "Have you safely copied and backed up your recovery key? You will not be able to view it again.",
        [
          { text: "Go Back", style: "cancel" },
          {
            text: "Yes, I Saved It",
            style: "default",
            onPress: () => {
              clearPendingRecoveryKey();
            },
          },
        ],
      );
    } else {
      clearPendingRecoveryKey();
    }
  };

  const handleRecoveryUnlock = async () => {
    if (!recoveryKeyInput.trim()) {
      Alert.alert(
        "Recovery Key Required",
        "Please enter your 64-character recovery key.",
      );
      return;
    }
    setIsRecovering(true);
    try {
      const success = await unlockVaultWithRecoveryKey(recoveryKeyInput.trim());
      if (success) {
        setRecoveryKeyInput("");
        setIsRecoveryMode(false);
      }
    } finally {
      setIsRecovering(false);
    }
  };

  // Optional convenience: auto-prompt biometrics once on mount if biometric setup exists
  useEffect(() => {
    if (
      vaultVersion === "v2" &&
      !isUnlocked &&
      hasBiometricSetup &&
      isBiometricAvailable &&
      !hasAutoPromptedBiometrics.current
    ) {
      hasAutoPromptedBiometrics.current = true;
      void handleBiometricUnlock();
    }
  }, [vaultVersion, isUnlocked, hasBiometricSetup, isBiometricAvailable]);

  const handleDismissMigration = () => {
    setShowMigrationModal(false);
    setHasDismissedMigration(true);
    setMigrationPassword("");
    setMigrationError(null);
  };

  const handleStartMigration = async () => {
    if (!migrationPassword.trim()) {
      Alert.alert(
        "Password Required",
        "Please enter your account password to secure your encryption key.",
      );
      return;
    }
    setIsMigrating(true);
    setMigrationError(null);
    setMigrationProgress(10);
    setMigrationStepText("Initializing secure client-side vault...");

    try {
      const success = await migrateVault(
        migrationPassword,
        (percent, stepText) => {
          setMigrationProgress(percent);
          setMigrationStepText(stepText);
        },
      );

      if (success) {
        setMigrationPassword(""); // Wipe from state immediately
        setMigrationSuccess(true);
        await loadEntries();
      } else {
        setMigrationError(
          vaultError || "Migration could not be completed. Please try again.",
        );
      }
    } catch (err) {
      setMigrationError(
        err instanceof Error ? err.message : "Migration failed",
      );
    } finally {
      setIsMigrating(false);
    }
  };

  const loadEntries = async () => {
    try {
      const response = await getPasswords();
      setEntries(response.data);
    } catch (error) {
      Alert.alert(
        "Could not load passwords",
        error instanceof Error ? error.message : "Please try again.",
      );
    }
  };

  // ─── handleSubmit ──────────────────────────────────────────────────────────
  // v1: sends plaintext { title, key, value } — backend encrypts.
  // v2: encrypts key + value client-side, sends { title, key_, value_ } ciphertext.
  //     Never falls back to server-side encryption for v2.

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert("Validation", "Please enter a title (e.g., Google Account).");
      return;
    }
    if (!key.trim()) {
      Alert.alert("Validation", "Please enter a username/email.");
      return;
    }
    if (!value.trim()) {
      Alert.alert("Validation", "Please enter a password.");
      return;
    }

    try {
      if (vaultVersion === "v2") {
        // Guard: DEK must be in memory. Vault must be unlocked.
        if (!dek) {
          Alert.alert(
            "Vault Locked",
            "Please unlock the vault before saving passwords.",
          );
          return;
        }

        // Encrypt both fields client-side before sending to the backend.
        const encryptedKey = await encryptField(key.trim(), dek);
        const encryptedValue = await encryptField(value, dek);

        if (editingId) {
          await updatePasswordV2(editingId, {
            title: title.trim(),
            key_: encryptedKey,
            value_: encryptedValue,
          });
        } else {
          await createPasswordV2({
            title: title.trim(),
            key_: encryptedKey,
            value_: encryptedValue,
          });
        }
      } else {
        // v1: plaintext to backend — server encrypts with PASSWORD_VAULT_KEY.
        if (editingId) {
          await updatePassword(editingId, {
            title: title.trim(),
            key: key.trim(),
            value,
          });
        } else {
          await createPassword({ title: title.trim(), key: key.trim(), value });
        }
      }

      await loadEntries();
      resetForm();
    } catch (error) {
      Alert.alert(
        "Could not save password",
        error instanceof Error ? error.message : "Please try again.",
      );
    }
  };

  const resetForm = () => {
    setTitle("");
    setKey("");
    setValue("");
    setFormPasswordVisible(false);
    setEditingId(null);
  };

  // ─── handleEdit ────────────────────────────────────────────────────────────
  // Loads an existing entry into the form for editing.
  // v1: backend decrypts and returns plaintext — use as-is.
  // v2: backend returns ciphertext — client decrypts with in-memory DEK.

  const handleEdit = async (item: PasswordEntrySummary) => {
    try {
      const response = await getPasswordSecret(item.id);
      const rawKey = response.data.key;
      const rawValue = response.data.value;

      if (vaultVersion === "v2") {
        if (!dek) {
          Alert.alert(
            "Vault Locked",
            "Please unlock the vault to edit passwords.",
          );
          return;
        }
        // rawKey / rawValue are ciphertext strings — decrypt locally.
        setTitle(item.title);
        setKey(await decryptField(rawKey, dek));
        setValue(await decryptField(rawValue, dek));
      } else {
        // v1: plaintext from backend.
        setTitle(item.title);
        setKey(rawKey);
        setValue(rawValue);
      }

      setFormPasswordVisible(false);
      setEditingId(item.id);
    } catch (error) {
      Alert.alert(
        "Could not load password details",
        error instanceof Error ? error.message : "Please try again.",
      );
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert(
      "Delete Entry",
      "Are you sure you want to delete this password entry?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () =>
            void (async () => {
              try {
                await deletePassword(id);
                setEntries((current) =>
                  current.filter((entry) => entry.id !== id),
                );
              } catch (error) {
                Alert.alert(
                  "Could not delete password",
                  error instanceof Error ? error.message : "Please try again.",
                );
              }
            })(),
        },
      ],
    );
  };

  // ─── toggleShowPassword ────────────────────────────────────────────────────
  // Reveals / hides credentials in a list card.
  // v1: backend decrypts on the secret endpoint — use directly.
  // v2: backend returns ciphertext — client decrypts with in-memory DEK.

  const toggleShowPassword = async (id: string) => {
    if (showPassword[id]) {
      setShowPassword((prev) => ({ ...prev, [id]: false }));
      setRevealedSecrets((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      return;
    }

    // Guard for v2: no DEK = no reveal.
    if (vaultVersion === "v2" && !dek) {
      Alert.alert(
        "Vault Locked",
        "Please unlock the vault to reveal passwords.",
      );
      return;
    }

    setLoadingSecrets((prev) => ({ ...prev, [id]: true }));
    try {
      const response = await getPasswordSecret(id);
      const rawKey = response.data.key;
      const rawValue = response.data.value;

      let plainKey: string;
      let plainValue: string;

      if (vaultVersion === "v2" && dek) {
        // Client-side decryption — DEK never sent to backend.
        plainKey = await decryptField(rawKey, dek);
        plainValue = await decryptField(rawValue, dek);
      } else {
        // v1: backend already decrypted.
        plainKey = rawKey;
        plainValue = rawValue;
      }

      setRevealedSecrets((prev) => ({
        ...prev,
        [id]: { key: plainKey, value: plainValue },
      }));
      setShowPassword((prev) => ({ ...prev, [id]: true }));
    } catch (error) {
      Alert.alert(
        "Could not reveal password",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setLoadingSecrets((prev) => ({ ...prev, [id]: false }));
    }
  };

  const filteredEntries = entries.filter((entry) =>
    entry.title.toLowerCase().includes(searchQuery.trim().toLowerCase()),
  );

  const renderItem = ({ item }: { item: PasswordEntrySummary }) => {
    const isVisible = showPassword[item.id] || false;
    const isLoadingSecret = loadingSecrets[item.id] || false;
    const secret = revealedSecrets[item.id];
    return (
      <View
        style={[styles.card, { backgroundColor: colors.secondaryBackground }]}
      >
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
            {item.title}
          </Text>
          <View style={styles.actions}>
            <TouchableOpacity
              onPress={() => void handleEdit(item)}
              style={styles.actionButton}
            >
              <Feather name="edit-2" size={18} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleDelete(item.id)}
              style={styles.actionButton}
            >
              <Feather name="trash-2" size={18} color={colors.expense} />
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.detailRow}>
          <Feather name="user" size={16} color={colors.textSecondary} />
          <Text style={[styles.detailText, { color: colors.textSecondary }]}>
            {isVisible && secret ? secret.key : "Tap eye to reveal username"}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Feather name="lock" size={16} color={colors.textSecondary} />
          <Text style={[styles.detailText, { color: colors.textSecondary }]}>
            {isVisible && secret ? secret.value : "••••••••"}
          </Text>
          <TouchableOpacity
            onPress={() => void toggleShowPassword(item.id)}
            style={styles.eyeButton}
            disabled={isLoadingSecret}
          >
            <Feather
              name={isLoadingSecret ? "loader" : isVisible ? "eye-off" : "eye"}
              size={18}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Feather name="arrow-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
          Password Manager
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Phase 6 Migration Modal */}
      <Modal
        visible={showMigrationModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!isMigrating) handleDismissMigration();
        }}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.modalKeyboardAvoiding}
          >
            <View
              style={[
                styles.migrationModalCard,
                { backgroundColor: colors.secondaryBackground },
              ]}
            >
              {migrationSuccess ? (
                /* Success Screen */
                <View style={styles.migrationSuccessContainer}>
                  <View
                    style={[
                      styles.unlockIconCircle,
                      { backgroundColor: "#10B9811A" },
                    ]}
                  >
                    <Feather name="check-circle" size={40} color="#10B981" />
                  </View>
                  <Text
                    style={[
                      styles.unlockTitle,
                      { color: colors.textPrimary, marginTop: spacing.sm },
                    ]}
                  >
                    Vault Security Upgraded
                  </Text>
                  <Text
                    style={[
                      styles.unlockSubtitle,
                      {
                        color: colors.textSecondary,
                        marginVertical: spacing.md,
                      },
                    ]}
                  >
                    Your vault is now protected with client-side encryption.
                    {"\n\n"}
                    Your saved passwords are encrypted on your device before
                    being stored.
                  </Text>
                  <TouchableOpacity
                    style={[
                      styles.formButton,
                      styles.submitButton,
                      { backgroundColor: colors.primary, width: "100%" },
                    ]}
                    onPress={() => {
                      setShowMigrationModal(false);
                      setMigrationSuccess(false);
                    }}
                  >
                    <Text style={styles.submitButtonText}>Done</Text>
                  </TouchableOpacity>
                </View>
              ) : isMigrating ? (
                /* Migration in Progress */
                <View style={styles.migrationProgressContainer}>
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text
                    style={[
                      styles.unlockTitle,
                      { color: colors.textPrimary, marginTop: spacing.lg },
                    ]}
                  >
                    Upgrading your vault...
                  </Text>
                  <Text
                    style={[
                      styles.unlockSubtitle,
                      { color: colors.textSecondary, marginTop: spacing.xs },
                    ]}
                  >
                    {migrationStepText || "Encrypting your saved passwords"}
                  </Text>

                  <View style={styles.progressContainer}>
                    <View
                      style={[
                        styles.progressBarBackground,
                        { backgroundColor: colors.divider },
                      ]}
                    >
                      <View
                        style={[
                          styles.progressBarFill,
                          {
                            width: `${migrationProgress}%`,
                            backgroundColor: colors.primary,
                          },
                        ]}
                      />
                    </View>
                    <Text
                      style={[
                        styles.progressPercent,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {migrationProgress}%
                    </Text>
                  </View>

                  <Text
                    style={[
                      styles.unlockSecurityNote,
                      { color: colors.textSecondary, marginTop: spacing.md },
                    ]}
                  >
                    Please keep AuraTrack open.
                  </Text>
                </View>
              ) : (
                /* Migration Prompt Screen */
                <View style={styles.migrationPromptContainer}>
                  <View
                    style={[
                      styles.unlockIconCircle,
                      { backgroundColor: colors.primary + "1A" },
                    ]}
                  >
                    <Feather name="shield" size={36} color={colors.primary} />
                  </View>

                  <Text
                    style={[styles.unlockTitle, { color: colors.textPrimary }]}
                  >
                    Upgrade Your Vault Security
                  </Text>
                  <Text
                    style={[
                      styles.unlockSubtitle,
                      { color: colors.textSecondary },
                    ]}
                  >
                    AuraTrack can now protect your saved passwords using
                    client-side encryption.{"\n\n"}
                    Your existing passwords will be securely re-encrypted on
                    this device.{"\n\n"}
                    This may take a moment.
                  </Text>

                  {migrationError && (
                    <View style={styles.errorBanner}>
                      <Feather
                        name="alert-circle"
                        size={16}
                        color={colors.expense}
                      />
                      <Text
                        style={[styles.errorText, { color: colors.expense }]}
                      >
                        {migrationError}
                      </Text>
                    </View>
                  )}

                  <View
                    style={[styles.passwordInputContainer, { width: "100%" }]}
                  >
                    <TextInput
                      style={[
                        styles.input,
                        styles.passwordInput,
                        {
                          color: colors.textPrimary,
                          borderColor: colors.divider,
                        },
                      ]}
                      placeholder="Account password"
                      placeholderTextColor={colors.textSecondary}
                      value={migrationPassword}
                      onChangeText={setMigrationPassword}
                      secureTextEntry={!migrationPasswordVisible}
                      autoCapitalize="none"
                    />
                    <TouchableOpacity
                      onPress={() =>
                        setMigrationPasswordVisible((prev) => !prev)
                      }
                      style={styles.formEyeButton}
                    >
                      <Feather
                        name={migrationPasswordVisible ? "eye-off" : "eye"}
                        size={18}
                        color={colors.textSecondary}
                      />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.migrationActions}>
                    <TouchableOpacity
                      style={[
                        styles.formButton,
                        styles.cancelButton,
                        { borderColor: colors.divider },
                      ]}
                      onPress={handleDismissMigration}
                    >
                      <Text
                        style={[
                          styles.formButtonText,
                          { color: colors.textSecondary },
                        ]}
                      >
                        Later
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.formButton,
                        styles.submitButton,
                        { backgroundColor: colors.primary },
                      ]}
                      onPress={handleStartMigration}
                    >
                      <Text style={styles.submitButtonText}>Upgrade Vault</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Phase 8 Recovery Key Modal */}
      <Modal
        visible={Boolean(pendingRecoveryKey)}
        transparent
        animationType="fade"
        onRequestClose={handleDismissRecoveryKeyModal}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.migrationModalCard,
              { backgroundColor: colors.secondaryBackground },
            ]}
          >
            <View
              style={[
                styles.unlockIconCircle,
                { backgroundColor: colors.primary + "1A" },
              ]}
            >
              <Feather name="key" size={36} color={colors.primary} />
            </View>

            <Text style={[styles.unlockTitle, { color: colors.textPrimary }]}>
              Save Your Recovery Key
            </Text>

            <Text
              style={[
                styles.unlockSubtitle,
                { color: colors.textSecondary, marginBottom: spacing.md },
              ]}
            >
              This is your emergency recovery key. If you forget your password,
              this key is the ONLY way to regain access to your vault.
              {"\n\n"}
              It will{" "}
              <Text style={{ fontWeight: "700", color: colors.textPrimary }}>
                NEVER
              </Text>{" "}
              be shown again. Store it in a safe place.
            </Text>

            {/* Recovery key display box */}
            <View
              style={[
                styles.recoveryKeyBox,
                {
                  backgroundColor: colors.background,
                  borderColor: colors.divider,
                },
              ]}
            >
              <Text
                selectable
                style={[styles.recoveryKeyText, { color: colors.textPrimary }]}
              >
                {pendingRecoveryKey}
              </Text>
            </View>

            {/* Copy button */}
            <TouchableOpacity
              style={[
                styles.formButton,
                styles.copyButton,
                {
                  borderColor: copiedRecoveryKey ? "#10B981" : colors.primary,
                  backgroundColor: copiedRecoveryKey
                    ? "#10B98115"
                    : colors.primary + "15",
                  marginBottom: spacing.md,
                },
              ]}
              onPress={handleCopyRecoveryKey}
            >
              <View style={styles.copyButtonContent}>
                <Feather
                  name={copiedRecoveryKey ? "check" : "copy"}
                  size={16}
                  color={copiedRecoveryKey ? "#10B981" : colors.primary}
                />
                <Text
                  style={[
                    styles.copyButtonText,
                    { color: copiedRecoveryKey ? "#10B981" : colors.primary },
                  ]}
                >
                  {copiedRecoveryKey
                    ? "Copied to Clipboard!"
                    : "Copy Recovery Key"}
                </Text>
              </View>
            </TouchableOpacity>

            {/* I saved it button */}
            <TouchableOpacity
              style={[
                styles.formButton,
                styles.submitButton,
                { backgroundColor: colors.primary, width: "100%" },
              ]}
              onPress={handleDismissRecoveryKeyModal}
            >
              <Text style={styles.submitButtonText}>I Saved It — Continue</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* v2 vault lock screen */}
      {vaultVersion === "v2" && !isUnlocked ? (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.unlockContainer}
        >
          <View
            style={[
              styles.unlockCard,
              { backgroundColor: colors.secondaryBackground },
            ]}
          >
            {isRecoveryMode ? (
              /* Recovery Key Unlock View */
              <>
                <View
                  style={[
                    styles.unlockIconCircle,
                    { backgroundColor: colors.primary + "1A" },
                  ]}
                >
                  <Feather name="key" size={36} color={colors.primary} />
                </View>

                <Text
                  style={[styles.unlockTitle, { color: colors.textPrimary }]}
                >
                  Account Recovery
                </Text>
                <Text
                  style={[
                    styles.unlockSubtitle,
                    { color: colors.textSecondary },
                  ]}
                >
                  Enter your 64-character recovery key (with or without hyphens)
                  to unlock your vault.
                </Text>

                {vaultError && (
                  <View style={styles.errorBanner}>
                    <Feather
                      name="alert-circle"
                      size={16}
                      color={colors.expense}
                    />
                    <Text style={[styles.errorText, { color: colors.expense }]}>
                      {vaultError}
                    </Text>
                  </View>
                )}

                <View style={{ width: "100%", marginBottom: spacing.md }}>
                  <TextInput
                    style={[
                      styles.input,
                      styles.recoveryTextInput,
                      {
                        color: colors.textPrimary,
                        borderColor: colors.divider,
                      },
                    ]}
                    placeholder="XXXX-XXXX-XXXX-XXXX-..."
                    placeholderTextColor={colors.textSecondary}
                    value={recoveryKeyInput}
                    onChangeText={(text) => {
                      setRecoveryKeyInput(text);
                      if (vaultError) clearVaultError();
                    }}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    multiline
                    numberOfLines={3}
                    editable={!isRecovering && !isVaultLoading}
                  />
                </View>

                <TouchableOpacity
                  style={[
                    styles.formButton,
                    styles.submitButton,
                    {
                      backgroundColor: colors.primary,
                      opacity: isRecovering || isVaultLoading ? 0.7 : 1,
                      width: "100%",
                      marginBottom: spacing.md,
                    },
                  ]}
                  onPress={handleRecoveryUnlock}
                  disabled={isRecovering || isVaultLoading}
                >
                  {isRecovering || isVaultLoading ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.submitButtonText}>
                      Unlock with Recovery Key
                    </Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.recoveryKeyLink}
                  onPress={() => {
                    setIsRecoveryMode(false);
                    setRecoveryKeyInput("");
                    if (vaultError) clearVaultError();
                  }}
                  disabled={isRecovering || isVaultLoading}
                >
                  <Feather name="arrow-left" size={14} color={colors.primary} />
                  <Text
                    style={[
                      styles.recoveryKeyLinkText,
                      { color: colors.primary },
                    ]}
                  >
                    Back to Password / Biometric Unlock
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              /* Password / Biometric Unlock View */
              <>
                <View
                  style={[
                    styles.unlockIconCircle,
                    { backgroundColor: colors.primary + "1A" },
                  ]}
                >
                  <Feather name="shield" size={36} color={colors.primary} />
                </View>

                <Text
                  style={[styles.unlockTitle, { color: colors.textPrimary }]}
                >
                  Unlock Password Vault
                </Text>
                <Text
                  style={[
                    styles.unlockSubtitle,
                    { color: colors.textSecondary },
                  ]}
                >
                  Enter your AuraTrack login password to derive your vault
                  encryption key locally using Argon2id.
                </Text>

                {vaultError && (
                  <View style={styles.errorBanner}>
                    <Feather
                      name="alert-circle"
                      size={16}
                      color={colors.expense}
                    />
                    <Text style={[styles.errorText, { color: colors.expense }]}>
                      {vaultError}
                    </Text>
                  </View>
                )}

                {hasBiometricSetup && isBiometricAvailable && (
                  <TouchableOpacity
                    style={[
                      styles.formButton,
                      styles.biometricButton,
                      {
                        backgroundColor: colors.primary + "15",
                        borderColor: colors.primary,
                      },
                    ]}
                    onPress={handleBiometricUnlock}
                    disabled={
                      isDerivingKey ||
                      isVaultLoading ||
                      isBiometricAuthenticating
                    }
                  >
                    {isBiometricAuthenticating ? (
                      <ActivityIndicator color={colors.primary} size="small" />
                    ) : (
                      <View style={styles.biometricButtonContent}>
                        <Feather
                          name="shield"
                          size={18}
                          color={colors.primary}
                        />
                        <Text
                          style={[
                            styles.biometricButtonText,
                            { color: colors.primary },
                          ]}
                        >
                          Unlock with Biometrics
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                )}

                {hasBiometricSetup && isBiometricAvailable && (
                  <View style={styles.orDividerContainer}>
                    <View
                      style={[
                        styles.dividerLine,
                        { backgroundColor: colors.divider },
                      ]}
                    />
                    <Text
                      style={[
                        styles.orDividerText,
                        { color: colors.textSecondary },
                      ]}
                    >
                      OR USE PASSWORD
                    </Text>
                    <View
                      style={[
                        styles.dividerLine,
                        { backgroundColor: colors.divider },
                      ]}
                    />
                  </View>
                )}

                <View style={styles.passwordInputContainer}>
                  <TextInput
                    style={[
                      styles.input,
                      styles.passwordInput,
                      {
                        color: colors.textPrimary,
                        borderColor: colors.divider,
                      },
                    ]}
                    placeholder="Account password"
                    placeholderTextColor={colors.textSecondary}
                    value={unlockPassword}
                    onChangeText={(text) => {
                      setUnlockPassword(text);
                      if (vaultError) clearVaultError();
                    }}
                    secureTextEntry={!unlockPasswordVisible}
                    autoCapitalize="none"
                    editable={!isDerivingKey && !isVaultLoading}
                  />
                  <TouchableOpacity
                    onPress={() => setUnlockPasswordVisible((prev) => !prev)}
                    style={styles.formEyeButton}
                  >
                    <Feather
                      name={unlockPasswordVisible ? "eye-off" : "eye"}
                      size={18}
                      color={colors.textSecondary}
                    />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={[
                    styles.formButton,
                    styles.submitButton,
                    {
                      backgroundColor: colors.primary,
                      opacity: isDerivingKey || isVaultLoading ? 0.7 : 1,
                    },
                  ]}
                  onPress={handleUnlock}
                  disabled={isDerivingKey || isVaultLoading}
                >
                  {isDerivingKey || isVaultLoading ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.submitButtonText}>Unlock Vault</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.recoveryKeyLink}
                  onPress={() => {
                    setIsRecoveryMode(true);
                    if (vaultError) clearVaultError();
                  }}
                  disabled={isDerivingKey || isVaultLoading}
                >
                  <Feather name="key" size={14} color={colors.primary} />
                  <Text
                    style={[
                      styles.recoveryKeyLinkText,
                      { color: colors.primary },
                    ]}
                  >
                    Lost password? Use Recovery Key
                  </Text>
                </TouchableOpacity>

                <Text
                  style={[
                    styles.unlockSecurityNote,
                    { color: colors.textSecondary },
                  ]}
                >
                  🔒 Zero-Knowledge Security: Your password is never sent to the
                  server.
                </Text>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      ) : (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Upgrade banner for v1 users if they clicked 'Later' */}
            {vaultVersion === "v1" && migrationStatus !== "completed" && (
              <View
                style={[
                  styles.upgradeBanner,
                  {
                    backgroundColor: colors.primary + "15",
                    borderColor: colors.primary,
                  },
                ]}
              >
                <Feather name="shield" size={24} color={colors.primary} />
                <View style={styles.upgradeBannerTextContainer}>
                  <Text
                    style={[
                      styles.upgradeBannerTitle,
                      { color: colors.textPrimary },
                    ]}
                  >
                    Upgrade Vault Security
                  </Text>
                  <Text
                    style={[
                      styles.upgradeBannerSubtitle,
                      { color: colors.textSecondary },
                    ]}
                  >
                    Protect your passwords with zero-knowledge encryption.
                  </Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.upgradeBannerButton,
                    { backgroundColor: colors.primary },
                  ]}
                  onPress={() => {
                    setShowMigrationModal(true);
                    setMigrationError(null);
                  }}
                >
                  <Text style={styles.upgradeBannerButtonText}>Upgrade</Text>
                </TouchableOpacity>
              </View>
            )}

            <View
              style={[
                styles.searchContainer,
                {
                  borderColor: colors.divider,
                  backgroundColor: colors.secondaryBackground,
                },
              ]}
            >
              <Feather name="search" size={18} color={colors.textSecondary} />
              <TextInput
                style={[styles.searchInput, { color: colors.textPrimary }]}
                placeholder="Search by title"
                placeholderTextColor={colors.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>

            {/* Persistent Form */}
            <View
              style={[
                styles.form,
                { backgroundColor: colors.secondaryBackground },
              ]}
            >
              <Text style={[styles.formTitle, { color: colors.textPrimary }]}>
                {editingId ? "Edit Password" : "Add New Password"}
              </Text>

              <TextInput
                style={[
                  styles.input,
                  { color: colors.textPrimary, borderColor: colors.divider },
                ]}
                placeholder="Title (e.g., Google Account)"
                placeholderTextColor={colors.textSecondary}
                value={title}
                onChangeText={setTitle}
              />

              <TextInput
                style={[
                  styles.input,
                  { color: colors.textPrimary, borderColor: colors.divider },
                ]}
                placeholder="Username / Email"
                placeholderTextColor={colors.textSecondary}
                value={key}
                onChangeText={setKey}
                autoCapitalize="none"
              />

              <View style={styles.passwordInputContainer}>
                <TextInput
                  style={[
                    styles.input,
                    styles.passwordInput,
                    { color: colors.textPrimary, borderColor: colors.divider },
                  ]}
                  placeholder="Password"
                  placeholderTextColor={colors.textSecondary}
                  value={value}
                  onChangeText={setValue}
                  secureTextEntry={!formPasswordVisible}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  onPress={() => setFormPasswordVisible((prev) => !prev)}
                  style={styles.formEyeButton}
                >
                  <Feather
                    name={formPasswordVisible ? "eye-off" : "eye"}
                    size={18}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>
              </View>

              <View style={styles.formActions}>
                {editingId && (
                  <TouchableOpacity
                    style={[
                      styles.formButton,
                      styles.cancelButton,
                      { borderColor: colors.divider },
                    ]}
                    onPress={resetForm}
                  >
                    <Text
                      style={[
                        styles.formButtonText,
                        { color: colors.textPrimary },
                      ]}
                    >
                      Cancel
                    </Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[
                    styles.formButton,
                    styles.submitButton,
                    { backgroundColor: colors.primary },
                  ]}
                  onPress={handleSubmit}
                >
                  <Text style={styles.submitButtonText}>
                    {editingId ? "Update" : "Save"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* List */}
            {filteredEntries.length > 0 ? (
              <FlatList
                data={filteredEntries}
                renderItem={renderItem}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
                contentContainerStyle={styles.listContainer}
              />
            ) : (
              <View style={styles.emptyContainer}>
                <Feather
                  name="lock"
                  size={60}
                  color={colors.textSecondary}
                  opacity={0.5}
                />
                <Text
                  style={[styles.emptyText, { color: colors.textSecondary }]}
                >
                  No passwords saved yet.
                </Text>
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  backButton: {
    padding: spacing.sm,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    fontFamily: typography.family,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing["2xl"],
  },
  upgradeBanner: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 14,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  upgradeBannerTextContainer: {
    flex: 1,
    marginHorizontal: spacing.sm,
  },
  upgradeBannerTitle: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: typography.family,
  },
  upgradeBannerSubtitle: {
    fontSize: 12,
    fontFamily: typography.family,
    marginTop: 2,
  },
  upgradeBannerButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
  },
  upgradeBannerButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
    fontFamily: typography.family,
  },
  form: {
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.lg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: 56,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  searchInput: {
    flex: 1,
    minHeight: 54,
    paddingVertical: spacing.sm,
    fontSize: 16,
    fontFamily: typography.family,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: "600",
    fontFamily: typography.family,
    marginBottom: spacing.md,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 16,
    fontFamily: typography.family,
    marginBottom: spacing.md,
  },
  passwordInputContainer: {
    position: "relative",
  },
  passwordInput: {
    paddingRight: spacing.xl,
  },
  formEyeButton: {
    position: "absolute",
    right: spacing.sm,
    top: 14,
    padding: 4,
  },
  formActions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  formButton: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: spacing.md,
    alignItems: "center",
    borderWidth: 1,
  },
  cancelButton: {
    backgroundColor: "transparent",
  },
  formButtonText: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: typography.family,
  },
  submitButton: {},
  submitButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: typography.family,
  },
  listContainer: {
    paddingBottom: spacing.sm,
  },
  card: {
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: typography.family,
  },
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  actionButton: {
    padding: 4,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: 4,
  },
  detailText: {
    fontSize: 14,
    fontFamily: typography.family,
    flex: 1,
  },
  eyeButton: {
    padding: 4,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing["3xl"],
    gap: spacing.md,
  },
  emptyText: {
    fontSize: 16,
    fontFamily: typography.family,
    textAlign: "center",
  },
  unlockContainer: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  unlockCard: {
    borderRadius: 20,
    padding: spacing.xl,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  unlockIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  unlockTitle: {
    fontSize: 20,
    fontWeight: "700",
    fontFamily: typography.family,
    marginBottom: spacing.xs,
    textAlign: "center",
  },
  unlockSubtitle: {
    fontSize: 14,
    fontFamily: typography.family,
    textAlign: "center",
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: "rgba(235, 87, 87, 0.1)",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    marginBottom: spacing.md,
    width: "100%",
  },
  errorText: {
    fontSize: 13,
    fontFamily: typography.family,
    flex: 1,
  },
  unlockSecurityNote: {
    fontSize: 12,
    fontFamily: typography.family,
    textAlign: "center",
    marginTop: spacing.lg,
    lineHeight: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
  },
  modalKeyboardAvoiding: {
    width: "100%",
    alignItems: "center",
  },
  migrationModalCard: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 20,
    padding: spacing.xl,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  migrationPromptContainer: {
    width: "100%",
    alignItems: "center",
  },
  migrationProgressContainer: {
    width: "100%",
    alignItems: "center",
    paddingVertical: spacing.md,
  },
  migrationSuccessContainer: {
    width: "100%",
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  progressContainer: {
    width: "100%",
    marginVertical: spacing.lg,
    alignItems: "center",
  },
  progressBarBackground: {
    width: "100%",
    height: 10,
    borderRadius: 5,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 5,
  },
  progressPercent: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: typography.family,
    marginTop: spacing.xs,
  },
  migrationActions: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.sm,
    width: "100%",
  },
  biometricButton: {
    width: "100%",
    marginBottom: spacing.md,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  biometricButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  biometricButtonText: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: typography.family,
  },
  orDividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  orDividerText: {
    fontSize: 11,
    fontWeight: "600",
    fontFamily: typography.family,
    letterSpacing: 0.5,
  },
  recoveryKeyBox: {
    borderWidth: 1,
    borderRadius: 10,
    padding: spacing.md,
    width: "100%",
    marginBottom: spacing.md,
  },
  recoveryKeyText: {
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 1,
    textAlign: "center",
    lineHeight: 22,
  },
  recoveryTextInput: {
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    fontSize: 13,
    minHeight: 80,
    textAlignVertical: "top",
    paddingTop: spacing.sm,
  },
  copyButton: {
    borderWidth: 1,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  copyButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  copyButtonText: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: typography.family,
  },
  recoveryKeyLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: spacing.md,
    padding: spacing.xs,
  },
  recoveryKeyLinkText: {
    fontSize: 13,
    fontWeight: "600",
    fontFamily: typography.family,
  },
});
