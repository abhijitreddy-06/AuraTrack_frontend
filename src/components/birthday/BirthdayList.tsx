import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

interface Birthday {
  id: string;
  name: string;
  date: string; // DD/MM/YYYY
}

interface BirthdayListProps {
  birthdays: Birthday[];
  onDelete?: (id: string) => void;
}

const getDaysUntilBirthday = (dateStr: string) => {
  const [day, month, year] = dateStr.split('/').map(Number);
  const today = new Date();
  const birthDate = new Date(today.getFullYear(), month - 1, day);
  if (birthDate < today) {
    birthDate.setFullYear(today.getFullYear() + 1);
  }
  const diffTime = birthDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

const getAge = (dateStr: string) => {
  const [day, month, year] = dateStr.split('/').map(Number);
  const today = new Date();
  let age = today.getFullYear() - year;
  const m = today.getMonth() - (month - 1);
  if (m < 0 || (m === 0 && today.getDate() < day)) {
    age--;
  }
  return age;
};

export const BirthdayList: React.FC<BirthdayListProps> = ({ birthdays, onDelete }) => {
  const { colors } = useTheme();

  const renderItem = ({ item }: { item: Birthday }) => {
    const daysLeft = getDaysUntilBirthday(item.date);
    const age = getAge(item.date);
    const isToday = daysLeft === 0;

    return (
      <View style={[styles.card, { backgroundColor: colors.secondaryBackground }]}>
        <View style={styles.info}>
          <Text style={[styles.name, { color: colors.textPrimary }]}>{item.name}</Text>
          <Text style={[styles.detail, { color: colors.textSecondary }]}>
            {item.date} · {age} years old
          </Text>
        </View>
        <View style={styles.right}>
          <View style={[styles.timer, isToday && styles.today]}>
            <Feather name="clock" size={14} color={isToday ? '#fff' : colors.primary} />
            <Text style={[styles.days, { color: isToday ? '#fff' : colors.primary }]}>
              {isToday ? '🎉 Today!' : `${daysLeft} days`}
            </Text>
          </View>
          {onDelete && (
            <TouchableOpacity onPress={() => onDelete(item.id)} style={styles.delete}>
              <Feather name="x" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <FlatList
      data={birthdays}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      contentContainerStyle={styles.list}
      showsVerticalScrollIndicator={false}
      ListEmptyComponent={
        <Text style={[styles.empty, { color: colors.textSecondary }]}>
          No birthdays added yet.
        </Text>
      }
    />
  );
};

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing['2xl'],
  },
  card: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    marginVertical: spacing.xs,
    borderRadius: 12,
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '500',
    fontFamily: typography.family,
  },
  detail: {
    fontSize: 13,
    fontFamily: typography.family,
    marginTop: 2,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  timer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(79, 140, 255, 0.1)',
  },
  today: {
    backgroundColor: '#FF5A5F',
  },
  days: {
    fontSize: 12,
    fontWeight: '500',
    fontFamily: typography.family,
  },
  empty: {
    textAlign: 'center',
    marginTop: spacing.xl,
    fontSize: 16,
  },
  delete: {
    padding: 4,
  },
});