export type VideoStatus = "draft" | "processing" | "published" | "offline";
export interface Video {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  playbackUrl: string;
  duration: number;
  tags: string[];
  chapters?: { id: string; label: string; time: number }[];
  views: number;
  aspectRatio: "landscape" | "portrait";
  isAdult: boolean;
  status: VideoStatus;
  createdAt: string;
}
export interface User {
  id: string;
  account: string;
  passwordHash: string;
  username: string;
  role: "user" | "admin";
  status: "active" | "disabled";
  isGuest?: boolean;
  visitCount?: number;
  totalWatchSeconds?: number;
  lastSeenAt?: string;
  createdAt: string;
}
export interface Progress {
  userId: string;
  videoId: string;
  progress: number;
  duration: number;
  completed: boolean;
  updatedAt: string;
  mode?: "normal" | "adult";
}
export interface AnalyticsEvent {
  id: string;
  eventName: string;
  eventTime: string;
  userId?: string;
  installId: string;
  sessionId: string;
  platform: "web" | "android" | "ios";
  appVersion: string;
  channel: string;
  videoId?: string;
  value?: number;
  metadata?: Record<string, string | number | boolean>;
}
export interface MediaJob {
  id: string;
  type: "transcode";
  status: "queued" | "processing" | "completed" | "failed";
  adminId: string;
  sourcePath: string;
  originalName: string;
  attempts: number;
  error?: string;
  output?: { playbackUrl: string; thumbnail: string; duration: number; aspectRatio: "portrait" | "landscape"; width: number; height: number };
  createdAt: string;
  updatedAt: string;
}
export interface Database {
  videos: Video[];
  users: User[];
  tags: { id: string; name: string; createdAt: string }[];
  favorites: { userId: string; videoId: string; createdAt: string; mode?: "normal" | "adult" }[];
  progress: Progress[];
  analyticsEvents: AnalyticsEvent[];
  auditLogs: {
    id: string;
    adminId: string;
    action: string;
    targetId: string;
    createdAt: string;
  }[];
  mediaJobs: MediaJob[];
}
