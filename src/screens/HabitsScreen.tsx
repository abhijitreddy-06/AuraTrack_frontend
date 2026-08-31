import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Modal,
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
  completeHabit,
  createHabit,
  deleteHabit,
  getHabits,
  Habit,
  updateHabit,
} from "../services/habits";

export const HabitsScreen: React.FC = () => {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newHabitName, setNewHabitName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHabits();
  }, []);

  const loadHabits = async () => {
    try {
      const result = await getHabits();
      setHabits(result.data);
    } catch (error) {
      Alert.alert(
        "Unable to load habits",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const closeModal = () => {
    setModalVisible(false);
    setEditingId(null);
    setNewHabitName("");
  };

  const handleAddHabit = async () => {
    const trimmed = newHabitName.trim();
    if (!trimmed) {
      Alert.alert("Validation", "Please enter a habit name.");
      return;
    }
    try {
      const result = await createHabit(trimmed);
      setHabits((current) => [result.data, ...current]);
      closeModal();
    } catch (error) {
      Alert.alert(
        "Unable to create habit",
        error instanceof Error ? error.message : "Please try again.",
      );
    }
  };

  const handleEditHabit = (habit: Habit) => {
    setEditingId(habit.id);
    setNewHabitName(habit.title);
    setModalVisible(true);
  };

  const handleUpdateHabit = async () => {
    const trimmed = newHabitName.trim();
    if (!trimmed) {
      Alert.alert("Validation", "Please enter a habit name.");
      return;
    }
    if (!editingId) return;
    try {
      const result = await updateHabit(editingId, trimmed);
      setHabits((current) =>
        current.map((habit) => (habit.id === editingId ? result.data : habit)),
      );
      closeModal();
    } catch (error) {
      Alert.alert(
        "Unable to update habit",
        error instanceof Error ? error.message : "Please try again.",
      );
    }
  };

  const handleDeleteHabit = (id: string) => {
    Alert.alert(
      "Delete Habit",
      "Are you sure you want to delete this habit? All progress will be lost.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteHabit(id);
              setHabits((current) =>
                current.filter((habit) => habit.id !== id),
              );
            } catch (error) {
              Alert.alert(
                "Unable to delete habit",
                error instanceof Error ? error.message : "Please try again.",
              );
            }
          },
        },
      ],
    );
  };

  const toggleCompletion = async (habit: Habit) => {
    if (habit.today_done) return;
    try {
      const result = await completeHabit(habit.id);
      setHabits((current) =>
        current.map((item) => (item.id === habit.id ? result.data : item)),
      );
    } catch (error) {
      Alert.alert(
        "Unable to mark habit",
        error instanceof Error ? error.message : "Please try again.",
      );
    }
  };

  const renderHabit = ({ item }: { item: Habit }) => {
    const doneToday = item.today_done;
    const streak = item.current_streak;

    return (
      <View
        style={[styles.card, { backgroundColor: colors.secondaryBackground }]}
      >
        <View style={styles.cardHeader}>
          <Text style={[styles.habitName, { color: colors.textPrimary }]}>
            {item.title}
          </Text>
          <View style={styles.actions}>
            <TouchableOpacity
              onPress={() => handleEditHabit(item)}
              style={styles.actionButton}
            >
              <Feather name="edit-2" size={18} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleDeleteHabit(item.id)}
              style={styles.actionButton}
            >
              <Feather name="trash-2" size={18} color={colors.expense} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.primary }]}>
              {streak}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              Day Streak
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.income }]}>
              {item.longest_streak}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              Longest Streak
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text
              style={[
                styles.statValue,
                { color: doneToday ? colors.income : colors.textSecondary },
              ]}
            >
              {doneToday ? "âœ…" : "â¬œ"}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              Today
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.textSecondary }]}>
              {item.missed_count}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              Missed
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[
            styles.toggleButton,
            { backgroundColor: doneToday ? colors.income : colors.primary },
          ]}
          onPress={() => toggleCompletion(item)}
        >
          <Text style={styles.toggleButtonText}>
            {doneToday ? "Completed Today" : "Mark Done Today"}
          </Text>
        </TouchableOpacity>

        {item.missed_count > 0 && (
          <View style={styles.missedContainer}>
            <Text style={[styles.missedLabel, { color: colors.textSecondary }]}>
              Missed days: {item.missed_count}
            </Text>
          </View>
        )}
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
          Habits
        </Text>
        <TouchableOpacity
          onPress={() => setModalVisible(true)}
          style={styles.addButton}
        >
          <Feather name="plus" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            Loading habits...
          </Text>
        </View>
      ) : habits.length > 0 ? (
        <FlatList
          data={habits}
          renderItem={renderHabit}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Feather
            name="check-circle"
            size={60}
            color={colors.textSecondary}
            opacity={0.5}
          />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            No habits yet. Start building your daily routine!
          </Text>
          <TouchableOpacity
            style={[styles.emptyAddButton, { backgroundColor: colors.primary }]}
            onPress={() => setModalVisible(true)}
          >
            <Text style={styles.emptyAddButtonText}>Add your first habit</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Add/Edit Habit Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          closeModal();
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalContainer}
        >
          <View
            style={[
              styles.modalContent,
              { backgroundColor: colors.secondaryBackground },
            ]}
          >
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
              {editingId ? "Edit Habit" : "Add New Habit"}
            </Text>

            <TextInput
              style={[
                styles.input,
                { color: colors.textPrimary, borderColor: colors.divider },
              ]}
              placeholder="e.g., Read 1 book"
              placeholderTextColor={colors.textSecondary}
              value={newHabitName}
              onChangeText={setNewHabitName}
              autoFocus
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.modalCancelButton,
                  { borderColor: colors.divider },
                ]}
                onPress={closeModal}
              >
                <Text
                  style={[
                    styles.modalButtonText,
                    { color: colors.textPrimary },
                  ]}
                >
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  { backgroundColor: colors.primary },
                ]}
                onPress={editingId ? handleUpdateHabit : handleAddHabit}
              >
                <Text style={styles.modalConfirmText}>
                  {editingId ? "Update" : "Save"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  addButton: {
    padding: spacing.sm,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing["2xl"],
  },
  card: {
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  habitName: {
    fontSize: 18,
    fontWeight: "600",
    fontFamily: typography.family,
    flex: 1,
  },
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  actionButton: {
    padding: 4,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginVertical: spacing.sm,
  },
  statItem: {
    alignItems: "center",
  },
  statValue: {
    fontSize: 22,
    fontWeight: "700",
    fontFamily: typography.family,
  },
  statLabel: {
    fontSize: 12,
    fontFamily: typography.family,
    marginTop: 2,
  },
  toggleButton: {
    borderRadius: 8,
    paddingVertical: spacing.sm,
    alignItems: "center",
    marginTop: spacing.xs,
  },
  toggleButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: typography.family,
  },
  missedContainer: {
    marginTop: spacing.sm,
  },
  missedLabel: {
    fontSize: 14,
    fontFamily: typography.family,
    marginBottom: 4,
  },
  missedDates: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
  },
  missedChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 12,
    marginRight: 4,
  },
  missedDate: {
    fontSize: 12,
    fontFamily: typography.family,
  },
  missedMore: {
    fontSize: 12,
    fontFamily: typography.family,
    marginLeft: 4,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  emptyText: {
    fontSize: 16,
    fontFamily: typography.family,
    textAlign: "center",
  },
  emptyAddButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 8,
    marginTop: spacing.md,
  },
  emptyAddButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: typography.family,
  },
  modalContainer: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.45)",
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.lg,
    paddingBottom: spacing["3xl"],
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "600",
    fontFamily: typography.family,
    marginBottom: spacing.md,
    textAlign: "center",
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
  modalActions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  modalButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: spacing.md,
    alignItems: "center",
    borderWidth: 1,
  },
  modalCancelButton: {
    backgroundColor: "transparent",
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: typography.family,
  },
  modalConfirmText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: typography.family,
  },
});
