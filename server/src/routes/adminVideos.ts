import { Router } from 'express';
import { randomInt, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { adminOnly, authenticate, type AuthRequest } from '../auth.js';
import { videoRepository } from '../db.js';
import { ok } from '../http.js';
import { normalizeSeconds, videoForRequest } from '../services/playback.js';
import { normalizeTags } from '../services/videoMetadata.js';
import type { Video } from '../types.js';

export const adminVideosRouter = Router();
adminVideosRouter.use(authenticate, adminOnly);

adminVideosRouter.get('/videos', (req, res) => ok(res, videoRepository.list().map(video => videoForRequest(req, video))));
adminVideosRouter.get('/videos/:id', (req, res) => {
  const video = videoRepository.findById(req.params.id);
  if (!video) return res.status(404).json({ error: { code: 'VIDEO_NOT_FOUND', message: '视频不存在' } });
  return ok(res, videoForRequest(req, video));
});

adminVideosRouter.post('/videos', (req: AuthRequest, res) => {
  const input = z.object({
    title: z.string().trim().min(1).max(200), description: z.string().max(5000).default(''),
    thumbnail: z.string().url(), playbackUrl: z.string().url(), duration: z.number().positive(),
    tags: z.array(z.string().max(100)).max(100).default([]), aspectRatio: z.enum(['landscape', 'portrait']).default('landscape'),
    isAdult: z.boolean().default(false), status: z.enum(['draft', 'processing', 'published', 'offline']).default('draft'),
  }).strict().safeParse(req.body);
  if (!input.success) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: '视频资料不完整', details: input.error.flatten() } });
  const video: Video = { id: randomUUID(), views: randomInt(18000, 60000), createdAt: new Date().toISOString(), ...input.data, tags: normalizeTags(input.data.tags), duration: normalizeSeconds(input.data.duration) };
  videoRepository.create(video, req.auth!.id);
  res.status(201);
  return ok(res, video);
});

adminVideosRouter.patch('/videos/:id', (req: AuthRequest, res) => {
  const input = z.object({
    title: z.string().trim().min(1).max(200).optional(), description: z.string().max(5000).optional(), thumbnail: z.string().url().optional(),
    playbackUrl: z.string().url().optional(), duration: z.number().positive().optional(), tags: z.array(z.string().max(100)).max(100).optional(),
    chapters: z.array(z.object({ id: z.string().min(1).max(100), label: z.string().trim().min(1).max(100), time: z.number().min(0) })).max(200).optional(),
    views: z.number().int().min(0).optional(), aspectRatio: z.enum(['landscape', 'portrait']).optional(), isAdult: z.boolean().optional(),
    status: z.enum(['draft', 'processing', 'published', 'offline']).optional(),
  }).strict().safeParse(req.body);
  if (!input.success) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: '视频资料格式无效', details: input.error.flatten() } });
  const updates = { ...input.data };
  if (Array.isArray(updates.tags)) updates.tags = normalizeTags(updates.tags);
  const changed = videoRepository.update(String(req.params.id), updates, req.auth!.id);
  if (!changed) return res.status(404).json({ error: { code: 'NOT_FOUND', message: '视频不存在' } });
  return ok(res, changed);
});

adminVideosRouter.delete('/videos/:id', (req, res) => {
  videoRepository.setStatus(String(req.params.id), 'offline');
  return ok(res, { deleted: true });
});
