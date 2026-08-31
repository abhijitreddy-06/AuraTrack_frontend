import { authenticatedRequest, isNetworkFailure } from "./auth";
import {
  loadCachedCollection,
  offlineCreate,
  offlineDelete,
  offlineUpdate,
  refreshAndCacheCollection,
} from "../offline/cache";

export type Todo = {
  id: string;
  title: string;
  start_time: string | null;
  end_time: string | null;
  date: string;
  completed: boolean;
};

type TodoResponse = { success: boolean; data: Todo };
type TodosResponse = { success: boolean; data: Todo[] };

export type CreateTodoBody = {
  title: string;
  start_time: string | null;
  end_time: string | null;
  date: string;
};

export type UpdateTodoBody = Partial<CreateTodoBody & { completed: boolean }>;

export const getTodos = async () => {
  try {
    return {
      success: true,
      data: await refreshAndCacheCollection<Todo>("todos", "/api/todos"),
    } satisfies TodosResponse;
  } catch (error) {
    if (isNetworkFailure(error)) {
      return {
        success: true,
        data: await loadCachedCollection<Todo>("todos"),
      } satisfies TodosResponse;
    }
    throw error;
  }
};

export const createTodo = async (body: CreateTodoBody) => {
  try {
    return await authenticatedRequest<TodoResponse>("/api/todos", {
      method: "POST",
      body,
    });
  } catch (error) {
    if (isNetworkFailure(error)) {
      return await offlineCreate<Todo>(
        "todos",
        "/api/todos",
        body as Record<string, unknown>,
      );
    }
    throw error;
  }
};

export const updateTodo = async (id: string, body: UpdateTodoBody) => {
  try {
    return await authenticatedRequest<TodoResponse>(`/api/todos/${id}`, {
      method: "PATCH",
      body,
    });
  } catch (error) {
    if (isNetworkFailure(error)) {
      return await offlineUpdate<Todo>("todos", `/api/todos/${id}`, {
        ...(body as Record<string, unknown>),
        id,
      });
    }
    throw error;
  }
};

export const deleteTodo = async (id: string) => {
  try {
    return await authenticatedRequest<{ success: boolean }>(
      `/api/todos/${id}`,
      { method: "DELETE" },
    );
  } catch (error) {
    if (isNetworkFailure(error)) {
      return await offlineDelete<{ success: boolean }>(
        "todos",
        `/api/todos/${id}`,
        id,
      );
    }
    throw error;
  }
};
