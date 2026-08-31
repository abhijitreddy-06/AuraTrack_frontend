import { authenticatedRequest } from "./auth";

export type AnalyticsPeriod = "week" | "month" | "3months" | "6months" | "year";

export type AnalyticsData = {
  period: AnalyticsPeriod;
  overview: {
    totalIncome: number;
    totalExpenses: number;
    netSavings: number;
  };
  incomeExpense: { label: string; income: number; expenses: number }[];
  spendingBreakdown: { name: string; amount: number; percentage: number }[];
  spendingTrend: { label: string; amount: number }[];
  topSpending: { name: string; amount: number; percentage: number }[];
};

export const getAnalytics = (period: AnalyticsPeriod) =>
  authenticatedRequest<{ success: boolean; data: AnalyticsData }>(
    `/api/finance/analytics?period=${period}`,
  );
