import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
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
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { useRouter } from "expo-router";
import { useTheme } from "../hooks/useTheme";
import { spacing } from "../theme/spacing";
import { typography } from "../theme/typography";
import { dateOnlyToDate, formatISTDate, getISTDate } from "../utils/ist";
import {
  Birthday,
  createBirthday,
  deleteBirthday as deleteBirthdayRequest,
  getBirthdays,
  updateBirthday as updateBirthdayRequest,
} from "../services/birthdays";

export const BirthdayScreen: React.FC = () => {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const [name, setName] = useState("");
  const [date, setDate] = useState<Date | null>(null);
  const [pickerDate, setPickerDate] = useState<Date>(new Date());
  const [birthdays, setBirthdays] = useState<Birthday[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDatePickerVisible, setDatePickerVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    void loadBirthdays();
  }, []);

  const loadBirthdays = async () => {
    try {
      const response = await getBirthdays();
      setBirthdays(response.data);
    } catch (error) {
      Alert.alert(
        "Could not load birthdays",
        error instanceof Error ? error.message : "Please try again.",
      );
    }
  };

  const handleAddOrUpdate = async () => {
    // Validation
    if (!name.trim()) {
      Alert.alert("Validation", "Please enter a name.");
      return;
    }
    if (!date) {
      Alert.alert("Validation", "Please select a date.");
      return;
    }
    // Check date not in future
    const today = dateOnlyToDate(getISTDate());
    if (date > today) {
      Alert.alert("Validation", "Birthdate cannot be in the future.");
      return;
    }
    // Optional: Check age (e.g., at least 1 year old)
    const ageDiff = today.getUTCFullYear() - date.getFullYear();
    const monthDiff = today.getUTCMonth() - date.getMonth();
    const dayDiff = today.getUTCDate() - date.getDate();
    const age =
      monthDiff < 0 || (monthDiff === 0 && dayDiff < 0) ? ageDiff - 1 : ageDiff;
    if (age < 0) {
      Alert.alert("Validation", "Birthdate cannot be in the future.");
      return;
    }
    // You can optionally require age >= 0, but we allow newborns

    const dateValue = toApiDate(date);

    try {
      if (editingId) {
        const response = await updateBirthdayRequest(editingId, name.trim(), dateValue);
        setBirthdays((current) =>
          current.map((birthday) =>
            birthday.id === editingId ? response.data : birthday,
          ),
        );
        setEditingId(null);
      } else {
        const response = await createBirthday(name.trim(), dateValue);
        setBirthdays((current) => [...current, response.data]);
      }

      setName("");
      setDate(null);
    } catch (error) {
      Alert.alert(
        "Could not save birthday",
        error instanceof Error ? error.message : "Please try again.",
      );
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert("Delete", "Are you sure you want to delete this birthday?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          void (async () => {
            try {
              await deleteBirthdayRequest(id);
              setBirthdays((current) =>
                current.filter((birthday) => birthday.id !== id),
              );
            } catch (error) {
              Alert.alert(
                "Could not delete birthday",
                error instanceof Error ? error.message : "Please try again.",
              );
            }
          })();
        },
      },
    ]);
  };

  const handleEdit = (item: Birthday) => {
    setName(item.name);
    setDate(parseBirthdayDate(item.date));
    setEditingId(item.id);
  };

  const showDatePicker = () => {
    setPickerDate(date || new Date());
    setDatePickerVisible(true);
  };
  const hideDatePicker = () => setDatePickerVisible(false);

  const handleDateChange = (
    event: DateTimePickerEvent,
    selectedDate?: Date,
  ) => {
    if (Platform.OS === "android") {
      hideDatePicker();
      if (event.type === "set" && selectedDate) {
        setDate(selectedDate);
      }
      return;
    }

    if (selectedDate) {
      setPickerDate(selectedDate);
    }
  };

  const handleConfirmDate = () => {
    setDate(pickerDate);
    hideDatePicker();
  };

  const parseBirthdayDate = (value: string) => {
    const [year, month, day] = value.slice(0, 10).split("-").map(Number);
    return dateOnlyToDate(value);
  };

  const toApiDate = (value: Date) => {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const formatDate = (value: Date) =>
    formatISTDate(value, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

  const filteredBirthdays = birthdays.filter((birthday) => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;

    const matchesQuery = (
      birthday.name.toLowerCase().includes(query) ||
      formatDate(parseBirthdayDate(birthday.date)).includes(query)
    );
    return matchesQuery;
  });

  // Calculate days until next birthday and age to turn
  const getBirthdayInfo = (birthDate: Date) => {
    const today = dateOnlyToDate(getISTDate());

    const birthMonth = birthDate.getMonth();
    const birthDay = birthDate.getDate();

    // Next birthday year
    let nextBirthdayYear = today.getUTCFullYear();
    let nextBirthday = new Date(nextBirthdayYear, birthMonth, birthDay);
    if (nextBirthday < today) {
      nextBirthdayYear++;
      nextBirthday = new Date(nextBirthdayYear, birthMonth, birthDay);
    }

    const diffTime = nextBirthday.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // Age they will turn
    const ageToTurn = nextBirthdayYear - birthDate.getFullYear();

    return { daysLeft: diffDays, ageToTurn };
  };

  const renderItem = ({ item }: { item: Birthday }) => {
    const birthDate = parseBirthdayDate(item.date);
    const { daysLeft, ageToTurn } = getBirthdayInfo(birthDate);

    return (
      <View
        style={[styles.card, { backgroundColor: colors.secondaryBackground }]}
      >
        <View style={styles.cardContent}>
          <View style={styles.cardLeft}>
            <Text style={[styles.cardName, { color: colors.textPrimary }]}>
              {item.name}
            </Text>
            <Text style={[styles.cardDate, { color: colors.textSecondary }]}>
              {formatDate(birthDate)}
            </Text>
          </View>
          <View style={styles.cardRight}>
            <View style={styles.timerContainer}>
              <Text style={[styles.timerDays, { color: colors.primary }]}>
                {daysLeft}
              </Text>
              <Text
                style={[styles.timerLabel, { color: colors.textSecondary }]}
              >
                days
              </Text>
            </View>
            <Text style={[styles.ageText, { color: colors.textSecondary }]}>
              turns {ageToTurn}
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
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      {/* Header with back button */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Feather name="arrow-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
          Birthday Reminder
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
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
              placeholder="Search by name or choose a date"
              placeholderTextColor={colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
            />
          </View>

          {/* Form */}
          <View
            style={[
              styles.form,
              { backgroundColor: colors.secondaryBackground },
            ]}
          >
            <Text style={[styles.formTitle, { color: colors.textPrimary }]}>
              {editingId ? "Edit Birthday" : "Add Birthday"}
            </Text>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                Name
              </Text>
              <TextInput
                style={[
                  styles.input,
                  { color: colors.textPrimary, borderColor: colors.divider },
                ]}
                placeholder="Enter name"
                placeholderTextColor={colors.textSecondary}
                value={name}
                onChangeText={setName}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                Birthdate
              </Text>
              <TouchableOpacity
                style={[
                  styles.datePickerButton,
                  { borderColor: colors.divider },
                ]}
                onPress={showDatePicker}
              >
                <Feather
                  name="calendar"
                  size={20}
                  color={colors.textSecondary}
                />
                <Text
                  style={[
                    styles.dateText,
                    { color: date ? colors.textPrimary : colors.textSecondary },
                  ]}
                >
                  {date ? formatDate(date) : "Select date"}
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.addButton, { backgroundColor: colors.primary }]}
              onPress={handleAddOrUpdate}
            >
              <Text style={styles.addButtonText}>
                {editingId ? "Update" : "Add"} Birthday
              </Text>
            </TouchableOpacity>
          </View>

          {/* List */}
          {filteredBirthdays.length > 0 ? (
            <FlatList
              data={filteredBirthdays}
              renderItem={renderItem}
              keyExtractor={(item) => item.id}
              scrollEnabled={false} // because we're inside ScrollView
              contentContainerStyle={styles.listContainer}
            />
          ) : (
            <View style={styles.emptyContainer}>
              <Feather
                name="calendar"
                size={60}
                color={colors.textSecondary}
                opacity={0.5}
              />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No birthdays added yet.
              </Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {Platform.OS === "android" && isDatePickerVisible && (
        <DateTimePicker
          value={pickerDate}
          mode="date"
          display="default"
          maximumDate={new Date()}
          onChange={handleDateChange}
        />
      )}

      {Platform.OS === "ios" && (
      <Modal
        visible={isDatePickerVisible}
        transparent
        animationType="fade"
        onRequestClose={hideDatePicker}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={hideDatePicker}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={[
              styles.modalContent,
              { backgroundColor: colors.secondaryBackground },
            ]}
          >
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
              Select Birthdate
            </Text>
            <DateTimePicker
              value={pickerDate}
              mode="date"
              display="spinner"
              maximumDate={new Date()}
              onChange={handleDateChange}
              style={styles.dateTimePicker}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={hideDatePicker}
                style={[
                  styles.modalButton,
                  styles.modalCancelButton,
                  { borderColor: colors.divider },
                ]}
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
                onPress={handleConfirmDate}
                style={[
                  styles.modalButton,
                  { backgroundColor: colors.primary },
                ]}
              >
                <Text style={styles.modalConfirmText}>Done</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
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
  form: {
    borderRadius: 16,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: "600",
    fontFamily: typography.family,
    marginBottom: spacing.md,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    minHeight: 56,
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
  inputGroup: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    fontFamily: typography.family,
    marginBottom: spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 16,
    fontFamily: typography.family,
  },
  datePickerButton: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  dateText: {
    fontSize: 16,
    fontFamily: typography.family,
  },
  addButton: {
    borderRadius: 8,
    paddingVertical: spacing.md,
    alignItems: "center",
    marginTop: spacing.sm,
  },
  addButtonText: {
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
  cardContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardLeft: {
    flex: 1,
  },
  cardName: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: typography.family,
  },
  cardDate: {
    fontSize: 14,
    fontFamily: typography.family,
    marginTop: 2,
  },
  cardRight: {
    alignItems: "flex-end",
    gap: 4,
  },
  timerContainer: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
  },
  timerDays: {
    fontSize: 20,
    fontWeight: "700",
    fontFamily: typography.family,
  },
  timerLabel: {
    fontSize: 12,
    fontFamily: typography.family,
  },
  ageText: {
    fontSize: 12,
    fontFamily: typography.family,
  },
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: 4,
  },
  actionButton: {
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
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  modalContent: {
    borderRadius: 20,
    padding: spacing.lg,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    fontFamily: typography.family,
    marginBottom: spacing.sm,
    textAlign: "center",
  },
  dateTimePicker: {
    alignSelf: "stretch",
  },
  modalActions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  modalButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: spacing.sm,
    alignItems: "center",
    borderWidth: 1,
  },
  modalCancelButton: {
    backgroundColor: "transparent",
  },
  modalButtonText: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: typography.family,
  },
  modalConfirmText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
    fontFamily: typography.family,
  },
});
