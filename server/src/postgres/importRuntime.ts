import fs from "node:fs";
import path from "node:path";
import type { PoolClient } from "pg";
import type { Database } from "../types.js";
import { createPostgresPool, transaction } from "./client.js";

const file = path.resolve(process.env.DATA_FILE || "./data/db.json");
if (!fs.existsSync(file)) throw new Error(`JSON 数据文件不存在: ${file}`);
const database = JSON.parse(fs.readFileSync(file, "utf8")) as Database;
const pool = createPostgresPool();
const client = await pool.connect();
const favoriteId = (item: Database["favorites"][number]) => `${item.userId}|${item.videoId}|${item.mode || "normal"}`;
const progressId = (item: Database["progress"][number]) => `${item.userId}|${item.videoId}|${item.mode || "normal"}`;

async function payloadRows(target: PoolClient, table: string, items: { id: string }[]) {
  for (let offset = 0; offset < items.length; offset += 2_000) {
    const batch = items.slice(offset, offset + 2_000);
    await target.query(`INSERT INTO ${table}(id,payload) SELECT x->>'id',x FROM jsonb_array_elements($1::jsonb) x ON CONFLICT(id) DO UPDATE SET payload=EXCLUDED.payload`, [JSON.stringify(batch)]);
  }
}

try {
  await transaction(client, async () => {
    await payloadRows(client, "runtime_videos", database.videos);
    await payloadRows(client, "runtime_users", database.users);
    await payloadRows(client, "runtime_tags", database.tags);
    await payloadRows(client, "runtime_categories", database.categories);
    for (let offset=0;offset<database.favorites.length;offset+=2_000) { const batch=database.favorites.slice(offset,offset+2_000).map(item=>({id:favoriteId(item),...item,mode:item.mode||"normal"})); await client.query(`INSERT INTO runtime_favorites(id,user_id,video_id,mode,payload) SELECT x->>'id',x->>'userId',x->>'videoId',x->>'mode',x FROM jsonb_array_elements($1::jsonb) x ON CONFLICT(id) DO UPDATE SET payload=EXCLUDED.payload`,[JSON.stringify(batch)]); }
    for (let offset=0;offset<database.progress.length;offset+=2_000) { const batch=database.progress.slice(offset,offset+2_000).map(item=>({id:progressId(item),...item,mode:item.mode||"normal"})); await client.query(`INSERT INTO runtime_progress(id,user_id,video_id,mode,updated_at,payload) SELECT x->>'id',x->>'userId',x->>'videoId',x->>'mode',(x->>'updatedAt')::timestamptz,x FROM jsonb_array_elements($1::jsonb) x ON CONFLICT(id) DO UPDATE SET updated_at=EXCLUDED.updated_at,payload=EXCLUDED.payload`,[JSON.stringify(batch)]); }
    for (let offset=0;offset<database.analyticsEvents.length;offset+=2_000) { const batch=database.analyticsEvents.slice(offset,offset+2_000); await client.query(`INSERT INTO runtime_analytics_events(id,event_name,event_time,install_id,channel,payload) SELECT x->>'id',x->>'eventName',(x->>'eventTime')::timestamptz,x->>'installId',COALESCE(x->>'channel','direct'),x FROM jsonb_array_elements($1::jsonb) x ON CONFLICT(id) DO NOTHING`,[JSON.stringify(batch)]); }
    await payloadRows(client, "runtime_channels", database.channels);
    for (const item of database.productLines) await client.query("INSERT INTO runtime_product_lines(id,slug,status,updated_at,payload) VALUES($1,$2,$3,$4,$5::jsonb) ON CONFLICT(id) DO UPDATE SET slug=EXCLUDED.slug,status=EXCLUDED.status,updated_at=EXCLUDED.updated_at,payload=EXCLUDED.payload",[item.id,item.slug,item.status,item.updatedAt,JSON.stringify(item)]);
    for (const item of database.collectorSources) await client.query("INSERT INTO runtime_collector_sources(id,source_key,enabled,payload) VALUES($1,$2,$3,$4::jsonb) ON CONFLICT(id) DO UPDATE SET source_key=EXCLUDED.source_key,enabled=EXCLUDED.enabled,payload=EXCLUDED.payload",[item.id,item.key,item.enabled,JSON.stringify(item)]);
    for (const item of database.auditLogs) await client.query("INSERT INTO runtime_audit_logs(id,created_at,payload) VALUES($1,$2,$3::jsonb) ON CONFLICT(id) DO NOTHING",[item.id,item.createdAt,JSON.stringify(item)]);
    for (const item of database.mediaJobs) await client.query("INSERT INTO runtime_media_jobs(id,status,created_at,payload) VALUES($1,$2,$3,$4::jsonb) ON CONFLICT(id) DO UPDATE SET status=EXCLUDED.status,payload=EXCLUDED.payload",[item.id,item.status,item.createdAt,JSON.stringify(item)]);
    await client.query("INSERT INTO runtime_settings(key,payload) VALUES('productDomains',$1::jsonb) ON CONFLICT(key) DO UPDATE SET payload=EXCLUDED.payload",[JSON.stringify(database.productDomains||["wflhc.cn"])]);
  });
  console.log(JSON.stringify({videos:database.videos.length,users:database.users.length,analyticsEvents:database.analyticsEvents.length,productLines:database.productLines.length}));
} finally { client.release(); await pool.end(); }
