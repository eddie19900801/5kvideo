import type { Progress, Video } from "../types.js";
import type { ContentMode } from "../contentMode.js";

export type VideoUpdate = Partial<Omit<Video, "id" | "createdAt">>;

export interface VideoRepository {
  list(): Video[];
  findById(id: string): Video | undefined;
  findPublishedById(id: string): Video | undefined;
  create(video: Video, adminId: string): Video;
  update(id: string, changes: VideoUpdate, adminId: string): Video | undefined;
  setStatus(id: string, status: Video["status"]): boolean;
  updateThumbnail(id: string, thumbnail: string, adminId: string): Video | undefined;
  deletePermanent(id: string, adminId: string): Video | undefined;
}

export interface UserInteractionSnapshot {
  favorites: { videoId: string }[];
  progress: { videoId: string; progress: number; duration: number; completed: boolean }[];
}

export interface InteractionRepository {
  forUser(userId?: string): UserInteractionSnapshot;
  recordView(videoId: string, userId: string, role: "user" | "admin"): number;
  setFavorite(userId: string, videoId: string, mode: ContentMode, favorited: boolean): void;
  saveProgress(userId: string, videoId: string, progress: number, duration: number, mode: ContentMode): void;
  deleteProgress(userId: string, videoId: string, mode: ContentMode): void;
  clearHistory(userId: string, mode: ContentMode): void;
  favorites(userId: string, mode: ContentMode): Video[];
  history(userId: string, mode: ContentMode): Array<Progress & { video?: Video }>;
}
