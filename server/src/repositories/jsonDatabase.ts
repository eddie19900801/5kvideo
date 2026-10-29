import bcrypt from "bcryptjs";
import fs from "node:fs";
import path from "node:path";
import type { Database } from "../types.js";
import type { DatabaseRepository } from "./database.js";

export class JsonDatabaseRepository implements DatabaseRepository {
  private cached?:{mtime:number;value:Database};
  private pendingWrite?: NodeJS.Timeout;
  private pendingSince?: number;
  constructor(private readonly file: string) {}

  private createSeed(): Database {
    const createdAt = new Date().toISOString();
    return {
      videos: [{
        id: "demo-1",
        title: "5K视频演示内容",
        description: "上传正式视频后可在管理后台替换此内容。",
        thumbnail: "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=900",
        playbackUrl: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
        duration: 634,
        tags: ["推荐", "演示"],
        views: 0,
        aspectRatio: "landscape",
        isAdult: false,
        status: "published",
        createdAt,
      }],
      users: [{
        id: "admin-1",
        account: process.env.ADMIN_INITIAL_ACCOUNT || "admin",
        passwordHash: bcrypt.hashSync(process.env.ADMIN_INITIAL_PASSWORD || "Admin123!", 12),
        username: "系统管理员",
        role: "admin",
        status: "active",
        createdAt,
      }],
      tags: [{ id: "tag-recommend", name: "推荐", createdAt }],
      categories: [],
      favorites: [],
      progress: [],
      analyticsEvents: [],
      channels: [],
      productLines: [],
      productDomains: ["wflhc.cn"],
      collectorSources: [
        { id: "collector-hsckm3u8", key: "hsckm3u8", name: "黄色仓库 M3U8", endpoint: "https://hsckzy888.com/api.php/provide/vod/from/hsckm3u8/at/json/", fallbackEndpoint: "https://hszyckapi.vip/api.php/provide/vod/from/hsckm3u8/at/json/", enabled: true, createdAt, updatedAt: createdAt },
        { id: "collector-jipinvip-dplayer", key: "jipinvip_dplayer", name: "新极品 dplayer", endpoint: "https://jipinvip1.com/api.php/provide/vod/from/dplayer/", enabled: true, createdAt, updatedAt: createdAt },
        { id: "collector-yuanlib", key: "yuanlib", name: "源力资源", endpoint: "https://yuanlib.com/api.php/provide/vod/", enabled: true, createdAt, updatedAt: createdAt },
        { id: "collector-heiliaozy", key: "heiliaozy", name: "黑料资源", endpoint: "https://heiliaozyapi.com/api.php/provide/vod", enabled: true, createdAt, updatedAt: createdAt },
        { id: "collector-xyezy", key: "xyezy", name: "星夜资源", endpoint: "https://xyezy.com/api.php/provide/vod/", enabled: true, createdAt, updatedAt: createdAt },
      ],
      auditLogs: [],
      mediaJobs: [],
    };
  }

