import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { Video } from "../types.js";

export type CollectorCategory = { id: string; name: string; createdAt: string };
type Taxonomy = { version: 1; initialized: boolean; categories: CollectorCategory[]; assignments: Record<string, string> };

const dataDirectory = path.dirname(path.resolve(process.env.DATA_FILE || "./data/db.json"));
const taxonomyFile = path.join(dataDirectory, "collected-taxonomy.json");
let cache: { mtime: number; value: Taxonomy } | undefined;

const sourceCategory = (video: Video) => video.tags.find(tag => tag !== "采集视频")?.trim() || "其他";
const remoteId = (video: Video) => video.externalSource?.remoteId || video.id;

function write(value: Taxonomy) {
  fs.mkdirSync(dataDirectory, { recursive: true });
  const temporary = `${taxonomyFile}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(value), "utf8");
  fs.renameSync(temporary, taxonomyFile);
  cache = undefined;
}

function load(): Taxonomy {
  if (!fs.existsSync(taxonomyFile)) return { version: 1, initialized: false, categories: [], assignments: {} };
  const mtime = fs.statSync(taxonomyFile).mtimeMs;
  if (cache?.mtime === mtime) return structuredClone(cache.value);
  const parsed = JSON.parse(fs.readFileSync(taxonomyFile, "utf8")) as Partial<Taxonomy>;
  const value: Taxonomy = {
    version: 1,
    initialized: parsed.initialized === true,
    categories: Array.isArray(parsed.categories) ? parsed.categories : [],
    assignments: parsed.assignments && typeof parsed.assignments === "object" ? parsed.assignments : {},
  };
  cache = { mtime, value };
  return structuredClone(value);
}

export function collectorTaxonomy(videos: Video[]) {
  const value = load();
  if (!value.initialized) {
    const byName = new Map<string, CollectorCategory>();
    for (const video of videos) {
      const name = sourceCategory(video);
      let category = byName.get(name);
      if (!category) {
        category = { id: randomUUID(), name, createdAt: new Date().toISOString() };
        byName.set(name, category);
        value.categories.push(category);
      }
      value.assignments[remoteId(video)] = category.id;
    }
    value.initialized = true;
    write(value);
  } else {
    const byName = new Map(value.categories.map(item => [item.name, item.id]));
    let changed = false;
    for (const video of videos) {
      const id = remoteId(video);
      if (value.assignments[id]) continue;
      const categoryId = byName.get(sourceCategory(video));
      if (categoryId) { value.assignments[id] = categoryId; changed = true; }
    }
    if (changed) write(value);
  }
  return value;
}

export function createCollectorCategory(videos: Video[], name: string) {
  const value = collectorTaxonomy(videos);
  if (value.categories.some(item => item.name.toLocaleLowerCase() === name.toLocaleLowerCase())) return null;
  const created = { id: randomUUID(), name, createdAt: new Date().toISOString() };
  value.categories.push(created); write(value); return created;
}

export function renameCollectorCategory(videos: Video[], id: string, name: string) {
  const value = collectorTaxonomy(videos);
  if (value.categories.some(item => item.id !== id && item.name.toLocaleLowerCase() === name.toLocaleLowerCase())) return "exists" as const;
  const item = value.categories.find(category => category.id === id);
  if (!item) return null;
  item.name = name; write(value); return item;
}

export function deleteCollectorCategory(videos: Video[], id: string) {
  const value = collectorTaxonomy(videos);
  if (!value.categories.some(item => item.id === id)) return false;
  value.categories = value.categories.filter(item => item.id !== id);
  for (const [videoId, categoryId] of Object.entries(value.assignments)) if (categoryId === id) delete value.assignments[videoId];
  write(value); return true;
}

export function assignCollectorCategory(videos: Video[], ids: string[], categoryId: string | null) {
  const value = collectorTaxonomy(videos);
  if (categoryId && !value.categories.some(item => item.id === categoryId)) return false;
  const valid = new Set(videos.map(remoteId));
  for (const id of ids) if (valid.has(id)) categoryId ? value.assignments[id] = categoryId : delete value.assignments[id];
  write(value); return true;
}
