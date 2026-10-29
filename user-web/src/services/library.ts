import { analytics } from "./analytics";
import type { VideoSummary } from "@/types";
import { guestApi } from "./guest";

export type HistoryItem = VideoSummary & {
  progress: number;
  watchedAt: number;
  completed?: boolean;
};
export type FavoriteItem = VideoSummary & { groupId?: string };
export type FavoriteGroup = { id: string; name: string };
const groupsKey = "5knews_favorite_groups_v1", hiddenKey = "5knews_hidden_v1";
const preferenceEvent = "5knews-preference-change";

const favoriteKey = "5knews_favorites_v1",
  historyKey = "5knews_history_v1",
  changeEvent = "5knews-library-change";

const read = <T>(key: string): T[] => {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
};
const write = (key: string, value: unknown[]) => {
  localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new Event(changeEvent));
};

export const library = {
  event: changeEvent,
  favorites: () => read<FavoriteItem>(favoriteKey),
  groups: () => read<FavoriteGroup>(groupsKey),
  saveGroup(name: string, id?: string) {
    const normalized = name.trim(), groups = read<FavoriteGroup>(groupsKey);
    if (!normalized || normalized.length > 20) throw new Error("分组名称为 1–20 个字");
    if (groups.some(group => group.id !== id && group.name.toLocaleLowerCase() === normalized.toLocaleLowerCase())) throw new Error("分组名称已存在");
    if (id && !groups.some(group => group.id === id)) throw new Error("分组不存在");
    if (!id && groups.length >= 30) throw new Error("最多创建 30 个分组");
    const group = { id: id || crypto.randomUUID(), name: normalized };
    write(groupsKey, id ? groups.map(item => item.id === id ? group : item) : [...groups, group]);
    return group;
  },
  deleteGroup(id: string) {
    write(favoriteKey, read<FavoriteItem>(favoriteKey).map(item => item.groupId === id ? { ...item, groupId: undefined } : item));
    write(groupsKey, read<FavoriteGroup>(groupsKey).filter(group => group.id !== id));
  },
  assignGroup(ids: string[], groupId: string) {
    if (groupId && !read<FavoriteGroup>(groupsKey).some(group => group.id === groupId)) throw new Error("分组不存在");
    const selected = new Set(ids);
    write(favoriteKey, read<FavoriteItem>(favoriteKey).map(item => selected.has(item.id) ? { ...item, groupId: groupId || undefined } : item));
  },
  preferenceEvent,
  hidden: () => read<VideoSummary>(hiddenKey),
  hide(video: VideoSummary) {
    const items = read<VideoSummary>(hiddenKey);
    if (!items.some(item => item.id === video.id) && items.length >= 500) throw new Error("不感兴趣记录已满，请先到个人中心整理");
    write(hiddenKey, [video, ...items.filter(item => item.id !== video.id)]);
    window.dispatchEvent(new window.CustomEvent(preferenceEvent, { detail: { hiddenId: video.id } }));
  },
  restoreHidden(id: string) {
    analytics.track("recommendation_restore", { videoId: id });
    write(hiddenKey, read<VideoSummary>(hiddenKey).filter(item => item.id !== id));
    window.dispatchEvent(new window.CustomEvent(preferenceEvent));
  },
  restoreAllHidden() {
    analytics.track("recommendation_restore_all");
    write(hiddenKey, []);
    window.dispatchEvent(new window.CustomEvent(preferenceEvent));
  },
  isFavorite: (id: string) =>
    read<VideoSummary>(favoriteKey).some((item) => item.id === id),
  toggleFavorite(video: VideoSummary) {
    const items = read<VideoSummary>(favoriteKey),
      exists = items.some((item) => item.id === video.id),
      next = exists
        ? items.filter((item) => item.id !== video.id)
        : [video, ...items].slice(0, 500);
    write(favoriteKey, next);
    void guestApi.favorite(video.id, !exists).catch(() => {});
    return !exists;
  },
  clearFavorites() {
    const items = read<VideoSummary>(favoriteKey);
    write(favoriteKey, []);
    for (const item of items)
      void guestApi.favorite(item.id, false).catch(() => {});
  },
  history: () => read<HistoryItem>(historyKey),
  progress: (id: string) => {
    const item = read<HistoryItem>(historyKey).find(item => item.id === id);
    return item && !item.completed ? item.progress : 0;
  },
  continuing: () => read<HistoryItem>(historyKey).filter(item => !item.completed && item.progress >= 5 && item.duration > item.progress + 5),
  complete(video: VideoSummary) { library.record(video, video.duration, true); },
  record(video: VideoSummary, progress = 0, completed = false) {
    const items = read<HistoryItem>(historyKey),
      entry: HistoryItem = {
        ...video,
        progress: Math.min(Math.max(0, Number.isFinite(progress) ? progress : 0), Math.max(0, video.duration)),
        completed,
        watchedAt: Date.now(),
      };
    write(
      historyKey,
      [entry, ...items.filter((item) => item.id !== video.id)].slice(0, 200),
    );
    if (progress > 0)
      void guestApi
        .progress(video.id, progress, video.duration)
        .catch(() => {});
  },
  removeHistory(id: string) {
    write(
      historyKey,
      read<HistoryItem>(historyKey).filter((item) => item.id !== id),
    );
    void guestApi.removeProgress(id).catch(() => {});
  },
  clearHistory() {
    write(historyKey, []);
    void guestApi.clearHistory().catch(() => {});
  },
};
