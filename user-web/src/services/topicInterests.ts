import type { VideoSummary } from "@/types";
import { library } from "./library";

const key = "5knews_topic_interests_v1", month = 30 * 86400000;
export const interestEvent = "5knews-interest-change";
type View = { video: VideoSummary; seconds: number; visit: string; at: number };
type Preferences = { views: View[]; searches: { text: string; at: number }[]; reduced: { id: string; at: number }[] };
export function interests(): Preferences {
  try {
    const data = JSON.parse(localStorage.getItem(key) || "null"), cutoff = Date.now() - month;
    return { views: (data?.views || []).filter((item: View) => item.at > cutoff), searches: (data?.searches || []).filter((item: { at: number }) => item.at > cutoff), reduced: (data?.reduced || []).filter((item: { at: number }) => item.at > cutoff) };
  } catch { return { views: [], searches: [], reduced: [] }; }
}
function save(data: Preferences) {
  try { localStorage.setItem(key, JSON.stringify(data)); window.dispatchEvent(new Event(interestEvent)); } catch { /* The feed remains usable without local storage. */ }
}
export const topicInterests = {
  watch(video: VideoSummary, seconds: number, visit: string) {
    if (!Number.isFinite(seconds) || seconds < 10) return;
    const data = interests(), prior = data.views.find(item => item.visit === visit && item.video.id === video.id);
    data.views = [{ video, seconds: Math.max(prior?.seconds || 0, Math.min(seconds, 1800)), visit, at: Date.now() }, ...data.views.filter(item => item.visit !== visit || item.video.id !== video.id)].slice(0, 200); save(data);
  },
  search(text: string) {
    text = text.trim().slice(0, 100); if (!text) return;
    const data = interests(); data.searches = [{ text, at: Date.now() }, ...data.searches.filter(item => item.text !== text)].slice(0, 20); save(data);
  },
  reduce(id: string) { const data = interests(); data.reduced = [{ id, at: Date.now() }, ...data.reduced.filter(item => item.id !== id)].slice(0, 100); save(data); },
  restore() { const data = interests(); data.reduced = []; save(data); },
  reset() { save({ views: [], searches: [], reduced: [] }); },
};

export type TopicCandidate = { id: string; name: string; crowdReady: boolean; crowdScore: number; videos: (VideoSummary & { crowdScore: number; importedAt: string })[] };
const normalize = (text: string) => text.trim().toLocaleLowerCase().replace("网曝门", "吃瓜");
const tokens = (video: VideoSummary) => [video.category, ...video.tags].map(normalize).filter(value => value && !["推荐", "精选", "采集视频"].includes(value));
export function rankTopics(candidates: TopicCandidate[], seed: number) {
  const data = interests(), favorites = library.favorites(), hidden = library.hidden(), weights = new Map<string, number>();
  const add = (video: VideoSummary, score: number) => { for (const token of new Set(tokens(video))) weights.set(token, (weights.get(token) || 0) + score); };
  for (const video of favorites) add(video, 3);
  // Per-video caps keep repeated visits from overwhelming the profile. Position/seek history is not used as interest evidence.
  const watched = new Map<string, { video: VideoSummary; score: number }>();
  for (const view of data.views) {
    const decay = Math.pow(.5, (Date.now() - view.at) / (7 * 86400000));
    const score = decay * (Math.min(view.seconds / 60, 1) + (view.video.duration > 1 ? Math.min(view.seconds / view.video.duration, 1) : 0));
    watched.set(view.video.id, { video: view.video, score: Math.min(4, (watched.get(view.video.id)?.score || 0) + score) });
  }
  for (const row of watched.values()) add(row.video, row.score);
  for (const video of hidden) add(video, -.75);
  const blocked = new Set(hidden.map(video => video.id)), reduced = new Set(data.reduced.map(item => item.id));
  const seen = new Set(library.history().filter(item => item.completed || item.progress >= 10).map(item => item.id));
  const affinity = (video: VideoSummary) => Math.max(0, tokens(video).reduce((sum, token) => sum + Math.max(-2, weights.get(token) || 0), 0)
    + data.searches.reduce((sum, search) => sum + (normalize(`${video.title} ${video.category} ${video.tags.join(" ")}`).includes(normalize(search.text)) ? 2 * Math.pow(.5, (Date.now() - search.at) / (7 * 86400000)) : 0), 0));
  const evidence = new Set([...favorites.map(video => video.id), ...watched.keys()]).size + data.searches.length;
  const personalWeight = evidence >= 5 ? .65 : evidence > 0 ? .3 : 0;
  const rows = candidates.filter(topic => !reduced.has(topic.id)).map(topic => {
    const videos = topic.videos.filter(video => !blocked.has(video.id));
    const match = videos.length ? Math.max(...videos.map(affinity)) : 0;
    const score = personalWeight * Math.min(match / 10, 1) + (1 - personalWeight) * topic.crowdScore;
    const ranked = [...videos].sort((a,b) => Number(seen.has(a.id)) - Number(seen.has(b.id)) || (personalWeight * Math.min(affinity(b)/10,1) + (1-personalWeight)*b.crowdScore) - (personalWeight * Math.min(affinity(a)/10,1) + (1-personalWeight)*a.crowdScore) || Date.parse(b.importedAt) - Date.parse(a.importedAt));
    return { ...topic, title: `${topic.name} · 视频推荐`, videos: ranked, score, reason: match > 0 && personalWeight ? "根据你的收藏、搜索和有效观看" : topic.crowdReady ? "根据近期全站观看与收藏" : "分类与新内容推荐" };
  }).filter(topic => topic.videos.length >= 3);
  // Rotate ties for new visitors; reserve every fifth position for a different topic.
  const hash = (id: string) => [...id].reduce((value, char) => Math.imul(value ^ char.charCodeAt(0), 16777619), seed) >>> 0;
  rows.sort((a,b) => b.score - a.score || hash(a.id) - hash(b.id));
  const result: typeof rows = [];
  while (rows.length) {
    const explore = result.length % 5 === 4;
    const item = rows.splice(explore ? rows.length - 1 : 0, 1)[0];
    result.push(explore ? { ...item, reason: "发现一个不同的主题" } : item);
  }
  return result;
}
