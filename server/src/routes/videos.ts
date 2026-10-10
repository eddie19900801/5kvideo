import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { optionalAuthenticate, type AuthRequest } from '../auth.js';
import { interactionRepository, videoRepository } from '../db.js';
import { ok } from '../http.js';
import { r2ObjectKey, requestApiBase, requestOrigin, signedPlaybackUrl, signedR2Url, sourceMediaPath, validPlaybackSignature, videoForRequest } from '../services/playback.js';
import type { Video } from '../types.js';
import { playbackIssueRateLimit } from '../middleware/rateLimit.js';
import { browserCoverKey, encryptedR2ObjectKey, reencryptCoverForBrowser } from '../services/encryptedCover.js';
import { localEncryptedImagePath } from '../services/encryptedImageStorage.js';

export const videosRouter = Router();

videosRouter.get('/cover-assets/client-key', (_req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=86400');
  return ok(res, { key: browserCoverKey() });
});

videosRouter.get('/:id/cover.enc', async (req: AuthRequest, res) => {
  try {
    const video = videoRepository.findById(String(req.params.id));
    const key = video && encryptedR2ObjectKey(video.thumbnail);
    if (!video || !key || (video.status !== 'published' && req.auth?.role !== 'admin')) return res.status(404).end();
    const response = await fetch(signedR2Url('GET', key, Date.now() + 5 * 60_000));
    if (!response.ok) return res.status(response.status).end();
    const encrypted = reencryptCoverForBrowser(Buffer.from(await response.arrayBuffer()));
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Cache-Control', 'private, max-age=300');
    return res.send(encrypted);
  } catch {
    return res.status(422).end();
  }
});

videosRouter.get('/:id/highlights/:highlightId/image.enc', async (req: AuthRequest, res) => {
  try {
    const video=videoRepository.findById(String(req.params.id)),highlight=video?.highlights?.find(item=>item.id===String(req.params.highlightId));
    const key=highlight&&encryptedR2ObjectKey(highlight.image),local=highlight&&localEncryptedImagePath(highlight.image);
    if(!video||!highlight||(!key&&!local)||(video.status!=='published'&&req.auth?.role!=='admin'))return res.status(404).end();
    let stored:Buffer;if(local){if(!fs.existsSync(local))return res.status(404).end();stored=fs.readFileSync(local)}else{const response=await fetch(signedR2Url('GET',key!,Date.now()+5*60_000));if(!response.ok)return res.status(response.status).end();stored=Buffer.from(await response.arrayBuffer())}
    const encrypted=reencryptCoverForBrowser(stored);
    res.setHeader('Content-Type','application/octet-stream');res.setHeader('Cache-Control','private, max-age=300');return res.send(encrypted);
  }catch{return res.status(422).end()}
});

