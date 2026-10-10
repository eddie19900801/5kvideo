import { createHmac, timingSafeEqual } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { Request } from 'express';
import type { AuthRequest } from '../auth.js';
import { requestPlaybackViewer } from '../middleware/playbackAccess.js';
import { config } from '../config.js';
import type { Video } from '../types.js';
import { encryptedR2ObjectKey } from './encryptedCover.js';

export const normalizeSeconds = (value: number) => Math.round(value * 1000) / 1000;

export function requestOrigin(req: Request) {
  const host = req.get('host') || 'localhost';
  const forwarded = String(req.headers['x-forwarded-proto'] || '').split(',')[0];
  const protocol = forwarded || (host === '5k.ag' || host.endsWith('.5k.ag') ? 'https' : req.protocol);
  return `${protocol}://${host}`;
}

export function requestApiBase(req: Request) {
  const raw = String(req.headers['x-forwarded-prefix'] || '').split(',')[0].replace(/\/$/, '');
  const prefix = /^\/[a-zA-Z0-9/_-]*$/.test(raw) ? raw : '';
  return `${requestOrigin(req)}${prefix}/api/v1`;
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

function playbackSignature(id: string, expires: number, viewer: string, mode: 'normal' | 'adult') {
  return createHmac('sha256', config.playbackSecret).update(`${id}:${expires}:${viewer}:${mode}`).digest('hex');
}

export function validPlaybackSignature(req: AuthRequest, video: Video, expires: number, signature: string) {
  if (!Number.isFinite(expires) || expires < Date.now() || expires > Date.now() + 3_600_000) return false;
  const viewer = String(req.query.viewer || ''), mode = String(req.query.mode || '');
  const coverExtraction = req.query.purpose === 'cover' && viewer === `cover:${video.id}`;
  if (!viewer || (!coverExtraction && viewer !== requestPlaybackViewer(req)) || mode !== (video.isAdult ? 'adult' : 'normal')) return false;
  const expected = playbackSignature(video.id, expires, viewer, mode);
  try { return timingSafeEqual(Buffer.from(expected), Buffer.from(signature)); } catch { return false; }
}

export function signedPlaybackUrl(req: AuthRequest, id: string, source: string, isAdult = false, purpose?: 'cover', directExternal = false) {
  if (directExternal && /^https:\/\//i.test(source)) return source;
  const expires = Date.now() + 20 * 60_000;
  const extension = source.includes('.m3u8') ? 'm3u8' : 'mp4';
  const viewer = purpose === 'cover' ? `cover:${id}` : requestPlaybackViewer(req), mode = isAdult ? 'adult' : 'normal';
  const purposeQuery = purpose ? `&purpose=${purpose}` : '';
  return `${requestApiBase(req)}/videos/${id}/stream.${extension}?expires=${expires}&viewer=${encodeURIComponent(viewer)}&mode=${mode}${purposeQuery}&signature=${playbackSignature(id, expires, viewer, mode)}`;
}

export function videoForRequest(req: AuthRequest, video: Video): Video {
  const origin = requestOrigin(req);
  const thumbnailKey = r2ObjectKey(video.thumbnail);
  const thumbnailExpires = Date.now() + 20 * 60_000;
  const trimmed = video.sourceType === 'external' && video.duration >= 70;
  return {
    ...video,
    duration: normalizeSeconds(trimmed ? video.duration - 60 : video.duration),
    trimStart: trimmed ? 30 : 0,
    trimEnd: trimmed ? 30 : 0,
    highlights: video.highlights?.map(item=>({...item,image:`${requestApiBase(req)}/videos/${video.id}/highlights/${item.id}/image.enc`})),
    thumbnail: encryptedR2ObjectKey(video.thumbnail)
      ? `${requestApiBase(req)}/videos/${video.id}/cover.enc?v=${createHmac('sha256', config.playbackSecret).update(video.thumbnail).digest('hex').slice(0, 12)}`
      : thumbnailKey ? signedR2Url('GET', thumbnailKey, thumbnailExpires) : video.thumbnail.replace(/^https?:\/\/(localhost|127\.0\.0\.1):4000/, origin),
    playbackUrl: signedPlaybackUrl(req, video.id, video.playbackUrl, video.isAdult, undefined, video.sourceType === 'external'),
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
