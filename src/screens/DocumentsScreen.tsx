    import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { useRouter } from 'expo-router';
import { useTheme } from '../hooks/useTheme';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

type DocumentItem = {
  id: string;
  name: string;        // userâ€‘given name
  fileName: string;    // original file name
  size: number;        // in bytes
  mimeType: string;
  uri: string;
};

// Allowed MIME types
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/jpeg',
  'image/png',
  'image/jpg',
  'audio/mpeg',
  'video/mp4',
];

const MAX_SIZE = 100 * 1024 * 1024; // 100 MB in bytes

export const DocumentsScreen: React.FC = () => {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const [docName, setDocName] = useState('');
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selectedFile, setSelectedFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ALLOWED_MIME_TYPES,
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return;
      }

      const asset = result.assets[0];
      // Validate file size
      if (asset.size && asset.size > MAX_SIZE) {
        Alert.alert('File too large', 'Maximum file size is 100 MB.');
        return;
      }

      // Validate MIME type (should be in allowed list)
      if (asset.mimeType && !ALLOWED_MIME_TYPES.includes(asset.mimeType)) {
        Alert.alert('Invalid file type', 'Please select a PDF, DOC, DOCX, PPT, image, MP3, or MP4 file.');
        return;
      }

      setSelectedFile(asset);
    } catch (error) {
      console.error('Error picking document:', error);
      Alert.alert('Error', 'Failed to pick document.');
    }
  };

  const addDocument = () => {
    const trimmedName = docName.trim();
    if (!trimmedName) {
      Alert.alert('Validation', 'Please enter a document name.');
      return;
    }
    if (!selectedFile) {
      Alert.alert('Validation', 'Please select a file.');
      return;
    }

    const newDoc: DocumentItem = {
      id: Date.now().toString(),
      name: trimmedName,
      fileName: selectedFile.name || 'Unnamed',
      size: selectedFile.size || 0,
      mimeType: selectedFile.mimeType || 'unknown',
      uri: selectedFile.uri,
    };

    setDocuments((prev) => [...prev, newDoc]);
    setDocName('');
    setSelectedFile(null);
  };

  const deleteDocument = (id: string) => {
    Alert.alert(
      'Delete Document',
      'Are you sure you want to delete this document?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setDocuments((prev) => prev.filter((d) => d.id !== id));
          },
        },
      ]
    );
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const renderItem = ({ item }: { item: DocumentItem }) => (
    <View style={[styles.card, { backgroundColor: colors.secondaryBackground }]}>
      <View style={styles.cardContent}>
        <Text style={[styles.docName, { color: colors.textPrimary }]}>
          {item.name}
        </Text>
        <Text style={[styles.docInfo, { color: colors.textSecondary }]}>
          {item.fileName} â€¢ {formatSize(item.size)}
        </Text>
      </View>
      <TouchableOpacity onPress={() => deleteDocument(item.id)} style={styles.deleteButton}>
        <Feather name="trash-2" size={20} color={colors.expense} />
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
          Documents
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Form */}
          <View style={[styles.form, { backgroundColor: colors.secondaryBackground }]}>
            <TextInput
              style={[
                styles.input,
                { color: colors.textPrimary, borderColor: colors.divider },
              ]}
              placeholder="Document name"
              placeholderTextColor={colors.textSecondary}
              value={docName}
              onChangeText={setDocName}
            />

            <TouchableOpacity
              style={[styles.pickButton, { borderColor: colors.divider }]}
              onPress={pickDocument}
            >
              <Feather name="file" size={20} color={colors.primary} />
              <Text style={[styles.pickButtonText, { color: colors.textPrimary }]}>
                {selectedFile ? selectedFile.name : 'Choose a file'}
              </Text>
              {selectedFile && (
                <TouchableOpacity onPress={() => setSelectedFile(null)} style={styles.clearFile}>
                  <Feather name="x" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              )}
            </TouchableOpacity>

            {selectedFile && (
              <View style={styles.fileInfo}>
                <Text style={[styles.fileInfoText, { color: colors.textSecondary }]}>
                  Size: {formatSize(selectedFile.size || 0)}
                </Text>
                <Text style={[styles.fileInfoText, { color: colors.textSecondary }]}>
                  Type: {selectedFile.mimeType || 'Unknown'}
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.addButton, { backgroundColor: colors.primary }]}
              onPress={addDocument}
            >
              <Text style={styles.addButtonText}>Add Document</Text>
            </TouchableOpacity>
          </View>

          {/* List */}
          {documents.length > 0 ? (
            <FlatList
              data={documents}
              renderItem={renderItem}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              contentContainerStyle={styles.listContainer}
            />
          ) : (
            <View style={styles.emptyContainer}>
              <Feather name="folder" size={60} color={colors.textSecondary} opacity={0.5} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No documents added yet.
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  backButton: {
    padding: spacing.sm,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    fontFamily: typography.family,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing['2xl'],
  },
  form: {
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
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
  pickButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  pickButtonText: {
    flex: 1,
    fontSize: 16,
    fontFamily: typography.family,
  },
  clearFile: {
    padding: 4,
  },
  fileInfo: {
    marginBottom: spacing.md,
  },
  fileInfoText: {
    fontSize: 14,
    fontFamily: typography.family,
  },
  addButton: {
    borderRadius: 8,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: typography.family,
  },
  listContainer: {
    paddingBottom: spacing.sm,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardContent: {
    flex: 1,
  },
  docName: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: typography.family,
  },
  docInfo: {
    fontSize: 14,
    fontFamily: typography.family,
    marginTop: 2,
  },
  deleteButton: {
    padding: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing['3xl'],
    gap: spacing.md,
  },
  emptyText: {
    fontSize: 16,
    fontFamily: typography.family,
    textAlign: 'center',
  },
});