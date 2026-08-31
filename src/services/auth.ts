import * as SecureStore from "expo-secure-store";
import { clearUserOfflineData } from "../offline/database";

const configuredBaseUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
const defaultBaseUrl = "http://localhost:5000";
const API_BASE_URL = (configuredBaseUrl || defaultBaseUrl).replace(/\/$/, "");

const ACCESS_TOKEN_KEY = "auratrack.accessToken";
const REFRESH_TOKEN_KEY = "auratrack.refreshToken";
const SESSION_USER_KEY = "auratrack.sessionUser";

export type SessionUser = {
  id: string;
  fullname: string;
  email: string;
  app_lock_enabled: boolean;
};

type AuthResponse = {
  success: boolean;
  message?: string;
  data?: {
    accessToken: string;
    refreshToken: string;
    user?: SessionUser;
  };
};

const request = async (path: string, body: object): Promise<AuthResponse> => {
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (error) {
    const networkError = new Error(
      "No internet connection. Your saved session is still available.",
    );
    Object.assign(networkError, {
      isNetworkError: true,
      status: 0,
      originalError: error,
    });
    throw networkError;
  }

  const result = (await response.json().catch(() => ({}))) as AuthResponse;
  if (!response.ok || !result.success) {
    throw new Error(result.message || "Authentication failed.");
  }

  return result;
};

const saveTokens = async (result: AuthResponse) => {
  if (!result.data?.accessToken || !result.data.refreshToken) {
    throw new Error("The server returned an invalid authentication response.");
  }

  await Promise.all([
    SecureStore.setItemAsync(ACCESS_TOKEN_KEY, result.data.accessToken),
    SecureStore.setItemAsync(REFRESH_TOKEN_KEY, result.data.refreshToken),
    ...(result.data.user
      ? [
          SecureStore.setItemAsync(
            SESSION_USER_KEY,
            JSON.stringify(result.data.user),
          ),
        ]
      : []),
  ]);
};

export const login = async (email: string, password: string) => {
  const result = await request("/api/auth/login", { email, password });
  await saveTokens(result);
};

export const signup = async (
  fullname: string,
  email: string,
  password: string,
) => {
  const result = await request("/api/auth/singup", {
    fullname,
    email,
    password,
  });
  await saveTokens(result);
};

export const restoreSession = async () => {
  const accessToken = await getAccessToken();
  const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);

  if (!accessToken && !refreshToken) {
    return false;
  }

  if (accessToken && !refreshToken) {
    return true;
  }

  try {
    const result = await request("/api/auth/refresh", { refreshToken });
    await saveTokens(result);
    return true;
  } catch (error) {
    if (isNetworkFailure(error)) {
      return true;
    }

    await clearSession();
    return false;
  }
};

export const clearSession = async () => {
  const storedUser = await SecureStore.getItemAsync(SESSION_USER_KEY);
  let userId: string | null = null;

  if (storedUser) {
    try {
      const parsed = JSON.parse(storedUser) as { id?: string };
      if (typeof parsed.id === "string") userId = parsed.id;
    } catch {
      userId = null;
    }
  }

  if (userId) {
    await clearUserOfflineData(userId);
  }

  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
    SecureStore.deleteItemAsync(SESSION_USER_KEY),
  ]);
};

export const logout = async () => {
  const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);

  try {
    if (refreshToken) {
      await request("/api/auth/logout", { refreshToken });
    }
  } finally {
    await clearSession();
  }
};

export const getAccessToken = () => SecureStore.getItemAsync(ACCESS_TOKEN_KEY);

export const getSessionUser = async (): Promise<SessionUser | null> => {
  const storedUser = await SecureStore.getItemAsync(SESSION_USER_KEY);
  if (!storedUser) return null;

  try {
    const user = JSON.parse(storedUser) as SessionUser;
    return typeof user.id === "string" &&
      typeof user.app_lock_enabled === "boolean"
      ? user
      : null;
  } catch {
    await SecureStore.deleteItemAsync(SESSION_USER_KEY);
    return null;
  }
};

export const setSessionUserAppLockEnabled = async (appLockEnabled: boolean) => {
  const user = await getSessionUser();
  if (!user) return;
  await SecureStore.setItemAsync(
    SESSION_USER_KEY,
    JSON.stringify({ ...user, app_lock_enabled: appLockEnabled }),
  );
};

type AuthenticatedRequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: object;
};

