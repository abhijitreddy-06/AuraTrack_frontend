import {
  initializeOfflineDatabase,
  readLocalCollection,
  upsertLocalCache,
  persistApiCollection,
  persistApiItem,
  queueOfflineWrite,
  readQueuedSyncItems,
  markSyncQueueItemComplete,
  bumpSyncQueueItem,
  removeLocalCache,
} from "./database";
import { isNetworkAvailable } from "./network";
import { authenticatedRequest } from "../services/auth";

export type OfflineStatus = "online" | "offline" | "syncing" | "pending";

export const ensureOfflineCacheReady = async () => {
  await initializeOfflineDatabase();
};

export const loadCachedCollection = async <T>(entityType: string) => {
  await ensureOfflineCacheReady();
  return (await readLocalCollection(entityType as never)) as T[];
};

export const refreshAndCacheCollection = async <T>(
  entityType: string,
  path: string,
  transform?: (payload: T[]) => T[],
) => {
  await ensureOfflineCacheReady();
  const networkAvailable = await isNetworkAvailable();

  if (!networkAvailable) {
    return (await readLocalCollection(entityType as never)) as T[];
  }

  const response = await authenticatedRequest<{ success: boolean; data: T[] }>(
    path,
  );
  const nextData = transform ? transform(response.data) : response.data;
  const freshItems = Array.isArray(nextData) ? nextData : [];

  for (const item of freshItems) {
    await upsertLocalCache(
      entityType as never,
      item as Record<string, unknown>,
    );
  }

  return freshItems;
};

export const refreshAndCacheItem = async <T>(
  entityType: string,
  path: string,
  transform?: (payload: T) => T,
) => {
  await ensureOfflineCacheReady();
  const networkAvailable = await isNetworkAvailable();

  if (!networkAvailable) {
    return (await readLocalCollection(entityType as never))[0] as T | undefined;
  }

  const response = await authenticatedRequest<{ success: boolean; data: T }>(
    path,
  );
  const nextItem = transform ? transform(response.data) : response.data;
  await persistApiItem(entityType as never, nextItem);
  return nextItem;
};

export const offlineCreate = async <T extends Record<string, unknown>>(
  entityType: string,
  path: string,
  payload: Record<string, unknown>,
): Promise<{ success: boolean; message?: string; data: T }> => {
  await ensureOfflineCacheReady();
  const networkAvailable = await isNetworkAvailable();

  if (!networkAvailable) {
    return await queueOfflineWrite<T>(path, "POST", payload);
  }

  const response = await authenticatedRequest<{ success: boolean; data: T }>(
    path,
    {
      method: "POST",
      body: payload,
    },
  );

  await persistApiItem(entityType as never, response.data);
  return response;
};

export const offlineUpdate = async <T extends Record<string, unknown>>(
  entityType: string,
  path: string,
  payload: Record<string, unknown>,
): Promise<{ success: boolean; message?: string; data: T }> => {
  await ensureOfflineCacheReady();
  const networkAvailable = await isNetworkAvailable();

  if (!networkAvailable) {
    return await queueOfflineWrite<T>(path, "PATCH", payload);
  }

  const response = await authenticatedRequest<{ success: boolean; data: T }>(
    path,
    {
      method: "PATCH",
      body: payload,
    },
  );

  await persistApiItem(entityType as never, response.data);
  return response;
};

export const offlineDelete = async <T extends Record<string, unknown>>(
  entityType: string,
  path: string,
  id: string,
): Promise<{ success: boolean; message?: string; data?: T }> => {
  await ensureOfflineCacheReady();
  const networkAvailable = await isNetworkAvailable();

  if (!networkAvailable) {
    return await queueOfflineWrite<T>(path, "DELETE", { id });
  }

  const response = await authenticatedRequest<{ success: boolean }>(path, {
    method: "DELETE",
  });

  await removeLocalCache(entityType as never, id);
  return response;
};

export const syncPendingQueue = async () => {
  await ensureOfflineCacheReady();
  const networkAvailable = await isNetworkAvailable();

  if (!networkAvailable) return false;

  const queue = await readQueuedSyncItems();
  if (!queue.length) return true;

  for (const item of queue) {
    const payload = JSON.parse(String(item.payload ?? "{}"));
    const entityType = String(item.entity_type ?? "");
    const method = String(item.operation ?? "POST").toUpperCase();
    const path = `/api/${entityType}`;

    try {
      if (method === "DELETE") {
        await authenticatedRequest<{ success: boolean }>(
          `${path}/${payload.id ?? item.entity_id}`,
          {
            method: "DELETE",
          },
        );
      } else {
        const requestBody = payload;
        const requestPath = payload.id ? `${path}/${payload.id}` : path;
        const requestMethod = payload.id ? "PATCH" : "POST";
        await authenticatedRequest<{ success: boolean }>(requestPath, {
          method: requestMethod,
          body: requestBody,
        });
      }

      await markSyncQueueItemComplete(String(item.id));
    } catch {
      await bumpSyncQueueItem(String(item.id));
    }
  }

  return true;
};
