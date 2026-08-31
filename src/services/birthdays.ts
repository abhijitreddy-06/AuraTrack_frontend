import { authenticatedRequest, isNetworkFailure } from "./auth";
import {
  loadCachedCollection,
  offlineCreate,
  offlineDelete,
  offlineUpdate,
  refreshAndCacheCollection,
} from "../offline/cache";

export type Birthday = {
  id: string;
  name: string;
  date: string;
  created_at: string;
};

type BirthdayResponse = { success: boolean; data: Birthday };
type BirthdaysResponse = { success: boolean; data: Birthday[] };

export const getBirthdays = async () => {
  try {
    return {
      success: true,
      data: await refreshAndCacheCollection<Birthday>(
        "birthdays",
        "/api/birthdays",
      ),
    } satisfies BirthdaysResponse;
  } catch (error) {
    if (isNetworkFailure(error)) {
      return {
        success: true,
        data: await loadCachedCollection<Birthday>("birthdays"),
      } satisfies BirthdaysResponse;
    }
    throw error;
  }
};

export const createBirthday = async (name: string, date: string) => {
  try {
    return await authenticatedRequest<BirthdayResponse>("/api/birthdays", {
      method: "POST",
      body: { name, date },
    });
  } catch (error) {
    if (isNetworkFailure(error)) {
      return await offlineCreate<Birthday>("birthdays", "/api/birthdays", {
        name,
        date,
      } as Record<string, unknown>);
    }
    throw error;
  }
};

export const updateBirthday = async (
  id: string,
  name: string,
  date: string,
) => {
  try {
    return await authenticatedRequest<BirthdayResponse>(
      `/api/birthdays/${id}`,
      {
        method: "PATCH",
        body: { name, date },
      },
    );
  } catch (error) {
    if (isNetworkFailure(error)) {
      return await offlineUpdate<Birthday>(
        "birthdays",
        `/api/birthdays/${id}`,
        { name, date, id } as Record<string, unknown>,
      );
    }
    throw error;
  }
};

export const deleteBirthday = async (id: string) => {
  try {
    return await authenticatedRequest<{ success: boolean }>(
      `/api/birthdays/${id}`,
      {
        method: "DELETE",
      },
    );
  } catch (error) {
    if (isNetworkFailure(error)) {
      return await offlineDelete<{ success: boolean }>(
        "birthdays",
        `/api/birthdays/${id}`,
        id,
      );
    }
    throw error;
  }
};
