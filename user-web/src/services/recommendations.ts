import type { VideoSummary } from "@/types";
import type { FavoriteItem, HistoryItem } from "./library";

const normalize = (value: string) => value.trim().toLocaleLowerCase();

// Rank only the candidates already returned by the backend. This keeps product-line
// recommendation rules authoritative while making the generic shuffled feed relevant
// to the interests stored on this device.
export function personalize(items: VideoSummary[], history: HistoryItem[], favorites: FavoriteItem[], hidden: VideoSummary[]) {
  const blocked = new Set(hidden.map(item => item.id));
  const seen = new Set(history.filter(item => item.completed || item.progress >= 10).map(item => item.id));
  const categoryWeight = new Map<string, number>();
  const tagWeight = new Map<string, number>();
  const addSignals = (item: VideoSummary, weight: number) => {
    const category = normalize(item.category);
    if (category) categoryWeight.set(category, (categoryWeight.get(category) || 0) + weight);
    for (const rawTag of item.tags || []) {
      const tag = normalize(rawTag);
      if (tag) tagWeight.set(tag, (tagWeight.get(tag) || 0) + weight);
    }
  };
  history.slice(0, 40).forEach((item, index) => addSignals(item, Math.max(1, 4 - Math.floor(index / 10))));
  favorites.slice(0, 40).forEach(item => addSignals(item, 6));

  return items
    .map((item, index) => ({
      item,
      index,
      score: (categoryWeight.get(normalize(item.category)) || 0) * 3
        + (item.tags || []).reduce((sum, tag) => sum + (tagWeight.get(normalize(tag)) || 0), 0)
        - (seen.has(item.id) ? 1000 : 0),
    }))
    .filter(entry => !blocked.has(entry.item.id))
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map(entry => entry.item);
}
