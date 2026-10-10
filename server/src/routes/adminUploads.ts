import { randomInt, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Router } from "express";
import { z } from "zod";
import { adminOnly, authenticate, type AuthRequest } from "../auth.js";
import { config } from "../config.js";
import { updateDb } from "../db.js";
import { ok } from "../http.js";
import { createCover, createHls, inspectMedia } from "../media.js";
import { chunkUpload, mediaUpload } from "../middleware/uploads.js";
import { datedMediaFile } from "../services/mediaFiles.js";
import {
  normalizeSeconds,
  requestOrigin,
  signedPlaybackUrl,
  signedR2Url,
  videoForRequest,
} from "../services/playback.js";
import { generateMissingHighlights } from "../services/highlightGenerator.js";
import { normalizeTags } from "../services/videoMetadata.js";
import type { Video } from "../types.js";

const uploadMetaSchema = z.object({
  originalName: z.string().min(1).max(500),
  totalChunks: z.number().int().min(1).max(10000),
  adminId: z.string().min(1),
});

type UploadMeta = z.infer<typeof uploadMetaSchema>;

export const adminUploadsRouter = Router();
const { chunkDir, mediaDir, r2Bucket, r2UploadSecret } = config;

adminUploadsRouter.use(authenticate, adminOnly);

function readUploadMeta(uploadId: string): UploadMeta | null {
  if (!/^[0-9a-f-]{36}$/.test(uploadId)) return null;
  const metaFile = path.join(chunkDir, uploadId, "meta.json");
  if (!fs.existsSync(metaFile)) return null;
  const parsed = uploadMetaSchema.safeParse(
    JSON.parse(fs.readFileSync(metaFile, "utf8")),
  );
  return parsed.success ? parsed.data : null;
}

function removeUploadedFiles(files: Express.Multer.File[]) {
  for (const file of files) fs.rmSync(file.path, { force: true });
}

adminUploadsRouter.post("/r2/uploads/prepare", (req, res) => {
  if (!r2UploadSecret)
    return res.status(503).json({
      error: { code: "R2_NOT_CONFIGURED", message: "R2上传尚未配置" },
    });
  const input = z
    .object({
      taskId: z.string().uuid(),
      files: z
        .array(
          z.object({
            relativePath: z.string().min(1).max(300),
            size: z.number().int().min(1).max(32 * 1024 * 1024),
            contentType: z.string().min(1).max(100),
          }),
        )
        .min(1)
        .max(10000),
    })
    .safeParse(req.body);
  if (!input.success)
    return res.status(400).json({
      error: { code: "INVALID_R2_UPLOAD", message: "上传文件清单无效" },
    });
  const now = new Date();
  const prefix = path.posix.join(
    "videos",
    String(now.getFullYear()),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
    input.data.taskId,
  );
  const expires = Date.now() + 60 * 60 * 1000;
  const normalizedFiles = input.data.files.map((file) => ({
    ...file,
    relativePath: path.posix.normalize(file.relativePath.replace(/\\/g, "/")),
  }));
  if (
    normalizedFiles.some(
      (file) =>
        file.relativePath.startsWith("../") ||
        !/^(?:cover\.jpg|master\.m3u8|(?:720p|1080p)\/(?:index\.m3u8|segment-\d+\.ts))$/.test(
          file.relativePath,
        ),
    )
  )
    return res.status(400).json({
      error: { code: "INVALID_R2_PATH", message: "上传文件路径无效" },
    });
  const items = normalizedFiles.map((file) => {
    const key = path.posix.join(prefix, file.relativePath);
    return {
      ...file,
      key,
      url: signedR2Url("PUT", key, expires, file.size, file.contentType),
    };
  });
  return ok(res, { prefix, expiresAt: new Date(expires).toISOString(), items });
});

