import { useEffect, useRef, useState } from "react";
import { videoApi } from "@/services/api";
import { library } from "@/services/library";
import { analytics } from "@/services/analytics";
import { interestEvent, interests, rankTopics, topicInterests, type TopicCandidate } from "@/services/topicInterests";
import TopicCard from "./TopicCard";

export default function TopicRecommendations({ onOpen }: { onOpen: (category: string) => void }) {
  const [topics, setTopics] = useState<TopicCandidate[]>([]), [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true), [failed, setFailed] = useState(false), [reload, setReload] = useState(0);
  const [, updatePreferences] = useState(0);
  const seed = useRef(Math.floor(Math.random() * 2147483647));
  const container = useRef<HTMLElement>(null);
  useEffect(() => {
    let active = true, richLoaded = false, succeeded = false;
    setLoading(true); setFailed(false);
    const rich = videoApi.topics().then(data => {
      if (!Array.isArray(data.topics) || !data.topics.length) throw new Error("No topics");
      succeeded = true; richLoaded = true;
      if (active) { setTopics(data.topics); setLoading(false); }
    });
    const fallback = videoApi.bootstrap().then(data => {
      const rows = data.categories.map(category => ({
        id: category.id, name: category.name === "网曝门" ? "吃瓜" : category.name, crowdReady: false, crowdScore: 0,
        videos: (data.categoryPages[category.id]?.items || []).map(video => ({ ...video, crowdScore: 0, importedAt: "" })),
      })).filter(topic => topic.videos.length >= 3);
      if (!rows.length) throw new Error("No fallback topics");
      succeeded = true;
      if (active && !richLoaded) { setTopics(rows); setLoading(false); }
    });
    void Promise.allSettled([rich, fallback]).then(() => {
      if (active) { setLoading(false); setFailed(!succeeded); }
    });
    const changed = () => updatePreferences(value => value + 1);
    window.addEventListener(library.event, changed); window.addEventListener("storage", changed); window.addEventListener(interestEvent, changed);
    return () => { active = false; window.removeEventListener(library.event, changed); window.removeEventListener("storage", changed); window.removeEventListener(interestEvent, changed); };
  }, [reload]);
  const available = rankTopics(topics, seed.current);
  const topic = available.length ? available[index % available.length] : undefined;
  const topicId = topic?.id;
  const visibleIds = JSON.stringify(topic?.videos.slice(0, 3).map(video => video.id) || []);
  useEffect(() => {
    const node = container.current;
    if (!node || !topicId) return;
    const ids = JSON.parse(visibleIds) as string[];
    let sent = false;
    const observer = new IntersectionObserver(entries => {
      if (sent || !entries.some(entry => entry.isIntersecting && entry.intersectionRatio >= .5)) return;
      sent = true;
      analytics.track("topic_impression", { metadata: { topicId, model: "interest-v1" } });
      ids.forEach(videoId => analytics.track("video_impression", { videoId, metadata: { source: "topic" } }));
    }, { threshold: .5 });
    observer.observe(node); return () => observer.disconnect();
  }, [topicId, visibleIds]);
  const reduced = interests().reduced.length;
  return <section ref={container} aria-label="专题推荐" className="mx-3 mb-4">
    <div className="mb-2 flex items-center justify-between">
      <h2 className="text-sm font-semibold text-foreground-900">专题推荐</h2>
      {available.length > 1 && <button onClick={() => { setIndex(value => (value + 1) % available.length); analytics.track("topic_swap"); }} className="rounded-full px-3 py-2 text-xs text-foreground-500">换个专题</button>}
    </div>
    {topic ? <>
      <TopicCard key={topic.id} topic={topic} onOpen={() => onOpen(topic.id)} />
      <div className="mt-2 flex items-center justify-end gap-2 text-[11px] text-foreground-400">
        <button onClick={() => { topicInterests.reduce(topic.id); setIndex(0); analytics.track("topic_reduce", { metadata: { topicId: topic.id } }); }} className="shrink-0 rounded-full px-2 py-2">减少此类推荐</button>
      </div>
    </> : loading ? <div role="status" className="flex min-h-[172px] items-center justify-center rounded-[26px] bg-background-100 text-xs text-foreground-400">专题加载中…</div>
      : failed ? <div role="status" className="rounded-[26px] bg-background-100 p-6 text-center text-xs text-foreground-500"><p>专题暂时加载失败</p><button onClick={() => setReload(value => value + 1)} className="mt-3 rounded-full bg-primary-500 px-4 py-2 text-white">重新加载专题</button></div>
      : <p className="rounded-xl bg-background-100 p-4 text-xs text-foreground-500">{reduced ? "当前专题已减少推荐，可恢复后继续浏览。" : "暂无可展示的专题"}</p>}
    {reduced > 0 && <button onClick={() => topicInterests.restore()} className="mt-1 rounded-full px-2 py-2 text-xs text-primary-600">恢复减少的专题（{reduced}）</button>}
  </section>;
}
