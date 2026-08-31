import * as SQLite from "expo-sqlite";
import * as SecureStore from "expo-secure-store";

const db = SQLite.openDatabaseSync("auratrack.db");
const SESSION_USER_KEY = "auratrack.sessionUser";

export type SupportedEntity =
  | "expenses"
  | "incomes"
  | "borrowed"
  | "lended"
  | "planned-expenses"
  | "todos"
  | "habits"
  | "birthdays"
  | "notes";

const ENTITY_LIST: Record<string, SupportedEntity> = {
  expenses: "expenses",
  incomes: "incomes",
  borrowed: "borrowed",
  lended: "lended",
  "planned-expenses": "planned-expenses",
  todos: "todos",
  habits: "habits",
  birthdays: "birthdays",
  notes: "notes",
};

export const initializeOfflineDatabase = async () => {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS offline_cache (
      entity_type TEXT NOT NULL,
      user_id TEXT NOT NULL,
      item_id TEXT NOT NULL,
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (entity_type, user_id, item_id)
    );

    CREATE TABLE IF NOT EXISTS sync_queue (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      operation TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL,
      retry_count INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending'
    );
  `);
};

export const normalizeEntityType = (path: string): SupportedEntity | null => {
  const cleaned = path.split("?")[0];
  const match = Object.keys(ENTITY_LIST).find(
    (entity) =>
      cleaned === `/api/${entity}` || cleaned.startsWith(`/api/${entity}/`),
  );

  return match ? ENTITY_LIST[match] : null;
};

const generateLocalId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export const getActiveUserId = async () => {
  const storedUser = await SecureStore.getItemAsync(SESSION_USER_KEY);
  if (!storedUser) return null;

  try {
    const user = JSON.parse(storedUser) as { id?: string };
    return typeof user.id === "string" ? user.id : null;
  } catch {
    return null;
  }
};

export const readLocalCollection = async (entityType: SupportedEntity) => {
  const userId = await getActiveUserId();
  if (!userId) return [] as Record<string, unknown>[];

  const rows = db.getAllSync(
    "SELECT payload FROM offline_cache WHERE entity_type = ? AND user_id = ? ORDER BY updated_at DESC",
    [entityType, userId],
  ) as Array<{ payload: string }>;

  return rows.map((row) => JSON.parse(row.payload) as Record<string, unknown>);
};

export const upsertLocalCache = async (
  entityType: SupportedEntity,
  item: Record<string, unknown>,
  userIdOverride?: string,
) => {
  const userId = userIdOverride ?? (await getActiveUserId());

  if (!userId) return;

  const itemId = String(item?.id ?? generateLocalId());
  const nextItem = { ...item, id: itemId };

  db.runSync(
    "INSERT OR REPLACE INTO offline_cache (entity_type, user_id, item_id, payload, updated_at) VALUES (?, ?, ?, ?, ?)",
    [
      entityType,
      userId,
      itemId,
      JSON.stringify(nextItem),
      new Date().toISOString(),
    ],
  );
};

export const removeLocalCache = async (
  entityType: SupportedEntity,
  itemId: string,
  userIdOverride?: string,
) => {
  const userId = userIdOverride ?? (await getActiveUserId());
  if (!userId) return;

  db.runSync(
    "DELETE FROM offline_cache WHERE entity_type = ? AND user_id = ? AND item_id = ?",
    [entityType, userId, itemId],
  );
};

export const clearUserOfflineData = async (userId: string) => {
  db.runSync("DELETE FROM offline_cache WHERE user_id = ?", [userId]);
  db.runSync("DELETE FROM sync_queue WHERE user_id = ?", [userId]);
};

export const queueOfflineWrite = async <T extends Record<string, unknown>>(
  path: string,
  method: "POST" | "PATCH" | "DELETE",
  body: Record<string, unknown> = {},
): Promise<{ success: true; message: string; data: T }> => {
  const entityType = normalizeEntityType(path);
  const userId = await getActiveUserId();

  if (!entityType || !userId) {
    throw new Error("Unable to queue the offline change for this item.");
  }

  const payload = { ...(body ?? {}) } as Record<string, unknown>;
  const itemId = String(payload.id ?? body.id ?? generateLocalId());
  const queuedItem: Record<string, unknown> = {
    ...payload,
    id: itemId,
    created_at: new Date().toISOString(),
  };

  if (method !== "DELETE") {
    await upsertLocalCache(entityType, queuedItem, userId);
  }

  const queueId = `${entityType}:${method}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
  db.runSync(
    "INSERT INTO sync_queue (id, user_id, entity_type, entity_id, operation, payload, created_at, retry_count, status) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'pending')",
    [
      queueId,
      userId,
      entityType,
      itemId,
      method,
      JSON.stringify(queuedItem),
      new Date().toISOString(),
    ],
  );

  if (method === "DELETE") {
    const deleteId = String(payload.id ?? body.id ?? itemId);
    await removeLocalCache(entityType, deleteId, userId);
  }

  return {
    success: true,
    message: "Saved offline. It will sync when you reconnect.",
    data: queuedItem as T,
  };
};

export const readQueuedSyncItems = async (userIdOverride?: string) => {
  const userId = userIdOverride ?? (await getActiveUserId());
  if (!userId) return [] as Array<Record<string, unknown>>;

  const rows = db.getAllSync(
    "SELECT * FROM sync_queue WHERE user_id = ? AND status = 'pending' ORDER BY created_at ASC",
    [userId],
  ) as Array<Record<string, unknown>>;

  return rows;
};

export const markSyncQueueItemComplete = async (queueId: string) => {
  db.runSync("DELETE FROM sync_queue WHERE id = ?", [queueId]);
};

export const bumpSyncQueueItem = async (queueId: string) => {
  db.runSync(
    "UPDATE sync_queue SET retry_count = retry_count + 1 WHERE id = ?",
    [queueId],
  );
};

export const persistApiCollection = async (
  entityType: SupportedEntity,
  value: unknown,
  userIdOverride?: string,
) => {
  const userId = userIdOverride ?? (await getActiveUserId());
  if (!userId || !Array.isArray(value)) return;

  for (const item of value) {
    if (item && typeof item === "object") {
      await upsertLocalCache(
        entityType,
        item as Record<string, unknown>,
        userId,
      );
    }
  }
};

export const persistApiItem = async (
  entityType: SupportedEntity,
  value: unknown,
  userIdOverride?: string,
) => {
  const userId = userIdOverride ?? (await getActiveUserId());
  if (!userId || !value || typeof value !== "object") return;

  await upsertLocalCache(entityType, value as Record<string, unknown>, userId);
};
