import bcrypt from "bcryptjs";
import fs from "node:fs";
import path from "node:path";
import type { Database } from "../types.js";
import type { DatabaseRepository } from "./database.js";

export class JsonDatabaseRepository implements DatabaseRepository {
  private cached?:{mtime:number;value:Database};
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
    database.auditLogs ||= [];
    database.mediaJobs ||= [];
    this.cached={mtime,value:database};return database;
  }

  transaction<T>(operation: (database: Database) => T): T {
    const database = this.read();
    const result = operation(database);
    fs.writeFileSync(this.file, JSON.stringify(database));
    this.cached={mtime:fs.statSync(this.file).mtimeMs,value:database};
    return result;
  }
}
