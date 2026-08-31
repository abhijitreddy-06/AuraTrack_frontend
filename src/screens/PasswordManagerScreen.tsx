import React, { useState, useEffect } from "react";
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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "../hooks/useTheme";
import { spacing } from "../theme/spacing";
import { typography } from "../theme/typography";
import {
  PasswordEntry,
  PasswordEntrySummary,
  createPassword,
  deletePassword,
  getPasswordSecret,
  getPasswords,
  updatePassword,
} from "../services/passwords";

export const PasswordManagerScreen: React.FC = () => {
  const { colors, isDark } = useTheme();
  const router = useRouter();
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
    void loadEntries();
  }, []);

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

  const handleSubmit = async () => {
    // Validation
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
      if (editingId) {
        await updatePassword(editingId, {
          title: title.trim(),
          key: key.trim(),
          value,
        });
      } else {
        await createPassword({ title: title.trim(), key: key.trim(), value });
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

  const handleEdit = async (item: PasswordEntrySummary) => {
    try {
      const response = await getPasswordSecret(item.id);
      setTitle(item.title);
      setKey(response.data.key);
      setValue(response.data.value);
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

  const toggleShowPassword = async (id: string) => {
    if (showPassword[id]) {
      setShowPassword((prev) => ({
        ...prev,
        [id]: false,
      }));
      setRevealedSecrets((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      return;
    }

    setLoadingSecrets((prev) => ({ ...prev, [id]: true }));
    try {
      const response = await getPasswordSecret(id);
      setRevealedSecrets((prev) => ({
        ...prev,
        [id]: {
          key: response.data.key,
          value: response.data.value,
        },
      }));
      setShowPassword((prev) => ({
        ...prev,
        [id]: true,
      }));
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
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No passwords saved yet.
              </Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
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
});
