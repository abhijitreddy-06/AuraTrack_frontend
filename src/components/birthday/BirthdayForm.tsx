import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

interface BirthdayFormProps {
  onAdd: (name: string, date: string) => void;
}

export const BirthdayForm: React.FC<BirthdayFormProps> = ({ onAdd }) => {
  const { colors } = useTheme();
  const [name, setName] = useState('');
  const [date, setDate] = useState('');

  const handleSubmit = () => {
    if (name.trim() && date.trim()) {
      onAdd(name.trim(), date.trim());
      setName('');
      setDate('');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.secondaryBackground }]}>
      <Text style={[styles.label, { color: colors.textPrimary }]}>Add Birthday</Text>
      <View style={styles.row}>
        <View style={[styles.inputWrapper, { borderColor: colors.divider }]}>
          <Feather name="user" size={16} color={colors.textSecondary} style={styles.icon} />
          <TextInput
            style={[styles.input, { color: colors.textPrimary }]}
            placeholder="Name"
            placeholderTextColor={colors.textSecondary}
            value={name}
            onChangeText={setName}
          />
        </View>
        <View style={[styles.inputWrapper, { borderColor: colors.divider }]}>
          <Feather name="calendar" size={16} color={colors.textSecondary} style={styles.icon} />
          <TextInput
            style={[styles.input, { color: colors.textPrimary }]}
            placeholder="DD/MM/YYYY"
            placeholderTextColor={colors.textSecondary}
            value={date}
            onChangeText={setDate}
          />
        </View>
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: colors.primary }]}
          onPress={handleSubmit}
          activeOpacity={0.7}
        >
          <Feather name="plus" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginVertical: spacing.sm,
    borderRadius: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: typography.family,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    height: 40,
  },
  icon: {
    marginRight: spacing.xs,
  },
  input: {
    flex: 1,
    fontSize: 14,
    fontFamily: typography.family,
    paddingVertical: spacing.xs,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
});