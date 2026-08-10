import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createPostgresPool, transaction } from "./client.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../");
const directory = path.join(root, "migrations");
const pool = createPostgresPool();
const client = await pool.connect();
try {
  await client.query("CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())");
  const applied = new Set((await client.query<{ version: string }>("SELECT version FROM schema_migrations")).rows.map((row) => row.version));
  for (const name of fs.readdirSync(directory).filter((file) => file.endsWith(".sql")).sort()) {
    if (applied.has(name)) continue;
    await transaction(client, async () => { await client.query(fs.readFileSync(path.join(directory, name), "utf8")); await client.query("INSERT INTO schema_migrations(version) VALUES($1)", [name]); });
    console.log(`applied ${name}`);
  }
} finally { client.release(); await pool.end(); }
