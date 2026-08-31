import React, { useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
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
import { getISTDate } from "../utils/ist";
import {
  Todo,
  createTodo,
  deleteTodo,
  getTodos,
  updateTodo,
} from "../services/todos";

type ViewMode = "today" | "tomorrow";
type PickingFor = "start" | "end";

const dateFor = (tomorrow: boolean) => {
  const [year, month, day] = getISTDate().split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + (tomorrow ? 1 : 0))).toISOString().slice(0, 10);
};

const nowHHMM = () => {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date());
};

const formatTime = (value: Date | null) =>
  value
    ? `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`
    : null;

const timeLabel = (value: Date | null) =>
  value
    ? value.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "Select";

export const TodoScreen: React.FC = () => {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("today");
  const [title, setTitle] = useState("");
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [endTime, setEndTime] = useState<Date | null>(null);
  const [pickerTime, setPickerTime] = useState(new Date());
  const [pickingFor, setPickingFor] = useState<PickingFor>("start");
  const [pickerVisible, setPickerVisible] = useState(false);
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null);

  useEffect(() => {
    void loadTodos();
  }, []);

  const loadTodos = async () => {
    try {
      const response = await getTodos();
      setTodos(response.data);
    } catch (error) {
      Alert.alert(
        "Could not load tasks",
        error instanceof Error ? error.message : "Please try again.",
      );
    }
  };

  const resetForm = () => {
    setTitle("");
    setStartTime(null);
    setEndTime(null);
    setEditingTodoId(null);
  };

  const validateFormTime = () => {
    const start = formatTime(startTime);
    const end = formatTime(endTime);
    if (start && end && start >= end) {
      Alert.alert("Validation", "Start time must be before end time.");
      return { isValid: false, start, end };
    }
    const selectedDate = dateFor(viewMode === "tomorrow");
    // Existing tasks may have reached their scheduled time. They must still be
    // editable and completable, so only apply this restriction when adding one.
    if (!editingTodoId && selectedDate === dateFor(false)) {
      const now = nowHHMM();
      if ((start && start < now) || (end && end < now)) {
        Alert.alert(
          "Validation",
          "Today's task time cannot be before current time.",
        );
        return { isValid: false, start, end };
      }
    }
    if (viewMode === "tomorrow" && (start === "00:00" || end === "00:00")) {
      Alert.alert(
        "Validation",
        "Tomorrow tasks must be between 12:01 AM and 11:59 PM.",
      );
      return { isValid: false, start, end };
    }
    return { isValid: true, start, end };
  };

  const saveTodo = async () => {
    if (!title.trim())
      return Alert.alert("Validation", "Please enter a task description.");
    const { isValid, start, end } = validateFormTime();
    if (!isValid) return;

    try {
      if (editingTodoId) {
        const response = await updateTodo(editingTodoId, {
          title: title.trim(),
          start_time: start,
          end_time: end,
          date: dateFor(viewMode === "tomorrow"),
        });
        setTodos((current) =>
          current.map((todo) =>
            todo.id === editingTodoId ? response.data : todo,
          ),
        );
      } else {
        const response = await createTodo({
          title: title.trim(),
          start_time: start,
          end_time: end,
          date: dateFor(viewMode === "tomorrow"),
        });
        setTodos((current) => [...current, response.data]);
      }
      resetForm();
    } catch (error) {
      Alert.alert(
        `Could not ${editingTodoId ? "update" : "save"} task`,
        error instanceof Error ? error.message : "Please try again.",
      );
    }
  };

  const editTodo = (todo: Todo) => {
    setViewMode(todo.date === dateFor(true) ? "tomorrow" : "today");
    setEditingTodoId(todo.id);
    setTitle(todo.title);
    const toDate = (value: string | null) => {
      if (!value) return null;
      const [h, m] = value.split(":").map(Number);
      const d = new Date();
      d.setHours(h, m, 0, 0);
      return d;
    };
    setStartTime(toDate(todo.start_time));
    setEndTime(toDate(todo.end_time));
  };

  const toggleTodoCompleted = async (todo: Todo) => {
    try {
      const response = await updateTodo(todo.id, {
        completed: !todo.completed,
      });
      setTodos((current) =>
        current.map((item) => (item.id === todo.id ? response.data : item)),
      );
    } catch (error) {
      Alert.alert(
        "Could not update task",
        error instanceof Error ? error.message : "Please try again.",
      );
    }
  };

  const removeTodo = (id: string) =>
    Alert.alert("Delete Task", "Are you sure you want to delete this task?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () =>
          void (async () => {
            try {
              await deleteTodo(id);
              setTodos((current) => current.filter((todo) => todo.id !== id));
            } catch (error) {
              Alert.alert(
                "Could not delete task",
                error instanceof Error ? error.message : "Please try again.",
              );
            }
          })(),
      },
    ]);

  const openPicker = (forTime: PickingFor) => {
    setPickingFor(forTime);
    setPickerTime((forTime === "start" ? startTime : endTime) || new Date());
    setPickerVisible(true);
  };

  const applyTime = (value: Date) => {
    if (pickingFor === "start") setStartTime(value);
    else setEndTime(value);
    setPickerVisible(false);
  };

  const onAndroidTimeChange = (event: DateTimePickerEvent, value?: Date) => {
    setPickerVisible(false);
    if (event.type === "set" && value) applyTime(value);
  };

  const selectedDate = dateFor(viewMode === "tomorrow");
  const visibleTodos = todos
    .filter((todo) => todo.date === selectedDate)
    .sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      if (a.start_time === b.start_time) return a.title.localeCompare(b.title);
      if (!a.start_time) return 1;
      if (!b.start_time) return -1;
      return a.start_time.localeCompare(b.start_time);
    });

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor={colors.background}
      />
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.iconButton}
        >
          <Feather name="arrow-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
          Todo List
        </Text>
        <View style={styles.iconButton} />
      </View>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
      >
        <ScrollView contentContainerStyle={styles.content}>
          <View style={[styles.segmented, { borderColor: colors.divider }]}>
            {(["today", "tomorrow"] as ViewMode[]).map((mode) => (
              <TouchableOpacity
                key={mode}
                onPress={() => setViewMode(mode)}
                style={[
                  styles.segment,
                  viewMode === mode && { backgroundColor: colors.primary },
                ]}
              >
                <Text
                  style={[
                    styles.segmentText,
                    {
                      color: viewMode === mode ? "#FFF" : colors.textSecondary,
                    },
                  ]}
                >
                  {mode === "today" ? "Today" : "Tomorrow"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View
            style={[
              styles.form,
              { backgroundColor: colors.secondaryBackground },
            ]}
          >
            <Text style={[styles.formTitle, { color: colors.textPrimary }]}>
              {editingTodoId
                ? `Edit task for ${viewMode}`
                : `Add task for ${viewMode}`}
            </Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="What do you need to do?"
              placeholderTextColor={colors.textSecondary}
              style={[
                styles.input,
                { color: colors.textPrimary, borderColor: colors.divider },
              ]}
            />
            <View style={styles.timeRow}>
              <TouchableOpacity
                onPress={() => openPicker("start")}
                style={[styles.timeButton, { borderColor: colors.divider }]}
              >
                <Feather name="clock" size={18} color={colors.textSecondary} />
                <Text
                  style={[styles.timeText, { color: colors.textSecondary }]}
                >
                  Start: {timeLabel(startTime)}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => openPicker("end")}
                style={[styles.timeButton, { borderColor: colors.divider }]}
              >
                <Feather name="clock" size={18} color={colors.textSecondary} />
                <Text
                  style={[styles.timeText, { color: colors.textSecondary }]}
                >
                  End: {timeLabel(endTime)}
                </Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              onPress={saveTodo}
              style={[styles.addButton, { backgroundColor: colors.primary }]}
            >
              <Text style={styles.addButtonText}>
                {editingTodoId ? "Update Task" : "Add Task"}
              </Text>
            </TouchableOpacity>
            {editingTodoId && (
              <TouchableOpacity
                onPress={resetForm}
                style={[styles.cancelButton, { borderColor: colors.divider }]}
              >
                <Text
                  style={[
                    styles.cancelButtonText,
                    { color: colors.textSecondary },
                  ]}
                >
                  Cancel Edit
                </Text>
              </TouchableOpacity>
            )}
          </View>
          <FlatList
            data={visibleTodos}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            ListEmptyComponent={
              <Text style={[styles.empty, { color: colors.textSecondary }]}>
                No tasks for {viewMode}.
              </Text>
            }
            renderItem={({ item }) => (
              <View
                style={[
                  styles.card,
                  { backgroundColor: colors.secondaryBackground },
                ]}
              >
                <TouchableOpacity
                  style={styles.cardContent}
                  onPress={() => void toggleTodoCompleted(item)}
                >
                  <Text
                    style={[
                      styles.taskTitle,
                      { color: colors.textPrimary },
                      item.completed && styles.taskTitleDone,
                    ]}
                  >
                    {item.title}
                  </Text>
                  {(item.start_time || item.end_time) && (
                    <Text
                      style={[styles.timeText, { color: colors.textSecondary }]}
                    >
                      {item.start_time || ""}
                      {item.start_time && item.end_time ? " - " : ""}
                      {item.end_time || ""}
                    </Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => editTodo(item)}
                  style={styles.iconButton}
                >
                  <Feather name="edit-2" size={20} color={colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => removeTodo(item.id)}
                  style={styles.iconButton}
                >
                  <Feather name="trash-2" size={20} color={colors.expense} />
                </TouchableOpacity>
              </View>
            )}
          />
        </ScrollView>
      </KeyboardAvoidingView>
      {Platform.OS === "ios" ? (
        <Modal visible={pickerVisible} transparent animationType="fade">
          <View style={styles.modalBackdrop}>
            <View
              style={[
                styles.modal,
                { backgroundColor: colors.secondaryBackground },
              ]}
            >
              <DateTimePicker
                value={pickerTime}
                mode="time"
                display="spinner"
                onChange={(_, value) => value && setPickerTime(value)}
              />
              <TouchableOpacity
                onPress={() => applyTime(pickerTime)}
                style={[styles.addButton, { backgroundColor: colors.primary }]}
              >
                <Text style={styles.addButtonText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      ) : (
        pickerVisible && (
          <DateTimePicker
            value={pickerTime}
            mode="time"
            display="default"
            onChange={onAndroidTimeChange}
          />
        )
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
  iconButton: { padding: spacing.sm, minWidth: 40 },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    fontFamily: typography.family,
  },
  content: { padding: spacing.lg, paddingBottom: spacing["2xl"] },
  segmented: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: 10,
    padding: 3,
    marginBottom: spacing.md,
  },
  segment: {
    flex: 1,
    borderRadius: 7,
    paddingVertical: spacing.sm,
    alignItems: "center",
  },
  segmentText: { fontFamily: typography.family, fontWeight: "600" },
  form: { borderRadius: 16, padding: spacing.md, marginBottom: spacing.lg },
  formTitle: {
    fontFamily: typography.family,
    fontWeight: "600",
    marginBottom: spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontFamily: typography.family,
    marginBottom: spacing.sm,
  },
  timeRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  timeButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderRadius: 8,
    padding: spacing.sm,
  },
  timeText: { fontFamily: typography.family, fontSize: 13 },
  addButton: {
    borderRadius: 8,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  addButtonText: {
    color: "#FFF",
    fontFamily: typography.family,
    fontWeight: "600",
  },
  cancelButton: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: spacing.sm,
    alignItems: "center",
    marginTop: spacing.sm,
  },
  cancelButtonText: { fontFamily: typography.family, fontWeight: "600" },
  card: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardContent: { flex: 1 },
  taskTitle: { fontFamily: typography.family, fontSize: 16 },
  taskTitleDone: { textDecorationLine: "line-through", opacity: 0.65 },
  empty: {
    textAlign: "center",
    fontFamily: typography.family,
    marginTop: spacing.xl,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.45)",
    padding: spacing.lg,
  },
  modal: { borderRadius: 16, padding: spacing.md },
});
