import { randomUUID } from "node:crypto";
import type { Video } from "../types.js";
import type { ContentMode } from "../contentMode.js";
import type { DatabaseRepository } from "./database.js";
import type {
  InteractionRepository,
  UserInteractionSnapshot,
  VideoRepository,
  VideoUpdate,
} from "./video.js";

export class JsonVideoRepository implements VideoRepository {
  constructor(private readonly database: DatabaseRepository) {}

  list(): Video[] {
    return this.database.read().videos;
  }

  findById(id: string): Video | undefined {
    return this.database.read().videos.find((video) => video.id === id);
  }

  findPublishedById(id: string): Video | undefined {
    return this.database
      .read()
      .videos.find((video) => video.id === id && video.status === "published");
  }

  create(video: Video, adminId: string): Video {
    return this.database.transaction((database) => {
      database.videos.unshift(video);
      this.ensureTags(database, video.tags);
      database.auditLogs.push({
        id: randomUUID(),
        adminId,
        action: "video.create",
        targetId: video.id,
        createdAt: new Date().toISOString(),
      });
      return video;
    });
  }

  update(id: string, changes: VideoUpdate, adminId: string): Video | undefined {
    return this.database.transaction((database) => {
      const video = database.videos.find((item) => item.id === id);
      if (!video) return undefined;
      Object.assign(video, changes, { id: video.id, createdAt: video.createdAt });
      this.ensureTags(database, video.tags);
      database.auditLogs.push({
        id: randomUUID(),
        adminId,
        action: "video.update",
        targetId: video.id,
        createdAt: new Date().toISOString(),
      });
      return video;
    });
  }

  setStatus(id: string, status: Video["status"]): boolean {
    return this.database.transaction((database) => {
      const video = database.videos.find((item) => item.id === id);
      if (!video) return false;
      video.status = status;
      return true;
    });
  }

  updateThumbnail(id: string, thumbnail: string, adminId: string): Video | undefined {
    return this.database.transaction((database) => {
      const video = database.videos.find((item) => item.id === id);
      if (!video) return undefined;
      video.thumbnail = thumbnail;
      database.auditLogs.push({ id: randomUUID(), adminId, action: "video.cover.update", targetId: id, createdAt: new Date().toISOString() });
      return video;
    });
  }

  deletePermanent(id: string, adminId: string): Video | undefined {
    return this.database.transaction((database) => {
      const video = database.videos.find((item) => item.id === id);
      if (!video) return undefined;
      database.videos = database.videos.filter((item) => item.id !== id);
      database.favorites = database.favorites.filter((item) => item.videoId !== id);
      database.progress = database.progress.filter((item) => item.videoId !== id);
      database.auditLogs.push({ id: randomUUID(), adminId, action: "video.delete", targetId: id, createdAt: new Date().toISOString() });
      return video;
    });
  }

  private ensureTags(database: ReturnType<DatabaseRepository["read"]>, names: string[]) {
    const createdAt = new Date().toISOString();
    for (const name of names)
      if (!database.tags.some((tag) => tag.name.toLowerCase() === name.toLowerCase()))
        database.tags.push({ id: randomUUID(), name, createdAt });
  }
}

export class JsonInteractionRepository implements InteractionRepository {
  constructor(private readonly database: DatabaseRepository) {}

  forUser(userId?: string): UserInteractionSnapshot {
    if (!userId) return { favorites: [], progress: [] };
    const database = this.database.read();
    return {
      favorites: database.favorites
        .filter((item) => item.userId === userId)
        .map(({ videoId }) => ({ videoId })),
      progress: database.progress
        .filter((item) => item.userId === userId)
        .map(({ videoId, progress, duration, completed }) => ({
          videoId,
          progress,
          duration,
          completed,
        })),
    };
  }

  recordView(videoId: string, userId: string, role: "user" | "admin"): number {
    return this.database.transactionDeferred((database) => {
      const video = database.videos.find((item) => item.id === videoId);
      if (video) video.views = (video.views || 0) + 1;
      const now = new Date().toISOString();
      let user = database.users.find((item) => item.id === userId);
      if (!user && role === "user") {
        user = { id: userId, account: "", passwordHash: "", username: "游客", role: "user", status: "active", isGuest: true, visitCount: 0, totalWatchSeconds: 0, createdAt: now };
        database.users.push(user);
      }
      if (user) { user.lastSeenAt = now; user.visitCount = (user.visitCount || 0) + 1; }
      return video?.views || 0;
    }, 750);
  }

  setFavorite(userId: string, videoId: string, mode: ContentMode, favorited: boolean): void {
    this.database.transaction((database) => {
      const matches = (item: typeof database.favorites[number]) => item.userId === userId && item.videoId === videoId && (item.mode || "normal") === mode;
      if (favorited && !database.favorites.some(matches)) database.favorites.push({ userId, videoId, mode, createdAt: new Date().toISOString() });
      if (!favorited) database.favorites = database.favorites.filter((item) => !matches(item));
    });
  }

  saveProgress(userId: string, videoId: string, progress: number, duration: number, mode: ContentMode): void {
    this.database.transactionDeferred((database) => {
      const old = database.progress.find((item) => item.userId === userId && item.videoId === videoId && (item.mode || "normal") === mode);
      const previous = old?.progress || 0;
      const record = { userId, videoId, progress, duration, mode, completed: progress / duration >= 0.95 || duration - progress <= 20, updatedAt: new Date().toISOString() };
      if (old) Object.assign(old, record); else database.progress.push(record);
      const user = database.users.find((item) => item.id === userId);
      if (user) { user.lastSeenAt = record.updatedAt; user.totalWatchSeconds = (user.totalWatchSeconds || 0) + Math.max(0, progress - previous); }
    }, 750);
  }

  deleteProgress(userId: string, videoId: string, mode: ContentMode): void {
    this.database.transaction((database) => { database.progress = database.progress.filter((item) => !(item.userId === userId && item.videoId === videoId && (item.mode || "normal") === mode)); });
  }

  clearHistory(userId: string, mode: ContentMode): void {
    this.database.transaction((database) => { database.progress = database.progress.filter((item) => !(item.userId === userId && (item.mode || "normal") === mode)); });
  }

  favorites(userId: string, mode: ContentMode): Video[] {
    const database = this.database.read();
    const ids = new Set(database.favorites.filter((item) => item.userId === userId && (item.mode || "normal") === mode).map((item) => item.videoId));
    return database.videos.filter((video) => ids.has(video.id));
  }

  history(userId: string, mode: ContentMode) {
    const database = this.database.read();
    return database.progress.filter((item) => item.userId === userId && (item.mode || "normal") === mode).map((item) => ({ ...item, video: database.videos.find((video) => video.id === item.videoId) }));
  }
}
