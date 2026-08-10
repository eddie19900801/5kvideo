import fs from "node:fs";
import path from "node:path";
import type { Database } from "../types.js";
import { createPostgresPool, transaction } from "./client.js";

const file = path.resolve(process.env.DATA_FILE || "./data/db.json");
if (!fs.existsSync(file)) throw new Error(`JSON 数据文件不存在: ${file}`);
const database = JSON.parse(fs.readFileSync(file, "utf8")) as Database;
const pool = createPostgresPool();
const client = await pool.connect();
try {
  await transaction(client, async () => {
    for (const user of database.users) await client.query(`INSERT INTO users(id,account,password_hash,username,role,status,is_guest,visit_count,total_watch_seconds,last_seen_at,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT(id) DO UPDATE SET account=EXCLUDED.account,password_hash=EXCLUDED.password_hash,username=EXCLUDED.username,status=EXCLUDED.status`, [user.id,user.account,user.passwordHash,user.username,user.role,user.status,user.isGuest,user.visitCount,user.totalWatchSeconds,user.lastSeenAt,user.createdAt]);
    for (const video of database.videos) await client.query(`INSERT INTO videos(id,title,description,thumbnail,playback_url,duration,tags,chapters,views,aspect_ratio,is_adult,status,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT(id) DO UPDATE SET title=EXCLUDED.title,description=EXCLUDED.description,thumbnail=EXCLUDED.thumbnail,playback_url=EXCLUDED.playback_url,duration=EXCLUDED.duration,tags=EXCLUDED.tags,chapters=EXCLUDED.chapters,views=EXCLUDED.views,aspect_ratio=EXCLUDED.aspect_ratio,is_adult=EXCLUDED.is_adult,status=EXCLUDED.status`, [video.id,video.title,video.description,video.thumbnail,video.playbackUrl,video.duration,JSON.stringify(video.tags),JSON.stringify(video.chapters||[]),video.views,video.aspectRatio,video.isAdult,video.status,video.createdAt]);
    for (const tag of database.tags) await client.query("INSERT INTO tags(id,name,created_at) VALUES($1,$2,$3) ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name", [tag.id,tag.name,tag.createdAt]);
    for (const item of database.favorites) await client.query("INSERT INTO favorites(user_id,video_id,mode,created_at) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING", [item.userId,item.videoId,item.mode||"normal",item.createdAt]);
    for (const item of database.progress) await client.query("INSERT INTO progress(user_id,video_id,mode,progress,duration,completed,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(user_id,video_id,mode) DO UPDATE SET progress=EXCLUDED.progress,duration=EXCLUDED.duration,completed=EXCLUDED.completed,updated_at=EXCLUDED.updated_at", [item.userId,item.videoId,item.mode||"normal",item.progress,item.duration,item.completed,item.updatedAt]);
    for (const event of database.analyticsEvents || []) await client.query("INSERT INTO analytics_events(id,event_name,event_time,user_id,install_id,session_id,platform,app_version,channel,video_id,value,metadata) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT(id) DO NOTHING", [event.id,event.eventName,event.eventTime,event.userId,event.installId,event.sessionId,event.platform,event.appVersion,event.channel,event.videoId,event.value,event.metadata ? JSON.stringify(event.metadata) : null]);
    for (const log of database.auditLogs || []) await client.query("INSERT INTO audit_logs(id,admin_id,action,target_id,created_at) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO NOTHING", [log.id,log.adminId,log.action,log.targetId,log.createdAt]);
    for (const job of database.mediaJobs || []) await client.query("INSERT INTO media_jobs(id,type,status,admin_id,source_path,original_name,attempts,error,output,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT(id) DO UPDATE SET status=EXCLUDED.status,attempts=EXCLUDED.attempts,error=EXCLUDED.error,output=EXCLUDED.output,updated_at=EXCLUDED.updated_at", [job.id,job.type,job.status,job.adminId,job.sourcePath,job.originalName,job.attempts,job.error,job.output ? JSON.stringify(job.output) : null,job.createdAt,job.updatedAt]);
  });
  console.log(`imported ${database.users.length} users and ${database.videos.length} videos`);
} finally { client.release(); await pool.end(); }
