import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { ok } from '../http.js';
import type { Video } from '../types.js';
import { collectorPreviewDirectory, readCollectorPreviews } from '../services/collectorPreviewGenerator.js';
import { collectorTaxonomy } from '../services/collectorTaxonomy.js';
import { hotCollectorSearches, recordCollectorSearch } from '../services/collectorSearchStats.js';
import { collectorPreviewId, collectorVideoId } from '../services/collectorIdentity.js';
import { databaseRepository } from '../db.js';
import { buildTopics } from '../services/topicRanking.js';

type Catalog={videos?:Video[]};
const catalogFile=path.join(path.dirname(path.resolve(process.env.DATA_FILE||'./data/db.json')),'collected-catalog.json');
let cache:{mtime:number;videos:Video[]}|undefined;
function catalog(){if(!fs.existsSync(catalogFile))return[];const mtime=fs.statSync(catalogFile).mtimeMs;if(cache?.mtime===mtime)return cache.videos;const value=JSON.parse(fs.readFileSync(catalogFile,'utf8')) as Catalog;const videos=Array.isArray(value.videos)?value.videos:[];cache={mtime,videos};return videos}
const videoId=collectorVideoId;
let relatedCache: { source: Video[]; taxonomyTime: number; lists: Map<string, Video[]> } | undefined;
function relatedCatalog(videos: Video[], source: Video, taxonomy: ReturnType<typeof collectorTaxonomy>) {
  const file = path.join(path.dirname(catalogFile), 'collected-taxonomy.json');
  const taxonomyTime = fs.existsSync(file) ? fs.statSync(file).mtimeMs : 0;
  if (relatedCache?.source !== videos || relatedCache.taxonomyTime !== taxonomyTime)
    relatedCache = { source: videos, taxonomyTime, lists: new Map() };
  const id = videoId(source), saved = relatedCache.lists.get(id);
  if (saved) return saved;
  const normalize = (tags: string[]) => new Set(tags.map(tag => tag.trim().toLocaleLowerCase()).filter(tag => tag && !['采集视频', '推荐', '精选'].includes(tag)));
  const tags = normalize(source.tags), category = taxonomy.assignments[id];
  const seconds = (video: Video) => video.duration >= 70 ? video.duration - 60 : video.duration;
  const sourceDuration = seconds(source), known = new Set<string>();
  const ranked: { video: Video; score: number; index: number }[] = [];
  videos.forEach((video, index) => {
    const otherId = videoId(video);
    if (otherId === id || known.has(otherId)) return;
    known.add(otherId);
    const shared = [...normalize(video.tags)].filter(tag => tags.has(tag)).length;
    const sameCategory = Boolean(category && taxonomy.assignments[otherId] === category);
    if (!sameCategory && !shared) return;
    const duration = seconds(video);
    const closeness = sourceDuration > 1 && duration > 1 ? Math.min(sourceDuration, duration) / Math.max(sourceDuration, duration) : 0;
    ranked.push({ video, score: (sameCategory ? 6 : 0) + Math.min(shared, 4) * 2 + closeness, index });
  });
  ranked.sort((left, right) => right.score - left.score || left.index - right.index);
  const result = ranked.map(item => item.video);
  if (relatedCache.lists.size >= 12) relatedCache.lists.delete(relatedCache.lists.keys().next().value!);
  relatedCache.lists.set(id, result);
  return result;
}
let latestCache: { source: Video[]; sorted: Video[] } | undefined;
function latestCatalog(videos: Video[]) {
  if (latestCache?.source === videos) return latestCache.sorted;
  const dated = videos.map(video => ({ video, time: Date.parse(video.externalSource?.importedAt || video.createdAt) || 0 }));
  dated.sort((left, right) => right.time - left.time || videoId(right.video).localeCompare(videoId(left.video), 'en', { numeric: true }));
  const sorted = dated.map(item => item.video);
  latestCache = { source: videos, sorted };
  return sorted;
}
const summary=(video:Video,category:string)=>({id:videoId(video),title:video.title,thumbnail:video.thumbnail,duration:video.duration>=70?video.duration-60:video.duration,views:video.views,tags:video.tags,category,updatedAt:video.externalSource?.remoteUpdatedAt||video.createdAt,aspectRatio:video.aspectRatio});
const gcd=(a:number,b:number):number=>b?gcd(b,a%b):a;
function seededSlice<T>(rows:T[],seed:string,start:number,size:number){if(!rows.length)return[];const hash=createHash('sha256').update(seed).digest(),length=rows.length,offset=hash.readUInt32BE(0)%length;let step=Math.max(1,hash.readUInt32BE(4)%length);while(gcd(step,length)!==1)step=step%length+1;const result:T[]=[];for(let index=start;index<Math.min(start+size,length);index++)result.push(rows[(offset+index*step)%length]);return result}
let bootstrapCache:{videos:Video[];expires:number;value:unknown}|undefined;
let categoryCache:{videos:Video[];taxonomy:ReturnType<typeof collectorTaxonomy>;value:{id:string;name:string;count:number}[]}|undefined;
function categorySummary(videos:Video[],taxonomy=collectorTaxonomy(videos)){if(categoryCache?.videos===videos&&categoryCache.taxonomy===taxonomy)return categoryCache.value;const counts=new Map<string,number>();for(const id of Object.values(taxonomy.assignments))counts.set(id,(counts.get(id)||0)+1);const value=taxonomy.categories.map(item=>({id:item.id,name:item.name,count:counts.get(item.id)||0})).filter(item=>item.count>0);categoryCache={videos,taxonomy,value};return value}
function bootstrap(){const videos=catalog(),now=Date.now();if(bootstrapCache?.videos===videos&&bootstrapCache.expires>now)return bootstrapCache.value;const taxonomy=collectorTaxonomy(videos),names=new Map(taxonomy.categories.map(item=>[item.id,item.name])),categories=categorySummary(videos,taxonomy),grouped=new Map<string,Video[]>();for(const video of videos){const category=taxonomy.assignments[videoId(video)];if(!category)continue;const rows=grouped.get(category);if(rows)rows.push(video);else grouped.set(category,[video])}const page=(rows:Video[])=>({page:1,pageSize:20,total:rows.length,pageCount:Math.max(1,Math.ceil(rows.length/20)),items:rows.slice(0,20).map(video=>summary(video,names.get(taxonomy.assignments[videoId(video)])||''))}),pools=Array.from({length:8},(_,index)=>page(seededSlice(videos,`static-pool-${index}`,0,videos.length))),categoryPages=Object.fromEntries(categories.map(item=>[item.id,page(grouped.get(item.id)||[])]));const value={version:createHash('sha1').update(`${videos.length}:${videos[0]?.externalSource?.remoteUpdatedAt||videos[0]?.createdAt||''}`).digest('hex').slice(0,12),generatedAt:new Date().toISOString(),categories,pools,categoryPages};bootstrapCache={videos,expires:now+5*60_000,value};return value}

