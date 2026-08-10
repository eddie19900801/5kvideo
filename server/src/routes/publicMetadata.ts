import { Router } from "express";
import { databaseRepository } from "../db.js";
import { ok } from "../http.js";

export const publicMetadataRouter = Router();

publicMetadataRouter.get("/tags", (_, res) => {
  const database = databaseRepository.read();
  const names = new Set([
    ...database.tags.map((tag) => tag.name),
    ...database.videos.flatMap((video) => video.tags),
  ]);
  return ok(
    res,
    [...names]
      .map((name) => ({
        name,
        usageCount: database.videos.filter(
          (video) => video.status === "published" && video.tags.includes(name),
        ).length,
      }))
      .sort((a, b) => b.usageCount - a.usageCount || a.name.localeCompare(b.name)),
  );
});

publicMetadataRouter.get("/chapter-tags", (_, res) => {
  const database = databaseRepository.read();
  const counts = new Map<string, number>();
  for (const video of database.videos)
    for (const chapter of video.chapters || []) {
      const name = chapter.label.trim();
      if (name) counts.set(name, (counts.get(name) || 0) + 1);
    }
  return ok(
    res,
    [...counts]
      .map(([name, usageCount]) => ({ name, usageCount }))
      .sort((a, b) => b.usageCount - a.usageCount || a.name.localeCompare(b.name)),
  );
});