adminUploadsRouter.post("/r2/uploads/complete", (req: AuthRequest, res) => {
  const input = z
    .object({
      taskId: z.string().uuid(),
      prefix: z.string().regex(/^videos\/\d{4}\/\d{2}\/\d{2}\/[0-9a-f-]{36}$/),
      title: z.string().trim().min(1).max(200),
      description: z.string().max(5000).default(""),
      tags: z.array(z.string().trim().min(1).max(30)).max(50).default([]),
      chapters: z
        .array(
          z.object({
            id: z.string(),
            label: z.string().min(1).max(50),
            time: z.number().min(0),
          }),
        )
        .max(500)
        .default([]),
      highlightTimes:z.array(z.number().min(0)).max(20).default([]),
      categoryIds:z.array(z.string().uuid()).min(1).max(20),
      duration: z.number().positive(),
      aspectRatio: z.enum(["portrait", "landscape"]),
      isAdult: z.boolean(),
      publishDirectly: z.boolean(),
    })
    .safeParse(req.body);
  if (!input.success || !input.data.prefix.endsWith(`/${input.data.taskId}`))
    return res.status(400).json({
      error: { code: "INVALID_R2_COMPLETE", message: "发布资料无效" },
    });
  const now = new Date().toISOString();
  const video: Video = {
    id: input.data.taskId,
    title: input.data.title,
    description: input.data.description,
    tags: normalizeTags(input.data.tags),
    chapters: input.data.chapters,
    highlightTimes: input.data.highlightTimes,
    categoryIds:input.data.categoryIds,
    duration: normalizeSeconds(input.data.duration),
    aspectRatio: input.data.aspectRatio,
    isAdult: input.data.isAdult,
    views: randomInt(18000, 60000),
    status: input.data.publishDirectly ? "published" : "draft",
    playbackUrl: `r2://${r2Bucket}/${input.data.prefix}/master.m3u8`,
    thumbnail: `r2://${r2Bucket}/${input.data.prefix}/cover.jpg`,
    createdAt: now,
  };
  updateDb((db) => {
    const old = db.videos.findIndex((item) => item.id === video.id);
    if (old >= 0)
      db.videos[old] = {
        ...video,
        views: db.videos[old].views,
        createdAt: db.videos[old].createdAt,
      };
    else db.videos.unshift(video);
    for (const name of video.tags)
      if (!db.tags.some((tag) => tag.name.toLowerCase() === name.toLowerCase()))
        db.tags.push({ id: randomUUID(), name, createdAt: now });
    db.auditLogs.push({
      id: randomUUID(),
      adminId: req.auth!.id,
      action: "video.r2.publish",
      targetId: video.id,
      createdAt: now,
    });
  });
  generateMissingHighlights(video.id,signedPlaybackUrl(req,video.id,video.playbackUrl,video.isAdult,'cover'),req.auth!.id);
  return ok(res, videoForRequest(req, video));
});

adminUploadsRouter.post("/videos/upload/init", (req: AuthRequest, res) => {
  const input = uploadMetaSchema.omit({ adminId: true }).safeParse(req.body);
  if (!input.success)
    return res.status(400).json({
      error: { code: "INVALID_UPLOAD", message: "上传参数无效" },
    });
  const uploadId = randomUUID();
  const dir = path.join(chunkDir, uploadId);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "meta.json"),
    JSON.stringify({ ...input.data, adminId: req.auth!.id }),
  );
  return ok(res, { uploadId });
});

adminUploadsRouter.post(
  "/videos/upload/chunk",
  chunkUpload.single("chunk"),
  (req: AuthRequest, res) => {
    const uploadId = String(req.body.uploadId || "");
    const index = Number(req.body.index);
    const meta = readUploadMeta(uploadId);
    if (!req.file || !meta || !Number.isInteger(index) || index < 0 || index >= meta.totalChunks) {
      if (req.file) fs.rmSync(req.file.path, { force: true });
      const missing = !meta && /^[0-9a-f-]{36}$/.test(uploadId);
      return res.status(missing ? 404 : 400).json({
        error: missing
          ? { code: "UPLOAD_NOT_FOUND", message: "上传任务不存在" }
          : { code: "INVALID_CHUNK", message: "分片参数无效" },
      });
    }
    if (meta.adminId !== req.auth!.id) {
      fs.rmSync(req.file.path, { force: true });
      return res.status(403).json({
        error: { code: "UPLOAD_FORBIDDEN", message: "无权操作此上传任务" },
      });
    }
    const part = path.join(chunkDir, uploadId, `${index}.part`);
    fs.rmSync(part, { force: true });
    fs.renameSync(req.file.path, part);
    return ok(res, { received: index });
  },
);

