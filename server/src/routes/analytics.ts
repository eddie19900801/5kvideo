import { randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { adminOnly, authenticate, type AuthRequest } from "../auth.js";
import { databaseRepository } from "../db.js";
import { ok } from "../http.js";
import { analyticsRateLimit } from "../middleware/rateLimit.js";
import type { AnalyticsEvent } from "../types.js";

export const analyticsRouter = Router();

analyticsRouter.post("/analytics/events", analyticsRateLimit, authenticate, (req: AuthRequest, res) => {
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
  databaseRepository.transaction((db) => {
    for (const item of parsed.data.events) db.analyticsEvents.push({ id: randomUUID(), eventTime, userId: req.auth!.id, ...item });
    const cutoff = Date.now() - 400 * 86400000;
    db.analyticsEvents = db.analyticsEvents.filter((item) => new Date(item.eventTime).getTime() >= cutoff).slice(-500000);
  });
  ok(res, { accepted: parsed.data.events.length });
});

analyticsRouter.get("/admin/analytics", authenticate, adminOnly, (req, res) => {
  const days = Math.max(7, Math.min(365, Number(req.query.days) || 30));
  const db = databaseRepository.read(), now = new Date(), start = new Date(now.getTime() - (days - 1) * 86400000);
  const dateKey = (date: Date | string) => new Date(date).toISOString().slice(0, 10);
  const dates = Array.from({ length: days }, (_, index) => dateKey(new Date(start.getTime() + index * 86400000)));
  const events = db.analyticsEvents.filter((event) => new Date(event.eventTime) >= start);
  const identity = (event: AnalyticsEvent) => event.userId || event.installId;
  const byName = (name: string) => events.filter((event) => event.eventName === name);
  const unique = (rows: AnalyticsEvent[]) => new Set(rows.map(identity)).size;
  const daily = dates.map((date) => {
    const rows = events.filter((event) => dateKey(event.eventTime) === date), active = unique(rows);
    return { date, activeUsers: active, newUsers: unique(rows.filter((event) => event.eventName === "app_open" && event.metadata?.firstOpen === true)), sessions: new Set(rows.map((event) => event.sessionId)).size, videoImpressions: rows.filter((event) => event.eventName === "video_impression").length, plays: rows.filter((event) => event.eventName === "video_play").length, effectivePlays: rows.filter((event) => event.eventName === "video_effective").length, watchSeconds: Math.round(rows.filter((event) => event.eventName === "watch_time").reduce((sum, event) => sum + (event.value || 0), 0)), favorites: rows.filter((event) => event.eventName === "favorite_add").length, shares: rows.filter((event) => event.eventName.startsWith("share_")).length, playbackFailures: rows.filter((event) => event.eventName === "playback_error").length };
  });
  const videoMap = new Map<string, { videoId: string; title: string; impressions: number; plays: number; effectivePlays: number; completions: number; watchSeconds: number; favorites: number; shares: number }>();
  for (const event of events) if (event.videoId) { const video = db.videos.find((item) => item.id === event.videoId), row = videoMap.get(event.videoId) || { videoId: event.videoId, title: video?.title || "已删除视频", impressions: 0, plays: 0, effectivePlays: 0, completions: 0, watchSeconds: 0, favorites: 0, shares: 0 }; if (event.eventName === "video_impression") row.impressions++; if (event.eventName === "video_play") row.plays++; if (event.eventName === "video_effective") row.effectivePlays++; if (event.eventName === "video_complete") row.completions++; if (event.eventName === "watch_time") row.watchSeconds += event.value || 0; if (event.eventName === "favorite_add") row.favorites++; if (event.eventName.startsWith("share_")) row.shares++; videoMap.set(event.videoId, row); }
  const videoStats = [...videoMap.values()].map((row) => ({ ...row, ctr: row.impressions ? Number((row.plays / row.impressions * 100).toFixed(2)) : 0, completionRate: row.plays ? Number((row.completions / row.plays * 100).toFixed(2)) : 0, averageWatchSeconds: row.plays ? Math.round(row.watchSeconds / row.plays) : 0 })).sort((a, b) => b.plays - a.plays);
  const allEvents = db.analyticsEvents, firstSeen = new Map<string, string>(), activeDates = new Map<string, Set<string>>();
  for (const event of allEvents) { const id = identity(event), date = dateKey(event.eventTime); if (!firstSeen.has(id) || date < firstSeen.get(id)!) firstSeen.set(id, date); if (!activeDates.has(id)) activeDates.set(id, new Set()); activeDates.get(id)!.add(date); }
  const retention = [1, 3, 7, 14, 30].map((offset) => { const eligible = [...firstSeen].filter(([, date]) => new Date(date).getTime() <= now.getTime() - offset * 86400000), retained = eligible.filter(([id, date]) => activeDates.get(id)?.has(dateKey(new Date(new Date(date).getTime() + offset * 86400000)))).length; return { day: offset, users: eligible.length, retained, rate: eligible.length ? Number((retained / eligible.length * 100).toFixed(2)) : 0 }; });
  const startup = byName("playback_startup").map((event) => event.value || 0), buffering = byName("buffering").map((event) => event.value || 0);
  ok(res, { days, overview: { activeUsers: unique(events), sessions: new Set(events.map((event) => event.sessionId)).size, newUsers: daily.reduce((sum, row) => sum + row.newUsers, 0), registeredUsers: db.users.filter((user) => !user.isGuest && user.role === "user").length, guestUsers: db.users.filter((user) => user.isGuest && user.role === "user").length, impressions: byName("video_impression").length, plays: byName("video_play").length, effectivePlays: byName("video_effective").length, totalWatchSeconds: Math.round(byName("watch_time").reduce((sum, event) => sum + (event.value || 0), 0)), favorites: byName("favorite_add").length, shares: events.filter((event) => event.eventName.startsWith("share_")).length }, daily, retention, videos: videoStats, quality: { averageStartupMs: startup.length ? Math.round(startup.reduce((a, b) => a + b, 0) / startup.length) : 0, startupSamples: startup.length, bufferingCount: buffering.length, bufferingSeconds: Math.round(buffering.reduce((a, b) => a + b, 0)), playbackErrors: byName("playback_error").length, completionRate: byName("video_play").length ? Number((byName("video_complete").length / byName("video_play").length * 100).toFixed(2)) : 0 }, platforms: ["web", "android", "ios"].map((platform) => ({ platform, users: unique(events.filter((event) => event.platform === platform)), events: events.filter((event) => event.platform === platform).length })) });
});
