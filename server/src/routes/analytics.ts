import { createHmac, randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { adminOnly, authenticate, type AuthRequest } from "../auth.js";
import { databaseRepository } from "../db.js";
import { ok } from "../http.js";
import { analyticsRateLimit } from "../middleware/rateLimit.js";
import type { AnalyticsEvent } from "../types.js";
import { collectorVideoId } from "../services/collectorIdentity.js";
import { config } from "../config.js";
import fs from "node:fs";
import path from "node:path";
import { clientIpFromRequest } from "../services/clientIp.js";
import type { ProductLine } from "../types.js";

export const analyticsRouter = Router();
const analyticsReportCache=new Map<string,{expires:number;value:unknown}>();
const ipVisitCache=new Map<string,{expires:number;value:unknown}>();
const bangkokDateFormatter=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Bangkok",year:"numeric",month:"2-digit",day:"2-digit"});
let pendingAnalytics:AnalyticsEvent[]=[];
function flushAnalytics(){if(!pendingAnalytics.length)return;const batch=pendingAnalytics;pendingAnalytics=[];try{databaseRepository.transactionDeferred(db=>{db.analyticsEvents.push(...batch);const cutoff=Date.now()-400*86400000;db.analyticsEvents=db.analyticsEvents.filter(item=>new Date(item.eventTime).getTime()>=cutoff).slice(-500000)},1_000)}catch(error){pendingAnalytics=[...batch,...pendingAnalytics];console.error("Analytics flush failed",error)}}
setInterval(flushAnalytics,5_000).unref();
const collectedCatalogFile=path.join(path.dirname(path.resolve(process.env.DATA_FILE||"./data/db.json")),"collected-catalog.json");
let collectedTitleCache:{mtime:number;titles:Map<string,string>}|undefined;
function collectedTitles(){if(!fs.existsSync(collectedCatalogFile))return new Map<string,string>();const mtime=fs.statSync(collectedCatalogFile).mtimeMs;if(collectedTitleCache?.mtime===mtime)return collectedTitleCache.titles;const content=JSON.parse(fs.readFileSync(collectedCatalogFile,"utf8")) as {videos?:import("../types.js").Video[]},titles=new Map<string,string>();for(const video of content.videos||[])titles.set(collectorVideoId(video),video.title);collectedTitleCache={mtime,titles};return titles}
const eventBelongsToProduct=(event:AnalyticsEvent,product:ProductLine)=>{const metadata=event.metadata||{},published=product.publishedConfig||product,host=String(metadata.productHost||"").toLowerCase().replace(/:\d+$/,"");return metadata.productId===product.id||metadata.productSlug===product.slug||metadata.product===product.slug||published.domains.includes(host)};

analyticsRouter.post("/analytics/events", analyticsRateLimit, (req: AuthRequest, res) => {
  const eventSchema = z.object({
    eventName: z.string().trim().min(1).max(50).regex(/^[a-z0-9_]+$/),
    installId: z.string().trim().min(8).max(100),
    sessionId: z.string().trim().min(8).max(100),
    platform: z.enum(["web", "android", "ios"]).default("web"),
    appVersion: z.string().trim().max(30).default("web"),
    channel: z.string().trim().max(50).default("direct"),
    videoId: z.string().max(100).optional(),
    value: z.number().finite().min(0).max(86400000).optional(),
    metadata: z.record(z.string(), z.union([z.string().max(200), z.number().finite(), z.boolean()])).optional(),
  });
  const parsed = z.object({ events: z.array(eventSchema).min(1).max(50) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: { code: "INVALID_ANALYTICS", message: "分析事件格式无效" } });
  const eventTime = new Date().toISOString();
  const clientIp = clientIpFromRequest(req);
  const ipHash = createHmac("sha256", config.playbackSecret).update(clientIp).digest("hex").slice(0, 24);
  pendingAnalytics.push(...parsed.data.events.map(item=>({ id:randomUUID(),eventTime,userId:req.auth?.id,...item,metadata:{...item.metadata,clientIp,ipHash} })));
  ok(res, { accepted: parsed.data.events.length });
});

analyticsRouter.get("/admin/analytics/ip-visits", authenticate, adminOnly, (req, res) => {
  const date = String(req.query.date || "").trim();
  const channel = String(req.query.channel || "").trim().slice(0, 50);
  const productId = String(req.query.product || "").trim();
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.max(1, Math.min(100, Number(req.query.pageSize) || 20));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
    return res.status(400).json({ error: { code: "INVALID_DATE", message: "日期格式无效" } });
  const cacheKey=`${date}:${channel}:${productId}:${page}:${pageSize}`,cached=ipVisitCache.get(cacheKey);if(cached&&cached.expires>Date.now())return ok(res,cached.value);

  const database=databaseRepository.read(),product=productId?database.productLines.find(item=>item.id===productId):undefined;
  if(productId&&!product)return res.status(404).json({error:{code:"PRODUCT_NOT_FOUND",message:"产品不存在"}});
  const rows = [...database.analyticsEvents, ...pendingAnalytics].filter(event =>
    bangkokDateFormatter.format(new Date(event.eventTime)) === date
    && (!product || eventBelongsToProduct(event,product))
    && (!channel || String(event.channel || "direct") === channel)
    && typeof event.metadata?.clientIp === "string"
    && event.metadata.clientIp.length > 0,
  );
  const grouped = new Map<string, { ip: string; firstVisitedAt: string; lastVisitedAt: string; events: number; devices: Set<string>; sessions: Set<string> }>();
  for (const event of rows) {
    const ip = String(event.metadata?.clientIp), current = grouped.get(ip) || {
      ip, firstVisitedAt: event.eventTime, lastVisitedAt: event.eventTime, events: 0,
      devices: new Set<string>(), sessions: new Set<string>(),
    };
    current.events++;
    if (event.eventTime < current.firstVisitedAt) current.firstVisitedAt = event.eventTime;
    if (event.eventTime > current.lastVisitedAt) current.lastVisitedAt = event.eventTime;
    if (event.installId) current.devices.add(event.installId);
    if (event.sessionId) current.sessions.add(event.sessionId);
    grouped.set(ip, current);
  }
  const all = [...grouped.values()]
    .sort((left, right) => right.lastVisitedAt.localeCompare(left.lastVisitedAt))
    .map(item => ({ ...item, devices: item.devices.size, sessions: item.sessions.size }));
  const offset = (page - 1) * pageSize;
  const value={ date, channel, productId, page, pageSize, total: all.length, items: all.slice(offset, offset + pageSize) };ipVisitCache.set(cacheKey,{expires:Date.now()+30_000,value});ok(res,value);
});

analyticsRouter.get("/admin/analytics", authenticate, adminOnly, (req, res) => {
  const days = Math.max(7, Math.min(365, Number(req.query.days) || 30)),compact=req.query.compact==="1",selectedChannel=String(req.query.channel||"").trim().slice(0,50),selectedProduct=String(req.query.product||"").trim(),cacheKey=`${days}:${compact?1:0}:${selectedProduct}:${selectedChannel}`;
  const cached=analyticsReportCache.get(cacheKey);if(cached&&cached.expires>Date.now())return ok(res,cached.value);
  const sourceDb=databaseRepository.read(),db=selectedProduct?{...sourceDb,users:[]}:sourceDb,now = new Date(), start = new Date(now.getTime() - (days - 1) * 86400000);
  const dateKey = (date: Date | string) => bangkokDateFormatter.format(new Date(date));
  const dates = Array.from({ length: days }, (_, index) => dateKey(new Date(start.getTime() + index * 86400000)));
  const products=(db.productLines||[]).map(item=>({id:item.id,name:(item.publishedConfig||item).name,slug:item.slug,domain:(item.publishedConfig||item).domain,status:item.status})),product=selectedProduct?db.productLines.find(item=>item.id===selectedProduct):undefined;
  if(selectedProduct&&!product)return res.status(404).json({error:{code:"PRODUCT_NOT_FOUND",message:"产品不存在"}});
  const rawEvents=[...db.analyticsEvents,...pendingAnalytics],productEvents=product?rawEvents.filter(event=>eventBelongsToProduct(event,product)):rawEvents,eventChannel=(event:AnalyticsEvent)=>String(event.channel||"direct").trim()||"direct",allEvents=selectedChannel?productEvents.filter(event=>eventChannel(event)===selectedChannel):productEvents,events = allEvents.filter((event) => new Date(event.eventTime) >= start),channelRows=productEvents.filter(event=>new Date(event.eventTime)>=start);
  const identity = (event: AnalyticsEvent) => event.installId || event.userId || event.id;
  const channelMap=new Map<string,{channel:string;name?:string;events:number;users:Set<string>;pageViews:number;plays:number}>();for(const configured of db.channels)channelMap.set(configured.code,{channel:configured.code,name:configured.name,events:0,users:new Set<string>(),pageViews:0,plays:0});for(const event of channelRows){const channel=eventChannel(event),row=channelMap.get(channel)||{channel,events:0,users:new Set<string>(),pageViews:0,plays:0};row.events++;row.users.add(identity(event));if(event.eventName==="page_view")row.pageViews++;if(event.eventName==="video_play")row.plays++;channelMap.set(channel,row)}const channels=[...channelMap.values()].map(row=>({channel:row.channel,name:row.name,events:row.events,users:row.users.size,pageViews:row.pageViews,plays:row.plays})).sort((a,b)=>b.users-a.users||b.events-a.events||a.channel.localeCompare(b.channel));
  const rowsByDate=new Map<string,AnalyticsEvent[]>(),rowsByName=new Map<string,AnalyticsEvent[]>();
  for(const event of events){const date=dateKey(event.eventTime),dated=rowsByDate.get(date);if(dated)dated.push(event);else rowsByDate.set(date,[event]);const named=rowsByName.get(event.eventName);if(named)named.push(event);else rowsByName.set(event.eventName,[event])}
  const byName = (name: string) => rowsByName.get(name)||[];
  const unique = (rows: AnalyticsEvent[]) => new Set(rows.map(identity)).size;
  const firstSeen = new Map<string, string>(), activeDates = new Map<string, Set<string>>();
  for (const event of allEvents) { const id = identity(event), date = dateKey(event.eventTime); if (!firstSeen.has(id) || date < firstSeen.get(id)!) firstSeen.set(id, date); if (!activeDates.has(id)) activeDates.set(id, new Set()); activeDates.get(id)!.add(date); }
  const cohortRate=(date:string,offset:number)=>{const cohort=[...firstSeen].filter(([,first])=>first===date).map(([id])=>id),target=dateKey(new Date(new Date(`${date}T00:00:00Z`).getTime()+offset*86400000));if(new Date(`${target}T00:00:00Z`)>now)return null;const retained=cohort.filter(id=>activeDates.get(id)?.has(target)).length;return cohort.length?Number((retained/cohort.length*100).toFixed(2)):0};
  const guestAccounts=new Map<string,number>(),registeredAccounts=new Map<string,number>();for(const user of db.users){const target=(user.isGuest??!user.account)?guestAccounts:registeredAccounts,date=dateKey(user.createdAt);if((user.isGuest??!user.account)||user.role==="user")target.set(date,(target.get(date)||0)+1)}
  const daily = dates.map((date) => {
    const rows = rowsByDate.get(date)||[], active = unique(rows);
    const pageViews=rows.filter(event=>event.eventName==="page_view"),firstOpens=rows.filter(event=>event.eventName==="app_open"&&event.metadata?.firstOpen===true),webRows=rows.filter(event=>event.platform==="web"),appRows=rows.filter(event=>event.platform!=="web");
    const startup=rows.filter(event=>event.eventName==="playback_startup").map(event=>event.value||0);
    return { date, visits:pageViews.length, uniqueVisitors:active, uniqueIps:new Set(rows.map(event=>String(event.metadata?.ipHash||"")).filter(Boolean)).size, newDevices:unique(firstOpens), installs:unique(firstOpens.filter(event=>event.platform!=="web")), guestAccounts:selectedChannel?0:guestAccounts.get(date)||0, registeredAccounts:selectedChannel?0:registeredAccounts.get(date)||0, day1Retention:cohortRate(date,1), day3Retention:cohortRate(date,3), day7Retention:cohortRate(date,7), appUsers:unique(appRows), h5Visits:webRows.filter(event=>event.eventName==="page_view").length, h5Users:unique(webRows), activeUsers: active, newUsers: unique(firstOpens), sessions: new Set(rows.map((event) => event.sessionId)).size, videoImpressions: rows.filter((event) => event.eventName === "video_impression").length, detailViews:rows.filter(event=>event.eventName==="video_detail_view").length, plays: rows.filter((event) => event.eventName === "video_play").length, effectivePlays: rows.filter((event) => event.eventName === "video_effective").length, completions:rows.filter(event=>event.eventName==="video_complete").length, watchSeconds: Math.round(rows.filter((event) => event.eventName === "watch_time").reduce((sum, event) => sum + (event.value || 0), 0)), favorites: rows.filter((event) => event.eventName === "favorite_add").length, favoriteRemovals:rows.filter(event=>event.eventName==="favorite_remove").length, shares: rows.filter((event) => event.eventName.startsWith("share_")).length, searches:rows.filter(event=>event.eventName==="search").length, categorySelections:rows.filter(event=>event.eventName==="category_select").length, bufferingCount:rows.filter(event=>event.eventName==="buffering").length, averageStartupMs:startup.length?Math.round(startup.reduce((sum,value)=>sum+value,0)/startup.length):0, playbackFailures: rows.filter((event) => event.eventName === "playback_error").length };
  });
  const videoMap = new Map<string, { videoId: string; title: string; impressions: number; plays: number; effectivePlays: number; completions: number; watchSeconds: number; favorites: number; shares: number }>();
  const videoTitles=compact?new Map<string,string>():new Map([...db.videos.map(video=>[video.id,video.title] as const),...collectedTitles()]);if(!compact)for (const event of events) if (event.videoId) { const row = videoMap.get(event.videoId) || { videoId: event.videoId, title: videoTitles.get(event.videoId) || `视频 ${event.videoId}`, impressions: 0, plays: 0, effectivePlays: 0, completions: 0, watchSeconds: 0, favorites: 0, shares: 0 }; if (event.eventName === "video_impression") row.impressions++; if (event.eventName === "video_play") row.plays++; if (event.eventName === "video_effective") row.effectivePlays++; if (event.eventName === "video_complete") row.completions++; if (event.eventName === "watch_time") row.watchSeconds += event.value || 0; if (event.eventName === "favorite_add") row.favorites++; if (event.eventName.startsWith("share_")) row.shares++; videoMap.set(event.videoId, row); }
  const videoStats = [...videoMap.values()].map((row) => ({ ...row, ctr: row.impressions ? Number((row.plays / row.impressions * 100).toFixed(2)) : 0, completionRate: row.plays ? Number((row.completions / row.plays * 100).toFixed(2)) : 0, averageWatchSeconds: row.plays ? Math.round(row.watchSeconds / row.plays) : 0 })).sort((a, b) => b.plays - a.plays);
  const searchMap=new Map<string,{keyword:string;count:number;users:Set<string>;lastSearchedAt:string}>();for(const event of byName("search")){const keyword=String(event.metadata?.keyword||"").trim();if(!keyword)continue;const normalized=keyword.toLocaleLowerCase(),row=searchMap.get(normalized)||{keyword,count:0,users:new Set<string>(),lastSearchedAt:event.eventTime};row.count++;row.users.add(identity(event));if(event.eventTime>row.lastSearchedAt)row.lastSearchedAt=event.eventTime;searchMap.set(normalized,row)}const totalSearches=[...searchMap.values()].reduce((sum,row)=>sum+row.count,0),searchTerms=[...searchMap.values()].map(row=>({keyword:row.keyword,count:row.count,users:row.users.size,lastSearchedAt:row.lastSearchedAt,share:totalSearches?Number((row.count/totalSearches*100).toFixed(2)):0})).sort((a,b)=>b.count-a.count||b.users-a.users).slice(0,500);
  const performanceRows=byName("performance_page"),percentile=(values:number[],rate:number)=>{if(!values.length)return 0;const sorted=[...values].sort((a,b)=>a-b);return Math.round(sorted[Math.min(sorted.length-1,Math.ceil(sorted.length*rate)-1)])},performanceMetric=(name:string)=>{const values=performanceRows.map(event=>Number(event.metadata?.[name]||0)).filter(value=>value>0);return {samples:values.length,p50:percentile(values,.5),p90:percentile(values,.9),p95:percentile(values,.95)}},networkMap=new Map<string,{network:string;samples:number;slow:number;failures:number}>();for(const event of performanceRows){const network=String(event.metadata?.network||"unknown"),row=networkMap.get(network)||{network,samples:0,slow:0,failures:0};row.samples++;if(Number(event.metadata?.lcp||0)>4000||Number(event.metadata?.firstImages||0)>6000)row.slow++;row.failures+=Number(event.metadata?.imageFailures||0);networkMap.set(network,row)}const performanceReport={samples:performanceRows.length,slowPages:performanceRows.filter(event=>Number(event.metadata?.lcp||0)>4000||Number(event.metadata?.firstImages||0)>6000).length,imageFailures:performanceRows.reduce((sum,event)=>sum+Number(event.metadata?.imageFailures||0),0),ttfb:performanceMetric("ttfb"),fcp:performanceMetric("fcp"),lcp:performanceMetric("lcp"),dataReady:performanceMetric("dataReady"),firstImage:performanceMetric("firstImage"),firstImages:performanceMetric("firstImages"),networks:[...networkMap.values()].map(row=>({...row,slowRate:row.samples?Number((row.slow/row.samples*100).toFixed(2)):0})).sort((a,b)=>b.samples-a.samples)};
  const retention = [1, 3, 7, 14, 30].map((offset) => { const eligible = [...firstSeen].filter(([, date]) => new Date(date).getTime() <= now.getTime() - offset * 86400000), retained = eligible.filter(([id, date]) => activeDates.get(id)?.has(dateKey(new Date(new Date(date).getTime() + offset * 86400000)))).length; return { day: offset, users: eligible.length, retained, rate: eligible.length ? Number((retained / eligible.length * 100).toFixed(2)) : 0 }; });
  const startup = byName("playback_startup").map((event) => event.value || 0), buffering = byName("buffering").map((event) => event.value || 0);
  const playbackErrorRows=byName("playback_error"),rankErrors=(key:"detail"|"videoId")=>{const map=new Map<string,{key:string;label:string;count:number}>();for(const event of playbackErrorRows){const value=key==="videoId"?String(event.videoId||"unknown"):String(event.metadata?.detail||event.metadata?.type||"unknown"),label=key==="videoId"?String(event.metadata?.title||videoTitles.get(value)||`视频 ${value}`):value,row=map.get(value)||{key:value,label,count:0};row.count++;map.set(value,row)}return [...map.values()].sort((a,b)=>b.count-a.count).slice(0,20)},detailCutoff=Date.now()-30*86400000,recentPlaybackErrors=playbackErrorRows.filter(event=>new Date(event.eventTime).getTime()>=detailCutoff).sort((a,b)=>b.eventTime.localeCompare(a.eventTime)).slice(0,100).map(event=>({id:event.id,eventTime:event.eventTime,videoId:event.videoId||"",title:String(event.metadata?.title||videoTitles.get(event.videoId||"")||`视频 ${event.videoId||"未知"}`),source:String(event.metadata?.source||"unknown"),type:String(event.metadata?.type||"unknown"),detail:String(event.metadata?.detail||"unknown"),httpStatus:Number(event.metadata?.httpStatus||0),host:String(event.metadata?.host||"unknown"),network:String(event.metadata?.network||"unknown"),browser:String(event.metadata?.browser||"unknown"),elapsedMs:event.value||0,position:Number(event.metadata?.position||0)}));
  const userFeedback = byName("content_feedback").slice().sort((a,b)=>b.eventTime.localeCompare(a.eventTime)).slice(0,100).map(event=>({
    id:event.id,eventTime:event.eventTime,videoId:event.videoId||"",
    title:String(event.metadata?.title||videoTitles.get(event.videoId||"")||""),
    reason:String(event.metadata?.reason||"其他问题"),note:String(event.metadata?.note||"")
  }));
  const report={ userFeedback, days, selectedChannel, channels, overview: { activeUsers: unique(events), sessions: new Set(events.map((event) => event.sessionId)).size, newUsers: daily.reduce((sum, row) => sum + row.newUsers, 0), installs:unique(byName("app_open").filter(event=>event.platform!=="web"&&event.metadata?.firstOpen===true)), registeredUsers: selectedChannel?0:db.users.filter((user) => !user.isGuest && user.role === "user").length, guestUsers: selectedChannel?0:db.users.filter((user) => user.isGuest && user.role === "user").length, impressions: byName("video_impression").length, plays: byName("video_play").length, effectivePlays: byName("video_effective").length, totalWatchSeconds: Math.round(byName("watch_time").reduce((sum, event) => sum + (event.value || 0), 0)), favorites: byName("favorite_add").length, shares: events.filter((event) => event.eventName.startsWith("share_")).length }, daily, retention, videos: videoStats, searchTerms, performance:performanceReport, quality: { averageStartupMs: startup.length ? Math.round(startup.reduce((a, b) => a + b, 0) / startup.length) : 0, startupSamples: startup.length, bufferingCount: buffering.length, bufferingSeconds: Math.round(buffering.reduce((a, b) => a + b, 0)), playbackErrors: playbackErrorRows.length, playbackErrorTypes:rankErrors("detail"),playbackErrorVideos:rankErrors("videoId"),recentPlaybackErrors, completionRate: byName("video_play").length ? Number((byName("video_complete").length / byName("video_play").length * 100).toFixed(2)) : 0 }, platforms: ["web", "android", "ios"].map((platform) => {const rows=events.filter(event=>event.platform===platform);return { platform, users: unique(rows), events: rows.length }})};analyticsReportCache.set(cacheKey,{expires:Date.now()+30_000,value:report});ok(res,report);
});
