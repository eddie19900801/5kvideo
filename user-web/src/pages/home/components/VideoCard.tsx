import { Link } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import type { VideoSummary } from "@/types";
import { library } from "@/services/library";
import { analytics } from "@/services/analytics";
import { performanceMonitor } from "@/services/performance";
const duration = (value: number) =>
  `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, "0")}`;
const views = (value: number) =>
  value >= 10_000
    ? `${(value / 10_000).toFixed(2).replace(/\.?0+$/, "")}万`
    : String(value);
export default function VideoCard({ video,priority=false }: { video: VideoSummary;priority?:boolean }) {
  const category = video.category === "网曝门" ? "吃瓜" : video.category,
    [favorite, setFavorite] = useState(() => library.isFavorite(video.id)),cardRef=useRef<HTMLDivElement>(null),impressed=useRef(false);
  useEffect(()=>{const node=cardRef.current;if(!node)return;const observer=new IntersectionObserver(entries=>{if(!impressed.current&&entries.some(item=>item.isIntersecting&&item.intersectionRatio>=.5)){impressed.current=true;analytics.track("video_impression",{videoId:video.id})}},{threshold:.5});observer.observe(node);return()=>observer.disconnect()},[video.id]);
  useEffect(() => {
    const refresh = () => setFavorite(library.isFavorite(video.id));
    window.addEventListener(library.event, refresh); window.addEventListener("storage", refresh);
    return () => { window.removeEventListener(library.event, refresh); window.removeEventListener("storage", refresh); };
  }, [video.id]);
  return (
    <div ref={cardRef} className="relative w-full min-w-0 max-w-full overflow-hidden rounded-xl bg-background-100">
      <Link to={`/video/${video.id}`} onClick={()=>{try{sessionStorage.setItem("5knews_home_scroll",String(window.scrollY));sessionStorage.setItem("5knews_home_restore","1")}catch{}analytics.track("video_click",{videoId:video.id})}} className="group block min-w-0 max-w-full">
        <div className="relative aspect-[4/3] overflow-hidden bg-background-200">
          <span className="absolute inset-0 grid place-items-center text-3xl text-foreground-300" aria-hidden="true"><i className="ri-video-line" /></span>
          <img
            src={video.thumbnail}
            alt={video.title}
            loading={priority?"eager":"lazy"}
            fetchPriority={priority?"high":"auto"}
            decoding="async"
            onLoad={()=>performanceMonitor.imageLoaded(priority,video.thumbnail)}
            onError={(event)=>{performanceMonitor.imageFailed(priority);event.currentTarget.hidden=true}}
            referrerPolicy="no-referrer"
            className="relative h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
          <span className="absolute bottom-1.5 right-1.5 rounded bg-black/65 px-1.5 py-0.5 text-[10px] font-semibold text-white">
            {duration(video.duration)}
          </span>
          <span className="absolute left-1.5 top-1.5 max-w-[75%] truncate rounded bg-black/50 px-1.5 py-0.5 text-[10px] text-white">
            {category}
          </span>
        </div>
        <div className="min-w-0 p-2">
          <h3 className="line-clamp-2 min-h-[2.4em] break-all text-[13px] font-semibold leading-snug text-foreground-900">
            {video.title}
          </h3>
          <div className="mt-1 flex min-w-0 items-center justify-between gap-1 text-[10px] text-foreground-400">
            <span className="whitespace-nowrap">
              {views(video.views)} 次播放
            </span>
            <span className="truncate">{video.tags[0] || "精选"}</span>
          </div>
        </div>
      </Link>
      <button
        type="button"
        aria-label={favorite ? "取消收藏" : "收藏"}
        onClick={() => {const value=library.toggleFavorite(video);setFavorite(value);analytics.track(value?"favorite_add":"favorite_remove",{videoId:video.id})}}
        className={`absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-black/60 ${favorite ? "text-primary-400" : "text-white"}`}
      >
        <i className={favorite ? "ri-heart-fill" : "ri-heart-line"} />
      </button>
    </div>
  );
}
