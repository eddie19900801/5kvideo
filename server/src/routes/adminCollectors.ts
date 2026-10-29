import { randomInt, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Router } from "express";
import { z } from "zod";
import { adminOnly, authenticate, type AuthRequest } from "../auth.js";
import { updateDb, videoRepository, readDb } from "../db.js";
import { ok } from "../http.js";
import type { Video } from "../types.js";
import { generateMissingHighlights } from "../services/highlightGenerator.js";
import { adoptCollectorPreviews, collectorPreviewDirectory, collectorPreviewQueueStatus, deleteCollectorPreview, generateCollectorPreviews, readCollectorPreviews, resetCollectorPreviewQueueStats, setCollectorPreviewQueuePaused } from "../services/collectorPreviewGenerator.js";
import { requestApiBase } from "../services/playback.js";
import { collectorSyncStatus, runCollectorCatalogSync } from "../services/collectorCatalogSync.js";
import { assignCollectorCategory, collectorTaxonomy, createCollectorCategory, deleteCollectorCategory, mergeCollectorCategories, renameCollectorCategory, reorderCollectorCategories } from "../services/collectorTaxonomy.js";
import { collectorPreviewId, collectorSourceName, collectorVideoId } from "../services/collectorIdentity.js";

export const adminCollectorsRouter = Router();
adminCollectorsRouter.use(authenticate, adminOnly);

const sources = {
  hsckm3u8: {
    key: "hsckm3u8",
    name: "黄色仓库 M3U8",
    endpoint: "https://hsckzy888.com/api.php/provide/vod/from/hsckm3u8/at/json/",
    fallbackEndpoint: "https://hszyckapi.vip/api.php/provide/vod/from/hsckm3u8/at/json/",
  },
} as const;

type RemoteVod = {
  vod_id: number | string;
  vod_name?: string;
  type_name?: string;
  vod_pic?: string;
  vod_blurb?: string;
  vod_content?: string;
  vod_duration?: string;
  vod_time?: string;
  vod_remarks?: string;
  vod_play_from?: string;
  vod_play_url?: string;
};

type RemoteResponse = {
  code?: number;
  page?: number;
  pagecount?: number;
  limit?: number;
  total?: number;
  list?: RemoteVod[];
};

type LocalCatalog = { videos?: Video[] };
const catalogPath = path.join(path.dirname(path.resolve(process.env.DATA_FILE || "./data/db.json")), "collected-catalog.json");
let catalogCache: { mtime: number; videos: Video[] } | undefined;

function localCatalog() {
  if (!fs.existsSync(catalogPath)) return null;
  const mtime = fs.statSync(catalogPath).mtimeMs;
  if (catalogCache?.mtime === mtime) return catalogCache.videos;
  const payload = JSON.parse(fs.readFileSync(catalogPath, "utf8")) as LocalCatalog;
  const videos = Array.isArray(payload.videos) ? payload.videos : [];
  catalogCache = { mtime, videos };
  return videos;
}

