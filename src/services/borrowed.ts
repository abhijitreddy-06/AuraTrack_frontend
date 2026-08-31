import { authenticatedRequest, isNetworkFailure } from "./auth";
import {
  loadCachedCollection,
  offlineCreate,
  offlineDelete,
  offlineUpdate,
  refreshAndCacheCollection,
} from "../offline/cache";

export type BorrowedEntry = {
  id: string;
  person_name: string;
  amount: number;
  date: string;
  time: string;
  created_at: string;
};
export type BorrowedPayload = Pick<
  BorrowedEntry,
  "person_name" | "amount" | "date" | "time"
>;
type EntryResponse = { success: boolean; data: BorrowedEntry };
type EntriesResponse = { success: boolean; data: BorrowedEntry[] };

export const getBorrowedEntries = async () => {
  try {
    return {
      success: true,
      data: await refreshAndCacheCollection<BorrowedEntry>(
        "borrowed",
        "/api/borrowed",
      ),
    } satisfies EntriesResponse;
  } catch (error) {
    if (isNetworkFailure(error)) {
      return {
        success: true,
        data: await loadCachedCollection<BorrowedEntry>("borrowed"),
      } satisfies EntriesResponse;
    }
    throw error;
  }
};

export const createBorrowedEntry = async (body: BorrowedPayload) => {
  try {
    return await authenticatedRequest<EntryResponse>("/api/borrowed", {
      method: "POST",
      body,
    });
  } catch (error) {
    if (isNetworkFailure(error)) {
      return await offlineCreate<BorrowedEntry>(
        "borrowed",
        "/api/borrowed",
        body as Record<string, unknown>,
      );
    }
    throw error;
  }
};

export const updateBorrowedEntry = async (
  id: string,
  body: BorrowedPayload,
) => {
  try {
    return await authenticatedRequest<EntryResponse>(`/api/borrowed/${id}`, {
      method: "PATCH",
      body,
    });
  } catch (error) {
    if (isNetworkFailure(error)) {
      return await offlineUpdate<BorrowedEntry>(
        "borrowed",
        `/api/borrowed/${id}`,
        { ...(body as Record<string, unknown>), id },
      );
    }
    throw error;
  }
};

export const deleteBorrowedEntry = async (id: string) => {
  try {
    return await authenticatedRequest<{ success: boolean }>(
      `/api/borrowed/${id}`,
      { method: "DELETE" },
    );
  } catch (error) {
    if (isNetworkFailure(error)) {
      return await offlineDelete<{ success: boolean }>(
        "borrowed",
        `/api/borrowed/${id}`,
        id,
      );
    }
    throw error;
  }
};
