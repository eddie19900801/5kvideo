import type { Pool } from "pg";
import type { Database } from "../types.js";
import { createPostgresPool, transaction as pgTransaction } from "../postgres/client.js";
import type { DatabaseRepository } from "./database.js";

type Entity = { id: string };
const favoriteId = (item: Database["favorites"][number]) => `${item.userId}|${item.videoId}|${item.mode || "normal"}`;
const progressId = (item: Database["progress"][number]) => `${item.userId}|${item.videoId}|${item.mode || "normal"}`;

export class PostgresDatabaseRepository implements DatabaseRepository {
  private readonly pool: Pool = createPostgresPool();
  private database?: Database;
  private persistedAnalytics = new Set<string>();
  private persistedAuditLogs = new Set<string>();
  private pending?: NodeJS.Timeout;
  private pendingSince?: number;
  private flushing?: Promise<void>;
  private dirty = false;

  async initialize() {
    const client = await this.pool.connect();
    try {
      const rows = async <T>(table: string) => (await client.query<{ payload: T }>(`SELECT payload FROM ${table}`)).rows.map(row => row.payload);
      const settings = await client.query<{ payload: string[] }>("SELECT payload FROM runtime_settings WHERE key='productDomains'");
      const analyticsEvents = await rows<Database["analyticsEvents"][number]>("runtime_analytics_events");
      const auditLogs = await rows<Database["auditLogs"][number]>("runtime_audit_logs");
      this.database = {
        videos: await rows<Database["videos"][number]>("runtime_videos"),
        users: await rows<Database["users"][number]>("runtime_users"),
        tags: await rows<Database["tags"][number]>("runtime_tags"),
        categories: await rows<Database["categories"][number]>("runtime_categories"),
        favorites: await rows<Database["favorites"][number]>("runtime_favorites"),
        progress: await rows<Database["progress"][number]>("runtime_progress"),
        analyticsEvents,
        channels: await rows<Database["channels"][number]>("runtime_channels"),
        productLines: await rows<Database["productLines"][number]>("runtime_product_lines"),
        productDomains: settings.rows[0]?.payload || ["wflhc.cn"],
        collectorSources: await rows<Database["collectorSources"][number]>("runtime_collector_sources"),
        auditLogs,
        mediaJobs: await rows<Database["mediaJobs"][number]>("runtime_media_jobs"),
      };
      this.persistedAnalytics = new Set(analyticsEvents.map(item => item.id));
      this.persistedAuditLogs = new Set(auditLogs.map(item => item.id));
    } finally { client.release(); }
  }

  read(): Database {
    if (!this.database) throw new Error("PostgreSQL 数据仓储尚未初始化");
    return this.database;
  }

  transaction<T>(operation: (database: Database) => T): T {
    const result = operation(this.read());
    this.schedule(0);
    return result;
  }

  transactionDeferred<T>(operation: (database: Database) => T, delayMs = 150): T {
    const result = operation(this.read());
    this.schedule(delayMs);
    return result;
  }

  async flush() {
    this.dirty = true;
    if (this.flushing) return this.flushing;
    this.flushing = this.flushLoop().finally(() => { this.flushing = undefined; });
    return this.flushing;
  }

  private schedule(delayMs: number) {
    this.dirty = true;
    const now = Date.now(); this.pendingSince ??= now;
    if (this.pending) clearTimeout(this.pending);
    const wait = Math.max(0, Math.min(delayMs, 5_000 - (now - this.pendingSince)));
    this.pending = setTimeout(() => {
      this.pending = undefined; this.pendingSince = undefined;
      void this.flush().catch(error => { this.dirty = true; console.error("PostgreSQL flush failed", error); this.schedule(1_000); });
    }, wait);
    this.pending.unref();
  }

  private async flushLoop() {
    while (this.dirty) {
      this.dirty = false;
      const db = this.read();
      const analytics = db.analyticsEvents.filter(item => !this.persistedAnalytics.has(item.id));
      const audits = db.auditLogs.filter(item => !this.persistedAuditLogs.has(item.id));
      const client = await this.pool.connect();
      try {
        await pgTransaction(client, async () => {
          await this.replace(client, "runtime_videos", db.videos);
          await this.replace(client, "runtime_users", db.users);
          await this.replace(client, "runtime_tags", db.tags);
          await this.replace(client, "runtime_categories", db.categories);
          await this.replace(client, "runtime_favorites", db.favorites.map(item => ({ id: favoriteId(item), ...item })), "id,user_id,video_id,mode,payload", item => [item.id,item.userId,item.videoId,item.mode||"normal",item]);
          await this.replace(client, "runtime_progress", db.progress.map(item => ({ id: progressId(item), ...item })), "id,user_id,video_id,mode,updated_at,payload", item => [item.id,item.userId,item.videoId,item.mode||"normal",item.updatedAt,item]);
          await this.replace(client, "runtime_channels", db.channels);
          await this.replace(client, "runtime_product_lines", db.productLines, "id,slug,status,updated_at,payload", item => [item.id,item.slug,item.status,item.updatedAt,item]);
          await this.replace(client, "runtime_collector_sources", db.collectorSources, "id,source_key,enabled,payload", item => [item.id,item.key,item.enabled,item]);
          await this.replace(client, "runtime_media_jobs", db.mediaJobs, "id,status,created_at,payload", item => [item.id,item.status,item.createdAt,item]);
          await client.query("INSERT INTO runtime_settings(key,payload) VALUES('productDomains',$1::jsonb) ON CONFLICT(key) DO UPDATE SET payload=EXCLUDED.payload", [JSON.stringify(db.productDomains)]);
          if (analytics.length) await client.query(`INSERT INTO runtime_analytics_events(id,event_name,event_time,install_id,channel,payload) SELECT x->>'id',x->>'eventName',(x->>'eventTime')::timestamptz,x->>'installId',COALESCE(x->>'channel','direct'),x FROM jsonb_array_elements($1::jsonb) x ON CONFLICT(id) DO NOTHING`, [JSON.stringify(analytics)]);
          if (audits.length) await client.query(`INSERT INTO runtime_audit_logs(id,created_at,payload) SELECT x->>'id',(x->>'createdAt')::timestamptz,x FROM jsonb_array_elements($1::jsonb) x ON CONFLICT(id) DO NOTHING`, [JSON.stringify(audits)]);
        });
        analytics.forEach(item => this.persistedAnalytics.add(item.id));
        audits.forEach(item => this.persistedAuditLogs.add(item.id));
      } finally { client.release(); }
    }
  }

  private async replace<T extends Entity>(client: import("pg").PoolClient, table: string, items: T[], columns = "id,payload", values: (item: T) => unknown[] = item => [item.id,item]) {
    const ids = items.map(item => item.id);
    if (items.length) {
      const width = values(items[0]).length;
      const parameters: unknown[] = [];
      const rows = items.map((item, row) => `(${values(item).map(value => { parameters.push(typeof value === "object" ? JSON.stringify(value) : value); return `$${row * width + parameters.length - row * width}`; }).join(",")})`);
      const updates = columns.split(",").slice(1).map(column => `${column}=EXCLUDED.${column}`).join(",");
      await client.query(`INSERT INTO ${table}(${columns}) VALUES ${rows.join(",")} ON CONFLICT(id) DO UPDATE SET ${updates}`, parameters);
    }
    await client.query(`DELETE FROM ${table} WHERE NOT (id = ANY($1::text[]))`, [ids]);
  }
}
