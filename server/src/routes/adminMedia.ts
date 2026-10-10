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
import { r2ObjectKey, requestOrigin, signedPlaybackUrl, signedR2Url, sourceMediaPath, videoForRequest } from '../services/playback.js';
import { permanentlyDeleteVideo } from '../services/mediaLifecycle.js';
import { encryptCoverForStorage } from '../services/encryptedCover.js';
import { generateMissingHighlights, highlightCountForDuration, highlightGenerationRunning } from '../services/highlightGenerator.js';
import type { Video } from '../types.js';

export const adminMediaRouter = Router();
adminMediaRouter.use(authenticate, adminOnly);

function mediaSource(req: Parameters<typeof signedPlaybackUrl>[0], video: Video) {
  const local = sourceMediaPath(video.playbackUrl);
  return { local, source: video.sourceType==='external'?video.playbackUrl:local && fs.existsSync(local) ? local : r2ObjectKey(video.playbackUrl) ? signedPlaybackUrl(req, video.id, video.playbackUrl, video.isAdult, 'cover') : null };
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

const highlightResponse=(req:AuthRequest,video:Video)=>({status:highlightGenerationRunning(video.id)?'processing':(video.highlightStatus||'idle'),error:video.highlightError,items:(video.highlights||[]).sort((a,b)=>a.slot-b.slot).map(item=>({...item,image:`${requestOrigin(req)}${String(req.headers['x-forwarded-prefix']||'').replace(/\/$/,'')}/api/v1/videos/${video.id}/highlights/${item.id}/image.enc`}))});

adminMediaRouter.get('/videos/:id/highlights',(req:AuthRequest,res)=>{
  const video=videoRepository.findById(String(req.params.id));if(!video)return res.status(404).json({error:{code:'NOT_FOUND',message:'视频不存在'}});
  const effectiveDuration=video.sourceType==='external'&&video.duration>=70?video.duration-60:video.duration;
  if((video.highlights?.length||0)<highlightCountForDuration(effectiveDuration)&&!highlightGenerationRunning(video.id)){const {source}=mediaSource(req,video);if(source)generateMissingHighlights(video.id,source,req.auth!.id)}
  return ok(res,highlightResponse(req,videoRepository.findById(video.id)!));
});

adminMediaRouter.post('/videos/:id/highlights/regenerate',(req:AuthRequest,res)=>{
  const video=videoRepository.findById(String(req.params.id));if(!video)return res.status(404).json({error:{code:'NOT_FOUND',message:'视频不存在'}});const {source}=mediaSource(req,video);if(!source)return res.status(404).json({error:{code:'MEDIA_NOT_FOUND',message:'视频文件不存在'}});
  generateMissingHighlights(video.id,source,req.auth!.id,true);return res.status(202).json({data:highlightResponse(req,videoRepository.findById(video.id)!)});
});

adminMediaRouter.delete('/videos/:id/highlights/:highlightId',(req:AuthRequest,res)=>{
  const video=videoRepository.findById(String(req.params.id));if(!video)return res.status(404).json({error:{code:'NOT_FOUND',message:'视频不存在'}});const target=video.highlights?.find(item=>item.id===String(req.params.highlightId));if(!target)return res.status(404).json({error:{code:'NOT_FOUND',message:'精彩截图不存在'}});
  videoRepository.update(video.id,{highlights:(video.highlights||[]).filter(item=>item.id!==target.id),highlightStatus:'processing'},req.auth!.id);const {source}=mediaSource(req,video);if(source)generateMissingHighlights(video.id,source,req.auth!.id);return ok(res,{deleted:true,replacing:!!source});
});

adminMediaRouter.post('/videos/:id/cover', mediaUpload.single('cover'), async (req: AuthRequest, res) => {
  if (!req.file || !req.file.mimetype.startsWith('image/')) {
    if (req.file) fs.rmSync(req.file.path, { force: true });
    return res.status(400).json({ error: { code: 'COVER_REQUIRED', message: '请提交封面图片' } });
  }
  const video = videoRepository.findById(String(req.params.id));
  if (!video) { fs.rmSync(req.file.path, { force: true }); return res.status(404).json({ error: { code: 'NOT_FOUND', message: '视频不存在' } }); }
  try {
    const encrypted = encryptCoverForStorage(fs.readFileSync(req.file.path), req.file.mimetype);
    const date = new Date().toISOString().slice(0, 10).replaceAll('-', '/');
    const key = `videos/${date}/${video.id}/covers/${randomUUID()}.enc`;
    const contentType = 'application/octet-stream';
    const response = await fetch(signedR2Url('PUT', key, Date.now() + 15 * 60_000, encrypted.length, contentType), {
      method: 'PUT', headers: { 'Content-Type': contentType, 'Content-Length': String(encrypted.length) }, body: encrypted,
    });
    if (!response.ok) throw new Error(`R2 上传失败（HTTP ${response.status}）`);
    const stored = `r2enc://${config.r2Bucket}/${key}`;
    const updated = videoRepository.updateThumbnail(video.id, stored, req.auth!.id);
    if (!updated) return res.status(404).json({ error: { code: 'NOT_FOUND', message: '视频不存在' } });
    return ok(res, { thumbnail: videoForRequest(req, updated).thumbnail });
  } catch (error) {
    return res.status(502).json({ error: { code: 'COVER_UPLOAD_FAILED', message: error instanceof Error ? error.message : '加密封面上传失败' } });
  } finally {
    fs.rmSync(req.file.path, { force: true });
  }
});

adminMediaRouter.delete('/videos/:id/permanent', (req: AuthRequest, res) => {
  const videoId = String(req.params.id);
  const video = videoRepository.findById(videoId);
  if (!video) return res.status(404).json({ error: { code: 'NOT_FOUND', message: '视频不存在' } });
  const recoverableFrom = permanentlyDeleteVideo(video, req.auth!.id);
  return ok(res, { deleted: true, recoverableFrom });
});
