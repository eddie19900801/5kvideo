import fs from "node:fs";
import { Router } from "express";
import { adminOnly, authenticate, type AuthRequest } from "../auth.js";
import { mediaJobRepository } from "../db.js";
import { ok } from "../http.js";
import { mediaUpload } from "../middleware/uploads.js";
import { datedMediaFile } from "../services/mediaFiles.js";

export const adminMediaJobsRouter = Router();
adminMediaJobsRouter.use(authenticate, adminOnly);

adminMediaJobsRouter.get("/media-jobs", (req: AuthRequest, res) => ok(res, mediaJobRepository.list(req.auth!.id)));

adminMediaJobsRouter.get("/media-jobs/:id", (req: AuthRequest, res) => {
  const job = mediaJobRepository.findById(String(req.params.id));
  if (!job || job.adminId !== req.auth!.id) return res.status(404).json({ error: { code: "JOB_NOT_FOUND", message: "媒体任务不存在" } });
  return ok(res, job);
});

adminMediaJobsRouter.post("/media-jobs/:id/retry", (req: AuthRequest, res) => {
  const existing = mediaJobRepository.findById(String(req.params.id));
  if (!existing || existing.adminId !== req.auth!.id) return res.status(404).json({ error: { code: "JOB_NOT_FOUND", message: "媒体任务不存在" } });
  const job = mediaJobRepository.retry(existing.id);
  if (!job) return res.status(409).json({ error: { code: "JOB_NOT_FAILED", message: "只有失败任务可以重试" } });
  return ok(res, job);
});

adminMediaJobsRouter.post("/videos/upload/async", mediaUpload.single("video"), (req: AuthRequest, res) => {
  if (!req.file) return res.status(400).json({ error: { code: "VIDEO_REQUIRED", message: "请选择视频文件" } });
  const source = datedMediaFile(req.file.originalname, ".mp4");
  try {
    fs.renameSync(req.file.path, source.absolute);
    const job = mediaJobRepository.enqueue({ type: "transcode", adminId: req.auth!.id, sourcePath: source.absolute, originalName: req.file.originalname });
    res.status(202);
    return ok(res, job);
  } catch (error) {
    fs.rmSync(req.file.path, { force: true });
    fs.rmSync(source.absolute, { force: true });
    throw error;
  }
});
