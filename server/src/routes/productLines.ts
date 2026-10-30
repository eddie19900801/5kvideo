import { randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { adminOnly, authenticate, type AuthRequest } from "../auth.js";
import { readDb, updateDb, updateDbDeferred } from "../db.js";
import { ok } from "../http.js";
import type { ProductLine } from "../types.js";
import fs from "node:fs";
import path from "node:path";
import { collectorTaxonomy } from "../services/collectorTaxonomy.js";
import { allPackageChannels, packageArtifact, packageLinks, syncProductPackageManifest } from "../services/productPackages.js";
import { runProductDeployment } from "../services/productDeployment.js";

const suffix = (process.env.PRODUCT_DOMAIN_SUFFIX || "wflhc.cn").trim().toLowerCase().replace(/^\.+/, "");
const slug = z.string().trim().toLowerCase().min(2).max(40).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "产品标识只能包含小写字母、数字和中划线");
const domain = z.string().trim().toLowerCase().min(3).max(253).regex(/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/, "域名格式不正确");
const iconUrl = z.union([z.literal(""), z.string().url().max(1000)]);
const categoryIds = z.array(z.string().uuid()).max(100);
const videoIds = z.array(z.string().trim().min(1).max(150)).max(500);
const keywords = z.array(z.string().trim().min(1).max(50)).max(50).transform(items => [...new Set(items.map(item => item.trim()).filter(Boolean))]);
const recommendationStrategy = z.enum(["stable", "shuffle"]);
const themeColors=["#ef4444","#f97316","#eab308","#22c55e","#14b8a6","#3b82f6","#6366f1","#8b5cf6","#ec4899"];
const generatedDomains=(productSlug:string,bases:string[])=>bases.map(base=>`${productSlug}.app.${base}`);
const generatedLandingDomains=(productSlug:string,bases:string[])=>bases.map(base=>`${productSlug}.download.${base}`);
const packageNameForSlug=(productSlug:string)=>{const segment=productSlug.replace(/-/g,"_");return `cn.k897kg.${/^[a-z]/.test(segment)?segment:`p${segment}`}`};
const defaultRecommendationCategoryIds=(terms:string[])=>{try{const file=path.join(path.dirname(path.resolve(process.env.DATA_FILE||"./data/db.json")),"collected-catalog.json");const payload=JSON.parse(fs.readFileSync(file,"utf8"));const keys=terms.map(value=>value.trim().toLowerCase()).filter(Boolean);return collectorTaxonomy(Array.isArray(payload.videos)?payload.videos:[]).categories.filter(item=>keys.some(key=>item.name.toLowerCase().includes(key)||key.includes(item.name.toLowerCase()))).slice(0,100).map(item=>item.id)}catch{return []}};
const createSchema = z.object({
  name: z.string().trim().min(1).max(50),
  slug,
  iconUrl: iconUrl.default(""),
  recommendationCategoryIds: categoryIds.default([]),
  recommendationKeywords: keywords.default([]),
  recommendationVideoIds: videoIds.default([]),
  recommendationStrategy: recommendationStrategy.default("stable"),
}).strict();
const updateSchema = z.object({
  name: z.string().trim().min(1).max(50).optional(),
  iconUrl: iconUrl.optional(),
  recommendationCategoryIds: categoryIds.optional(),
  recommendationKeywords: keywords.optional(),
  recommendationVideoIds: videoIds.optional(),
  recommendationStrategy: recommendationStrategy.optional(),
  status: z.enum(["draft", "active", "disabled"]).optional(),
}).strict().refine(value => Object.keys(value).length > 0);

const adminValue = (item: ProductLine) => ({
  ...item,
  url: `https://${item.domain}/`,
  urls: item.domains.map(value=>`https://${value}/`),
  landingUrl: `https://${item.landingDomain}/`,
  landingUrls: item.landingDomains.map(value=>`https://${value}/`),
  runtimeConfigUrl: `https://${item.domain}/vdo-api/v1/product/runtime-config?host=${encodeURIComponent(item.domain)}`,
});
const runtimeValue = (item: ProductLine, requestedHost: string) => {
  const config = item.publishedConfig || item;
  return {
    id: item.id, slug: item.slug, status: item.status, version: item.version, publishedAt: item.publishedAt,
    ...config,
    hostMode: config.landingDomains.includes(requestedHost) ? "landing" : "app",
    url: `https://${config.domain}/`, urls: config.domains.map(value=>`https://${value}/`),
    runtimeConfigUrl: `https://${config.domain}/vdo-api/v1/product/runtime-config?host=${encodeURIComponent(config.domain)}`,
  };
};

const bangkokDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" });
const bangkokDateKey=(value:string|Date)=>new Date(new Date(value).getTime()+7*3600000).toISOString().slice(0,10);
const eventIdentity = (event: import("../types.js").AnalyticsEvent) => event.installId || event.userId || event.id;
const eventBelongsToProduct = (event: import("../types.js").AnalyticsEvent, product: ProductLine) => {
  const metadata = event.metadata || {}, config = product.publishedConfig || product;
  return metadata.productId === product.id || metadata.productSlug === product.slug || metadata.product === product.slug || config.domains.includes(String(metadata.productHost||"").toLowerCase());
};

export const productLinesRouter = Router();
const landingAnalyticsCache=new Map<string,{expires:number;value:unknown}>();
productLinesRouter.get("/product/runtime-config", (req, res) => {
  const requested = String(req.query.host || req.headers["x-product-host"] || req.hostname || "").trim().toLowerCase().replace(/:\d+$/, "");
  const products = readDb().productLines || [];
  const item = products.find(product => { const config=product.publishedConfig||product; return product.status === "active" && [...config.domains,...config.landingDomains].includes(requested) });
  if (!item) return res.status(404).json({ error: { code: "PRODUCT_NOT_FOUND", message: "产品尚未发布" } });
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  res.setHeader("Pragma", "no-cache");
  return ok(res, runtimeValue(item, requested));
});

productLinesRouter.get("/admin/landing-analytics", authenticate, adminOnly, (req, res) => {
  const database = readDb(), days = Math.max(7, Math.min(365, Number(req.query.days) || 30));
  const selectedChannel = String(req.query.channel || "").trim().slice(0, 50), selectedProduct = String(req.query.product || "").trim();
  const cacheKey=`${days}:${selectedChannel}:${selectedProduct}`,cached=landingAnalyticsCache.get(cacheKey);
  if(cached&&cached.expires>Date.now())return ok(res,cached.value);
  const product = selectedProduct ? database.productLines.find(item => item.id === selectedProduct || item.slug === selectedProduct) : undefined;
  const now = new Date(), start = new Date(now.getTime() - (days - 1) * 86400000), identity = (event: import("../types.js").AnalyticsEvent) => event.installId || event.userId || event.id;
  const startIso=start.toISOString(),events = database.analyticsEvents.filter(event => event.eventTime >= startIso && (!selectedChannel || (event.channel || "direct") === selectedChannel) && (!product || eventBelongsToProduct(event, product)));
  const dates = Array.from({ length: days }, (_, index) => bangkokDateKey(new Date(start.getTime() + index * 86400000)));
  const device = (event: import("../types.js").AnalyticsEvent) => {
    const value = String(event.metadata?.landingDevice || event.metadata?.devicePlatform || "").toLowerCase();
    if (value === "android" || value === "ios" || value === "pc") return value;
    return event.platform === "android" || event.platform === "ios" ? event.platform : "unknown";
  };
  type Row={date:string;pcVisits:number;pc:Set<string>;androidVisits:number;android:Set<string>;iosVisits:number;ios:Set<string>;unknownVisits:number;androidInstalls:Set<string>;iosInstalls:Set<string>};
  const grouped=new Map(dates.map(date=>[date,{date,pcVisits:0,pc:new Set<string>(),androidVisits:0,android:new Set<string>(),iosVisits:0,ios:new Set<string>(),unknownVisits:0,androidInstalls:new Set<string>(),iosInstalls:new Set<string>()} satisfies Row]));
  for(const event of events){const row=grouped.get(bangkokDateKey(event.eventTime));if(!row)continue;const id=identity(event);if(event.eventName==="landing_view"){const kind=device(event);if(kind==="pc"){row.pcVisits++;row.pc.add(id)}else if(kind==="android"){row.androidVisits++;row.android.add(id)}else if(kind==="ios"){row.iosVisits++;row.ios.add(id)}else row.unknownVisits++}if(event.eventName==="app_open"&&event.metadata?.firstOpen===true){if(event.platform==="android")row.androidInstalls.add(id);if(event.platform==="ios")row.iosInstalls.add(id)}}
  const daily=[...grouped.values()].map(row=>({date:row.date,pcVisits:row.pcVisits,pcUsers:row.pc.size,androidVisits:row.androidVisits,androidUsers:row.android.size,iosVisits:row.iosVisits,iosUsers:row.ios.size,unknownVisits:row.unknownVisits,androidInstalls:row.androidInstalls.size,iosInstalls:row.iosInstalls.size})).reverse();
  const value={
    days, selectedChannel, selectedProduct,
    channels: [{ code: "direct", name: "自然流量" }, ...database.channels.map(channel => ({ code: channel.code, name: channel.name }))],
    products: database.productLines.map(item => ({ id: item.id, slug: item.slug, name: item.name })),
    daily,
  };landingAnalyticsCache.set(cacheKey,{expires:Date.now()+30_000,value});return ok(res,value);
});

