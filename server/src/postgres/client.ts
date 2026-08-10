import { Pool, type PoolClient } from "pg";

export function createPostgresPool() {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) throw new Error("需要配置 DATABASE_URL 才能使用 PostgreSQL");
  return new Pool({ connectionString, max: Number(process.env.DATABASE_POOL_SIZE || 10), ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : undefined });
}

export async function transaction<T>(client: PoolClient, operation: () => Promise<T>): Promise<T> {
  await client.query("BEGIN");
  try { const result = await operation(); await client.query("COMMIT"); return result; }
  catch (error) { await client.query("ROLLBACK"); throw error; }
}
