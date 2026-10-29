import { analytics } from "@/services/analytics";
import { Link } from "react-router-dom";
import type { VideoSummary } from "@/types";

export type Topic = { id: string; title: string; videos: VideoSummary[] };

export default function TopicCard({ topic, onOpen }: { topic: Topic; onOpen: () => void }) {
  const backdrop = topic.videos.find(video => video.thumbnail)?.thumbnail;
  return <article className="relative isolate flex min-h-[172px] flex-col justify-between overflow-hidden rounded-[26px] bg-gradient-to-br from-primary-50 via-background-100 to-background-200 p-4 ring-1 ring-inset ring-background-200/60" aria-label={topic.title}>
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      {backdrop && <img key={backdrop} src={backdrop} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={event => { event.currentTarget.hidden = true; }} className="h-full w-full scale-125 object-cover object-[center_35%] opacity-30 blur-[6px]" />}
      <div className="absolute inset-0 bg-gradient-to-r from-background-50/90 via-background-50/50 to-background-50/20" />
    </div>
    <button onClick={onOpen} className="max-w-full self-start rounded-lg bg-background-50/90 px-3 py-2 text-left text-sm font-medium text-foreground-900 shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500">
      {topic.title}
    </button>
    <div className="mt-5 flex items-end justify-between gap-3">
      <button onClick={onOpen} className="shrink-0 rounded-full bg-background-50/80 px-3 py-2 text-xs text-foreground-700">查看专题 <span aria-hidden="true">→</span></button>
      <div className="flex min-w-0 justify-end gap-2">
        {topic.videos.slice(0, 3).map(video => <Link key={video.id} to={`/video/${encodeURIComponent(video.id)}`} onClick={() => analytics.track("video_click", { videoId: video.id, metadata: { source: "topic", topicId: topic.id } })} aria-label={`播放：${video.title}`} className="relative block aspect-[4/5] w-[clamp(44px,12vw,64px)] overflow-hidden rounded-md bg-background-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500">
          <span aria-hidden="true" className="absolute inset-0 grid place-items-center text-foreground-400"><i className="ri-play-circle-line text-xl" /></span>
          {video.thumbnail && <img src={video.thumbnail} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={event => { event.currentTarget.hidden = true; }} className="relative h-full w-full object-cover" />}
        </Link>)}
      </div>
    </div>
  </article>;
}