export const isNetworkFailure = (error: unknown) => {
  if (!(error instanceof Error)) return false;

  const message = error.message.toLowerCase();
  return (
    message.includes("network") ||
    message.includes("offline") ||
    message.includes("failed to fetch") ||
    message.includes("load failed") ||
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("enotfound") ||
    message.includes("enetunreach") ||
    message.includes("econnrefused") ||
    message.includes("socket hang up") ||
    message.includes("dns")
  );
};

// Prevent rapid repeat taps from sending the same write request more than once.
// This is shared by every screen that uses an authenticated API call.
const pendingWriteRequests = new Set<string>();

const getWriteRequestKey = (
  path: string,
  options: AuthenticatedRequestOptions,
) => `${options.method || "GET"}:${path}:${JSON.stringify(options.body || {})}`;

const sendAuthenticatedRequest = async <T>(
  path: string,
  accessToken: string,
  options: AuthenticatedRequestOptions,
) => {
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method || "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(options.body ? { "Content-Type": "application/json" } : {}),
      },
      ...(options.body ? { body: JSON.stringify(options.body) } : {}),
    });

    const result = (await response.json().catch(() => ({}))) as T & {
      success?: boolean;
      message?: string;
    };

    return { response, result };
  } catch (error) {
    const networkError = new Error(
      "No internet connection. Showing saved data.",
    );
    Object.assign(networkError, {
      isNetworkError: true,
      status: 0,
      originalError: error,
    });
    throw networkError;
  }
};

export const authenticatedRequest = async <T>(
  path: string,
  options: AuthenticatedRequestOptions = {},
): Promise<T> => {
  const isWriteRequest = options.method && options.method !== "GET";
  const requestKey = getWriteRequestKey(path, options);

  if (isWriteRequest && pendingWriteRequests.has(requestKey)) {
    const error = new Error("This action is already being saved. Please wait.");
    Object.assign(error, { isDuplicateRequest: true });
    throw error;
  }

  if (isWriteRequest) pendingWriteRequests.add(requestKey);

  try {
    let accessToken = await getAccessToken();
    if (!accessToken) throw new Error("Please sign in to continue.");

    let { response, result } = await sendAuthenticatedRequest<T>(
      path,
      accessToken,
      options,
    );

    if (response.status === 401) {
      const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
      if (!refreshToken) {
        await clearSession();
        throw new Error("Your session has expired. Please sign in again.");
      }

      const refreshed = await request("/api/auth/refresh", { refreshToken });
      await saveTokens(refreshed);
      accessToken = refreshed.data!.accessToken;
      ({ response, result } = await sendAuthenticatedRequest<T>(
        path,
        accessToken,
        options,
      ));
    }

    if (!response.ok || result.success === false) {
      const error = new Error(result.message || "Request failed.");
      Object.assign(error, { status: response.status });
      throw error;
    }

    return result;
  } catch (error) {
    if (isNetworkFailure(error)) {
      throw error;
    }
    throw error;
  } finally {
    if (isWriteRequest) pendingWriteRequests.delete(requestKey);
  }
};

export const getCurrentUser = async (): Promise<SessionUser> => {
  const result = await authenticatedRequest<{
    success: boolean;
    data: { user: SessionUser };
  }>("/api/auth/me");
  await SecureStore.setItemAsync(
    SESSION_USER_KEY,
    JSON.stringify(result.data.user),
  );
  return result.data.user;
};

const verifyAccessToken = async (accessToken: string) => {
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}/api/auth/me`, {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch (error) {
    const networkError = new Error(
      "No internet connection. Your saved session is still available.",
    );
    Object.assign(networkError, {
      isNetworkError: true,
      status: 0,
      originalError: error,
    });
    throw networkError;
  }

  if (response.ok) {
    return true;
  }

  const result = (await response.json().catch(() => ({}))) as {
    message?: string;
  };
  const error = new Error(result.message || "Authentication failed.");
  Object.assign(error, { status: response.status });
  throw error;
};

export const verifySession = async () => {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return false;
  }

  try {
    await verifyAccessToken(accessToken);
    return true;
  } catch (error) {
    if (isNetworkFailure(error)) {
      return true;
    }

    if (
      !(error instanceof Error) ||
      (error as Error & { status?: number }).status !== 401
    ) {
      return false;
    }
  }

  const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  if (!refreshToken) {
    await clearSession();
    return false;
  }

  try {
    const result = await request("/api/auth/refresh", { refreshToken });
    await saveTokens(result);
    const newAccessToken = await getAccessToken();
    if (!newAccessToken) {
      throw new Error(
        "The server returned an invalid authentication response.",
      );
    }
    await verifyAccessToken(newAccessToken);
    return true;
  } catch (error) {
    if (isNetworkFailure(error)) {
      return true;
    }

    await clearSession();
    return false;
  }
};
