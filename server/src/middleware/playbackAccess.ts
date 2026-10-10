import { createHmac, randomUUID } from "node:crypto";
import type { NextFunction, Response } from "express";
import type { AuthRequest } from "../auth.js";
import { config } from "../config.js";

const cookieName = "playback_viewer";

function cookieValue(req: AuthRequest) {
  const header = req.headers.cookie || "";
  const existing = header.split(";").map((item) => item.trim()).find((item) => item.startsWith(`${cookieName}=`));
  return existing ? decodeURIComponent(existing.slice(cookieName.length + 1)) : undefined;
}

function userViewer(userId: string) {
  return `u.${createHmac("sha256", config.playbackSecret).update(`user:${userId}`).digest("hex").slice(0, 32)}`;
}

export function playbackAccess(req: AuthRequest, res: Response, next: NextFunction) {
  const existing = cookieValue(req);
  const viewer = req.auth?.id ? userViewer(req.auth.id) : existing || `a.${randomUUID()}`;
  req.playbackViewer = viewer;
  if (viewer !== existing) {
    const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
    res.append("Set-Cookie", `${cookieName}=${encodeURIComponent(viewer)}; Path=/api/v1/videos; HttpOnly; SameSite=Lax; Max-Age=604800${secure}`);
  }
  next();
}

export function requestPlaybackViewer(req: AuthRequest) {
  return req.playbackViewer || cookieValue(req) || "";
}
