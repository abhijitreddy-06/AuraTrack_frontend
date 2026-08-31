import { authenticatedRequest, isNetworkFailure } from "./auth";
import {
  loadCachedCollection,
  offlineCreate,
  offlineDelete,
  offlineUpdate,
  refreshAndCacheCollection,
} from "../offline/cache";

export type Expense = {
  id: string;
  title: string;
  amount: number;
  date: string;
  time: string;
  created_at: string;
};

export type ExpensePayload = Pick<
  Expense,
  "title" | "amount" | "date" | "time"
>;

type ExpenseResponse = { success: boolean; data: Expense };
type ExpensesResponse = { success: boolean; data: Expense[] };

export const getExpenses = async () => {
  try {
    return {
      success: true,
      data: await refreshAndCacheCollection<Expense>(
        "expenses",
        "/api/expenses",
      ),
    } satisfies ExpensesResponse;
  } catch (error) {
    if (isNetworkFailure(error)) {
      return {
        success: true,
        data: await loadCachedCollection<Expense>("expenses"),
      } satisfies ExpensesResponse;
    }
    throw error;
  }
};

export const createExpense = async (body: ExpensePayload) => {
  try {
    const response = await authenticatedRequest<ExpenseResponse>(
      "/api/expenses",
      {
        method: "POST",
        body,
      },
    );
    return response;
  } catch (error) {
    if (isNetworkFailure(error)) {
      return await offlineCreate<Expense>(
        "expenses",
        "/api/expenses",
        body as Record<string, unknown>,
      );
    }
    throw error;
  }
};

export const updateExpense = async (id: string, body: ExpensePayload) => {
  try {
    const response = await authenticatedRequest<ExpenseResponse>(
      `/api/expenses/${id}`,
      {
        method: "PATCH",
        body,
      },
    );
    return response;
  } catch (error) {
    if (isNetworkFailure(error)) {
      return await offlineUpdate<Expense>("expenses", `/api/expenses/${id}`, {
        ...(body as Record<string, unknown>),
        id,
      });
    }
    throw error;
  }
};

export const deleteExpense = async (id: string) => {
  try {
    return await authenticatedRequest<{ success: boolean }>(
      `/api/expenses/${id}`,
      {
        method: "DELETE",
      },
    );
  } catch (error) {
    if (isNetworkFailure(error)) {
      return await offlineDelete<{ success: boolean }>(
        "expenses",
        `/api/expenses/${id}`,
        id,
      );
    }
    throw error;
  }
};
