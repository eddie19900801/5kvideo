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
  highlights?: { id: string; time: number; slot: number; image: string; source: "auto" | "manual"; createdAt: string }[];
  highlightStatus?: "idle" | "processing" | "ready" | "failed";
  highlightError?: string;
  highlightTimes?: number[];
  categoryIds?: string[];
  views: number;
  aspectRatio: "landscape" | "portrait";
  isAdult: boolean;
  status: VideoStatus;
  createdAt: string;
  sourceType?: "local" | "external";
  externalSource?: {
    sourceKey: string;
    remoteId: string;
    remoteUpdatedAt?: string;
    importedAt: string;
  };
  trimStart?: number;
  trimEnd?: number;
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
export interface TrafficChannel {
  id: string;
  code: string;
  name: string;
  createdAt: string;
}
export interface ProductLine {
  id: string;
  name: string;
  slug: string;
  domain: string;
  domains: string[];
  landingDomain: string;
  landingDomains: string[];
  landingPage: null;
  packageName: string;
  iconUrl: string;
  themeColor: string;
  recommendationCategoryIds: string[];
  recommendationKeywords: string[];
  /** @deprecated Retained only to read old product records. */
  recommendationVideoIds: string[];
  recommendationStrategy: "stable" | "shuffle";
  status: "draft" | "active" | "disabled";
  version: number;
  publishedConfig?: {
    name: string;
    domain: string;
    domains: string[];
    landingDomain: string;
    landingDomains: string[];
    landingPage: null;
    packageName: string;
    iconUrl: string;
    themeColor: string;
    recommendationCategoryIds: string[];
    recommendationKeywords: string[];
    recommendationVideoIds: string[];
    recommendationStrategy: "stable" | "shuffle";
  };
  publishedAt?: string;
  deployment?: {
    status: "queued" | "checking" | "ready" | "failed";
    dnsReady: boolean;
    tlsReady: boolean;
    frontendReady: boolean;
    runtimeReady: boolean;
    packagesReady: boolean;
    checkedAt?: string;
    error?: string;
  };
  createdAt: string;
  updatedAt: string;
}
export interface CollectorSource {
  id: string;
  key: string;
  name: string;
  endpoint: string;
  fallbackEndpoint?: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
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
  categories: { id: string; name: string; createdAt: string }[];
  favorites: { userId: string; videoId: string; createdAt: string; mode?: "normal" | "adult" }[];
  progress: Progress[];
  analyticsEvents: AnalyticsEvent[];
  channels: TrafficChannel[];
  productLines: ProductLine[];
  productDomains: string[];
  collectorSources: CollectorSource[];
  auditLogs: {
    id: string;
    adminId: string;
    action: string;
    targetId: string;
    createdAt: string;
  }[];
  mediaJobs: MediaJob[];
}
