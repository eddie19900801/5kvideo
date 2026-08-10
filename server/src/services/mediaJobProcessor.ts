import fs from "node:fs";
import path from "node:path";
import { config } from "../config.js";
import { mediaJobRepository } from "../db.js";
import { createCover, createHls, inspectMedia } from "../media.js";
import { datedMediaFile } from "./mediaFiles.js";

export async function processNextMediaJob(): Promise<boolean> {
  const job = mediaJobRepository.claimNext();
  if (!job) return false;
  try {
    const source = path.resolve(job.sourcePath);
    if (!source.startsWith(`${config.mediaDir}${path.sep}`) || !fs.existsSync(source)) throw new Error("媒体任务源文件不存在");
    const info = await inspectMedia(source);
    const cover = datedMediaFile("cover.jpg", ".jpg");
    await createCover(source, cover.absolute);
    const playlist = await createHls(source);
    const relativePlaylist = path.relative(config.mediaDir, playlist).split(path.sep).join("/");
    const publicOrigin = (process.env.MEDIA_PUBLIC_ORIGIN || `http://localhost:${config.port}`).replace(/\/$/, "");
    mediaJobRepository.complete(job.id, {
      playbackUrl: `${publicOrigin}/media/${relativePlaylist}`,
      thumbnail: `${publicOrigin}/media/${cover.relative}`,
      duration: info.duration,
      aspectRatio: info.aspectRatio,
      width: info.width,
      height: info.height,
    });
    fs.rmSync(source, { force: true });
  } catch (error) {
    mediaJobRepository.fail(job.id, error instanceof Error ? error.message : "媒体处理失败");
  }
  return true;
}