videosRouter.get('/', playbackIssueRateLimit, optionalAuthenticate, (req: AuthRequest, res) => {
  const q = String(req.query.q || '').toLowerCase();
  const tag = String(req.query.tag || '');
  const includeAdult = req.query.adult === 'true';
  const videos = videoRepository.list();
  let rows = videos.filter(video => video.status === 'published' && (includeAdult || !video.isAdult));
  if (q) rows = rows.filter(video => `${video.title} ${video.description} ${video.tags.join(' ')}`.toLowerCase().includes(q));
  if (tag) rows = rows.filter(video => video.tags.includes(tag));
  if (!q && !tag) {
    const interactions = interactionRepository.forUser(req.auth?.id);
    const affinity = new Map<string, number>();
    const progressByVideo = new Map(interactions.progress.map(item => [item.videoId, item]));
    for (const favorite of interactions.favorites) {
      const video = videos.find(item => item.id === favorite.videoId);
      for (const name of video?.tags || []) affinity.set(name, (affinity.get(name) || 0) + 4);
    }
    for (const watched of progressByVideo.values()) {
      const video = videos.find(item => item.id === watched.videoId);
      const ratio = Math.min(1, watched.progress / watched.duration);
      for (const name of video?.tags || []) affinity.set(name, (affinity.get(name) || 0) + ratio * 2);
    }
    const now = Date.now();
    const scored = rows.map(video => {
      const ageDays = Math.max(0, (now - new Date(video.createdAt).getTime()) / 86_400_000);
      const freshness = 4 * Math.exp(-ageDays / 30);
      const popularity = Math.log1p(video.views || 0) * 1.5;
      const preference = video.tags.reduce((sum, name) => sum + (affinity.get(name) || 0), 0);
      const watched = progressByVideo.get(video.id);
      const ratio = watched ? Math.min(1, watched.progress / watched.duration) : 0;
      return { video, score: freshness + popularity + preference - (watched?.completed ? 7 : ratio * 3) };
    }).sort((a, b) => b.score - a.score);
    const selected: Video[] = [];
    const recentTags = new Map<string, number>();
    while (scored.length) {
      let best = 0;
      let bestScore = -Infinity;
      for (let index = 0; index < scored.length; index++) {
        const penalty = scored[index].video.tags.reduce((sum, name) => sum + (recentTags.get(name) || 0) * 1.5, 0);
        if (scored[index].score - penalty > bestScore) { bestScore = scored[index].score - penalty; best = index; }
      }
      const [{ video }] = scored.splice(best, 1);
      selected.push(video);
      for (const [name, count] of recentTags) recentTags.set(name, count * 0.65);
      for (const name of video.tags) recentTags.set(name, (recentTags.get(name) || 0) + 1);
    }
    rows = selected;
  }
  return ok(res, rows.map(video => videoForRequest(req, video)));
});

videosRouter.get('/:id', playbackIssueRateLimit, (req: AuthRequest, res) => {
  const video = videoRepository.findPublishedById(String(req.params.id));
  if (!video) return res.status(404).json({ error: { code: 'NOT_FOUND', message: '视频不存在' } });
  return ok(res, videoForRequest(req, video));
});

videosRouter.get('/:id/playback', playbackIssueRateLimit, (req: AuthRequest, res) => {
  const video = videoRepository.findPublishedById(String(req.params.id));
  if (!video) return res.status(404).json({ error: { code: 'NOT_FOUND', message: '视频不存在' } });
  return ok(res, { url: signedPlaybackUrl(req, video.id, video.playbackUrl, video.isAdult, undefined, video.sourceType === 'external'), type: video.playbackUrl.includes('.m3u8') ? 'hls' : 'mp4', expiresAt: new Date(Date.now() + 20 * 60_000).toISOString() });
});

videosRouter.get('/:id/stream.mp4', (req: AuthRequest, res) => {
  const id = String(req.params.id), expires = Number(req.query.expires), signature = String(req.query.signature || '');
  const video = videoRepository.findById(id);
  if (!video || !validPlaybackSignature(req, video, expires, signature)) return res.status(403).json({ error: { code: 'PLAYBACK_FORBIDDEN', message: '播放地址无效或已过期' } });
  const source = sourceMediaPath(video.playbackUrl);
  if (!source || !fs.existsSync(source) || !source.endsWith('.mp4')) return res.status(404).end();
  res.setHeader('Cache-Control', 'private, max-age=300');
  return res.sendFile(source);
});

