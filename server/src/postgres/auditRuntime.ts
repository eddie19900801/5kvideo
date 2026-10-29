import fs from "node:fs";
import path from "node:path";
import type { Database } from "../types.js";
import { createPostgresPool } from "./client.js";

const file=path.resolve(process.env.DATA_FILE||"./data/db.json");
const source=JSON.parse(fs.readFileSync(file,"utf8")) as Database;
const pool=createPostgresPool(),client=await pool.connect();
const favoriteId=(item:Database["favorites"][number])=>`${item.userId}|${item.videoId}|${item.mode||"normal"}`;
const progressId=(item:Database["progress"][number])=>`${item.userId}|${item.videoId}|${item.mode||"normal"}`;
const checks:[string,string[]][]=[
  ["runtime_videos",source.videos.map(item=>item.id)],["runtime_users",source.users.map(item=>item.id)],["runtime_tags",source.tags.map(item=>item.id)],
  ["runtime_categories",source.categories.map(item=>item.id)],["runtime_favorites",source.favorites.map(favoriteId)],["runtime_progress",source.progress.map(progressId)],
  ["runtime_analytics_events",source.analyticsEvents.map(item=>item.id)],["runtime_channels",source.channels.map(item=>item.id)],["runtime_product_lines",source.productLines.map(item=>item.id)],
  ["runtime_collector_sources",source.collectorSources.map(item=>item.id)],["runtime_audit_logs",source.auditLogs.map(item=>item.id)],["runtime_media_jobs",source.mediaJobs.map(item=>item.id)],
];
let missingTotal=0;
try{for(const[table,ids]of checks){const rows=await client.query<{id:string}>(`SELECT id FROM ${table}`),actual=new Set(rows.rows.map(row=>row.id)),missing=ids.filter(id=>!actual.has(id));missingTotal+=missing.length;console.log(JSON.stringify({table,json:ids.length,postgres:actual.size,missing:missing.length,sample:missing.slice(0,3)}))}if(missingTotal)process.exitCode=2;else console.log(JSON.stringify({status:"complete",missing:0}))}finally{client.release();await pool.end()}
