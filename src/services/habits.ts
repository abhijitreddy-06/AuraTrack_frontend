import { authenticatedRequest, isNetworkFailure } from "./auth";
import {
  loadCachedCollection,
  offlineCreate,
  offlineDelete,
  offlineUpdate,
  refreshAndCacheCollection,
} from "../offline/cache";

export type Habit = {
  id: string;
  title: string;
  current_streak: number;
  longest_streak: number;
  missed_count: number;
  today_done: boolean;
  created_at: string;
};

type HabitResponse = { success: boolean; data: Habit };
type HabitsResponse = { success: boolean; data: Habit[] };

export const getHabits = async () => {
  try {
    return {
      success: true,
      data: await refreshAndCacheCollection<Habit>("habits", "/api/habits"),
    } satisfies HabitsResponse;
  } catch (error) {
    if (isNetworkFailure(error)) {
      return {
        success: true,
        data: await loadCachedCollection<Habit>("habits"),
      } satisfies HabitsResponse;
    }
    throw error;
  }
};

export const createHabit = async (title: string) => {
  try {
    return await authenticatedRequest<HabitResponse>("/api/habits", {
      method: "POST",
      body: { title },
    });
  } catch (error) {
    if (isNetworkFailure(error)) {
      return await offlineCreate<Habit>("habits", "/api/habits", {
        title,
      } as Record<string, unknown>);
    }
    throw error;
  }
};

export const updateHabit = async (id: string, title: string) => {
  try {
    return await authenticatedRequest<HabitResponse>(`/api/habits/${id}`, {
      method: "PATCH",
      body: { title },
    });
  } catch (error) {
    if (isNetworkFailure(error)) {
      return await offlineUpdate<Habit>("habits", `/api/habits/${id}`, {
        title,
        id,
      } as Record<string, unknown>);
    }
    throw error;
  }
};

export const completeHabit = async (id: string) => {
  try {
    return await authenticatedRequest<HabitResponse>(
      `/api/habits/${id}/complete`,
      {
        method: "PATCH",
      },
    );
  } catch (error) {
    if (isNetworkFailure(error)) {
      return await offlineUpdate<Habit>(
        "habits",
        `/api/habits/${id}/complete`,
        { id } as Record<string, unknown>,
      );
    }
    throw error;
  }
};

export const deleteHabit = async (id: string) => {
  try {
    return await authenticatedRequest<{ success: boolean }>(
      `/api/habits/${id}`,
      {
        method: "DELETE",
      },
    );
  } catch (error) {
    if (isNetworkFailure(error)) {
      return await offlineDelete<{ success: boolean }>(
        "habits",
        `/api/habits/${id}`,
        id,
      );
    }
    throw error;
  }
};
