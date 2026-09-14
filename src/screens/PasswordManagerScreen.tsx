import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Keyboard,
  StyleSheet,
  FlatList,
  Alert,
  StatusBar,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
  Animated,
  Easing,
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
  createPasswordV2,
  deletePassword,
  getPasswordSecret,
  getPasswords,
  updatePasswordV2,
} from "../services/passwords";

const formatCountdown = (totalSeconds: number) => {
  const clamped = Math.max(0, totalSeconds);
  const minutes = Math.floor(clamped / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (clamped % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
};

export const PasswordManagerScreen: React.FC = () => {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const {
    vaultVersion,
    isUnlocked,
    dek,
    isLoading: isVaultLoading,
    metadata,
    error: vaultError,
    isBiometricAvailable,
    hasBiometricSetup,
    pendingRecoveryKey,
    loadMetadata,
    unlockVaultWithPassword,
    unlockVaultWithBiometrics,
    unlockVaultWithRecoveryKey,
    clearPendingRecoveryKey,
    clearError: clearVaultError,
  } = useVault();

  const [unlockPassword, setUnlockPassword] = useState("");
  const [unlockPasswordVisible, setUnlockPasswordVisible] = useState(false);
  const [isDerivingKey, setIsDerivingKey] = useState(false);
  const [localUnlockError, setLocalUnlockError] = useState<string | null>(null);
  const [isBiometricAuthenticating, setIsBiometricAuthenticating] =
    useState(false);
  const hasAutoPromptedBiometrics = useRef(false);

  // Phase 8 Recovery Key state
  const [copiedRecoveryKey, setCopiedRecoveryKey] = useState(false);
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const [recoveryKeyInput, setRecoveryKeyInput] = useState("");
  const [localRecoveryError, setLocalRecoveryError] = useState<string | null>(
    null,
  );
  const [isRecovering, setIsRecovering] = useState(false);

  const [entries, setEntries] = useState<PasswordEntrySummary[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [formPasswordVisible, setFormPasswordVisible] = useState(false);
  const [isSavingEntry, setIsSavingEntry] = useState(false);
  const [showPassword, setShowPassword] = useState<{ [id: string]: boolean }>(
    {},
  );
  const [revealedSecrets, setRevealedSecrets] = useState<{
    [id: string]: { key: string; value: string };
  }>({});
  const [loadingSecrets, setLoadingSecrets] = useState<{
    [id: string]: boolean;
  }>({});

  // Full-screen loading overlay is for slow KDF paths (password / recovery unlock)
  const isProcessing = isDerivingKey || isRecovering;

  const [countdownSeconds, setCountdownSeconds] = useState(60);
  const processingTimerRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );

  useEffect(() => {
    if (isProcessing) {
      const startTime = Date.now();
      setCountdownSeconds(300);
      processingTimerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        setCountdownSeconds(Math.max(0, 300 - elapsed));
      }, 200);
    } else if (processingTimerRef.current) {
      clearInterval(processingTimerRef.current);
      processingTimerRef.current = null;
    }
    return () => {
      if (processingTimerRef.current) {
        clearInterval(processingTimerRef.current);
        processingTimerRef.current = null;
      }
    };
  }, [isProcessing]);

  useEffect(() => {
    void loadMetadata();
  }, [loadMetadata]);

  useEffect(() => {
    if (isUnlocked) {
      void loadEntries();
    }
  }, [isUnlocked]);

  const handleUnlock = async () => {
    if (isDerivingKey || isVaultLoading) return;
    if (!unlockPassword.trim()) {
      setLocalUnlockError("Please enter your login password to continue.");
      return;
    }
    Keyboard.dismiss();
    setIsDerivingKey(true);
    setLocalUnlockError(null);
    clearVaultError();

    // Yield to the JS event loop so the UI and loading screen render before CPU-heavy Argon2 derivation begins
    await new Promise((resolve) => setTimeout(resolve, 80));

    try {
      const success = await unlockVaultWithPassword(unlockPassword);
      if (success) {
        setUnlockPassword("");
        setLocalUnlockError(null);
      } else {
        setLocalUnlockError("Incorrect password. Please try again.");
      }
    } catch {
      setLocalUnlockError("Incorrect password. Please try again.");
    } finally {
      setIsDerivingKey(false);
    }
  };

  const handleBiometricUnlock = async () => {
    if (isBiometricAuthenticating || isDerivingKey || isVaultLoading) return;
    setIsBiometricAuthenticating(true);
    setLocalUnlockError(null);
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
        "Did you save your recovery key?",
        "You won't be able to see this key again. Make sure you've copied it somewhere safe before continuing.",
        [
          { text: "Go back", style: "cancel" },
          {
            text: "Yes, I saved it",
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
    if (isRecovering || isVaultLoading) return;
    if (!recoveryKeyInput.trim()) {
      setLocalRecoveryError("Please enter your recovery key to continue.");
      return;
    }
    Keyboard.dismiss();
    setIsRecovering(true);
    setLocalRecoveryError(null);
    clearVaultError();

    // Yield to the JS event loop so the UI and loading screen render before CPU-heavy Argon2 derivation begins
    await new Promise((resolve) => setTimeout(resolve, 80));

    try {
      const success = await unlockVaultWithRecoveryKey(recoveryKeyInput.trim());
      if (success) {
        setRecoveryKeyInput("");
        setIsRecoveryMode(false);
        setLocalRecoveryError(null);
      } else {
        setLocalRecoveryError(
          "Invalid recovery key. Please check and try again.",
        );
      }
    } catch {
      setLocalRecoveryError(
        "Invalid recovery key. Please check and try again.",
      );
    } finally {
      setIsRecovering(false);
    }
  };

  // Reset auto-prompt flag whenever vault unlocks, so the next lock
  // cycle can prompt again.
  useEffect(() => {
    if (isUnlocked) {
      hasAutoPromptedBiometrics.current = false;
    }
  }, [isUnlocked]);

  // Auto-prompt biometric ONCE when the locked screen opens.
  // The OS handles the face/fingerprint sheet — no full-screen overlay.
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vaultVersion, isUnlocked, hasBiometricSetup, isBiometricAvailable]);

  const loadEntries = async () => {
    try {
      const response = await getPasswords();
      setEntries(response.data);
    } catch (error) {
      Alert.alert(
        "Couldn't load your passwords",
        error instanceof Error ? error.message : "Please try again.",
      );
    }
  };

  const handleSubmit = async () => {
    if (isSavingEntry) return;
    if (!title.trim()) {
      Alert.alert(
        "Missing title",
        "Please enter a title (e.g., Google Account).",
      );
      return;
    }
    if (!key.trim()) {
      Alert.alert("Missing username", "Please enter a username or email.");
      return;
    }
    if (!value.trim()) {
      Alert.alert("Missing password", "Please enter a password.");
      return;
    }

    setIsSavingEntry(true);
    try {
      if (!dek) {
        Alert.alert(
          "Password Manager is locked",
          "Please unlock Password Manager before saving passwords.",
        );
        return;
      }

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

      await loadEntries();
      resetForm();
    } catch (error) {
      Alert.alert(
        "Couldn't save password",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setIsSavingEntry(false);
    }
  };

  const resetForm = () => {
    setTitle("");
    setKey("");
    setValue("");
    setFormPasswordVisible(false);
    setEditingId(null);
  };

  const handleEdit = async (item: PasswordEntrySummary) => {
    try {
      if (!dek) {
        Alert.alert(
          "Password Manager is locked",
          "Please unlock Password Manager to edit this entry.",
        );
        return;
      }
      const response = await getPasswordSecret(item.id);
      const rawKey = response.data.key;
      const rawValue = response.data.value;

      setTitle(item.title);
      setKey(await decryptField(rawKey, dek));
      setValue(await decryptField(rawValue, dek));

      setFormPasswordVisible(false);
      setEditingId(item.id);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Please try again.";
      Alert.alert(
        "Couldn't open this entry",
        msg.includes("wrong DEK")
          ? "This entry couldn't be unlocked. Please delete it and add it again."
          : msg,
      );
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert("Delete this entry?", "This can't be undone.", [
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
                "Couldn't delete this entry",
                error instanceof Error ? error.message : "Please try again.",
              );
            }
          })(),
      },
    ]);
  };

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

    if (!dek) {
      Alert.alert(
        "Password Manager is locked",
        "Please unlock Password Manager to view this password.",
      );
      return;
    }

    setLoadingSecrets((prev) => ({ ...prev, [id]: true }));
    try {
      const response = await getPasswordSecret(id);
      const rawKey = response.data.key;
      const rawValue = response.data.value;

      const plainKey = await decryptField(rawKey, dek);
      const plainValue = await decryptField(rawValue, dek);

      setRevealedSecrets((prev) => ({
        ...prev,
        [id]: { key: plainKey, value: plainValue },
      }));
      setShowPassword((prev) => ({ ...prev, [id]: true }));
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Please try again.";
      Alert.alert(
        "Couldn't reveal this password",
        msg.includes("wrong DEK")
          ? "This entry couldn't be unlocked. Please delete it and add it again."
          : msg,
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
            {isVisible && secret ? secret.key : "Tap the eye icon to reveal"}
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

      {/* Full-screen loading overlay — password / recovery unlock only */}
      <Modal
        visible={isProcessing}
        transparent={false}
        animationType="fade"
        presentationStyle="fullScreen"
        statusBarTranslucent
        onRequestClose={() => {}}
      >
        <SafeAreaView
          style={[styles.loadingScreen, { backgroundColor: colors.background }]}
        >
          <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
          <View style={styles.loadingContent}>
            <View style={styles.loadingIndicatorWrapper}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>

            <Text style={[styles.loadingTimer, { color: colors.textPrimary }]}>
              {formatCountdown(countdownSeconds)}
            </Text>

            <Text
              style={[
                styles.loadingVerifyingText,
                { color: colors.textSecondary },
              ]}
            >
              Verifying.... Please keep the app open.
            </Text>
          </View>
        </SafeAreaView>
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
              styles.modalCard,
              {
                backgroundColor: colors.secondaryBackground,
                borderColor: isDark
                  ? "rgba(255, 255, 255, 0.1)"
                  : "rgba(0, 0, 0, 0.08)",
              },
            ]}
          >
            <ScrollView
              style={{ width: "100%" }}
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              <View
                style={[
                  styles.unlockIconCircle,
                  { backgroundColor: colors.primary + "18" },
                ]}
              >
                <Feather name="key" size={32} color={colors.primary} />
              </View>

              <Text style={[styles.unlockTitle, { color: colors.textPrimary }]}>
                Save your recovery key
              </Text>

              <Text
                style={[
                  styles.unlockSubtitle,
                  { color: colors.textSecondary, marginBottom: spacing.md },
                ]}
              >
                If you ever forget your password, this key is the{" "}
                <Text style={{ fontWeight: "700", color: colors.textPrimary }}>
                  only
                </Text>{" "}
                way to get your passwords back.
                {"\n\n"}
                We can't show it to you again after this, so save it somewhere
                safe now.
              </Text>

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
                  style={[
                    styles.recoveryKeyText,
                    { color: colors.textPrimary },
                  ]}
                >
                  {pendingRecoveryKey}
                </Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.primaryButton,
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
                activeOpacity={0.8}
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
                      ? "Copied to clipboard!"
                      : "Copy recovery key"}
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  { backgroundColor: colors.primary },
                ]}
                onPress={handleDismissRecoveryKeyModal}
                activeOpacity={0.8}
              >
                <Text style={styles.submitButtonText}>I've saved it</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Vault lock screen */}
      {!isUnlocked ? (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.unlockContainer}
        >
          <ScrollView
            contentContainerStyle={styles.unlockScrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            <TouchableWithoutFeedback
              onPress={Keyboard.dismiss}
              accessible={false}
            >
              <View style={styles.unlockCardWrapper}>
                <View
                  style={[
                    styles.unlockCard,
                    {
                      backgroundColor: colors.secondaryBackground,
                      borderColor: isDark
                        ? "rgba(255, 255, 255, 0.08)"
                        : "rgba(0, 0, 0, 0.06)",
                    },
                  ]}
                >
                  {isRecoveryMode ? (
                    /* Recovery Key Unlock View */
                    <>
                      <View
                        style={[
                          styles.unlockIconCircle,
                          { backgroundColor: colors.primary + "18" },
                        ]}
                      >
                        <Feather name="key" size={32} color={colors.primary} />
                      </View>

                      <Text
                        style={[
                          styles.unlockTitle,
                          { color: colors.textPrimary },
                        ]}
                      >
                        Use Recovery Key
                      </Text>
                      <Text
                        style={[
                          styles.unlockSubtitle,
                          { color: colors.textSecondary },
                        ]}
                      >
                        Enter the recovery key you saved earlier to restore and
                        unlock your vault.
                      </Text>

                      {(localRecoveryError || vaultError) && (
                        <View style={styles.errorBanner}>
                          <Feather
                            name="alert-circle"
                            size={16}
                            color={colors.expense}
                          />
                          <Text
                            style={[
                              styles.errorText,
                              { color: colors.expense },
                            ]}
                          >
                            {localRecoveryError ||
                              vaultError ||
                              "Invalid recovery key. Please check and try again."}
                          </Text>
                        </View>
                      )}

                      <View style={styles.recoveryInputContainer}>
                        <TextInput
                          style={[
                            styles.input,
                            styles.recoveryTextInput,
                            {
                              color: colors.textPrimary,
                              borderColor:
                                localRecoveryError || vaultError
                                  ? colors.expense
                                  : colors.divider,
                              backgroundColor: colors.background,
                            },
                          ]}
                          placeholder="Paste your recovery key here"
                          placeholderTextColor={colors.textSecondary}
                          value={recoveryKeyInput}
                          onChangeText={(text) => {
                            setRecoveryKeyInput(text);
                            if (localRecoveryError) setLocalRecoveryError(null);
                            if (vaultError) clearVaultError();
                          }}
                          autoCapitalize="none"
                          autoCorrect={false}
                          multiline
                          numberOfLines={3}
                          editable={!isRecovering && !isVaultLoading}
                        />
                      </View>

                      <TouchableOpacity
                        style={[
                          styles.primaryButton,
                          {
                            backgroundColor:
                              isRecovering || isVaultLoading
                                ? colors.primary + "CC"
                                : colors.primary,
                            opacity: isRecovering || isVaultLoading ? 0.85 : 1,
                            marginBottom: spacing.md,
                          },
                        ]}
                        onPress={handleRecoveryUnlock}
                        disabled={isRecovering || isVaultLoading}
                        activeOpacity={0.8}
                      >
                        {isRecovering || isVaultLoading ? (
                          <View style={styles.buttonLoadingRow}>
                            <ActivityIndicator size="small" color="#FFFFFF" />
                            <Text style={styles.submitButtonText}>
                              Restoring Vault...
                            </Text>
                          </View>
                        ) : (
                          <Text style={styles.submitButtonText}>
                            Unlock with Recovery Key
                          </Text>
                        )}
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.recoveryBackLink}
                        onPress={() => {
                          setIsRecoveryMode(false);
                          setRecoveryKeyInput("");
                          setLocalRecoveryError(null);
                          if (vaultError) clearVaultError();
                        }}
                        disabled={isRecovering || isVaultLoading}
                        activeOpacity={0.7}
                      >
                        <Feather
                          name="arrow-left"
                          size={14}
                          color={colors.primary}
                        />
                        <Text
                          style={[
                            styles.recoveryBackLinkText,
                            { color: colors.primary },
                          ]}
                        >
                          Back to password unlock
                        </Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    /* Password / Biometric Unlock View */
                    <>
                      <View
                        style={[
                          styles.unlockIconCircle,
                          { backgroundColor: colors.primary + "18" },
                        ]}
                      >
                        <Feather
                          name="shield"
                          size={32}
                          color={colors.primary}
                        />
                      </View>

                      <Text
                        style={[
                          styles.unlockTitle,
                          { color: colors.textPrimary },
                        ]}
                      >
                        Unlock Password Manager
                      </Text>
                      <Text
                        style={[
                          styles.unlockSubtitle,
                          { color: colors.textSecondary },
                        ]}
                      >
                        Enter your login password to access your vault.
                      </Text>

                      {(localUnlockError || vaultError) && (
                        <View style={styles.errorBanner}>
                          <Feather
                            name="alert-circle"
                            size={16}
                            color={colors.expense}
                          />
                          <Text
                            style={[
                              styles.errorText,
                              { color: colors.expense },
                            ]}
                          >
                            {localUnlockError ||
                              vaultError ||
                              "Incorrect password. Please try again."}
                          </Text>
                        </View>
                      )}

                      {hasBiometricSetup && isBiometricAvailable && (
                        <>
                          <TouchableOpacity
                            style={[
                              styles.primaryButton,
                              styles.biometricButton,
                              {
                                backgroundColor: isBiometricAuthenticating
                                  ? colors.primary + "20"
                                  : colors.primary + "12",
                                borderColor: colors.primary,
                                borderWidth: 1,
                              },
                            ]}
                            onPress={handleBiometricUnlock}
                            disabled={
                              isDerivingKey ||
                              isVaultLoading ||
                              isBiometricAuthenticating
                            }
                            activeOpacity={0.75}
                          >
                            <View style={styles.biometricButtonContent}>
                              {isBiometricAuthenticating ? (
                                <ActivityIndicator
                                  size="small"
                                  color={colors.primary}
                                />
                              ) : (
                                <Feather
                                  name="shield"
                                  size={18}
                                  color={colors.primary}
                                />
                              )}
                              <Text
                                style={[
                                  styles.biometricButtonText,
                                  { color: colors.primary },
                                ]}
                              >
                                {isBiometricAuthenticating
                                  ? "Waiting for biometrics…"
                                  : "Unlock with biometrics"}
                              </Text>
                            </View>
                          </TouchableOpacity>

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
                        </>
                      )}

                      <View style={styles.passwordInputContainer}>
                        <TextInput
                          style={[
                            styles.input,
                            styles.passwordInput,
                            {
                              color: colors.textPrimary,
                              borderColor:
                                localUnlockError || vaultError
                                  ? colors.expense
                                  : colors.divider,
                              backgroundColor: colors.background,
                            },
                          ]}
                          placeholder="Login password"
                          placeholderTextColor={colors.textSecondary}
                          value={unlockPassword}
                          onChangeText={(text) => {
                            setUnlockPassword(text);
                            if (localUnlockError) setLocalUnlockError(null);
                            if (vaultError) clearVaultError();
                          }}
                          secureTextEntry={!unlockPasswordVisible}
                          autoCapitalize="none"
                          autoCorrect={false}
                          returnKeyType="done"
                          onSubmitEditing={handleUnlock}
                          editable={!isDerivingKey && !isVaultLoading}
                        />
                        <TouchableOpacity
                          onPress={() =>
                            setUnlockPasswordVisible((prev) => !prev)
                          }
                          style={styles.formEyeButton}
                          disabled={isDerivingKey || isVaultLoading}
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
                          styles.primaryButton,
                          {
                            backgroundColor:
                              isDerivingKey || isVaultLoading
                                ? colors.primary + "CC"
                                : colors.primary,
                            opacity: isDerivingKey || isVaultLoading ? 0.85 : 1,
                          },
                        ]}
                        onPress={handleUnlock}
                        disabled={isDerivingKey || isVaultLoading}
                        activeOpacity={0.8}
                      >
                        {isDerivingKey || isVaultLoading ? (
                          <View style={styles.buttonLoadingRow}>
                            <ActivityIndicator size="small" color="#FFFFFF" />
                            <Text style={styles.submitButtonText}>
                              Unlocking...
                            </Text>
                          </View>
                        ) : (
                          <Text style={styles.submitButtonText}>Unlock</Text>
                        )}
                      </TouchableOpacity>

                      {isDerivingKey && (
                        <Text
                          style={[
                            styles.derivingKeyHint,
                            { color: colors.textSecondary },
                          ]}
                        >
                          Verifying security… this may take a few seconds
                        </Text>
                      )}

                      <View style={styles.recoveryPromptContainer}>
                        <Text
                          style={[
                            styles.recoveryPromptLabel,
                            { color: colors.textSecondary },
                          ]}
                        >
                          Forgot your password?
                        </Text>
                        <TouchableOpacity
                          style={styles.recoveryActionButton}
                          onPress={() => {
                            setIsRecoveryMode(true);
                            setLocalUnlockError(null);
                            if (vaultError) clearVaultError();
                          }}
                          disabled={isDerivingKey || isVaultLoading}
                          activeOpacity={0.7}
                        >
                          <Feather
                            name="key"
                            size={14}
                            color={colors.primary}
                          />
                          <Text
                            style={[
                              styles.recoveryActionText,
                              { color: colors.primary },
                            ]}
                          >
                            Use Recovery Key
                          </Text>
                        </TouchableOpacity>
                      </View>

                      <View style={styles.securityNoteRow}>
                        <Feather
                          name="lock"
                          size={12}
                          color={colors.textSecondary}
                          style={{ opacity: 0.7 }}
                        />
                        <Text
                          style={[
                            styles.unlockSecurityNote,
                            { color: colors.textSecondary },
                          ]}
                        >
                          Only you can decrypt your vault — not even we can see
                          your passwords.
                        </Text>
                      </View>
                    </>
                  )}
                </View>
              </View>
            </TouchableWithoutFeedback>
          </ScrollView>
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
                {editingId ? "Edit password" : "Add new password"}
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
                    {
                      backgroundColor: isSavingEntry
                        ? colors.primary + "CC"
                        : colors.primary,
                      opacity: isSavingEntry ? 0.85 : 1,
                    },
                  ]}
                  onPress={handleSubmit}
                  disabled={isSavingEntry}
                  activeOpacity={0.8}
                >
                  {isSavingEntry ? (
                    <View style={styles.buttonLoadingRow}>
                      <ActivityIndicator size="small" color="#FFFFFF" />
                      <Text style={styles.submitButtonText}>
                        {editingId ? "Updating..." : "Saving..."}
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.submitButtonText}>
                      {editingId ? "Update" : "Save"}
                    </Text>
                  )}
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
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  backButton: { padding: spacing.sm },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    fontFamily: typography.family,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing["2xl"],
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
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    height: 50,
    fontSize: 15,
    fontFamily: typography.family,
    marginBottom: spacing.md,
  },
  // ─── Password input + eye icon (fixed width & height, zero resizing) ────
  passwordInputContainer: {
    width: "100%",
    height: 52,
    position: "relative",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  passwordInput: {
    width: "100%",
    height: 52,
    borderRadius: 12,
    borderWidth: 1.5,
    paddingLeft: spacing.md,
    paddingRight: 48,
    paddingVertical: 0,
    fontSize: 15,
    fontFamily: typography.family,
    marginBottom: 0,
    textAlignVertical: "center",
  },
  formEyeButton: {
    position: "absolute",
    right: 4,
    top: 0,
    bottom: 0,
    width: 44,
    height: 52,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 2,
  },
  formActions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  primaryButton: {
    width: "100%",
    height: 50,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonLoadingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  formButton: {
    flex: 1,
    height: 50,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  cancelButton: { backgroundColor: "transparent" },
  formButtonText: {
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
  },
  submitButton: {},
  submitButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
  },
  listContainer: { paddingBottom: spacing.sm },
  card: {
    borderRadius: 14,
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
  actions: { flexDirection: "row", gap: spacing.sm },
  actionButton: { padding: 4 },
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
  eyeButton: { padding: 4 },
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

  /* ─── Lock screen (Single clean card, zero elevation rectangular bugs) ─── */
  unlockContainer: {
    flex: 1,
    width: "100%",
  },
  unlockScrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
  },
  unlockCardWrapper: {
    width: "100%",
    maxWidth: 420,
    alignItems: "center",
  },
  unlockCard: {
    width: "100%",
    borderRadius: 24,
    borderWidth: 1,
    overflow: "hidden",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
    alignItems: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
      },
      android: {
        elevation: 0, // Prevents Android rectangular shadow box artifact around rounded corners
      },
    }),
  },
  unlockIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  unlockTitle: {
    fontSize: 21,
    fontWeight: "700",
    fontFamily: typography.family,
    marginBottom: 6,
    textAlign: "center",
  },
  unlockSubtitle: {
    fontSize: 14,
    fontFamily: typography.family,
    textAlign: "center",
    marginBottom: spacing.lg,
    lineHeight: 20,
    paddingHorizontal: spacing.xs,
  },
  derivingKeyHint: {
    fontSize: 12,
    fontFamily: typography.family,
    textAlign: "center",
    marginTop: spacing.sm,
    lineHeight: 16,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 12,
    marginBottom: spacing.md,
    width: "100%",
  },
  errorText: {
    fontSize: 13,
    fontWeight: "500",
    fontFamily: typography.family,
    flex: 1,
    lineHeight: 18,
  },

  /* ─── Clear Recovery Section ─────────────────────────────────────── */
  recoveryPromptContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.lg,
    gap: 4,
  },
  recoveryPromptLabel: {
    fontSize: 13,
    fontFamily: typography.family,
  },
  recoveryActionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  recoveryActionText: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: typography.family,
  },
  securityNoteRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: spacing.xl,
    paddingHorizontal: spacing.xs,
  },
  unlockSecurityNote: {
    fontSize: 12,
    fontFamily: typography.family,
    textAlign: "center",
    lineHeight: 16,
  },

  /* ─── Recovery Mode View ─────────────────────────────────────────── */
  recoveryInputContainer: {
    width: "100%",
    marginBottom: spacing.md,
  },
  recoveryTextInput: {
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    fontSize: 13,
    minHeight: 84,
    borderRadius: 12,
    borderWidth: 1.5,
    textAlignVertical: "top",
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.md,
    lineHeight: 20,
  },
  recoveryBackLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: spacing.sm,
    padding: spacing.xs,
  },
  recoveryBackLinkText: {
    fontSize: 13,
    fontWeight: "600",
    fontFamily: typography.family,
  },

  /* ─── Modal shell ────────────────────────────────────────────────── */
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
  modalCard: {
    width: "100%",
    maxWidth: 420,
    maxHeight: "88%",
    borderRadius: 24,
    borderWidth: 1,
    overflow: "hidden",
    alignItems: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 24,
      },
      android: {
        elevation: 0, // Prevents square shadow artifacts in Android Modal
      },
    }),
  },
  modalScrollContent: {
    width: "100%",
    alignItems: "center",
    padding: spacing.xl,
  },

  /* ─── Biometric button ───────────────────────────────────────────── */
  biometricButton: {
    width: "100%",
    height: 48,
    borderRadius: 12,
    marginBottom: spacing.xs,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  biometricButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  biometricButtonText: { fontSize: 15, fontWeight: "600" },
  orDividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    marginVertical: spacing.md,
    gap: spacing.sm,
  },
  dividerLine: { flex: 1, height: 1 },
  orDividerText: {
    fontSize: 11,
    fontWeight: "600",
    fontFamily: typography.family,
    letterSpacing: 0.8,
  },

  /* ─── Recovery key modal ─────────────────────────────────────────── */
  recoveryKeyBox: {
    borderWidth: 1.5,
    borderRadius: 14,
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
  copyButton: {
    borderWidth: 1.5,
    width: "100%",
    height: 50,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  copyButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  copyButtonText: { fontSize: 14, fontWeight: "600" },

  /* ─── Full-screen loading overlay ────────────────────────────────── */
  loadingScreen: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingContent: {
    width: "100%",
    maxWidth: 380,
    alignItems: "center",
    paddingHorizontal: spacing.xl,
  },
  loadingIndicatorWrapper: {
    marginBottom: spacing.xl,
  },
  loadingTimer: {
    fontSize: 28,
    fontWeight: "700",
    fontFamily: typography.family,
    marginBottom: spacing.sm,
    letterSpacing: 1,
  },
  loadingVerifyingText: {
    fontSize: 14,
    fontWeight: "500",
    fontFamily: typography.family,
    textAlign: "center",
    lineHeight: 20,
    opacity: 0.85,
  },
});
