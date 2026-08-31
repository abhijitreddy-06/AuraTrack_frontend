import React, { useEffect, useState } from "react";
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
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "../hooks/useTheme";
import { spacing } from "../theme/spacing";
import { typography } from "../theme/typography";
import { formatISTDate } from "../utils/ist";
import {
  createNote,
  deleteNote as deleteNoteRequest,
  getNotes,
  Note as ApiNote,
  updateNote,
} from "../services/notes";

type Note = {
  id: string;
  content: string;
  createdAt: string;
};

const MAX_CHARS = 2500;
const PREVIEW_LINES = 3;

export const NotesScreen: React.FC = () => {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNoteText, setNewNoteText] = useState("");
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [editText, setEditText] = useState("");
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadNotes();
  }, []);

  const mapNote = (note: ApiNote): Note => ({
    id: note.id,
    content: note.text,
    createdAt: note.created_at,
  });

  const loadNotes = async () => {
    try {
      const result = await getNotes();
      setNotes(result.data.map(mapNote));
    } catch (error) {
      Alert.alert(
        "Unable to load notes",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const addNote = async () => {
    const trimmed = newNoteText.trim();
    if (!trimmed) {
      Alert.alert("Validation", "Please enter some text.");
      return;
    }
    if (trimmed.length > MAX_CHARS) {
      Alert.alert("Validation", `Maximum ${MAX_CHARS} characters allowed.`);
      return;
    }
    try {
      const result = await createNote(trimmed);
      setNotes((prev) => [mapNote(result.data), ...prev]);
      setNewNoteText("");
    } catch (error) {
      Alert.alert(
        "Unable to create note",
        error instanceof Error ? error.message : "Please try again.",
      );
    }
  };

  const openNote = (note: Note) => {
    setSelectedNote(note);
    setEditText(note.content);
    setIsModalVisible(true);
  };

  const closeModal = () => {
    setIsModalVisible(false);
    setSelectedNote(null);
    setEditText("");
  };

  const saveNote = async () => {
    if (!selectedNote) return;
    const trimmed = editText.trim();
    if (!trimmed) {
      Alert.alert("Validation", "Note cannot be empty.");
      return;
    }
    if (trimmed.length > MAX_CHARS) {
      Alert.alert("Validation", `Maximum ${MAX_CHARS} characters allowed.`);
      return;
    }
    try {
      const result = await updateNote(selectedNote.id, trimmed);
      setNotes((prev) =>
        prev.map((n) => (n.id === selectedNote.id ? mapNote(result.data) : n)),
      );
      closeModal();
    } catch (error) {
      Alert.alert(
        "Unable to update note",
        error instanceof Error ? error.message : "Please try again.",
      );
    }
  };

  const deleteNote = () => {
    if (!selectedNote) return;
    Alert.alert("Delete Note", "Are you sure you want to delete this note?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteNoteById(selectedNote.id);
            setNotes((prev) => prev.filter((n) => n.id !== selectedNote.id));
            closeModal();
          } catch (error) {
            Alert.alert(
              "Unable to delete note",
              error instanceof Error ? error.message : "Please try again.",
            );
          }
        },
      },
    ]);
  };

  const deleteNoteById = (id: string) => deleteNoteRequest(id);

  const renderItem = ({ item }: { item: Note }) => {
    // Truncate preview to first few lines
    const lines = item.content.split("\n");
    let preview = lines.slice(0, PREVIEW_LINES).join("\n");
    if (lines.length > PREVIEW_LINES) {
      preview += "…";
    }
    // If preview is too long, truncate at 100 chars roughly
    if (preview.length > 120) {
      preview = preview.slice(0, 120) + "…";
    }

    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: colors.secondaryBackground }]}
        onPress={() => openNote(item)}
        activeOpacity={0.7}
      >
        <Text style={[styles.previewText, { color: colors.textPrimary }]}>
          {preview}
        </Text>
        <Text style={[styles.dateText, { color: colors.textSecondary }]}>
          {formatISTDate(item.createdAt, {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </Text>
      </TouchableOpacity>
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
          Notes
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Add Note Form */}
          <View
            style={[
              styles.form,
              { backgroundColor: colors.secondaryBackground },
            ]}
          >
            <TextInput
              style={[
                styles.textInput,
                { color: colors.textPrimary, borderColor: colors.divider },
              ]}
              placeholder="Write your note here…"
              placeholderTextColor={colors.textSecondary}
              multiline
              numberOfLines={4}
              value={newNoteText}
              onChangeText={setNewNoteText}
              maxLength={MAX_CHARS}
            />
            <View style={styles.formFooter}>
              <Text style={[styles.charCount, { color: colors.textSecondary }]}>
                {newNoteText.length}/{MAX_CHARS}
              </Text>
              <TouchableOpacity
                style={[styles.addButton, { backgroundColor: colors.primary }]}
                onPress={addNote}
              >
                <Feather name="plus" size={20} color="#FFFFFF" />
                <Text style={styles.addButtonText}>Add Note</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Notes List */}
          {loading ? (
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                Loading notes...
              </Text>
            </View>
          ) : notes.length > 0 ? (
            <FlatList
              data={notes}
              renderItem={renderItem}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              contentContainerStyle={styles.listContainer}
            />
          ) : (
            <View style={styles.emptyContainer}>
              <Feather
                name="file-text"
                size={60}
                color={colors.textSecondary}
                opacity={0.5}
              />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No notes yet. Write one above!
              </Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Modal for viewing/editing note */}
      <Modal
        visible={isModalVisible}
        transparent
        animationType="slide"
        onRequestClose={closeModal}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalContent,
              { backgroundColor: colors.secondaryBackground },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                Note Details
              </Text>
              <TouchableOpacity onPress={closeModal} style={styles.modalClose}>
                <Feather name="x" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={[
                styles.modalInput,
                { color: colors.textPrimary, borderColor: colors.divider },
              ]}
              multiline
              numberOfLines={8}
              value={editText}
              onChangeText={setEditText}
              maxLength={MAX_CHARS}
              placeholder="Edit your note..."
              placeholderTextColor={colors.textSecondary}
            />

            <View style={styles.modalFooter}>
              <Text style={[styles.charCount, { color: colors.textSecondary }]}>
                {editText.length}/{MAX_CHARS}
              </Text>
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.deleteButton]}
                  onPress={deleteNote}
                >
                  <Feather name="trash-2" size={20} color="#FFFFFF" />
                  <Text style={styles.modalButtonText}>Delete</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.modalButton,
                    { backgroundColor: colors.primary },
                  ]}
                  onPress={saveNote}
                >
                  <Feather name="save" size={20} color="#FFFFFF" />
                  <Text style={styles.modalButtonText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
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
  textInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 16,
    fontFamily: typography.family,
    minHeight: 100,
    textAlignVertical: "top",
  },
  formFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.sm,
  },
  charCount: {
    fontSize: 14,
    fontFamily: typography.family,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    gap: spacing.sm,
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
  previewText: {
    fontSize: 16,
    fontFamily: typography.family,
    lineHeight: 22,
  },
  dateText: {
    fontSize: 12,
    fontFamily: typography.family,
    marginTop: spacing.xs,
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
  // Modal styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  modalContent: {
    borderRadius: 20,
    padding: spacing.lg,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "600",
    fontFamily: typography.family,
  },
  modalClose: {
    padding: spacing.sm,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 16,
    fontFamily: typography.family,
    minHeight: 150,
    textAlignVertical: "top",
    marginBottom: spacing.sm,
  },
  modalFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.sm,
  },
  modalActions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  modalButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    gap: spacing.sm,
  },
  deleteButton: {
    backgroundColor: "#FF5A5F",
  },
  modalButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: typography.family,
  },
});
