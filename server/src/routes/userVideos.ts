import { Router } from 'express';
import { z } from 'zod';
import { authenticate, type AuthRequest } from '../auth.js';
import { contentMode } from '../contentMode.js';
import { interactionRepository } from '../db.js';
import { ok } from '../http.js';
import { viewRateLimit } from '../middleware/rateLimit.js';

export const userVideosRouter = Router();

userVideosRouter.post('/:id/view', viewRateLimit, authenticate, (req: AuthRequest, res) => {
  const videoId = String(req.params.id);
  const views = interactionRepository.recordView(videoId, req.auth!.id, req.auth!.role);
  return ok(res, { counted: true, views });
});

userVideosRouter.put('/:id/favorite', authenticate, (req: AuthRequest, res) => {
  const videoId = String(req.params.id);
  const mode = contentMode(req.body?.mode);
  interactionRepository.setFavorite(req.auth!.id, videoId, mode, true);
  return ok(res, { favorited: true });
});

userVideosRouter.delete('/:id/favorite', authenticate, (req: AuthRequest, res) => {
  const mode = contentMode(req.query.mode);
  interactionRepository.setFavorite(req.auth!.id, String(req.params.id), mode, false);
  return ok(res, { favorited: false });
});

userVideosRouter.put('/:id/progress', authenticate, (req: AuthRequest, res) => {
  const videoId = String(req.params.id);
  const input = z.object({ progress: z.number().min(0), duration: z.number().positive(), mode: z.enum(['normal', 'adult']).default('normal') }).strict().safeParse(req.body);
  if (!input.success) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: '播放进度无效' } });
  interactionRepository.saveProgress(req.auth!.id, videoId, input.data.progress, input.data.duration, input.data.mode);
  return ok(res, { saved: true });
});

userVideosRouter.delete('/:id/progress', authenticate, (req: AuthRequest, res) => {
  const mode = contentMode(req.query.mode);
  interactionRepository.deleteProgress(req.auth!.id, String(req.params.id), mode);
  return ok(res, { deleted: true });
});