videosRouter.get('/:id/stream.m3u8', async (req: AuthRequest, res) => {
  const id = String(req.params.id), expires = Number(req.query.expires), signature = String(req.query.signature || '');
  const video = videoRepository.findById(id);
  if (!video || !validPlaybackSignature(req, video, expires, signature)) return res.status(403).json({ error: { code: 'PLAYBACK_FORBIDDEN', message: '播放地址无效或已过期' } });
  const r2MasterKey = r2ObjectKey(video.playbackUrl);
  if (r2MasterKey) {
    const root = path.posix.dirname(r2MasterKey), requested = String(req.query.path || path.posix.basename(r2MasterKey)), key = path.posix.normalize(path.posix.join(root, requested));
    if (!key.startsWith(`${root}/`) || !key.endsWith('.m3u8')) return res.status(403).end();
    const workerExpires = Date.now() + 10 * 60_000;
    const response = await fetch(signedR2Url('GET', key, workerExpires));
    if (!response.ok) return res.status(response.status).end();
    const playlist = (await response.text()).split(/\r?\n/).map(line => {
      if (!line || line.startsWith('#')) return line;
      const childKey = path.posix.normalize(path.posix.join(path.posix.dirname(key), line));
      if (!childKey.startsWith(`${root}/`)) return '';
      const purpose = req.query.purpose === 'cover' ? '&purpose=cover' : '';
      const access = `expires=${expires}&viewer=${encodeURIComponent(String(req.query.viewer))}&mode=${encodeURIComponent(String(req.query.mode))}${purpose}&signature=${signature}`;
      if (childKey.endsWith('.m3u8')) return `${requestApiBase(req)}/videos/${id}/stream.m3u8?${access}&path=${encodeURIComponent(path.posix.relative(root, childKey))}`;
      return `${requestApiBase(req)}/videos/${id}/segment/${encodeURIComponent(path.posix.basename(childKey))}?${access}&path=${encodeURIComponent(path.posix.relative(root, childKey))}`;
    }).join('\n');
    res.type('application/vnd.apple.mpegurl').setHeader('Cache-Control', 'private, max-age=60');
    return res.send(playlist);
  }
  const source = sourceMediaPath(video.playbackUrl);
  if (!source || !fs.existsSync(source) || !source.endsWith('.m3u8')) return res.status(404).end();
  const purpose = req.query.purpose === 'cover' ? '&purpose=cover' : '';
  const access = `expires=${expires}&viewer=${encodeURIComponent(String(req.query.viewer))}&mode=${encodeURIComponent(String(req.query.mode))}${purpose}&signature=${signature}`;
  const playlist = fs.readFileSync(source, 'utf8').split(/\r?\n/).map(line => line && !line.startsWith('#') ? `${requestApiBase(req)}/videos/${id}/segment/${encodeURIComponent(path.basename(line))}?${access}` : line).join('\n');
  res.type('application/vnd.apple.mpegurl').setHeader('Cache-Control', 'private, max-age=60');
  return res.send(playlist);
});

videosRouter.get('/:id/segment/:name', async (req: AuthRequest, res) => {
  const id = String(req.params.id), expires = Number(req.query.expires), signature = String(req.query.signature || '');
  const video = videoRepository.findById(id);
  if (!video || !validPlaybackSignature(req, video, expires, signature)) return res.status(403).end();
  const r2MasterKey = r2ObjectKey(video.playbackUrl);
  if (r2MasterKey) {
    const root = path.posix.dirname(r2MasterKey), relative = String(req.query.path || ''), key = path.posix.normalize(path.posix.join(root, relative));
    if (!relative || !key.startsWith(`${root}/`) || !/\.(?:ts|m4s|mp4)$/.test(key)) return res.status(403).end();
    const response = await fetch(signedR2Url('GET', key, Date.now() + 60_000));
    if (!response.ok || !response.body) return res.status(response.status).end();
    res.type(key.endsWith('.ts') ? 'video/mp2t' : 'video/mp4').setHeader('Cache-Control', 'private, max-age=60');
    if (response.headers.get('content-length')) res.setHeader('Content-Length', response.headers.get('content-length')!);
    const body = response.body;
    Readable.from((async function* () {
      const reader = body.getReader();
      try {
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          yield Buffer.from(chunk.value);
        }
      } finally {
        reader.releaseLock();
      }
    })()).pipe(res);
    return;
  }
  const playlist = sourceMediaPath(video.playbackUrl), name = path.basename(String(req.params.name));
  if (!playlist || !playlist.endsWith('.m3u8') || !/^(?:segment-\d+\.(?:ts|m4s)|init\.mp4)$/.test(name)) return res.status(403).end();
  const segment = path.join(path.dirname(playlist), name);
  if (!fs.existsSync(segment)) return res.status(404).end();
  res.type(name.endsWith('.ts') ? 'video/mp2t' : 'video/mp4').setHeader('Cache-Control', 'private, max-age=300');
  return res.sendFile(segment);
});