productLinesRouter.use("/admin/product-lines", authenticate, adminOnly);
productLinesRouter.get("/admin/product-lines", (_req, res) => ok(res, (readDb().productLines || []).map(adminValue).sort((a, b) => b.createdAt.localeCompare(a.createdAt))));
productLinesRouter.get("/admin/product-domains", (_req,res)=>ok(res,{domains:readDb().productDomains}));
productLinesRouter.put("/admin/product-domains", (req:AuthRequest,res)=>{const input=z.object({domains:z.array(domain).min(1).max(50)}).safeParse(req.body);if(!input.success)return res.status(400).json({error:{code:"VALIDATION_ERROR",message:input.error.issues[0]?.message||"域名列表不正确"}});const domains=[...new Set(input.data.domains.map(value=>value.toLowerCase()))];updateDb(db=>{db.productDomains=domains;for(const product of db.productLines){product.domains=generatedDomains(product.slug,domains);product.domain=product.domains[0];product.landingDomains=generatedLandingDomains(product.slug,domains);product.landingDomain=product.landingDomains[0];product.updatedAt=new Date().toISOString()}db.auditLogs.push({id:randomUUID(),adminId:req.auth!.id,action:"product-domains.update",targetId:domains.join(","),createdAt:new Date().toISOString()})});return ok(res,{domains})});
productLinesRouter.get("/admin/product-lines/:id/packages", (req, res) => {
  const database = readDb(), product = database.productLines.find(item => item.id === req.params.id);
  if (!product) return res.status(404).json({ error: { code: "NOT_FOUND", message: "产品不存在" } });
  return ok(res, allPackageChannels(database).map(channel => ({
    channelId: channel.id, channel: channel.code, channelName: channel.name,
    ...packageLinks(product, channel), apkReady: fs.existsSync(packageArtifact(product, channel.code)),
  })));
});
productLinesRouter.get("/admin/product-lines/:id/analytics", (req, res) => {
  const database = readDb(), product = database.productLines.find(item => item.id === req.params.id);
  if (!product) return res.status(404).json({ error: { code: "NOT_FOUND", message: "产品不存在" } });
  const days = Math.max(7, Math.min(180, Number(req.query.days) || 30)), selectedChannel = String(req.query.channel || "").trim();
  const now = new Date(), start = new Date(now.getTime() - (days - 1) * 86400000), date = (value: Date | string) => bangkokDay.format(new Date(value));
  const allProductEvents = database.analyticsEvents.filter(event => eventBelongsToProduct(event, product));
  const events = allProductEvents.filter(event => new Date(event.eventTime) >= start && (!selectedChannel || event.channel === selectedChannel));
  const identities = (rows: typeof events) => new Set(rows.map(eventIdentity)).size;
  const channels = [...new Set(["direct", ...database.channels.map(channel => channel.code), ...allProductEvents.map(event => event.channel || "direct")])].map(code => ({ code, name: code === "direct" ? "自然流量" : database.channels.find(channel => channel.code === code)?.name || code }));
  const firstSeen = new Map<string, string>(), activeDays = new Map<string, Set<string>>();
  for (const event of allProductEvents.filter(event => !selectedChannel || event.channel === selectedChannel)) {
    const identity = eventIdentity(event), day = date(event.eventTime);
    if (!firstSeen.has(identity) || day < firstSeen.get(identity)!) firstSeen.set(identity, day);
    if (!activeDays.has(identity)) activeDays.set(identity, new Set());
    activeDays.get(identity)!.add(day);
  }
  const retention = (cohortDay: string, offset: number) => {
    const cohort = [...firstSeen].filter(([, first]) => first === cohortDay).map(([identity]) => identity);
    const target = date(new Date(new Date(`${cohortDay}T00:00:00+07:00`).getTime() + offset * 86400000));
    if (new Date(`${target}T00:00:00+07:00`) > now) return null;
    return cohort.length ? Number((cohort.filter(identity => activeDays.get(identity)?.has(target)).length / cohort.length * 100).toFixed(2)) : 0;
  };
  const dates = Array.from({ length: days }, (_, index) => date(new Date(start.getTime() + index * 86400000)));
  const daily = dates.map(day => {
    const rows = events.filter(event => date(event.eventTime) === day), named = (name: string) => rows.filter(event => event.eventName === name);
    const landings = named("landing_view"), downloads = named("app_download_click"), opens = named("app_open"), installs = opens.filter(event => event.metadata?.firstOpen === true && event.platform !== "web");
    return { date: day, landingViews: landings.length, landingUsers: identities(landings), downloadClicks: downloads.length, downloadUsers: identities(downloads), installs: identities(installs), activeUsers: identities(rows), appUsers: identities(rows.filter(event => event.platform !== "web")), plays: named("video_play").length, effectivePlays: named("video_effective").length, day1Retention: retention(day, 1), day3Retention: retention(day, 3), day7Retention: retention(day, 7) };
  }).reverse();
  const landingViews = events.filter(event => event.eventName === "landing_view"), downloads = events.filter(event => event.eventName === "app_download_click"), installs = events.filter(event => event.eventName === "app_open" && event.metadata?.firstOpen === true && event.platform !== "web");
  return ok(res, { productId: product.id, productName: product.name, days, selectedChannel, channels, overview: { landingViews: landingViews.length, landingUsers: identities(landingViews), downloadClicks: downloads.length, downloadUsers: identities(downloads), installs: identities(installs), activeUsers: identities(events), conversionRate: identities(landingViews) ? Number((identities(installs) / identities(landingViews) * 100).toFixed(2)) : 0 }, daily });
});
productLinesRouter.post("/admin/product-lines", (req: AuthRequest, res) => {
  const input = createSchema.safeParse(req.body);
  if (!input.success) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: input.error.issues[0]?.message || "产品资料不正确" } });
  let created: ProductLine | undefined, conflict = "";
  updateDbDeferred(db => {
    const domains = generatedDomains(input.data.slug,db.productDomains||[suffix]);
    const landingDomains=generatedLandingDomains(input.data.slug,db.productDomains||[suffix]);
    const generatedDomain=domains[0],generatedPackageName=packageNameForSlug(input.data.slug),themeColor=themeColors[Math.floor(Math.random()*themeColors.length)];
    if (db.productLines.some(item => item.slug === input.data.slug)) { conflict = "产品标识已存在"; return; }
    if (db.productLines.some(item => item.domain === generatedDomain)) { conflict = "产品域名已存在"; return; }
    if (db.productLines.some(item => item.packageName.toLowerCase() === generatedPackageName.toLowerCase())) { conflict = "应用包名已存在"; return; }
    const now = new Date().toISOString();
    const inheritedCategories = input.data.recommendationCategoryIds.length
      ? input.data.recommendationCategoryIds
      : defaultRecommendationCategoryIds(input.data.recommendationKeywords);
    created = { id: randomUUID(), ...input.data, recommendationCategoryIds:[...inheritedCategories], domain: generatedDomain, domains, landingDomain:landingDomains[0], landingDomains, landingPage:null, packageName: generatedPackageName, themeColor, status: "draft", version: 0, createdAt: now, updatedAt: now };
    db.productLines.push(created);
    db.auditLogs.push({ id: randomUUID(), adminId: req.auth!.id, action: "product-line.create", targetId: created.id, createdAt: now });
  });
  if (conflict) return res.status(409).json({ error: { code: "PRODUCT_CONFLICT", message: conflict } });
  res.status(201); return ok(res, adminValue(created!));
});
productLinesRouter.patch("/admin/product-lines/:id", (req: AuthRequest, res) => {
  const input = updateSchema.safeParse(req.body);
  if (!input.success) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: input.error.issues[0]?.message || "产品资料不正确" } });
  let updated: ProductLine | undefined;
  updateDbDeferred(db => {
    const item = db.productLines.find(product => product.id === req.params.id); if (!item) return;
    Object.assign(item, input.data, { updatedAt: new Date().toISOString() }); updated = item;
    db.auditLogs.push({ id: randomUUID(), adminId: req.auth!.id, action: "product-line.update", targetId: item.id, createdAt: item.updatedAt });
  });
  if (!updated) return res.status(404).json({ error: { code: "NOT_FOUND", message: "产品不存在" } });
  return ok(res, adminValue(updated));
});
productLinesRouter.delete("/admin/product-lines/:id", (req: AuthRequest, res) => {
  let removed: ProductLine | undefined;
  updateDb(db => {
    const index = db.productLines.findIndex(product => product.id === req.params.id);
    if (index < 0) return;
    const now = new Date().toISOString();
    [removed] = db.productLines.splice(index, 1);
    db.auditLogs.push({ id: randomUUID(), adminId: req.auth!.id, action: "product-line.delete", targetId: removed.id, createdAt: now });
  });
  if (!removed) return res.status(404).json({ error: { code: "NOT_FOUND", message: "产品不存在或已经删除" } });
  const dataRoot = path.dirname(path.resolve(process.env.DATA_FILE || "./data/db.json"));
  const packageRoot = path.resolve(dataRoot, "product-packages");
  const packageTarget = path.resolve(packageRoot, removed.slug);
  const relativePackage = path.relative(packageRoot, packageTarget);
  if (relativePackage && !relativePackage.startsWith("..") && !path.isAbsolute(relativePackage)) fs.rmSync(packageTarget, { recursive: true, force: true });
  const manifestRoot = path.resolve(dataRoot, "product-package-manifests");
  const manifestTarget = path.resolve(manifestRoot, `${removed.slug}.json`);
  const relativeManifest = path.relative(manifestRoot, manifestTarget);
  if (relativeManifest && !relativeManifest.startsWith("..") && !path.isAbsolute(relativeManifest)) fs.rmSync(manifestTarget, { force: true });
  landingAnalyticsCache.clear();
  return ok(res, { id: removed.id, name: removed.name, deleted: true });
});
productLinesRouter.post("/admin/product-lines/:id/publish", async (req: AuthRequest, res) => {
  let updated: ProductLine | undefined;
  updateDb(db => { const item = db.productLines.find(product => product.id === req.params.id); if (!item) return; const now = new Date().toISOString(); item.status = "active"; item.version += 1; item.publishedAt = now; item.updatedAt = now; item.publishedConfig = { name: item.name, domain: item.domain, domains:[...item.domains], landingDomain:item.landingDomain, landingDomains:[...item.landingDomains], landingPage:item.landingPage, packageName: item.packageName, iconUrl: item.iconUrl, themeColor: item.themeColor, recommendationCategoryIds: [...item.recommendationCategoryIds], recommendationKeywords: [...item.recommendationKeywords], recommendationVideoIds: [], recommendationStrategy: item.recommendationStrategy }; syncProductPackageManifest(db, item); updated = item; db.auditLogs.push({ id: randomUUID(), adminId: req.auth!.id, action: "product-line.publish", targetId: item.id, createdAt: now }); });
  if (!updated) return res.status(404).json({ error: { code: "NOT_FOUND", message: "产品不存在" } });
  await runProductDeployment(updated.id);
  const completed = readDb().productLines.find(product => product.id === updated!.id) || updated;
  return ok(res, adminValue(completed));
});
productLinesRouter.post("/admin/product-lines/:id/deploy", async (req, res) => {
  const product = readDb().productLines.find(item => item.id === req.params.id);
  if (!product) return res.status(404).json({ error: { code: "NOT_FOUND", message: "产品不存在" } });
  if (product.status !== "active" || !product.publishedConfig) return res.status(409).json({ error: { code: "PRODUCT_NOT_PUBLISHED", message: "请先发布产品配置" } });
  await runProductDeployment(product.id);
  return ok(res, adminValue(readDb().productLines.find(item => item.id === product.id) || product));
});