export const collectedVideosRouter=Router();
let topicsCache: { videos: Video[]; expires: number; value: ReturnType<typeof buildTopics> } | undefined;
collectedVideosRouter.get('/topics', (_req, res) => {
  const videos = catalog();
  if (!topicsCache || topicsCache.videos !== videos || topicsCache.expires < Date.now()) {
    topicsCache = { videos, expires: Date.now() + 60_000, value: buildTopics(videos, collectorTaxonomy(videos), databaseRepository.read().analyticsEvents) };
  }
  res.setHeader('Cache-Control', 'public, max-age=60');
  return ok(res, topicsCache.value);
});
const recentSearches=new Map<string,number>();
collectedVideosRouter.get('/bootstrap',(_req,res)=>{res.setHeader('Cache-Control','public, max-age=60, s-maxage=300, stale-while-revalidate=86400');return ok(res,bootstrap())});
collectedVideosRouter.get('/hot-searches',(_req,res)=>ok(res,hotCollectorSearches()));
collectedVideosRouter.post('/searches',(req,res)=>{const input=z.object({keyword:z.string().trim().min(1).max(100)}).strict().safeParse(req.body);if(!input.success)return res.status(400).json({error:{code:'VALIDATION_ERROR',message:'搜索关键词无效'}});const key=`${req.ip}:${input.data.keyword.toLocaleLowerCase()}`,now=Date.now(),last=recentSearches.get(key)||0;if(now-last>=60_000){recordCollectorSearch(input.data.keyword);recentSearches.set(key,now)}if(recentSearches.size>10_000)for(const[item,time]of recentSearches)if(now-time>60_000)recentSearches.delete(item);res.status(201);return ok(res,{recorded:now-last>=60_000})});
collectedVideosRouter.get('/categories',(_req,res)=>{const videos=catalog();return ok(res,categorySummary(videos))});
collectedVideosRouter.get('/', (req, res) => {
  const input = z.object({
    page: z.coerce.number().int().min(1).max(100000).default(1),
    pageSize: z.coerce.number().int().min(1).max(40).default(20),
    q: z.string().trim().max(100).default(''),
    category: z.string().trim().max(100).default(''),
    seed: z.string().trim().max(100).default(''),
    relatedTo: z.string().trim().max(100).default(''),
    sort: z.enum(['recommended', 'latest']).default('recommended'),
    duration: z.enum(['all', 'short', 'medium', 'long']).default('all'),
    product: z.string().trim().max(40).default(''),
  }).safeParse(req.query);
  if (!input.success) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: '查询参数无效' } });
  const videos = catalog(), taxonomy = collectorTaxonomy(videos);
  const names = new Map(taxonomy.categories.map(item => [item.id, item.name]));
  const requested = taxonomy.categories.find(item => item.id === input.data.category || item.name === input.data.category)?.id;
  const query = input.data.q.toLocaleLowerCase();
  let rows = input.data.sort === 'latest' ? latestCatalog(videos) : videos;
  let productStrategy: 'stable' | 'shuffle' = 'shuffle';
  if (input.data.product && !input.data.relatedTo && !query && !input.data.category && input.data.sort === 'recommended') {
    const product = (databaseRepository.read().productLines || []).find(item => item.status === 'active' && item.slug === input.data.product);
    if (!product) return res.status(404).json({ error: { code: 'PRODUCT_NOT_FOUND', message: '产品尚未发布' } });
    const config = product.publishedConfig || product;
    const configuredCategories = new Set(config.recommendationCategoryIds || []);
    const configuredKeywords = (config.recommendationKeywords || []).map(keyword => keyword.toLocaleLowerCase()).filter(Boolean);
    productStrategy = config.recommendationStrategy || 'stable';
    if (configuredKeywords.length || configuredCategories.size) {
      const categoryVideos = videos.filter(video => configuredCategories.has(taxonomy.assignments[videoId(video)]));
      const keywordVideos = videos.filter(video => {
        const categoryName = names.get(taxonomy.assignments[videoId(video)]) || '';
        const haystack = `${video.title} ${video.description} ${video.tags.join(' ')} ${categoryName}`.toLocaleLowerCase();
        return configuredKeywords.some(keyword => haystack.includes(keyword));
      });
      rows = [...new Map([...keywordVideos, ...categoryVideos].map(video => [videoId(video), video])).values()];
    }
  }
  if (input.data.relatedTo) {
    const source = videos.find(video => videoId(video) === input.data.relatedTo);
    if (!source) return res.status(404).json({ error: { code: 'NOT_FOUND', message: '关联视频不存在' } });
    rows = relatedCatalog(videos, source, taxonomy);
  }
  if (query) rows = rows.filter(video => `${video.title} ${video.description} ${video.tags.join(' ')}`.toLocaleLowerCase().includes(query));
  // Text search is always global. A previously selected category is retained by
  // the client only so clearing the search can return to that category.
  if (input.data.category && !query) rows = requested ? rows.filter(video => taxonomy.assignments[videoId(video)] === requested) : [];
  if (input.data.duration !== 'all') rows = rows.filter(video => {
    const seconds = video.duration >= 70 ? video.duration - 60 : video.duration;
    if (seconds <= 1) return false; // Unknown durations are not presented as short videos.
    if (input.data.duration === 'short') return seconds < 600;
    if (input.data.duration === 'medium') return seconds >= 600 && seconds < 1800;
    return seconds >= 1800;
  });
  const start = (input.data.page - 1) * input.data.pageSize;
  const items = !input.data.relatedTo && input.data.sort === 'recommended' && input.data.seed && !query && !input.data.category && productStrategy === 'shuffle'
    ? seededSlice(rows, input.data.seed, start, input.data.pageSize) : rows.slice(start, start + input.data.pageSize);
  return ok(res, { page: input.data.page, pageSize: input.data.pageSize, total: rows.length,
    pageCount: Math.max(1, Math.ceil(rows.length / input.data.pageSize)),
    items: items.map(video => summary(video, names.get(taxonomy.assignments[videoId(video)]) || '')) });
});
collectedVideosRouter.get('/:id',(req,res)=>{const id=String(req.params.id),videos=catalog(),video=videos.find(item=>videoId(item)===id);if(!video)return res.status(404).json({error:{code:'NOT_FOUND',message:'视频不存在或已下架'}});const taxonomy=collectorTaxonomy(videos),name=taxonomy.categories.find(item=>item.id===taxonomy.assignments[id])?.name||'',trimmed=video.duration>=70,previews=readCollectorPreviews(collectorPreviewId(video));return ok(res,{...summary(video,name),description:video.description,playbackUrl:video.playbackUrl,trimStart:trimmed?30:0,trimEnd:0,highlights:previews.items.map(item=>({id:item.id,time:item.time,image:`/collected-videos/${encodeURIComponent(id)}/previews/${encodeURIComponent(item.file)}`}))})});
collectedVideosRouter.get('/:id/previews/:file',(req,res)=>{const id=String(req.params.id),video=catalog().find(item=>videoId(item)===id);if(!video)return res.status(404).end();const previewId=collectorPreviewId(video),name=path.basename(String(req.params.file)),directory=collectorPreviewDirectory(previewId),metadata=readCollectorPreviews(previewId);if(!directory||!metadata.items.some(item=>item.file===name))return res.status(404).end();const file=path.join(directory,name);if(!fs.existsSync(file))return res.status(404).end();res.type('image/webp').setHeader('Cache-Control','public, max-age=86400');return res.sendFile(file)});
