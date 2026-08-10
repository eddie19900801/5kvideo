import fs from "node:fs";
import path from "node:path";
import { config } from "../config.js";
import { videoRepository } from "../db.js";
import type { Video } from "../types.js";

function localMediaPath(url: string): string | undefined {
  try {
    const pathname = new URL(url).pathname;
    if (!pathname.startsWith("/media/")) return undefined;
    const target = path.resolve(config.mediaDir, ...decodeURIComponent(pathname.slice(7)).split("/"));
    return target.startsWith(`${config.mediaDir}${path.sep}`) ? target : undefined;
  } catch {
    return undefined;
  }
}

export function replaceVideoCover(videoId: string, temporaryFile: string, destination: string, thumbnail: string, adminId: string): boolean {
  fs.renameSync(temporaryFile, destination);
  try {
    const updated = videoRepository.updateThumbnail(videoId, thumbnail, adminId);
    if (!updated) { fs.rmSync(destination, { force: true }); return false; }
    return true;
  } catch (error) {
    fs.rmSync(destination, { force: true });
    throw error;
  }
}

export function permanentlyDeleteVideo(video: Video, adminId: string) {
  const trashDir = path.resolve("./data/trash", new Date().toISOString().slice(0, 10), video.id);
  fs.mkdirSync(trashDir, { recursive: true });
  const moved: Array<{ source: string; target: string }> = [];
  try {
    for (const url of [video.playbackUrl, video.thumbnail]) {
      const source = localMediaPath(url);
      if (!source || !fs.existsSync(source)) continue;
      const target = path.join(trashDir, path.basename(source));
      fs.renameSync(source, target);
      moved.push({ source, target });
    }
    const removed = videoRepository.deletePermanent(video.id, adminId);
    if (!removed) throw new Error("视频记录不存在");
    return path.relative(path.resolve("./data"), trashDir);
  } catch (error) {
    for (const item of moved.reverse())
      if (fs.existsSync(item.target)) fs.renameSync(item.target, item.source);
    throw error;
  }
}

export function cleanupStaleUploadTasks(maxAgeMs = 24 * 60 * 60 * 1000): number {
  if (!fs.existsSync(config.chunkDir)) return 0;
  const cutoff = Date.now() - maxAgeMs;
  let removed = 0;
  for (const name of fs.readdirSync(config.chunkDir)) {
    const target = path.join(config.chunkDir, name);
    if (!/^[0-9a-f-]{36}$/.test(name) || !fs.statSync(target).isDirectory()) continue;
    if (fs.statSync(target).mtimeMs < cutoff) { fs.rmSync(target, { recursive: true, force: true }); removed++; }
  }
  return removed;
}
