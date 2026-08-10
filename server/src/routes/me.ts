import { Router } from 'express';
import { z } from 'zod';
import { authenticate, type AuthRequest } from '../auth.js';
import { contentMode } from '../contentMode.js';
import { interactionRepository, userRepository } from '../db.js';
import { publicUser } from '../repositories/user.js';
import { ok } from '../http.js';
import { loginRateLimit } from '../middleware/rateLimit.js';

export const meRouter = Router();
meRouter.use(authenticate);

meRouter.post('/session', (req: AuthRequest, res) => {
  const user = userRepository.touchSession(req.auth!.id, req.auth!.role);
  return ok(res, user ? publicUser(user) : undefined);
});

meRouter.patch('/profile', (req: AuthRequest, res) => {
  const input = z.object({ username: z.string().trim().min(1).max(30) }).strict().safeParse(req.body);
  if (!input.success) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: '昵称格式无效' } });
  const user = userRepository.updateProfile(req.auth!.id, input.data.username);
  if (!user) return res.status(404).json({ error: { code: 'USER_NOT_FOUND', message: '用户不存在' } });
  return ok(res, publicUser(user));
});

meRouter.put('/password', loginRateLimit, (req: AuthRequest, res) => {
  const input = z.object({ oldPassword: z.string().min(6), newPassword: z.string().min(6).max(200) }).strict().safeParse(req.body);
  if (!input.success) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: '密码格式无效' } });
  const outcome = userRepository.changePassword(req.auth!.id, input.data.oldPassword, input.data.newPassword);
  if (outcome === 'missing') return res.status(404).json({ error: { code: 'USER_NOT_FOUND', message: '已绑定用户不存在' } });
  if (outcome === 'invalid') return res.status(400).json({ error: { code: 'INVALID_PASSWORD', message: '原密码错误' } });
  return ok(res, { updated: true });
});

meRouter.get('/favorites', (req: AuthRequest, res) => {
  const mode = contentMode(req.query.mode);
  return ok(res, interactionRepository.favorites(req.auth!.id, mode));
});

meRouter.get('/history', (req: AuthRequest, res) => {
  const mode = contentMode(req.query.mode);
  return ok(res, interactionRepository.history(req.auth!.id, mode));
});

meRouter.delete('/history', (req: AuthRequest, res) => {
  const mode = contentMode(req.query.mode);
  interactionRepository.clearHistory(req.auth!.id, mode);
  return ok(res, { deleted: true });
});
