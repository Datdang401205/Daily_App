import { existsSync, readFileSync } from "node:fs";
import pg from "pg";
import type { AppState } from "./types";
import { buildSeedState } from "./seed";

const secretPath = "/etc/secrets/DATABASE_URL";
const connectionString =
  process.env.DATABASE_URL || (existsSync(secretPath) ? readFileSync(secretPath, "utf8").trim() : undefined);
if (!connectionString) {
  throw new Error("DATABASE_URL is required");
}

export const pool = new pg.Pool({
  connectionString,
  max: 5,
  ssl: process.env.PGSSLMODE === "disable" ? undefined : { rejectUnauthorized: false },
});

const TABLES = ["tasks", "events", "categories", "notifications", "settings"] as const;
export type TableName = (typeof TABLES)[number];

type Entity = { id: string };

function assertTable(table: string): asserts table is TableName {
  if (!TABLES.includes(table as TableName)) throw new Error(`Unknown table: ${table}`);
}

export async function initDatabase(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS settings (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS tasks_date_idx ON tasks ((data->>'date'));
    CREATE INDEX IF NOT EXISTS tasks_status_idx ON tasks ((data->>'status'));
    CREATE INDEX IF NOT EXISTS notifications_scheduled_idx ON notifications ((data->>'scheduledAt'));
  `);

  const result = await pool.query<{ count: number }>("SELECT COUNT(*)::int AS count FROM settings");
  if (result.rows[0]?.count === 0) {
    await replaceState(buildSeedState());
  }
}

export async function listAll<T extends Entity>(table: TableName): Promise<T[]> {
  assertTable(table);
  const order = table === "notifications" ? "data->>'scheduledAt' DESC" : "data->>'createdAt' ASC";
  const result = await pool.query<{ data: T }>(`SELECT data FROM ${table} ORDER BY ${order}`);
  return result.rows.map((row) => row.data);
}

export async function findOne<T extends Entity>(table: TableName, id: string): Promise<T | null> {
  assertTable(table);
  const result = await pool.query<{ data: T }>(`SELECT data FROM ${table} WHERE id = $1`, [id]);
  return result.rows[0]?.data ?? null;
}

export async function upsert<T extends Entity>(table: TableName, item: T): Promise<T> {
  assertTable(table);
  const result = await pool.query<{ data: T }>(
    `INSERT INTO ${table} (id, data) VALUES ($1, $2)
     ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
     RETURNING data`,
    [item.id, JSON.stringify(item)]
  );
  return result.rows[0].data;
}

export async function patchEntity<T extends Entity>(
  table: TableName,
  id: string,
  patch: Partial<T>
): Promise<T | null> {
  const current = await findOne<T>(table, id);
  if (!current) return null;
  return upsert<T>(table, { ...current, ...patch, id });
}

export async function removeEntity(table: TableName, id: string): Promise<boolean> {
  assertTable(table);
  const result = await pool.query(`DELETE FROM ${table} WHERE id = $1`, [id]);
  return (result.rowCount ?? 0) > 0;
}

export async function replaceState(state: AppState): Promise<AppState> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const table of TABLES) await client.query(`DELETE FROM ${table}`);
    await insertAll(client, "categories", state.categories);
    await insertAll(client, "events", state.events);
    await insertAll(client, "tasks", state.tasks);
    await insertAll(client, "notifications", state.notifications);
    await insertAll(client, "settings", state.settings);
    await client.query("COMMIT");
    return { ...state, exportedAt: new Date().toISOString() };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function mergeState(state: AppState): Promise<AppState> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await insertAll(client, "categories", state.categories);
    await insertAll(client, "events", state.events);
    await insertAll(client, "tasks", state.tasks);
    await insertAll(client, "notifications", state.notifications);
    await insertAll(client, "settings", state.settings);
    await client.query("COMMIT");
    return readState();
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function insertAll(client: pg.PoolClient, table: TableName, items: Entity[]): Promise<void> {
  assertTable(table);
  for (const item of items) {
    await client.query(
      `INSERT INTO ${table} (id, data) VALUES ($1, $2)
       ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
      [item.id, JSON.stringify(item)]
    );
  }
}

export async function readState(): Promise<AppState> {
  const [tasks, events, categories, settings, notifications] = await Promise.all([
    listAll<AppState["tasks"][number]>("tasks"),
    listAll<AppState["events"][number]>("events"),
    listAll<AppState["categories"][number]>("categories"),
    listAll<AppState["settings"][number]>("settings"),
    listAll<AppState["notifications"][number]>("notifications"),
  ]);

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    tasks,
    events,
    categories,
    settings,
    notifications,
  };
}
