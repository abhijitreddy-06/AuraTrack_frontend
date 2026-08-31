import { authenticatedRequest, isNetworkFailure } from "./auth";
import {
  loadCachedCollection,
  offlineCreate,
  offlineDelete,
  offlineUpdate,
  refreshAndCacheCollection,
} from "../offline/cache";

export type LendedEntry = {
  id: string;
  person_name: string;
  amount: number;
  date: string;
  time: string;
  created_at: string;
};
export type LendedPayload = Pick<
  LendedEntry,
  "person_name" | "amount" | "date" | "time"
>;
type EntryResponse = { success: boolean; data: LendedEntry };
type EntriesResponse = { success: boolean; data: LendedEntry[] };

export const getLendedEntries = async () => {
  try {
    return {
      success: true,
      data: await refreshAndCacheCollection<LendedEntry>(
        "lended",
        "/api/lended",
      ),
    } satisfies EntriesResponse;
  } catch (error) {
    if (isNetworkFailure(error)) {
      return {
        success: true,
        data: await loadCachedCollection<LendedEntry>("lended"),
      } satisfies EntriesResponse;
    }
    throw error;
  }
};

export const createLendedEntry = async (body: LendedPayload) => {
  try {
    return await authenticatedRequest<EntryResponse>("/api/lended", {
      method: "POST",
      body,
    });
  } catch (error) {
    if (isNetworkFailure(error)) {
      return await offlineCreate<LendedEntry>(
        "lended",
        "/api/lended",
        body as Record<string, unknown>,
      );
    }
    throw error;
  }
};

export const updateLendedEntry = async (id: string, body: LendedPayload) => {
  try {
    return await authenticatedRequest<EntryResponse>(`/api/lended/${id}`, {
      method: "PATCH",
      body,
    });
  } catch (error) {
    if (isNetworkFailure(error)) {
      return await offlineUpdate<LendedEntry>("lended", `/api/lended/${id}`, {
        ...(body as Record<string, unknown>),
        id,
      });
    }
    throw error;
  }
};

export const deleteLendedEntry = async (id: string) => {
  try {
    return await authenticatedRequest<{ success: boolean }>(
      `/api/lended/${id}`,
      { method: "DELETE" },
    );
  } catch (error) {
    if (isNetworkFailure(error)) {
      return await offlineDelete<{ success: boolean }>(
        "lended",
        `/api/lended/${id}`,
        id,
      );
    }
    throw error;
  }
};
