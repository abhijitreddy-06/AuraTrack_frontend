import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  SectionList,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { getFinanceSummary, Transaction } from "../services/finance";
import { useTheme } from "../hooks/useTheme";
import { spacing } from "../theme/spacing";
import { typography } from "../theme/typography";

export const FinanceSummaryScreen = ({
  mode,
}: {
  mode: "balance" | "history";
}) => {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const [data, setData] = useState<{
    balance: number;
    totalGained: number;
    totalLost: number;
    transactions: Transaction[];
  } | null>(null);
  useEffect(() => {
    void getFinanceSummary().then((result) => setData(result.data));
  }, []);
  const sections = useMemo(
    () =>
      ["Income", "Expense", "Borrowed", "Lent"]
        .map((type) => ({
          title: type,
          data: (data?.transactions || [])
            .filter((item) => item.type === type)
            .sort((a, b) =>
              `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`),
            ),
        }))
        .filter((section) => section.data.length > 0),
    [data],
  );
  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          {mode === "balance" ? "Current Balance" : "History"}
        </Text>
        <View style={{ width: 24 }} />
      </View>
      {!data ? (
        <ActivityIndicator color={colors.primary} />
      ) : mode === "balance" ? (
        <View
          style={[
            styles.summary,
            { backgroundColor: colors.secondaryBackground },
          ]}
        >
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            Current balance
          </Text>
          <Text
            style={[
              styles.balance,
              { color: data.balance >= 0 ? colors.income : colors.expense },
            ]}
          >
            ₹{data.balance.toFixed(2)}
          </Text>
          <Text style={[styles.label, { color: colors.income }]}>
            Gained: ₹{data.totalGained.toFixed(2)}
          </Text>
          <Text style={[styles.label, { color: colors.expense }]}>
            Spent / lent: ₹{data.totalLost.toFixed(2)}
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderSectionHeader={({ section }) => (
            <Text
              style={[styles.sectionTitle, { color: colors.textSecondary }]}
            >
              {section.title}
            </Text>
          )}
          renderItem={({ item }) => (
            <View
              style={[
                styles.row,
                { backgroundColor: colors.secondaryBackground },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.itemTitle, { color: colors.textPrimary }]}>
                  {item.title}
                </Text>
                <Text style={[styles.label, { color: colors.textSecondary }]}>
                  {item.date} · {item.time.slice(0, 5)}
                </Text>
              </View>
              <Text
                style={{
                  color:
                    item.direction === "gain" ? colors.income : colors.expense,
                  fontFamily: typography.family,
                  fontWeight: "700",
                }}
              >
                {item.direction === "gain" ? "+" : "−"}₹{item.amount.toFixed(2)}
              </Text>
            </View>
          )}
          ListEmptyComponent={
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              No transactions yet.
            </Text>
          }
        />
      )}
    </SafeAreaView>
  );
};
const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: spacing.lg,
  },
  title: { fontSize: 18, fontWeight: "600", fontFamily: typography.family },
  summary: {
    margin: spacing.lg,
    padding: spacing.lg,
    borderRadius: 16,
    gap: spacing.sm,
  },
  balance: { fontSize: 32, fontWeight: "700", fontFamily: typography.family },
  label: { fontFamily: typography.family },
  list: { padding: spacing.lg, gap: spacing.sm },
  sectionTitle: {
    fontFamily: typography.family,
    fontSize: 14,
    fontWeight: "700",
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    textTransform: "uppercase",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: spacing.md,
    borderRadius: 12,
  },
  itemTitle: { fontFamily: typography.family, fontSize: 16, fontWeight: "600" },
});
