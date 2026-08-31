import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  ActivityIndicator,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import Svg, { Circle, Polyline } from "react-native-svg";
import { useTheme } from "../hooks/useTheme";
import { FloatingNav } from "../components/navigation/FloatingNav";
import { spacing } from "../theme/spacing";
import { typography } from "../theme/typography";
import {
  AnalyticsData,
  AnalyticsPeriod,
  getAnalytics,
} from "../services/analytics";

type Period = "This Week" | "This Month" | "3 Months" | "6 Months" | "1 Year";

const PERIODS: Period[] = [
  "This Week",
  "This Month",
  "3 Months",
  "6 Months",
  "1 Year",
];
const formatAmount = (amount: number) => `₹${amount.toLocaleString("en-IN")}`;
const PERIOD_API: Record<Period, AnalyticsPeriod> = {
  "This Week": "week",
  "This Month": "month",
  "3 Months": "3months",
  "6 Months": "6months",
  "1 Year": "year",
};

const categoryIcon = (name: string): keyof typeof Feather.glyphMap => {
  const value = name.toLowerCase();
  if (value.includes("food") || value.includes("dining")) return "coffee";
  if (value.includes("transport") || value.includes("travel")) return "truck";
  if (value.includes("shop")) return "shopping-bag";
  if (
    value.includes("rent") ||
    value.includes("house") ||
    value.includes("home")
  )
    return "home";
  return "more-horizontal";
};

const categoryColor = (
  index: number,
  colors: ReturnType<typeof useTheme>["colors"],
) =>
  [
    colors.primary,
    colors.expense,
    colors.income,
    colors.warning,
    colors.secondary,
  ][index % 5];

const EMPTY_ANALYTICS: AnalyticsData = {
  period: "month",
  overview: { totalIncome: 0, totalExpenses: 0, netSavings: 0 },
  incomeExpense: [],
  spendingBreakdown: [],
  spendingTrend: [],
  topSpending: [],
};

