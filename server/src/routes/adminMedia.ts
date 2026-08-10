import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { adminOnly, authenticate, type AuthRequest } from '../auth.js';
import { config } from '../config.js';
import { videoRepository } from '../db.js';
import { ok } from '../http.js';
import { createCandidateFrames, createRemoteCandidateFrames, extractFrame } from '../media.js';
import { mediaUpload } from '../middleware/uploads.js';
import { datedMediaFile } from '../services/mediaFiles.js';
import { r2ObjectKey, requestOrigin, signedPlaybackUrl, sourceMediaPath } from '../services/playback.js';
import { permanentlyDeleteVideo, replaceVideoCover } from '../services/mediaLifecycle.js';
import type { Video } from '../types.js';

export const adminMediaRouter = Router();
adminMediaRouter.use(authenticate, adminOnly);

function mediaSource(req: Parameters<typeof signedPlaybackUrl>[0], video: Video) {
  const local = sourceMediaPath(video.playbackUrl);
  return { local, source: local && fs.existsSync(local) ? local : r2ObjectKey(video.playbackUrl) ? signedPlaybackUrl(req, video.id, video.playbackUrl) : null };
}

adminMediaRouter.get('/videos/:id/cover-assets', async (req, res) => {
  try {
    const video = videoRepository.findById(String(req.params.id));
    if (!video) return res.status(404).json({ error: { code: 'NOT_FOUND', message: '视频不存在' } });
    const { local, source } = mediaSource(req, video);
    if (!source) return res.status(404).json({ error: { code: 'MEDIA_NOT_FOUND', message: '视频文件不存在' } });
    const directory = local ? path.join(path.dirname(local), 'cover-assets') : path.join(config.mediaDir, 'cover-assets', video.id);
    const assetUrl = (file: string) => `${requestOrigin(req)}/media/${path.relative(config.mediaDir, file).split(path.sep).join('/')}?v=${Math.trunc(fs.statSync(file).mtimeMs)}`;
    if (!local) {
      const candidates = await createRemoteCandidateFrames(source, directory, req.query.refresh === '1');
      const captures = fs.readdirSync(directory).filter(name => /^capture-.*\.jpe?g$/i.test(name)).map(name => path.join(directory, name));
      return ok(res, [...candidates.map(assetUrl), ...captures.map(assetUrl)]);
    }
    const files = await createCandidateFrames(source, directory, video.duration, req.query.refresh === '1');
    return ok(res, files.map(assetUrl));
  } catch (error) {
    return res.status(422).json({ error: { code: 'FRAME_FAILED', message: error instanceof Error ? error.message : '候选画面生成失败' } });
  }
});

adminMediaRouter.post('/videos/:id/cover-assets/capture', async (req, res) => {
  const input = z.object({ time: z.number().min(0) }).strict().safeParse(req.body);
  if (!input.success) return res.status(400).json({ error: { code: 'INVALID_TIME', message: '截取时间无效' } });
  try {
    const video = videoRepository.findById(String(req.params.id));
    if (!video) return res.status(404).json({ error: { code: 'NOT_FOUND', message: '视频不存在' } });
    const { local, source } = mediaSource(req, video);
    if (!source) return res.status(404).json({ error: { code: 'MEDIA_NOT_FOUND', message: '视频文件不存在' } });
    const directory = local ? path.join(path.dirname(local), 'cover-assets') : path.join(config.mediaDir, 'cover-assets', video.id);
    fs.mkdirSync(directory, { recursive: true });
    const file = path.join(directory, `capture-${Date.now()}-${randomUUID().slice(0, 6)}.jpg`);
    await extractFrame(source, file, Math.min(input.data.time, video.duration));
    return ok(res, { url: `${requestOrigin(req)}/media/${path.relative(config.mediaDir, file).split(path.sep).join('/')}` });
  } catch (error) {
    return res.status(422).json({ error: { code: 'FRAME_FAILED', message: error instanceof Error ? error.message : '画面截取失败' } });
  }
});

adminMediaRouter.post('/videos/:id/cover', mediaUpload.single('cover'), (req: AuthRequest, res) => {
  if (!req.file || !req.file.mimetype.startsWith('image/')) {
    if (req.file) fs.rmSync(req.file.path, { force: true });
    return res.status(400).json({ error: { code: 'COVER_REQUIRED', message: '请提交封面图片' } });
  }
  const video = videoRepository.findById(String(req.params.id));
  if (!video) { fs.rmSync(req.file.path, { force: true }); return res.status(404).json({ error: { code: 'NOT_FOUND', message: '视频不存在' } }); }
  const cover = datedMediaFile('cover-editor.jpg', '.jpg');
  const thumbnail = `${requestOrigin(req)}/media/${cover.relative}`;
  if (!replaceVideoCover(video.id, req.file.path, cover.absolute, thumbnail, req.auth!.id))
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: '视频不存在' } });
  return ok(res, { thumbnail });
});

adminMediaRouter.delete('/videos/:id/permanent', (req: AuthRequest, res) => {
  const videoId = String(req.params.id);
  const video = videoRepository.findById(videoId);
  if (!video) return res.status(404).json({ error: { code: 'NOT_FOUND', message: '视频不存在' } });
  const recoverableFrom = permanentlyDeleteVideo(video, req.auth!.id);
  return ok(res, { deleted: true, recoverableFrom });
});
