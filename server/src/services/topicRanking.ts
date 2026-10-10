import type { AnalyticsEvent, Video } from '../types.js';

const day = 86400000;
export function crowdScores(events: AnalyticsEvent[], now = Date.now()) {
  type Row = { device: string; video: string; impressions: boolean; effective: boolean; favorite: boolean; hidden: boolean; watch: number; ratio: number; time: number };
  const rows = new Map<string, Row>();
  const relevant = new Set(['video_impression', 'video_effective', 'favorite_add', 'favorite_remove', 'recommendation_hide', 'recommendation_restore', 'recommendation_watch', 'recommendation_restore_all']);
  for (const event of [...events].filter(event => relevant.has(event.eventName) && Date.parse(event.eventTime) >= now - 7 * day && Date.parse(event.eventTime) <= now).sort((a,b) => a.eventTime.localeCompare(b.eventTime))) {
    if (!event.installId) continue;
    if (event.eventName === 'recommendation_restore_all') { for (const row of rows.values()) if (row.device === event.installId) row.hidden = false; continue; }
    if (!event.videoId) continue;
    const key = JSON.stringify([event.installId, event.videoId]);
    const row = rows.get(key) || { device: event.installId, video: event.videoId, impressions: false, effective: false, favorite: false, hidden: false, watch: 0, ratio: 0, time: 0 };
    if (event.eventName === 'video_impression') row.impressions = true;
    if (event.eventName === 'video_effective' && event.metadata?.measurement === 'watch_seconds_v2') row.effective = true;
    if (event.eventName === 'favorite_add') row.favorite = true;
    if (event.eventName === 'favorite_remove') row.favorite = false;
    if (event.eventName === 'recommendation_hide') row.hidden = true;
    if (event.eventName === 'recommendation_restore') row.hidden = false;
    if (event.eventName === 'recommendation_watch' && event.metadata?.measurement === 'watch_seconds_v3') {
      const seconds = Math.max(0, Math.min(Number(event.value) || 0, 1800));
      const duration = Number(event.metadata.duration) || 0;
      row.watch = Math.max(row.watch, seconds);
      row.ratio = Math.max(row.ratio, duration > 1 ? Math.min(seconds / duration, 1) : 0);
      if (seconds >= 10) row.effective = true;
    }
    row.time = Math.max(row.time, Date.parse(event.eventTime)); rows.set(key, row);
  }
  const totals = new Map<string, { devices: number; engaged: number; exposures: number; positive: number; negative: number }>();
  for (const row of rows.values()) {
    const total = totals.get(row.video) || { devices: 0, engaged: 0, exposures: 0, positive: 0, negative: 0 };
    const decay = Math.pow(0.5, (now - row.time) / (3 * day));
    total.devices++;
    if (!row.hidden && (row.effective || row.favorite)) total.engaged++;
    total.exposures += decay;
    // One device contributes at most once per video during the window. Implicit exposure includes a genuine action.
    total.positive += decay * (row.hidden ? 0 : Math.min(1, (row.effective ? .35 : 0) + (row.favorite ? .45 : 0) + .2 * row.ratio));
    total.negative += decay * Number(row.hidden);
    totals.set(row.video, total);
  }
  return new Map([...totals].map(([id, row]) => [id, { eligible: row.devices >= 5 && row.engaged >= 3, score: Math.max(0, (row.positive - row.negative + 1) / (row.exposures + 10)) }]));
}

export function buildTopics(videos: Video[], taxonomy: { categories: { id: string; name: string }[]; assignments: Record<string, string> }, events: AnalyticsEvent[], now = Date.now()) {
  const scores = crowdScores(events, now), grouped = new Map<string, Video[]>();
  const id = (video: Video) => video.externalSource?.remoteId || video.id;
  const known = new Set<string>();
  for (const video of videos) {
    if (known.has(id(video))) continue; known.add(id(video));
    const category = taxonomy.assignments[id(video)];
    if (!category) continue;
    const rows = grouped.get(category) || []; rows.push(video); grouped.set(category, rows);
  }
  const imported = (video: Video) => Date.parse(video.externalSource?.importedAt || video.createdAt) || 0;
  return { version: 'interest-v1', generatedAt: new Date(now).toISOString(), topics: taxonomy.categories.flatMap(category => {
    const rows = grouped.get(category.id) || [];
    if (rows.length < 3) return [];
    const popular = rows.filter(video => scores.get(id(video))?.eligible).sort((a,b) => scores.get(id(b))!.score - scores.get(id(a))!.score || id(a).localeCompare(id(b)));
    const recent = [...rows].sort((a,b) => imported(b) - imported(a) || id(a).localeCompare(id(b)));
    // Keep both popular and recent candidates; do not send user identities or raw event counts to clients.
    const candidates = [...new Map([...popular.slice(0, 10), ...recent.slice(0, 14)].map(video => [id(video), video])).values()];
    return [{ id: category.id, name: category.name === '网曝门' ? '吃瓜' : category.name,
      crowdReady: popular.length >= 3, crowdScore: popular.length >= 3 ? popular.slice(0,3).reduce((sum,video)=>sum + scores.get(id(video))!.score,0)/3 : 0,
      videos: candidates.map(video => ({ id: id(video), title: video.title, thumbnail: video.thumbnail,
        duration: video.duration >= 70 ? video.duration - 60 : video.duration, views: video.views, tags: video.tags,
        category: category.name, updatedAt: video.externalSource?.remoteUpdatedAt || video.createdAt, aspectRatio: video.aspectRatio,
        crowdScore: scores.get(id(video))?.eligible ? scores.get(id(video))!.score : 0, importedAt: new Date(imported(video)).toISOString() })) }];
  }) };
}
