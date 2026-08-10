import type { NextFunction, Request, Response } from 'express';

type RateLimitEntry = { count: number; resetAt: number };
type RateLimitOptions = { windowMs: number; max: number; scope: string };

const buckets = new Map<string, RateLimitEntry>();

export function rateLimit(options: RateLimitOptions) {
  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const key = `${options.scope}:${req.ip}`;
    const current = buckets.get(key);
    const entry = !current || current.resetAt <= now
      ? { count: 0, resetAt: now + options.windowMs }
      : current;
    entry.count += 1;
    buckets.set(key, entry);
    res.setHeader('RateLimit-Limit', String(options.max));
    res.setHeader('RateLimit-Remaining', String(Math.max(0, options.max - entry.count)));
    res.setHeader('RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));
    if (entry.count > options.max) {
      res.setHeader('Retry-After', String(Math.max(1, Math.ceil((entry.resetAt - now) / 1000))));
      return res.status(429).json({ error: { code: 'RATE_LIMITED', message: '请求过于频繁，请稍后再试' } });
    }
    next();
  };
}

export const guestRateLimit = rateLimit({ windowMs: 60_000, max: 10, scope: 'guest' });
export const loginRateLimit = rateLimit({ windowMs: 15 * 60_000, max: 10, scope: 'login' });
export const viewRateLimit = rateLimit({ windowMs: 60_000, max: 120, scope: 'view' });
export const analyticsRateLimit = rateLimit({ windowMs: 60_000, max: 60, scope: 'analytics' });

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of buckets) if (entry.resetAt <= now) buckets.delete(key);
}, 5 * 60_000).unref();

