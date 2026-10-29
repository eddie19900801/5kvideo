import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { Video } from "../types.js";
import { collectorVideoId } from "./collectorIdentity.js";

export type CollectorCategory = { id: string; name: string; createdAt: string };
type Taxonomy = {
  version: 2;
  initialized: boolean;
  categories: CollectorCategory[];
  assignments: Record<string, string>;
  sourceMappings: Record<string, string>;
  ignoredSourceCategories: string[];
};

const dataDirectory = path.dirname(path.resolve(process.env.DATA_FILE || "./data/db.json"));
const taxonomyFile = path.join(dataDirectory, "collected-taxonomy.json");
let cache: { mtime: number; value: Taxonomy } | undefined;
let resolvedCache: { videos: Video[]; mtime: number; value: Taxonomy } | undefined;

const sourceCategory = (video: Video) => video.tags.find(tag => tag !== "采集视频")?.trim() || "其他";
const remoteId = collectorVideoId;

function write(value: Taxonomy) {
  fs.mkdirSync(dataDirectory, { recursive: true });
  const temporary = `${taxonomyFile}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(value), "utf8");
  fs.renameSync(temporary, taxonomyFile);
  cache = undefined;
  resolvedCache = undefined;
}

function load(): Taxonomy {
  if (!fs.existsSync(taxonomyFile)) return { version: 2, initialized: false, categories: [], assignments: {}, sourceMappings: {}, ignoredSourceCategories: [] };
  const mtime = fs.statSync(taxonomyFile).mtimeMs;
  if (cache?.mtime === mtime) return cache.value;
  const parsed = JSON.parse(fs.readFileSync(taxonomyFile, "utf8")) as Partial<Taxonomy>;
  const value: Taxonomy = {
    version: 2,
    initialized: parsed.initialized === true,
    categories: Array.isArray(parsed.categories) ? parsed.categories : [],
    assignments: parsed.assignments && typeof parsed.assignments === "object" ? parsed.assignments : {},
    sourceMappings: parsed.sourceMappings && typeof parsed.sourceMappings === "object" ? parsed.sourceMappings : {},
    ignoredSourceCategories: Array.isArray(parsed.ignoredSourceCategories) ? parsed.ignoredSourceCategories : [],
  };
  cache = { mtime, value };
  return value;
}

export function collectorTaxonomy(videos: Video[]) {
  const mtime = fs.existsSync(taxonomyFile) ? fs.statSync(taxonomyFile).mtimeMs : 0;
  if (resolvedCache?.videos === videos && resolvedCache.mtime === mtime)
    return resolvedCache.value;
  const value = load();
  // The common read path already has one assignment per catalog item. Avoid
  // walking the entire catalog merely to prove that no taxonomy work is due.
  if (value.initialized && Object.keys(value.assignments).length >= videos.length) {
    resolvedCache = { videos, mtime, value };
    return value;
  }
  const categoryIds = new Set(value.categories.map(item => item.id));
  const byName = new Map(value.categories.map(item => [item.name.toLocaleLowerCase(), item.id]));
  const ignored = new Set(value.ignoredSourceCategories);
  let changed = !value.initialized;

  // Upgrade old taxonomy data by learning which managed category each source category
  // was previously assigned to. The mapping survives later renames and merges.
  const votes = new Map<string, Map<string, number>>();
  for (const video of videos) {
    const name = sourceCategory(video), assigned = value.assignments[remoteId(video)];
    if (!assigned || !categoryIds.has(assigned) || value.sourceMappings[name]) continue;
    const counts = votes.get(name) || new Map<string, number>();
    counts.set(assigned, (counts.get(assigned) || 0) + 1); votes.set(name, counts);
  }
  for (const [name, counts] of votes) {
    const winner = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0];
    if (winner) { value.sourceMappings[name] = winner; changed = true; }
  }

  for (const video of videos) {
    const id = remoteId(video), name = sourceCategory(video);
    if (value.assignments[id] && categoryIds.has(value.assignments[id])) continue;
    if (ignored.has(name)) continue;
    let categoryId: string | undefined = value.sourceMappings[name];
    if (!categoryId || !categoryIds.has(categoryId)) {
      categoryId = byName.get(name.toLocaleLowerCase());
      if (!categoryId) {
        const created = { id: randomUUID(), name, createdAt: new Date().toISOString() };
        value.categories.push(created); categoryIds.add(created.id);
        byName.set(name.toLocaleLowerCase(), created.id); categoryId = created.id;
      }
      value.sourceMappings[name] = categoryId; changed = true;
    }
    value.assignments[id] = categoryId; changed = true;
  }
  value.initialized = true;
  if (changed) write(value);
  resolvedCache = {
    videos,
    mtime: fs.existsSync(taxonomyFile) ? fs.statSync(taxonomyFile).mtimeMs : 0,
    value,
  };
  return value;
}

export function createCollectorCategory(videos: Video[], name: string) {
  const value = collectorTaxonomy(videos);
  if (value.categories.some(item => item.name.toLocaleLowerCase() === name.toLocaleLowerCase())) return null;
  const created = { id: randomUUID(), name, createdAt: new Date().toISOString() };
  value.categories.push(created);
  value.ignoredSourceCategories = value.ignoredSourceCategories.filter(item => item.toLocaleLowerCase() !== name.toLocaleLowerCase());
  write(value); return created;
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
  for (const [sourceName, categoryId] of Object.entries(value.sourceMappings)) if (categoryId === id) {
    delete value.sourceMappings[sourceName];
    if (!value.ignoredSourceCategories.includes(sourceName)) value.ignoredSourceCategories.push(sourceName);
  }
  write(value); return true;
}

export function mergeCollectorCategories(videos: Video[], sourceId: string, targetId: string) {
  const value = collectorTaxonomy(videos);
  if (sourceId === targetId || !value.categories.some(item => item.id === sourceId) || !value.categories.some(item => item.id === targetId)) return false;
  for (const [videoId, categoryId] of Object.entries(value.assignments)) if (categoryId === sourceId) value.assignments[videoId] = targetId;
  for (const [sourceName, categoryId] of Object.entries(value.sourceMappings)) if (categoryId === sourceId) value.sourceMappings[sourceName] = targetId;
  value.categories = value.categories.filter(item => item.id !== sourceId);
  write(value); return true;
}

export function reorderCollectorCategories(videos: Video[], ids: string[]) {
  const value = collectorTaxonomy(videos), existing = new Set(value.categories.map(item => item.id));
  if (ids.length !== existing.size || new Set(ids).size !== ids.length || ids.some(id => !existing.has(id))) return false;
  const byId = new Map(value.categories.map(item => [item.id, item]));
  value.categories = ids.map(id => byId.get(id)!);
  write(value); return true;
}

export function assignCollectorCategory(videos: Video[], ids: string[], categoryId: string | null) {
  const value = collectorTaxonomy(videos);
  if (categoryId && !value.categories.some(item => item.id === categoryId)) return false;
  const valid = new Set(videos.map(remoteId));
  for (const id of ids) if (valid.has(id)) categoryId ? value.assignments[id] = categoryId : delete value.assignments[id];
  write(value); return true;
}