adminUploadsRouter.post(
  "/videos/upload/complete",
  mediaUpload.single("cover"),
  async (req: AuthRequest, res) => {
    const uploadId = String(req.body.uploadId || "");
    const dir = path.join(chunkDir, uploadId);
    let sourcePath: string | undefined;
    try {
      const meta = readUploadMeta(uploadId);
      if (!meta)
        return res.status(404).json({
          error: { code: "UPLOAD_NOT_FOUND", message: "上传任务不存在" },
        });
      if (meta.adminId !== req.auth!.id)
        return res.status(403).json({
          error: { code: "UPLOAD_FORBIDDEN", message: "无权操作此上传任务" },
        });
      const video = datedMediaFile(meta.originalName, ".mp4");
      sourcePath = video.absolute;
      const output = fs.openSync(video.absolute, "w");
      try {
        for (let i = 0; i < meta.totalChunks; i++) {
          const part = path.join(dir, `${i}.part`);
          if (!fs.existsSync(part)) throw new Error(`缺少视频分片 ${i + 1}`);
          fs.writeSync(output, fs.readFileSync(part));
        }
      } finally {
        fs.closeSync(output);
      }
      const info = await inspectMedia(video.absolute);
      let cover: { relative: string; absolute: string };
      if (req.file) {
        cover = datedMediaFile(req.file.originalname, ".jpg");
        fs.renameSync(req.file.path, cover.absolute);
      } else {
        cover = datedMediaFile("cover.jpg", ".jpg");
        await createCover(video.absolute, cover.absolute);
      }
      const playlist = await createHls(video.absolute);
      const hlsRelative = path.relative(mediaDir, playlist).split(path.sep).join("/");
      fs.rmSync(video.absolute, { force: true });
      sourcePath = undefined;
      fs.rmSync(dir, { recursive: true, force: true });
      const origin = requestOrigin(req);
      return ok(res, {
        playbackUrl: `${origin}/media/${hlsRelative}`,
        thumbnail: `${origin}/media/${cover.relative}`,
        duration: info.duration,
        aspectRatio: info.aspectRatio,
        width: info.width,
        height: info.height,
        originalName: meta.originalName,
      });
    } catch (error) {
      if (sourcePath) fs.rmSync(sourcePath, { force: true });
      if (req.file) fs.rmSync(req.file.path, { force: true });
      return res.status(422).json({
        error: {
          code: "MEDIA_INVALID",
          message: error instanceof Error ? error.message : "无法识别视频",
        },
      });
    }
  },
);

adminUploadsRouter.post(
  "/videos/upload",
  mediaUpload.fields([
    { name: "video", maxCount: 1 },
    { name: "cover", maxCount: 1 },
  ]),
  async (req: AuthRequest, res) => {
    const files = (req.files || {}) as Record<string, Express.Multer.File[]>;
    const allFiles = Object.values(files).flat();
    const source = files.video?.[0];
    if (!source) {
      removeUploadedFiles(allFiles);
      return res.status(400).json({
        error: { code: "VIDEO_REQUIRED", message: "请选择视频文件" },
      });
    }
    let sourcePath: string | undefined = source.path;
    try {
      const info = await inspectMedia(source.path);
      const video = datedMediaFile(source.originalname, ".mp4");
      fs.renameSync(source.path, video.absolute);
      sourcePath = video.absolute;
      let cover: { relative: string; absolute: string };
      const customCover = files.cover?.[0];
      if (customCover) {
        cover = datedMediaFile(customCover.originalname, ".jpg");
        fs.renameSync(customCover.path, cover.absolute);
      } else {
        cover = datedMediaFile("cover.jpg", ".jpg");
        await createCover(video.absolute, cover.absolute);
      }
      const playlist = await createHls(video.absolute);
      const hlsRelative = path.relative(mediaDir, playlist).split(path.sep).join("/");
      fs.rmSync(video.absolute, { force: true });
      sourcePath = undefined;
      const origin = requestOrigin(req);
      return ok(res, {
        playbackUrl: `${origin}/media/${hlsRelative}`,
        thumbnail: `${origin}/media/${cover.relative}`,
        duration: info.duration,
        aspectRatio: info.aspectRatio,
        width: info.width,
        height: info.height,
        originalName: source.originalname,
      });
    } catch (error) {
      if (sourcePath) fs.rmSync(sourcePath, { force: true });
      removeUploadedFiles(allFiles.filter((file) => file.path !== sourcePath));
      return res.status(422).json({
        error: {
          code: "MEDIA_INVALID",
          message: error instanceof Error ? error.message : "无法识别视频",
        },
      });
    }
  },
);
