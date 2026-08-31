import { authenticatedRequest, isNetworkFailure } from "./auth";
import {
  loadCachedCollection,
  offlineCreate,
  offlineDelete,
  offlineUpdate,
  refreshAndCacheCollection,
} from "../offline/cache";

export type Income = {
  id: string;
  title: string;
  amount: number;
  date: string;
  time: string;
  created_at: string;
};
export type IncomePayload = Pick<Income, "title" | "amount" | "date" | "time">;
type IncomeResponse = { success: boolean; data: Income };
type IncomesResponse = { success: boolean; data: Income[] };

export const getIncomes = async () => {
  try {
    return {
      success: true,
      data: await refreshAndCacheCollection<Income>("incomes", "/api/incomes"),
    } satisfies IncomesResponse;
  } catch (error) {
    if (isNetworkFailure(error)) {
      return {
        success: true,
        data: await loadCachedCollection<Income>("incomes"),
      } satisfies IncomesResponse;
    }
    throw error;
  }
};

export const createIncome = async (body: IncomePayload) => {
  try {
    return await authenticatedRequest<IncomeResponse>("/api/incomes", {
      method: "POST",
      body,
    });
  } catch (error) {
    if (isNetworkFailure(error)) {
      return await offlineCreate<Income>(
        "incomes",
        "/api/incomes",
        body as Record<string, unknown>,
      );
    }
    throw error;
  }
};

export const updateIncome = async (id: string, body: IncomePayload) => {
  try {
    return await authenticatedRequest<IncomeResponse>(`/api/incomes/${id}`, {
      method: "PATCH",
      body,
    });
  } catch (error) {
    if (isNetworkFailure(error)) {
      return await offlineUpdate<Income>("incomes", `/api/incomes/${id}`, {
        ...(body as Record<string, unknown>),
        id,
      });
    }
    throw error;
  }
};

export const deleteIncome = async (id: string) => {
  try {
    return await authenticatedRequest<{ success: boolean }>(
      `/api/incomes/${id}`,
      { method: "DELETE" },
    );
  } catch (error) {
    if (isNetworkFailure(error)) {
      return await offlineDelete<{ success: boolean }>(
        "incomes",
        `/api/incomes/${id}`,
        id,
      );
    }
    throw error;
  }
};
