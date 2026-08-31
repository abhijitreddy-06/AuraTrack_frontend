import { authenticatedRequest, isNetworkFailure } from "./auth";
import {
  loadCachedCollection,
  offlineCreate,
  offlineDelete,
  offlineUpdate,
  refreshAndCacheCollection,
} from "../offline/cache";
export type PlannedExpense = {
  id: string;
  title: string;
  amount: number;
  date: string;
  time: string | null;
};
export type PlannedExpensePayload = Omit<PlannedExpense, "id">;
type Response = { success: boolean; data: PlannedExpense };

export const getPlannedExpenses = async () => {
  try {
    return {
      success: true,
      data: await refreshAndCacheCollection<PlannedExpense>(
        "planned-expenses",
        "/api/planned-expenses",
      ),
    } satisfies { success: boolean; data: PlannedExpense[] };
  } catch (error) {
    if (isNetworkFailure(error)) {
      return {
        success: true,
        data: await loadCachedCollection<PlannedExpense>("planned-expenses"),
      } satisfies { success: boolean; data: PlannedExpense[] };
    }
    throw error;
  }
};

export const createPlannedExpense = async (body: PlannedExpensePayload) => {
  try {
    return await authenticatedRequest<Response>("/api/planned-expenses", {
      method: "POST",
      body,
    });
  } catch (error) {
    if (isNetworkFailure(error)) {
      return await offlineCreate<PlannedExpense>(
        "planned-expenses",
        "/api/planned-expenses",
        body as Record<string, unknown>,
      );
    }
    throw error;
  }
};

export const updatePlannedExpense = async (
  id: string,
  body: PlannedExpensePayload,
) => {
  try {
    return await authenticatedRequest<Response>(`/api/planned-expenses/${id}`, {
      method: "PATCH",
      body,
    });
  } catch (error) {
    if (isNetworkFailure(error)) {
      return await offlineUpdate<PlannedExpense>(
        "planned-expenses",
        `/api/planned-expenses/${id}`,
        { ...(body as Record<string, unknown>), id },
      );
    }
    throw error;
  }
};

export const deletePlannedExpense = async (id: string) => {
  try {
    return await authenticatedRequest<{ success: boolean }>(
      `/api/planned-expenses/${id}`,
      { method: "DELETE" },
    );
  } catch (error) {
    if (isNetworkFailure(error)) {
      return await offlineDelete<{ success: boolean }>(
        "planned-expenses",
        `/api/planned-expenses/${id}`,
        id,
      );
    }
    throw error;
  }
};
