import React, { useState, useEffect } from 'react';
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
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../hooks/useTheme';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import DateTimePickerModal from "react-native-modal-datetime-picker";
import {
  Income,
  createIncome,
  deleteIncome as deleteIncomeRequest,
  getIncomes,
  updateIncome,
} from "../services/incomes";

export const AddIncomeScreen: React.FC = () => {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState<Date | null>(null);
  const [time, setTime] = useState<Date | null>(null);
  const [isDatePickerVisible, setDatePickerVisible] = useState(false);
  const [isTimePickerVisible, setTimePickerVisible] = useState(false);

  useEffect(() => {
    void loadIncomes();
  }, []);

  const loadIncomes = async () => {
    try {
      const response = await getIncomes();
      setIncomes(response.data);
    } catch (error) {
      Alert.alert('Could not load incomes', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  const toApiDate = (value: Date) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  const toApiTime = (value: Date) => `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;
  const parseApiDate = (value: string) => { const [year, month, day] = value.slice(0, 10).split('-').map(Number); return new Date(year, month - 1, day); };
  const parseApiTime = (value: string) => { const [hours, minutes] = value.split(':').map(Number); const date = new Date(); date.setHours(hours, minutes, 0, 0); return date; };

  const handleSubmit = async () => {
    // Validation
    if (!name.trim()) {
      Alert.alert('Validation', 'Please enter a description.');
      return;
    }
    if (!amount.trim()) {
      Alert.alert('Validation', 'Please enter an amount.');
      return;
    }
    const amountNum = Number(amount);
    if (!Number.isInteger(amountNum) || amountNum <= 0) {
      Alert.alert('Validation', 'Please enter a positive whole-number amount.');
      return;
    }
    if (!date) {
      Alert.alert('Validation', 'Please select a date.');
      return;
    }
    if (!time) {
      Alert.alert('Validation', 'Please select a time.');
      return;
    }

    const payload = { title: name.trim(), amount: amountNum, date: toApiDate(date), time: toApiTime(time) };
    try {
      if (editingId) {
        const response = await updateIncome(editingId, payload);
        setIncomes((current) => current.map((income) => income.id === editingId ? response.data : income));
      } else {
        const response = await createIncome(payload);
        setIncomes((current) => [...current, response.data]);
      }
      resetForm();
    } catch (error) {
      Alert.alert(`Could not ${editingId ? 'update' : 'save'} income`, error instanceof Error ? error.message : 'Please try again.');
    }
  };

  const resetForm = () => {
    setName('');
    setAmount('');
    setDate(null);
    setTime(null);
    setEditingId(null);
  };

  const handleEdit = (item: Income) => {
    setName(item.title);
    setAmount(item.amount.toString());
    setDate(parseApiDate(item.date));
    setTime(parseApiTime(item.time));
    setEditingId(item.id);
  };

  const handleDelete = (id: string) => {
    Alert.alert(
      'Delete Income',
      'Are you sure you want to delete this income entry?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => void (async () => {
            try {
              await deleteIncomeRequest(id);
              setIncomes((current) => current.filter((income) => income.id !== id));
            } catch (error) {
              Alert.alert('Could not delete income', error instanceof Error ? error.message : 'Please try again.');
            }
          })(),
        },
      ]
    );
  };

  const showDatePicker = () => setDatePickerVisible(true);
  const hideDatePicker = () => setDatePickerVisible(false);

  const showTimePicker = () => setTimePickerVisible(true);
  const hideTimePicker = () => setTimePickerVisible(false);

  const handleConfirmDate = (selectedDate: Date) => {
    hideDatePicker();
    if (selectedDate) {
      setDate(selectedDate);
    }
  };

  const handleConfirmTime = (selectedTime: Date) => {
    hideTimePicker();
    if (selectedTime) {
      setTime(selectedTime);
    }
  };

  const formatDate = (isoString: string) => {
    const d = parseApiDate(isoString);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (isoString: string) => {
    const d = parseApiTime(isoString);
    return d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderItem = ({ item }: { item: Income }) => (
    <View style={[styles.card, { backgroundColor: colors.secondaryBackground }]}>
      <View style={styles.cardHeader}>
        <Text style={[styles.cardName, { color: colors.textPrimary }]}>
          {item.title}
        </Text>
        <View style={styles.actions}>
          <TouchableOpacity onPress={() => handleEdit(item)} style={styles.actionButton}>
            <Feather name="edit-2" size={18} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.actionButton}>
            <Feather name="trash-2" size={18} color={colors.expense} />
          </TouchableOpacity>
        </View>
      </View>
      <Text style={[styles.cardAmount, { color: colors.primary }]}>
        {item.amount.toFixed(2)}
      </Text>
      <View style={styles.cardDetails}>
        <Feather name="calendar" size={14} color={colors.textSecondary} />
        <Text style={[styles.cardDate, { color: colors.textSecondary }]}>
          {formatDate(item.date)}
        </Text>
        <Feather name="clock" size={14} color={colors.textSecondary} style={styles.detailIcon} />
        <Text style={[styles.cardDate, { color: colors.textSecondary }]}>
          {formatTime(item.time)}
        </Text>
      </View>
    </View>
  );

  const filteredIncomes = incomes.filter((income) => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;

    return (
      income.title.toLowerCase().includes(query) ||
      formatDate(income.date).toLowerCase().includes(query) ||
      income.date.includes(query)
    );
  });

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
          Add Income
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.searchContainer, { borderColor: colors.divider, backgroundColor: colors.secondaryBackground }]}>
            <Feather name="search" size={18} color={colors.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: colors.textPrimary }]}
              placeholder="Search by name or date"
              placeholderTextColor={colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
            />
          </View>

          {/* Form */}
          <View style={[styles.form, { backgroundColor: colors.secondaryBackground }]}>
            <Text style={[styles.formTitle, { color: colors.textPrimary }]}>
              {editingId ? 'Edit Income' : 'Add New Income'}
            </Text>

            <TextInput
              style={[styles.input, { color: colors.textPrimary, borderColor: colors.divider }]}
              placeholder="What did you earn from?"
              placeholderTextColor={colors.textSecondary}
              value={name}
              onChangeText={setName}
            />

            <TextInput
              style={[styles.input, { color: colors.textPrimary, borderColor: colors.divider }]}
              placeholder="Amount (â‚¹)"
              placeholderTextColor={colors.textSecondary}
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
            />

            <View style={styles.row}>
              <TouchableOpacity
                style={[styles.dateButton, { borderColor: colors.divider }]}
                onPress={showDatePicker}
              >
                <Feather name="calendar" size={20} color={colors.textSecondary} />
                <Text style={[styles.dateText, { color: date ? colors.textPrimary : colors.textSecondary }]}>
                  {date ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Select Date'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.dateButton, { borderColor: colors.divider }]}
                onPress={showTimePicker}
              >
                <Feather name="clock" size={20} color={colors.textSecondary} />
                <Text style={[styles.dateText, { color: time ? colors.textPrimary : colors.textSecondary }]}>
                  {time ? time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : 'Select Time'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.formActions}>
              {editingId && (
                <TouchableOpacity
                  style={[styles.formButton, styles.cancelButton, { borderColor: colors.divider }]}
                  onPress={resetForm}
                >
                  <Text style={[styles.formButtonText, { color: colors.textPrimary }]}>
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
                  {editingId ? 'Update' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* List */}
          {filteredIncomes.length > 0 ? (
            <FlatList
              data={filteredIncomes}
              renderItem={renderItem}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              contentContainerStyle={styles.listContainer}
            />
          ) : (
            <View style={styles.emptyContainer}>
              <Feather name="trending-up" size={60} color={colors.textSecondary} opacity={0.5} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No income recorded yet.
              </Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Date Picker Modal */}
      <DateTimePickerModal
        isVisible={isDatePickerVisible}
        mode="date"
        onConfirm={handleConfirmDate}
        onCancel={hideDatePicker}
        date={date || new Date()}
      />

      {/* Time Picker Modal */}
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
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
    fontWeight: '600',
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
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  dateButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
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
  formActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  formButton: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
  },
  cancelButton: {
    backgroundColor: 'transparent',
  },
  formButtonText: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: typography.family,
  },
  submitButton: {},
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: typography.family,
  },
  listContainer: {
    paddingBottom: spacing.sm,
  },
  card: {
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardName: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: typography.family,
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    padding: 4,
  },
  cardAmount: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: typography.family,
    marginVertical: 4,
  },
  cardDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  detailIcon: {
    marginLeft: 8,
  },
  cardDate: {
    fontSize: 14,
    fontFamily: typography.family,
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
