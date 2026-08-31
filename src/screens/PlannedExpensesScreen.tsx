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
import { Calendar, LocaleConfig } from "react-native-calendars";
import DateTimePickerModal from "react-native-modal-datetime-picker";
import { useRouter } from "expo-router";
import { useTheme } from "../hooks/useTheme";
import { spacing } from "../theme/spacing";
import { typography } from "../theme/typography";
import { getISTDate } from "../utils/ist";
import {
  PlannedExpense,
  createPlannedExpense,
  deletePlannedExpense,
  getPlannedExpenses,
  updatePlannedExpense,
} from "../services/plannedExpenses";

// Configure calendar locale (optional)
LocaleConfig.locales["en"] = {
  monthNames: [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ],
  monthNamesShort: [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ],
  dayNames: [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ],
  dayNamesShort: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  today: "Today",
};
LocaleConfig.defaultLocale = "en";

export const PlannedExpensesScreen: React.FC = () => {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const [expenses, setExpenses] = useState<PlannedExpense[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(getISTDate());
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState<string>(selectedDate);
  const [time, setTime] = useState<Date | null>(null);
  const [isTimePickerVisible, setTimePickerVisible] = useState(false);

  useEffect(() => {
    void loadExpenses();
  }, []);

  const loadExpenses = async () => {
    try {
      const response = await getPlannedExpenses();
      setExpenses(response.data);
    } catch (error) {
      Alert.alert(
        "Could not load planned expenses",
        error instanceof Error ? error.message : "Please try again.",
      );
    }
  };

  // Get expenses for selected date
  const getExpensesForDate = (dateStr: string) => {
    return expenses.filter((e) => e.date === dateStr);
  };

  // Get marked dates for calendar (dots)
  const getMarkedDates = () => {
    const marked: { [key: string]: any } = {};
    expenses.forEach((e) => {
      if (!marked[e.date]) {
        marked[e.date] = {
          dots: [{ key: "expense", color: colors.primary }],
          selected: e.date === selectedDate,
        };
      }
    });
    // Ensure selected date is marked
    if (!marked[selectedDate]) {
      marked[selectedDate] = { selected: true };
    } else {
      marked[selectedDate].selected = true;
    }
    return marked;
  };

  const handleSubmit = async () => {
    // Validation
    if (!name.trim()) {
      Alert.alert("Validation", "Please enter a description.");
      return;
    }
    if (!amount.trim()) {
      Alert.alert("Validation", "Please enter an amount.");
      return;
    }
    const amountNum = Number(amount);
    if (!Number.isInteger(amountNum) || amountNum <= 0) {
      Alert.alert(
        "Validation",
        "Please enter a valid amount (greater than 0).",
      );
      return;
    }
    if (!date) {
      Alert.alert("Validation", "Please select a date.");
      return;
    }

    const payload = {
      title: name.trim(),
      amount: amountNum,
      date,
      time: time
        ? `${String(time.getHours()).padStart(2, "0")}:${String(time.getMinutes()).padStart(2, "0")}`
        : null,
    };
    try {
      if (editingId) {
        const response = await updatePlannedExpense(editingId, payload);
        setExpenses((current) =>
          current.map((item) => (item.id === editingId ? response.data : item)),
        );
      } else {
        const response = await createPlannedExpense(payload);
        setExpenses((current) => [...current, response.data]);
      }
      resetForm();
      setModalVisible(false);
    } catch (error) {
      Alert.alert(
        "Could not save planned expense",
        error instanceof Error ? error.message : "Please try again.",
      );
    }
  };

  const resetForm = () => {
    setName("");
    setAmount("");
    setDate(selectedDate);
    setTime(null);
    setEditingId(null);
  };

  const handleEdit = (item: PlannedExpense) => {
    setName(item.title);
    setAmount(item.amount.toString());
    setDate(item.date);
    setTime(item.time ? new Date(`2000-01-01T${item.time}`) : null);
    setEditingId(item.id);
    setModalVisible(true);
  };

  const handleDelete = (id: string) => {
    Alert.alert(
      "Delete Expense",
      "Are you sure you want to delete this planned expense?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () =>
            void (async () => {
              try {
                await deletePlannedExpense(id);
                setExpenses((current) =>
                  current.filter((item) => item.id !== id),
                );
              } catch (error) {
                Alert.alert(
                  "Could not delete planned expense",
                  error instanceof Error ? error.message : "Please try again.",
                );
              }
            })(),
        },
      ],
    );
  };

  const showTimePicker = () => setTimePickerVisible(true);
  const hideTimePicker = () => setTimePickerVisible(false);

  const handleConfirmTime = (selectedTime: Date) => {
    hideTimePicker();
    if (selectedTime) {
      setTime(selectedTime);
    }
  };

  // Summary for selected month
  const getMonthlySummary = () => {
    const month = selectedDate.substring(0, 7); // YYYY-MM
    const monthlyExpenses = expenses.filter((e) => e.date.startsWith(month));
    const total = monthlyExpenses.reduce((sum, e) => sum + e.amount, 0);
    return { total, count: monthlyExpenses.length };
  };

  const { total, count } = getMonthlySummary();

  const renderItem = ({ item }: { item: PlannedExpense }) => (
    <View
      style={[styles.card, { backgroundColor: colors.secondaryBackground }]}
    >
      <View style={styles.cardHeader}>
        <Text style={[styles.cardName, { color: colors.textPrimary }]}>
          {item.title}
        </Text>
        <View style={styles.actions}>
          <TouchableOpacity
            onPress={() => handleEdit(item)}
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
      <Text style={[styles.cardAmount, { color: colors.primary }]}>
        ₹{item.amount.toFixed(2)}
      </Text>
      {item.time && (
        <Text style={[styles.cardTime, { color: colors.textSecondary }]}>
          <Feather name="clock" size={14} color={colors.textSecondary} />{" "}
          {item.time}
        </Text>
      )}
    </View>
  );

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
          Planned Expenses
        </Text>
        <TouchableOpacity
          onPress={() => {
            resetForm();
            setDate(selectedDate);
            setModalVisible(true);
          }}
          style={styles.addButton}
        >
          <Feather name="plus" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Summary */}
        <View
          style={[
            styles.summary,
            { backgroundColor: colors.secondaryBackground },
          ]}
        >
          <Text style={[styles.summaryTitle, { color: colors.textSecondary }]}>
            {selectedDate.substring(0, 7)} Summary
          </Text>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text
                style={[styles.summaryValue, { color: colors.textPrimary }]}
              >
                ₹{total.toFixed(2)}
              </Text>
              <Text
                style={[styles.summaryLabel, { color: colors.textSecondary }]}
              >
                Total Planned
              </Text>
            </View>
            <View style={styles.summaryItem}>
              <Text
                style={[styles.summaryValue, { color: colors.textPrimary }]}
              >
                {count}
              </Text>
              <Text
                style={[styles.summaryLabel, { color: colors.textSecondary }]}
              >
                Expenses
              </Text>
            </View>
          </View>
        </View>

        {/* Calendar */}
        <Calendar
          current={selectedDate}
          onDayPress={(day: { dateString: string }) => {
            setSelectedDate(day.dateString);
            setDate(day.dateString);
          }}
          markedDates={getMarkedDates()}
          markingType={"multi-dot"}
          theme={{
            backgroundColor: colors.background,
            calendarBackground: colors.secondaryBackground,
            textSectionTitleColor: colors.textSecondary,
            selectedDayBackgroundColor: colors.primary,
            selectedDayTextColor: "#FFFFFF",
            todayTextColor: colors.primary,
            dayTextColor: colors.textPrimary,
            textDisabledColor: colors.textSecondary,
            dotColor: colors.primary,
            selectedDotColor: "#FFFFFF",
            arrowColor: colors.primary,
            monthTextColor: colors.textPrimary,
            textMonthFontWeight: "600",
            textDayFontFamily: typography.family,
            textMonthFontFamily: typography.family,
            textDayHeaderFontFamily: typography.family,
          }}
        />

        {/* Expenses for selected date */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            {new Date(selectedDate + "T00:00:00").toLocaleDateString("en-US", {
              weekday: "long",
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </Text>
          <Text style={[styles.sectionCount, { color: colors.textSecondary }]}>
            {getExpensesForDate(selectedDate).length} items
          </Text>
        </View>

        {getExpensesForDate(selectedDate).length > 0 ? (
          <FlatList
            data={getExpensesForDate(selectedDate)}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            contentContainerStyle={styles.listContainer}
          />
        ) : (
          <View style={styles.emptyContainer}>
            <Feather
              name="calendar"
              size={40}
              color={colors.textSecondary}
              opacity={0.5}
            />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No planned expenses for this day.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Add/Edit Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
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
              {editingId ? "Edit Planned Expense" : "Add Planned Expense"}
            </Text>

            <TextInput
              style={[
                styles.input,
                { color: colors.textPrimary, borderColor: colors.divider },
              ]}
              placeholder="Expense name"
              placeholderTextColor={colors.textSecondary}
              value={name}
              onChangeText={setName}
            />

            <TextInput
              style={[
                styles.input,
                { color: colors.textPrimary, borderColor: colors.divider },
              ]}
              placeholder="Amount (₹)"
              placeholderTextColor={colors.textSecondary}
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
            />

            <TouchableOpacity
              style={[styles.datePickerButton, { borderColor: colors.divider }]}
              onPress={() => {
                // We'll use the calendar selection, but we can also show a date picker if needed
                // For simplicity, we use the calendar selection
                Alert.alert("Select Date", "Tap a date on the calendar above.");
              }}
            >
              <Feather name="calendar" size={20} color={colors.textSecondary} />
              <Text style={[styles.dateText, { color: colors.textPrimary }]}>
                {new Date(date + "T00:00:00").toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.timeButton, { borderColor: colors.divider }]}
              onPress={showTimePicker}
            >
              <Feather name="clock" size={20} color={colors.textSecondary} />
              <Text
                style={[
                  styles.timeText,
                  { color: time ? colors.textPrimary : colors.textSecondary },
                ]}
              >
                {time
                  ? time.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "Set time (optional)"}
              </Text>
              {time && (
                <TouchableOpacity
                  onPress={() => setTime(null)}
                  style={styles.clearTime}
                >
                  <Feather name="x" size={16} color={colors.textSecondary} />
                </TouchableOpacity>
              )}
            </TouchableOpacity>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.modalCancelButton,
                  { borderColor: colors.divider },
                ]}
                onPress={() => {
                  resetForm();
                  setModalVisible(false);
                }}
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
                onPress={handleSubmit}
              >
                <Text style={styles.modalConfirmText}>
                  {editingId ? "Update" : "Save"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Time Picker */}
      <DateTimePickerModal
        isVisible={isTimePickerVisible}
        mode="time"
        onConfirm={handleConfirmTime}
        onCancel={hideTimePicker}
        date={time || new Date()}
      />
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
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing["2xl"],
  },
  summary: {
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: typography.family,
    marginBottom: spacing.sm,
    textTransform: "uppercase",
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  summaryItem: {
    alignItems: "center",
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: "700",
    fontFamily: typography.family,
  },
  summaryLabel: {
    fontSize: 14,
    fontFamily: typography.family,
    marginTop: 2,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: typography.family,
  },
  sectionCount: {
    fontSize: 14,
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
  },
  cardName: {
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
  cardAmount: {
    fontSize: 18,
    fontWeight: "700",
    fontFamily: typography.family,
    marginVertical: 4,
  },
  cardTime: {
    fontSize: 14,
    fontFamily: typography.family,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  emptyText: {
    fontSize: 16,
    fontFamily: typography.family,
    textAlign: "center",
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
  datePickerButton: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  dateText: {
    fontSize: 16,
    fontFamily: typography.family,
  },
  timeButton: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  timeText: {
    flex: 1,
    fontSize: 16,
    fontFamily: typography.family,
  },
  clearTime: {
    padding: 4,
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
