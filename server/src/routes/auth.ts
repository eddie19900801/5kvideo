import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { authenticate, signToken, type AuthRequest } from '../auth.js';
import { userRepository } from '../db.js';
import { publicUser } from '../repositories/user.js';
import { ok } from '../http.js';
import { guestRateLimit, loginRateLimit } from '../middleware/rateLimit.js';

export const authRouter = Router();

authRouter.post('/guest', guestRateLimit, (_, res) => {
  const user = userRepository.createGuest();
  return ok(res, { user: publicUser(user), token: signToken(user.id, 'user') });
});

authRouter.post('/login', loginRateLimit, (req, res) => {
  const input = z.object({ account: z.string().min(1), password: z.string().min(6) }).strict().safeParse(req.body);
  if (!input.success) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: '账号或密码格式错误' } });
  const user = userRepository.findActiveByAccount(input.data.account);
  if (!user || !bcrypt.compareSync(input.data.password, user.passwordHash)) {
    return res.status(401).json({ error: { code: 'LOGIN_FAILED', message: '账号或密码错误' } });
  }
  return ok(res, { token: signToken(user.id, user.role), user: { id: user.id, account: user.account, username: user.username, role: user.role, isGuest: user.isGuest ?? !user.account } });
});

authRouter.post('/register', authenticate, (req: AuthRequest, res) => {
  const input = z.object({ account: z.string().min(3), password: z.string().min(6).max(200), username: z.string().trim().min(1).max(30).optional() }).strict().safeParse(req.body);
  if (!input.success) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: '账号至少3位，密码至少6位' } });
  const result = userRepository.bindAccount(req.auth!.id, input.data.account, input.data.password, input.data.username);
  if (result.status === 'exists') return res.status(409).json({ error: { code: 'ACCOUNT_EXISTS', message: '该账号已存在' } });
  return ok(res, { token: signToken(result.user.id, 'user'), user: publicUser(result.user) });
});
