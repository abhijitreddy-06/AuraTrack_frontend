import { authenticatedRequest, isNetworkFailure } from "./auth";
import {
  loadCachedCollection,
  offlineCreate,
  offlineDelete,
  offlineUpdate,
  refreshAndCacheCollection,
} from "../offline/cache";

export type Note = {
  id: string;
  text: string;
  created_at: string;
};

type NoteResponse = {
  success: boolean;
  data: Note;
};

type NotesResponse = {
  success: boolean;
  data: Note[];
};

export const getNotes = async () => {
  try {
    return {
      success: true,
      data: await refreshAndCacheCollection<Note>("notes", "/api/notes"),
    } satisfies NotesResponse;
  } catch (error) {
    if (isNetworkFailure(error)) {
      return {
        success: true,
        data: await loadCachedCollection<Note>("notes"),
      } satisfies NotesResponse;
    }
    throw error;
  }
};

export const createNote = async (text: string) => {
  try {
    return await authenticatedRequest<NoteResponse>("/api/notes", {
      method: "POST",
      body: { text },
    });
  } catch (error) {
    if (isNetworkFailure(error)) {
      return await offlineCreate<Note>("notes", "/api/notes", {
        text,
      } as Record<string, unknown>);
    }
    throw error;
  }
};

export const updateNote = async (id: string, text: string) => {
  try {
    return await authenticatedRequest<NoteResponse>(`/api/notes/${id}`, {
      method: "PATCH",
      body: { text },
    });
  } catch (error) {
    if (isNetworkFailure(error)) {
      return await offlineUpdate<Note>("notes", `/api/notes/${id}`, {
        text,
        id,
      } as Record<string, unknown>);
    }
    throw error;
  }
};

export const deleteNote = async (id: string) => {
  try {
    return await authenticatedRequest<{ success: boolean }>(
      `/api/notes/${id}`,
      {
        method: "DELETE",
      },
    );
  } catch (error) {
    if (isNetworkFailure(error)) {
      return await offlineDelete<{ success: boolean }>(
        "notes",
        `/api/notes/${id}`,
        id,
      );
    }
    throw error;
  }
};
