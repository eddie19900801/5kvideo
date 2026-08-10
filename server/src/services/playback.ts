import { createHmac, timingSafeEqual } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { Request } from 'express';
import { config } from '../config.js';
import type { Video } from '../types.js';

export const normalizeSeconds = (value: number) => Math.round(value * 1000) / 1000;

export function requestOrigin(req: Request) {
  const host = req.get('host') || 'localhost';
  const forwarded = String(req.headers['x-forwarded-proto'] || '').split(',')[0];
  const protocol = forwarded || (host === '5k.ag' || host.endsWith('.5k.ag') ? 'https' : req.protocol);
  return `${protocol}://${host}`;
}

function r2Signature(method: 'GET' | 'HEAD' | 'PUT', key: string, expires: number, length = 0, contentType = '') {
  return createHmac('sha256', config.r2UploadSecret).update([method, key, expires, length, contentType].join('\n')).digest('hex');
}

export function signedR2Url(method: 'GET' | 'HEAD' | 'PUT', key: string, expires: number, length = 0, contentType = '') {
  const pathname = key.split('/').map(encodeURIComponent).join('/');
  return `${config.r2WorkerOrigin}/${pathname}?expires=${expires}&signature=${r2Signature(method, key, expires, length, contentType)}`;
}

export function r2ObjectKey(source: string) {
  if (!source.startsWith(`r2://${config.r2Bucket}/`)) return null;
  const key = source.slice(`r2://${config.r2Bucket}/`.length);
  return key && !key.includes('..') ? key : null;
}

function playbackSignature(id: string, expires: number) {
  return createHmac('sha256', config.playbackSecret).update(`${id}:${expires}`).digest('hex');
}

export function validPlaybackSignature(id: string, expires: number, signature: string) {
  if (!Number.isFinite(expires) || expires < Date.now() || expires > Date.now() + 3_600_000) return false;
  const expected = playbackSignature(id, expires);
  try { return timingSafeEqual(Buffer.from(expected), Buffer.from(signature)); } catch { return false; }
}

export function signedPlaybackUrl(req: Request, id: string, source: string) {
  const expires = Date.now() + 20 * 60_000;
  const extension = source.includes('.m3u8') ? 'm3u8' : 'mp4';
  return `${requestOrigin(req)}/api/v1/videos/${id}/stream.${extension}?expires=${expires}&signature=${playbackSignature(id, expires)}`;
}

export function videoForRequest(req: Request, video: Video): Video {
  const origin = requestOrigin(req);
  const thumbnailKey = r2ObjectKey(video.thumbnail);
  const thumbnailExpires = Date.now() + 20 * 60_000;
  return {
    ...video,
    duration: normalizeSeconds(video.duration),
    thumbnail: thumbnailKey ? signedR2Url('GET', thumbnailKey, thumbnailExpires) : video.thumbnail.replace(/^https?:\/\/(localhost|127\.0\.0\.1):4000/, origin),
    playbackUrl: signedPlaybackUrl(req, video.id, video.playbackUrl),
  };
}

export function sourceMediaPath(url: string) {
  const pathname = new URL(url).pathname;
  if (!pathname.startsWith('/media/')) return null;
  const absolute = path.resolve(config.mediaDir, ...decodeURIComponent(pathname.slice(7)).split('/'));
  return absolute.startsWith(`${config.mediaDir}${path.sep}`) ? absolute : null;
}

export function localMediaExists(url: string) {
  const source = sourceMediaPath(url);
  return source && fs.existsSync(source) ? source : null;
}