function safeText(value: unknown, max = 5000) {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function durationSeconds(value: unknown) {
  const text = String(value || "").trim();
  if (/^\d+(?::\d+){1,2}$/.test(text)) {
    return text.split(":").reduce((total, part) => total * 60 + Number(part), 0) || 1;
  }
  const minutes = text.match(/(\d+)\s*分/), seconds = text.match(/(\d+)\s*秒/);
  return Math.max(1, Number(minutes?.[1] || 0) * 60 + Number(seconds?.[1] || 0));
}

function firstM3u8(value: unknown) {
  const entries = String(value || "").split("#");
  for (const entry of entries) {
    const separator = entry.indexOf("$");
    const url = (separator >= 0 ? entry.slice(separator + 1) : entry).trim();
    if (/^https:\/\/[^\s]+\.m3u8(?:\?[^\s]*)?$/i.test(url)) return url;
  }
  return null;
}

async function fetchRemote(path: string) {
  const source = sources.hsckm3u8;
  let lastError: unknown;
  for (const base of [source.endpoint, source.fallbackEndpoint]) {
    try {
      const response = await fetch(new URL(path, base), { signal: AbortSignal.timeout(15_000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json() as RemoteResponse;
    } catch (error) { lastError = error; }
  }
  throw lastError instanceof Error ? lastError : new Error("采集源不可用");
}

adminCollectorsRouter.get("/collectors/sources", (_req, res) =>
  ok(res, readDb().collectorSources.map(source => ({ ...source, videoCount:(localCatalog()||[]).filter(video=>video.externalSource?.sourceKey===source.key).length }))),
);
adminCollectorsRouter.patch('/collectors/sources/:id',(req:AuthRequest,res)=>{const input=z.object({name:z.string().trim().min(1).max(50).optional(),enabled:z.boolean().optional()}).strict().safeParse(req.body);if(!input.success)return res.status(400).json({error:{code:'VALIDATION_ERROR',message:'片源配置无效'}});let updated:any;updateDb(db=>{const source=db.collectorSources.find(item=>item.id===req.params.id);if(!source)return;if(input.data.name!==undefined)source.name=input.data.name;if(input.data.enabled!==undefined)source.enabled=input.data.enabled;source.updatedAt=new Date().toISOString();updated=source;db.auditLogs.push({id:randomUUID(),adminId:req.auth!.id,action:'collector-source.update',targetId:source.id,createdAt:source.updatedAt})});if(!updated)return res.status(404).json({error:{code:'NOT_FOUND',message:'片源不存在'}});return ok(res,updated)});
adminCollectorsRouter.get('/collectors/sync',(_req,res)=>ok(res,collectorSyncStatus()));
adminCollectorsRouter.post('/collectors/sync',(_req,res)=>{void runCollectorCatalogSync();res.status(202);return ok(res,{...collectorSyncStatus(),running:true})});
adminCollectorsRouter.get('/collectors/categories',(_req,res)=>{const videos=localCatalog()||[],taxonomy=collectorTaxonomy(videos),counts=new Map<string,number>();for(const id of Object.values(taxonomy.assignments))counts.set(id,(counts.get(id)||0)+1);return ok(res,taxonomy.categories.map(item=>({...item,count:counts.get(item.id)||0})))});
adminCollectorsRouter.post('/collectors/categories',(req,res)=>{const input=z.object({name:z.string().trim().min(1).max(30)}).strict().safeParse(req.body);if(!input.success)return res.status(400).json({error:{code:'VALIDATION_ERROR',message:'分类名称为1至30个字符'}});const created=createCollectorCategory(localCatalog()||[],input.data.name);if(!created)return res.status(409).json({error:{code:'CATEGORY_EXISTS',message:'分类名称已存在'}});res.status(201);return ok(res,created)});
adminCollectorsRouter.patch('/collectors/categories/:id',(req,res)=>{const input=z.object({name:z.string().trim().min(1).max(30)}).strict().safeParse(req.body);if(!input.success)return res.status(400).json({error:{code:'VALIDATION_ERROR',message:'分类名称为1至30个字符'}});const result=renameCollectorCategory(localCatalog()||[],String(req.params.id),input.data.name);if(result==='exists')return res.status(409).json({error:{code:'CATEGORY_EXISTS',message:'分类名称已存在'}});if(!result)return res.status(404).json({error:{code:'NOT_FOUND',message:'分类不存在'}});return ok(res,result)});
adminCollectorsRouter.delete('/collectors/categories/:id',(req,res)=>{if(!deleteCollectorCategory(localCatalog()||[],String(req.params.id)))return res.status(404).json({error:{code:'NOT_FOUND',message:'分类不存在'}});return ok(res,{deleted:true})});
adminCollectorsRouter.post('/collectors/categories/:id/merge',(req,res)=>{const input=z.object({targetId:z.string().uuid()}).strict().safeParse(req.body);if(!input.success)return res.status(400).json({error:{code:'VALIDATION_ERROR',message:'目标分类无效'}});if(!mergeCollectorCategories(localCatalog()||[],String(req.params.id),input.data.targetId))return res.status(404).json({error:{code:'NOT_FOUND',message:'源分类或目标分类不存在'}});return ok(res,{merged:true})});
adminCollectorsRouter.put('/collectors/categories/order',(req,res)=>{const input=z.object({ids:z.array(z.string().uuid())}).strict().safeParse(req.body);if(!input.success||!reorderCollectorCategories(localCatalog()||[],input.data.ids))return res.status(400).json({error:{code:'VALIDATION_ERROR',message:'分类排序参数无效'}});return ok(res,{updated:true})});
adminCollectorsRouter.patch('/collectors/category-assignment',(req,res)=>{const input=z.object({ids:z.array(z.string()).min(1).max(1000),categoryId:z.string().uuid().nullable()}).strict().safeParse(req.body);if(!input.success)return res.status(400).json({error:{code:'VALIDATION_ERROR',message:'分类分配参数无效'}});if(!assignCollectorCategory(localCatalog()||[],input.data.ids,input.data.categoryId))return res.status(404).json({error:{code:'NOT_FOUND',message:'分类不存在'}});return ok(res,{updated:input.data.ids.length})});

adminCollectorsRouter.get("/collectors/remote", async (req, res) => {
  const input = z.object({
    page: z.coerce.number().int().min(1).max(100_000).default(1),
    keyword: z.string().trim().max(100).default(""),
    category: z.string().trim().max(100).default(""),
    source: z.string().trim().max(50).default(""),
  }).safeParse(req.query);
  if (!input.success) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "查询参数无效" } });
  try {
    const catalog = localCatalog();
    if (catalog) {
      const keyword = input.data.keyword.toLocaleLowerCase();
      let filtered = keyword ? catalog.filter(video => `${video.title} ${video.description} ${video.tags.join(" ")}`.toLocaleLowerCase().includes(keyword)) : catalog;
      if(input.data.source)filtered=filtered.filter(video=>video.externalSource?.sourceKey===input.data.source);
      const taxonomy=collectorTaxonomy(catalog),managedNames=new Map(taxonomy.categories.map(item=>[item.id,item.name]));
      const selectedCategory=taxonomy.categories.find(item=>item.id===input.data.category||item.name===input.data.category)?.id;
      if(input.data.category)filtered=selectedCategory?filtered.filter(video=>taxonomy.assignments[collectorVideoId(video)]===selectedCategory):[];
      const pageSize = 20, start = (input.data.page - 1) * pageSize,sources=readDb().collectorSources;
      const imported = new Set(videoRepository.list().filter(video => video.externalSource).map(video => `${video.externalSource!.sourceKey}~${video.externalSource!.remoteId}`));
      return ok(res, {
        page: input.data.page, pageCount: Math.max(1, Math.ceil(filtered.length / pageSize)), pageSize, total: filtered.length,
        items: filtered.slice(start, start + pageSize).map(video => {
          const id=collectorVideoId(video),previewId=collectorPreviewId(video),previews=readCollectorPreviews(previewId),sourceKey=video.externalSource!.sourceKey;
          return {
            id,remoteId: video.externalSource!.remoteId,sourceKey,sourceName:collectorSourceName(video,sources), title: video.title, category: managedNames.get(taxonomy.assignments[id]) || "", categoryId: taxonomy.assignments[id] || "",
            thumbnail: video.thumbnail, duration: video.duration > 1 ? String(video.duration) : "", updatedAt: video.externalSource?.remoteUpdatedAt || "",
            remarks: "", playable: true, collected: true, imported: imported.has(`${sourceKey}~${video.externalSource!.remoteId}`),
            previewCount: previews.items.length, previewStatus: previews.status,
          };
        }),
      });
    }
    const query = new URLSearchParams({ ac: "detail", pg: String(input.data.page) });
    if (input.data.keyword) query.set("wd", input.data.keyword);
    const payload = await fetchRemote(`?${query}`);
    const imported = new Set(videoRepository.list().filter(video => video.externalSource?.sourceKey === "hsckm3u8").map(video => video.externalSource!.remoteId));
    return ok(res, {
      page: Number(payload.page || input.data.page),
      pageCount: Number(payload.pagecount || 1),
      pageSize: Number(payload.limit || 20),
      total: Number(payload.total || 0),
      items: (payload.list || []).map(item => ({
        remoteId: String(item.vod_id), title: safeText(item.vod_name, 200), category: safeText(item.type_name, 100),
        thumbnail: String(item.vod_pic || ""), duration: String(item.vod_duration || ""), updatedAt: String(item.vod_time || ""),
        remarks: safeText(item.vod_remarks, 100), playable: Boolean(firstM3u8(item.vod_play_url)), collected: false, imported: imported.has(String(item.vod_id)),
        previewCount: 0, previewStatus: "idle",
      })),
    });
  } catch (error) {
    return res.status(502).json({ error: { code: "COLLECTOR_UNAVAILABLE", message: `采集源访问失败：${error instanceof Error ? error.message : "未知错误"}` } });
  }
});

adminCollectorsRouter.get("/collectors/remote/:remoteId", (req, res) => {
  const catalog = localCatalog();
  const video = catalog?.find(item => collectorVideoId(item) === String(req.params.remoteId));
  if (!video) return res.status(404).json({ error: { code: "COLLECTED_VIDEO_NOT_FOUND", message: "采集资源不存在" } });
  const imported = videoRepository.list().some(item => item.externalSource?.sourceKey === video.externalSource?.sourceKey && item.externalSource?.remoteId === video.externalSource!.remoteId),taxonomy=collectorTaxonomy(catalog||[]),categoryId=taxonomy.assignments[collectorVideoId(video)]||"";
  const trimmed = video.duration >= 70;
  return ok(res, {
    id:collectorVideoId(video),remoteId: video.externalSource!.remoteId,sourceKey:video.externalSource!.sourceKey,sourceName:collectorSourceName(video,readDb().collectorSources), title: video.title, description: video.description,
    thumbnail: video.thumbnail, playbackUrl: video.playbackUrl, duration: trimmed ? video.duration - 60 : video.duration,
    trimStart: trimmed ? 30 : 0, trimEnd: trimmed ? 30 : 0,
    category: taxonomy.categories.find(item=>item.id===categoryId)?.name || "", categoryId, tags: video.tags,
    updatedAt: video.externalSource?.remoteUpdatedAt || "", importedAt: video.externalSource?.importedAt || "",
    collected: true, imported,
  });
});

const catalogVideo=(id:string)=>localCatalog()?.find(item=>collectorVideoId(item)===id);
const previewResponse=(req:AuthRequest,id:string)=>{const video=catalogVideo(id),previewId=video?collectorPreviewId(video):id,metadata=readCollectorPreviews(previewId);return{...metadata,items:metadata.items.map(item=>({...item,image:`${requestApiBase(req)}/admin/collectors/remote/${encodeURIComponent(id)}/previews/${encodeURIComponent(item.file)}`}))}};
adminCollectorsRouter.get('/collectors/preview-jobs',(_req,res)=>ok(res,collectorPreviewQueueStatus()));
adminCollectorsRouter.post('/collectors/preview-jobs/control',(req,res)=>{
  const input=z.object({action:z.enum(['pause','resume','reset-stats'])}).safeParse(req.body);if(!input.success)return res.status(400).json({error:{code:'VALIDATION_ERROR',message:'任务操作无效'}});
  return ok(res,input.data.action==='reset-stats'?resetCollectorPreviewQueueStats():setCollectorPreviewQueuePaused(input.data.action==='pause'));
});
adminCollectorsRouter.post('/collectors/preview-jobs/batch',(req,res)=>{
  const input=z.object({ids:z.array(z.string()).max(1000).optional(),keyword:z.string().trim().max(100).optional(),limit:z.coerce.number().int().min(1).max(1000).default(500)}).safeParse(req.body);
  if(!input.success)return res.status(400).json({error:{code:'VALIDATION_ERROR',message:'批量截图参数无效'}});const catalog=localCatalog();if(!catalog)return res.status(409).json({error:{code:'CATALOG_NOT_READY',message:'本地采集目录尚未准备好'}});
  const ids=input.data.ids?.length?new Set(input.data.ids):null,keyword=(input.data.keyword||'').toLocaleLowerCase();const candidates=catalog.filter(video=>(!ids||ids.has(collectorVideoId(video)))&&(!keyword||`${video.title} ${video.description} ${video.tags.join(' ')}`.toLocaleLowerCase().includes(keyword))).slice(0,input.data.limit);
  let enqueued=0,skipped=0;for(const video of candidates){const previewId=collectorPreviewId(video);if(readCollectorPreviews(previewId).status==='ready'){skipped++;continue}const trimStart=video.duration>=70?30:0;if(generateCollectorPreviews(previewId,video.playbackUrl,Math.max(1,video.duration-(trimStart?60:0)),trimStart,false,'normal'))enqueued++;else skipped++}
  res.status(202);return ok(res,{requested:candidates.length,enqueued,skipped,queue:collectorPreviewQueueStatus()});
});
adminCollectorsRouter.get('/collectors/remote/:remoteId/previews',(req,res)=>{
  const remoteId=String(req.params.remoteId);if(!catalogVideo(remoteId))return res.status(404).json({error:{code:'COLLECTED_VIDEO_NOT_FOUND',message:'采集资源不存在'}});return ok(res,previewResponse(req,remoteId));
});
adminCollectorsRouter.post('/collectors/remote/:remoteId/previews',(req,res)=>{
  const remoteId=String(req.params.remoteId),video=catalogVideo(remoteId);if(!video)return res.status(404).json({error:{code:'COLLECTED_VIDEO_NOT_FOUND',message:'采集资源不存在'}});
  const trimStart=video.duration>=70?30:0,duration=Math.max(1,video.duration-(trimStart?60:0));generateCollectorPreviews(collectorPreviewId(video),video.playbackUrl,duration,trimStart,req.query.replace==='1');res.status(202);return ok(res,previewResponse(req,remoteId));
});
adminCollectorsRouter.delete('/collectors/remote/:remoteId/previews/:previewId',(req,res)=>{
  const remoteId=String(req.params.remoteId),video=catalogVideo(remoteId);if(!video)return res.status(404).json({error:{code:'COLLECTED_VIDEO_NOT_FOUND',message:'采集资源不存在'}});
  const previewId=collectorPreviewId(video);if(!deleteCollectorPreview(previewId,String(req.params.previewId)))return res.status(404).json({error:{code:'PREVIEW_NOT_FOUND',message:'预览截图不存在'}});
  const trimStart=video.duration>=70?30:0;generateCollectorPreviews(previewId,video.playbackUrl,Math.max(1,video.duration-(trimStart?60:0)),trimStart);return ok(res,previewResponse(req,remoteId));
});
adminCollectorsRouter.get('/collectors/remote/:remoteId/previews/:file',(req,res)=>{
  const remoteId=String(req.params.remoteId),video=catalogVideo(remoteId);if(!video)return res.status(404).end();const previewId=collectorPreviewId(video),metadata=readCollectorPreviews(previewId),name=path.basename(String(req.params.file)),directory=collectorPreviewDirectory(previewId);
  if(!directory||!metadata.items.some(item=>item.file===name))return res.status(404).end();const file=path.join(directory,name);if(!fs.existsSync(file))return res.status(404).end();
  res.type('image/webp').setHeader('Cache-Control','private, max-age=3600');return res.sendFile(file);
});

adminCollectorsRouter.post("/collectors/import", async (req: AuthRequest, res) => {
  const input = z.object({ ids: z.array(z.union([z.string(), z.number()]).transform(String)).min(1).max(50) }).safeParse(req.body);
  if (!input.success) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "请选择要采集的视频，单次最多 50 条" } });
  try {
    const catalog = localCatalog();
    const payload = catalog
      ? { list: catalog.filter(video => input.data.ids.includes(collectorVideoId(video))) }
      : await fetchRemote(`?ac=detail&ids=${encodeURIComponent(input.data.ids.join(","))}`);
    const existing = new Set(videoRepository.list().filter(video => video.externalSource).map(video => `${video.externalSource!.sourceKey}~${video.externalSource!.remoteId}`));
    const result = { imported: 0, skipped: 0, failed: [] as { remoteId: string; reason: string }[] };
    for (const item of payload.list || []) {
      if (catalog) {
        const template = item as Video;
        const remoteId = template.externalSource!.remoteId;
        const identity=`${template.externalSource!.sourceKey}~${remoteId}`;if (existing.has(identity)) { result.skipped++; continue; }
        const now = new Date().toISOString();
        const created=videoRepository.create({ ...template, id: randomUUID(), createdAt: now, externalSource: { ...template.externalSource!, importedAt: now } }, req.auth!.id);
        if(!adoptCollectorPreviews(created,req.auth!.id))generateMissingHighlights(created.id,created.playbackUrl,req.auth!.id);
        existing.add(identity); result.imported++;
        continue;
      }
      const remote = item as RemoteVod;
      const remoteId = String(remote.vod_id);
      if (existing.has(remoteId)) { result.skipped++; continue; }
      const playbackUrl = firstM3u8(remote.vod_play_url);
      if (!playbackUrl || !/^https:\/\//i.test(String(remote.vod_pic || ""))) {
        result.failed.push({ remoteId, reason: !playbackUrl ? "没有有效的 M3U8 地址" : "没有有效封面" });
        continue;
      }
      const now = new Date().toISOString(), category = safeText(remote.type_name, 100);
      const video: Video = {
        id: randomUUID(), title: safeText(remote.vod_name, 200) || `采集视频 ${remoteId}`,
        description: safeText(remote.vod_content || remote.vod_blurb), thumbnail: String(remote.vod_pic), playbackUrl,
        duration: durationSeconds(remote.vod_duration), tags: category ? [category, "采集视频"] : ["采集视频"],
        views: randomInt(10_000, 100_000), aspectRatio: "landscape", isAdult: true, status: "draft", categoryIds: [], createdAt: now,
        sourceType: "external", externalSource: { sourceKey: "hsckm3u8", remoteId, remoteUpdatedAt: String(remote.vod_time || ""), importedAt: now },
      };
      videoRepository.create(video, req.auth!.id);
      if(!adoptCollectorPreviews(video,req.auth!.id))generateMissingHighlights(video.id,video.playbackUrl,req.auth!.id);
      existing.add(remoteId); result.imported++;
    }
    return ok(res, result);
  } catch (error) {
    return res.status(502).json({ error: { code: "COLLECTOR_UNAVAILABLE", message: `采集失败：${error instanceof Error ? error.message : "未知错误"}` } });
  }
});
