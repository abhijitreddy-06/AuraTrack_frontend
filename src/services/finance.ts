import { authenticatedRequest } from "./auth";
export type Transaction = { id: string; type: string; direction: "gain" | "loss"; title: string; amount: number; date: string; time: string };
export type FinanceSummary = { balance: number; totalGained: number; totalLost: number; transactions: Transaction[] };
export const getFinanceSummary = () => authenticatedRequest<{ success: boolean; data: FinanceSummary }>("/api/finance/summary");