export const AnalyticsScreen: React.FC = () => {
  const { colors, isDark } = useTheme();
  const { width } = useWindowDimensions();
  const [period, setPeriod] = useState<Period>("This Month");
  const [periodOpen, setPeriodOpen] = useState(false);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const fadeIn = useRef(new Animated.Value(0)).current;
  const chartWidth = Math.max(width - spacing.lg * 4, 230);
  const data = analytics || EMPTY_ANALYTICS;
  const maxValue = Math.max(
    ...data.incomeExpense.flatMap((item) => [item.income, item.expenses]),
    1,
  );
  const totalExpenses = data.overview.totalExpenses;

  useEffect(() => {
    Animated.timing(fadeIn, {
      toValue: 1,
      duration: 420,
      useNativeDriver: true,
    }).start();
  }, [fadeIn]);

  useEffect(() => {
    let mounted = true;
    setAnalytics(null);
    getAnalytics(PERIOD_API[period])
      .then((result) => {
        if (mounted) setAnalytics(result.data);
      })
      .catch(() => {
        if (mounted) setAnalytics(EMPTY_ANALYTICS);
      });
    return () => {
      mounted = false;
    };
  }, [period]);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor={colors.background}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {analytics === null ? (
          <View style={styles.loadingState}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <Animated.View
            style={{
              opacity: fadeIn,
              transform: [
                {
                  translateY: fadeIn.interpolate({
                    inputRange: [0, 1],
                    outputRange: [10, 0],
                  }),
                },
              ],
            }}
          >
            <View style={styles.header}>
              <Text style={[styles.title, { color: colors.textPrimary }]}>
                Analytics
              </Text>
              <View>
                <Pressable
                  onPress={() => setPeriodOpen((open) => !open)}
                  style={[
                    styles.periodButton,
                    {
                      backgroundColor: colors.cardBackground,
                      borderColor: colors.divider,
                    },
                  ]}
                >
                  <Text
                    style={[styles.periodText, { color: colors.textPrimary }]}
                  >
                    {period}
                  </Text>
                  <Feather
                    name={periodOpen ? "chevron-up" : "chevron-down"}
                    size={15}
                    color={colors.textSecondary}
                  />
                </Pressable>
                {periodOpen && (
                  <View
                    style={[
                      styles.periodMenu,
                      {
                        backgroundColor: colors.cardBackground,
                        borderColor: colors.divider,
                      },
                    ]}
                  >
                    {PERIODS.map((option) => (
                      <Pressable
                        key={option}
                        onPress={() => {
                          setPeriod(option);
                          setPeriodOpen(false);
                        }}
                        style={styles.periodOption}
                      >
                        <Text
                          style={[
                            styles.periodText,
                            {
                              color:
                                option === period
                                  ? colors.primary
                                  : colors.textPrimary,
                            },
                          ]}
                        >
                          {option}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
            </View>

            <Text
              style={[styles.sectionTitle, { color: colors.textSecondary }]}
            >
              Overview
            </Text>
            <View style={styles.overviewRow}>
              <MetricCard
                label="Total Income"
                value={formatAmount(data.overview.totalIncome)}
                color={colors.income}
                colors={colors}
              />
              <MetricCard
                label="Total Expenses"
                value={formatAmount(data.overview.totalExpenses)}
                color={colors.expense}
                colors={colors}
              />
              <MetricCard
                label="Net Savings"
                value={formatAmount(data.overview.netSavings)}
                color={colors.primary}
                colors={colors}
              />
            </View>

            <ChartSection title="Income vs Expense" colors={colors}>
              <View style={styles.legendRow}>
                <LegendDot
                  color={colors.income}
                  label="Income"
                  colors={colors}
                />
                <LegendDot
                  color={colors.expense}
                  label="Expenses"
                  colors={colors}
                />
              </View>
              <View
                style={[styles.barChart, { borderBottomColor: colors.divider }]}
              >
                {data.incomeExpense.map((item) => (
                  <View key={item.label} style={styles.barGroup}>
                    <View style={styles.bars}>
                      <View
                        style={[
                          styles.bar,
                          {
                            backgroundColor: colors.income,
                            height: `${(item.income / maxValue) * 100}%`,
                          },
                        ]}
                      />
                      <View
                        style={[
                          styles.bar,
                          {
                            backgroundColor: colors.expense,
                            height: `${(item.expenses / maxValue) * 100}%`,
                          },
                        ]}
                      />
                    </View>
                    <Text
                      style={[
                        styles.axisLabel,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {item.label}
                    </Text>
                  </View>
                ))}
              </View>
            </ChartSection>

            <ChartSection title="Spending Breakdown" colors={colors}>
              <View style={styles.donutArea}>
                <DonutChart
                  categories={data.spendingBreakdown}
                  colors={colors}
                />
                <View style={styles.donutCenter}>
                  <Text
                    style={[styles.donutTotal, { color: colors.textPrimary }]}
                  >
                    {formatAmount(totalExpenses)}
                  </Text>
                  <Text
                    style={[styles.donutLabel, { color: colors.textSecondary }]}
                  >
                    total spent
                  </Text>
                </View>
              </View>
              <View style={styles.categoryList}>
                {data.spendingBreakdown.map((category, index) => (
                  <View key={category.name} style={styles.categoryRow}>
                    <Feather
                      name={categoryIcon(category.name)}
                      size={17}
                      color={categoryColor(index, colors)}
                    />
                    <Text
                      style={[
                        styles.categoryName,
                        { color: colors.textPrimary },
                      ]}
                    >
                      {category.name}
                    </Text>
                    <Text
                      style={[
                        styles.categoryAmount,
                        { color: colors.textPrimary },
                      ]}
                    >
                      {formatAmount(category.amount)}
                    </Text>
                    <Text
                      style={[
                        styles.categoryPercentage,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {category.percentage}%
                    </Text>
                  </View>
                ))}
              </View>
            </ChartSection>

            <ChartSection title="Spending Trend" colors={colors}>
              <Svg
                width={chartWidth}
                height={150}
                viewBox={`0 0 ${chartWidth} 150`}
              >
                <Polyline
                  points={data.spendingTrend
                    .map(
                      (item, index) =>
                        `${data.spendingTrend.length > 1 ? (chartWidth * index) / (data.spendingTrend.length - 1) : chartWidth / 2},${150 - (item.amount / Math.max(...data.spendingTrend.map((trend) => trend.amount), 1)) * 120}`,
                    )
                    .join(" ")}
                  fill="none"
                  stroke={colors.expense}
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
              <View style={styles.axisRow}>
                {data.spendingTrend.map(({ label }) => (
                  <Text
                    key={label}
                    style={[styles.axisLabel, { color: colors.textSecondary }]}
                  >
                    {label}
                  </Text>
                ))}
              </View>
            </ChartSection>

            <Text
              style={[styles.sectionTitle, { color: colors.textSecondary }]}
            >
              Top Spending
            </Text>
            <View
              style={[
                styles.topList,
                { backgroundColor: colors.cardBackground },
              ]}
            >
              {data.topSpending.map((category, index) => (
                <View
                  key={category.name}
                  style={[
                    styles.topRow,
                    index < 4 && {
                      borderBottomColor: colors.divider,
                      borderBottomWidth: 1,
                    },
                  ]}
                >
                  <Text style={[styles.rank, { color: colors.textSecondary }]}>
                    {index + 1}
                  </Text>
                  <Text
                    style={[styles.categoryName, { color: colors.textPrimary }]}
                  >
                    {category.name}
                  </Text>
                  <Text
                    style={[
                      styles.categoryAmount,
                      { color: colors.textPrimary },
                    ]}
                  >
                    {formatAmount(category.amount)}
                  </Text>
                  <Text
                    style={[
                      styles.categoryPercentage,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {category.percentage}%
                  </Text>
                </View>
              ))}
            </View>
          </Animated.View>
        )}
      </ScrollView>
      <FloatingNav activeTab="analytics" onTabPress={() => undefined} />
    </SafeAreaView>
  );
};

const MetricCard = ({
  label,
  value,
  color,
  colors,
}: {
  label: string;
  value: string;
  color: string;
  colors: ReturnType<typeof useTheme>["colors"];
}) => (
  <View style={[styles.metricCard, { backgroundColor: colors.cardBackground }]}>
    <View style={[styles.metricAccent, { backgroundColor: color }]} />
    <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>
      {label}
    </Text>
    <Text style={[styles.metricValue, { color: colors.textPrimary }]}>
      {value}
    </Text>
  </View>
);

const ChartSection = ({
  title,
  colors,
  children,
}: {
  title: string;
  colors: ReturnType<typeof useTheme>["colors"];
  children: React.ReactNode;
}) => (
  <View
    style={[styles.chartSection, { backgroundColor: colors.cardBackground }]}
  >
    <Text style={[styles.chartTitle, { color: colors.textPrimary }]}>
      {title}
    </Text>
    {children}
  </View>
);

const LegendDot = ({
  color,
  label,
  colors,
}: {
  color: string;
  label: string;
  colors: ReturnType<typeof useTheme>["colors"];
}) => (
  <View style={styles.legendItem}>
    <View style={[styles.legendDot, { backgroundColor: color }]} />
    <Text style={[styles.legendText, { color: colors.textSecondary }]}>
      {label}
    </Text>
  </View>
);

const DonutChart = ({
  categories,
  colors,
}: {
  categories: AnalyticsData["spendingBreakdown"];
  colors: ReturnType<typeof useTheme>["colors"];
}) => {
  const circumference = 2 * Math.PI * 48;
  let offset = 0;
  return (
    <Svg width={140} height={140} viewBox="0 0 140 140">
      <Circle
        cx="70"
        cy="70"
        r="48"
        fill="none"
        stroke={colors.divider}
        strokeWidth="18"
      />
      {categories.map((category, index) => {
        const length = (circumference * category.percentage) / 100;
        const circle = (
          <Circle
            key={category.name}
            cx="70"
            cy="70"
            r="48"
            fill="none"
            stroke={categoryColor(index, colors)}
            strokeWidth="18"
            strokeDasharray={`${length} ${circumference - length}`}
            strokeDashoffset={-offset}
            transform="rotate(-90 70 70)"
          />
        );
        offset += length;
        return circle;
      })}
    </Svg>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingState: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 520,
  },
  content: { padding: spacing.lg, paddingBottom: spacing.xl },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.xl,
  },
  title: { fontFamily: typography.family, fontSize: 28, fontWeight: "700" },
  periodButton: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  periodText: {
    fontFamily: typography.family,
    fontSize: 13,
    fontWeight: "600",
  },
  periodMenu: {
    borderRadius: 8,
    borderWidth: 1,
    elevation: 5,
    position: "absolute",
    right: 0,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 6,
    top: 42,
    width: 130,
    zIndex: 5,
  },
  periodOption: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  sectionTitle: {
    fontFamily: typography.family,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
    textTransform: "uppercase",
  },
  overviewRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  metricCard: {
    borderRadius: 12,
    flex: 1,
    minHeight: 92,
    overflow: "hidden",
    padding: spacing.md,
  },
  metricAccent: {
    borderRadius: 2,
    height: 4,
    marginBottom: spacing.sm,
    width: 22,
  },
  metricLabel: { fontFamily: typography.family, fontSize: 11, lineHeight: 14 },
  metricValue: {
    fontFamily: typography.family,
    fontSize: 17,
    fontWeight: "700",
    marginTop: spacing.xs,
  },
  chartSection: {
    borderRadius: 12,
    marginBottom: spacing.xl,
    padding: spacing.lg,
  },
  chartTitle: {
    fontFamily: typography.family,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: spacing.md,
  },
  legendRow: {
    flexDirection: "row",
    gap: spacing.lg,
    marginBottom: spacing.md,
  },
  legendItem: { alignItems: "center", flexDirection: "row", gap: spacing.xs },
  legendDot: { borderRadius: 4, height: 8, width: 8 },
  legendText: { fontFamily: typography.family, fontSize: 12 },
  barChart: {
    alignItems: "flex-end",
    borderBottomWidth: 1,
    flexDirection: "row",
    height: 150,
    justifyContent: "space-around",
    paddingHorizontal: spacing.sm,
  },
  barGroup: {
    alignItems: "center",
    flex: 1,
    height: "100%",
    justifyContent: "flex-end",
  },
  bars: { alignItems: "flex-end", flexDirection: "row", gap: 3, height: 115 },
  bar: { borderRadius: 3, minHeight: 4, width: 9 },
  axisLabel: { fontFamily: typography.family, fontSize: 11 },
  donutArea: { alignItems: "center", justifyContent: "center", minHeight: 160 },
  donutCenter: { alignItems: "center", position: "absolute" },
  donutTotal: {
    fontFamily: typography.family,
    fontSize: 17,
    fontWeight: "700",
  },
  donutLabel: { fontFamily: typography.family, fontSize: 11, marginTop: 2 },
  categoryList: { gap: spacing.md, marginTop: spacing.md },
  categoryRow: { alignItems: "center", flexDirection: "row" },
  categoryName: {
    flex: 1,
    fontFamily: typography.family,
    fontSize: 13,
    marginLeft: spacing.sm,
  },
  categoryAmount: {
    fontFamily: typography.family,
    fontSize: 13,
    fontWeight: "600",
    marginRight: spacing.md,
  },
  categoryPercentage: {
    fontFamily: typography.family,
    fontSize: 12,
    minWidth: 32,
    textAlign: "right",
  },
  axisRow: { flexDirection: "row", justifyContent: "space-between" },
  topList: {
    borderRadius: 12,
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  topRow: { alignItems: "center", flexDirection: "row", minHeight: 52 },
  rank: { fontFamily: typography.family, fontSize: 13, width: 24 },
});