  private ensureFile() {
    if (fs.existsSync(this.file)) return;
    if (process.env.NODE_ENV === "production" && !process.env.ADMIN_INITIAL_PASSWORD?.trim())
      throw new Error("生产环境首次初始化必须配置 ADMIN_INITIAL_PASSWORD");
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, JSON.stringify(this.createSeed(), null, 2));
  }

  read(): Database {
    this.ensureFile();
    const mtime=fs.statSync(this.file).mtimeMs;if(this.cached?.mtime===mtime)return this.cached.value;
    const database = JSON.parse(fs.readFileSync(this.file, "utf8")) as Database;
    database.tags ||= [];
    database.categories ||= [];
    database.analyticsEvents ||= [];
    database.channels ||= [];
    const createdAt=new Date().toISOString();
    database.productLines ||= [];
    database.productDomains ||= ["wflhc.cn"];
    if (!database.productLines.length) {
      database.productLines.push({
        id: "product-ppfree",
        name: "PP免费",
        slug: "ppfree",
        domain: "5knews.wflhc.cn",
        domains: ["5knews.wflhc.cn"],
        landingDomain: "ppfree.download.wflhc.cn",
        landingDomains: ["ppfree.download.wflhc.cn"],
        landingPage: null,
        packageName: "cn.ppfree.video",
        iconUrl: "",
        themeColor: "#ef4444",
        recommendationCategoryIds: [],
        recommendationKeywords: [],
        recommendationVideoIds: [],
        recommendationStrategy: "shuffle",
        status: "active",
        version: 1,
        publishedConfig: { name: "PP免费", domain: "5knews.wflhc.cn", domains: ["5knews.wflhc.cn"], landingDomain:"ppfree.download.wflhc.cn", landingDomains:["ppfree.download.wflhc.cn"], landingPage:null, packageName: "cn.ppfree.video", iconUrl: "", themeColor: "#ef4444", recommendationCategoryIds: [], recommendationKeywords: [], recommendationVideoIds: [], recommendationStrategy: "shuffle" },
        publishedAt: createdAt,
        createdAt,
        updatedAt: createdAt,
      });
    }
    for (const product of database.productLines) {
      product.domains ||= [product.domain];
      product.landingDomains ||= (database.productDomains||["wflhc.cn"]).map(base=>`${product.slug}.download.${base}`);
      product.landingDomain ||= product.landingDomains[0];
      product.landingPage ??= null;
      product.recommendationCategoryIds ||= [];
      product.recommendationKeywords ||= [];
      product.recommendationVideoIds ||= [];
      product.recommendationStrategy ||= "shuffle";
      if (product.publishedConfig) {
        product.publishedConfig.domains ||= [product.publishedConfig.domain];
        product.publishedConfig.landingDomains ||= [...product.landingDomains];
        product.publishedConfig.landingDomain ||= product.publishedConfig.landingDomains[0];
        product.publishedConfig.landingPage ??= null;
        product.publishedConfig.recommendationCategoryIds ||= [];
        product.publishedConfig.recommendationKeywords ||= [];
        product.publishedConfig.recommendationVideoIds ||= [];
        product.publishedConfig.recommendationStrategy ||= "shuffle";
      }
      if (product.status === "active" && !product.publishedConfig) product.publishedConfig = {
        name: product.name, domain: product.domain, domains: [...product.domains], landingDomain:product.landingDomain, landingDomains:[...product.landingDomains], landingPage:product.landingPage, packageName: product.packageName,
        iconUrl: product.iconUrl, themeColor: product.themeColor,
        recommendationCategoryIds: [...product.recommendationCategoryIds],
        recommendationKeywords: [...product.recommendationKeywords],
        recommendationVideoIds: [...product.recommendationVideoIds],
        recommendationStrategy: product.recommendationStrategy,
      };
    }
    database.collectorSources ||= [];
    const defaults=[
      { id: "collector-hsckm3u8", key: "hsckm3u8", name: "黄色仓库 M3U8", endpoint: "https://hsckzy888.com/api.php/provide/vod/from/hsckm3u8/at/json/", fallbackEndpoint: "https://hszyckapi.vip/api.php/provide/vod/from/hsckm3u8/at/json/", enabled: true, createdAt, updatedAt: createdAt },
      { id: "collector-jipinvip-dplayer", key: "jipinvip_dplayer", name: "新极品 dplayer", endpoint: "https://jipinvip1.com/api.php/provide/vod/from/dplayer/", enabled: true, createdAt, updatedAt: createdAt },
      { id: "collector-yuanlib", key: "yuanlib", name: "源力资源", endpoint: "https://yuanlib.com/api.php/provide/vod/", enabled: true, createdAt, updatedAt: createdAt },
      { id: "collector-heiliaozy", key: "heiliaozy", name: "黑料资源", endpoint: "https://heiliaozyapi.com/api.php/provide/vod", enabled: true, createdAt, updatedAt: createdAt },
      { id: "collector-xyezy", key: "xyezy", name: "星夜资源", endpoint: "https://xyezy.com/api.php/provide/vod/", enabled: true, createdAt, updatedAt: createdAt },
    ];
    for(const source of defaults)if(!database.collectorSources.some(item=>item.key===source.key))database.collectorSources.push(source);
    database.auditLogs ||= [];
    database.mediaJobs ||= [];
    this.cached={mtime,value:database};return database;
  }

  transaction<T>(operation: (database: Database) => T): T {
    const database = this.read();
    const result = operation(database);
    if (this.pendingWrite) {
      clearTimeout(this.pendingWrite);
      this.pendingWrite = undefined;
      this.pendingSince = undefined;
    }
    this.persist(database);
    return result;
  }

  /**
   * Apply small admin mutations immediately, then coalesce the expensive full
   * JSON snapshot write. The in-memory value is authoritative during the short
   * delay, and any normal transaction flushes it synchronously first.
   */
  transactionDeferred<T>(operation: (database: Database) => T, delayMs = 150): T {
    const database = this.read();
    const result = operation(database);
    const now = Date.now();
    this.pendingSince ??= now;
    if (this.pendingWrite) clearTimeout(this.pendingWrite);
    const wait = Math.max(0, Math.min(delayMs, 5_000 - (now - this.pendingSince)));
    this.pendingWrite = setTimeout(() => {
      this.pendingWrite = undefined;
      this.pendingSince = undefined;
      this.persist(database);
    }, wait);
    this.pendingWrite.unref();
    return result;
  }

  private persist(database: Database) {
    const temporary=`${this.file}.tmp-${process.pid}`;
    fs.writeFileSync(temporary, JSON.stringify(database));
    fs.renameSync(temporary,this.file);
    this.cached={mtime:fs.statSync(this.file).mtimeMs,value:database};
  }
}
