import { isIP } from "node:net";
import type { Request } from "express";

function normalize(value: unknown) {
  const candidate = String(value || "").split(",", 1)[0].trim().replace(/^\[|\]$/g, "");
  const withoutMappedPrefix = candidate.startsWith("::ffff:") ? candidate.slice(7) : candidate;
  return isIP(withoutMappedPrefix) ? withoutMappedPrefix : "";
}

/**
 * Public traffic reaches the API through the product-site Nginx and the
 * middle-platform Apache proxy. Both are controlled infrastructure; the edge
 * writes X-Real-IP and Apache preserves it. Header values are accepted only
 * after strict IP validation and never returned to public clients.
 */
export function clientIpFromRequest(req: Request) {
  const candidates = [
    req.get("cf-connecting-ip"),
    req.get("x-real-ip"),
    req.get("x-forwarded-for"),
    req.ip,
    req.socket.remoteAddress,
  ];
  for (const value of candidates) {
    const ip = normalize(value);
    if (ip) return ip;
  }
  return "unknown";
}

