import { topicInterests } from "@/services/topicInterests";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { videoApi } from "@/services/api";
import type { VideoDetail as Detail } from "@/types";
import VideoPlayer, { type VideoPlayerHandle } from "./components/VideoPlayer";
import FrameGallery from "./components/FrameGallery";
import Waterfall from "@/pages/home/components/Waterfall";
import FiveKAdSlot from "@/components/FiveKAdSlot";
import { library } from "@/services/library";
import { analytics } from "@/services/analytics";
import ContentFeedback from "@/components/ContentFeedback";
import { usePagedVideos } from "@/hooks/usePagedVideos";
import { productRuntime } from "@/services/productRuntime";
import BottomNav from "@/components/base/BottomNav";
const VIDEO_BANNER_ZONE = "ZN_A1BD01D65B6E249A60AB5A26";
const VIDEO_RECOMMENDATION_ZONE = "ZN_584774055B2DC9702C87750C";
const VIDEO_LIVE_CARD_ZONE = "ZN_5C9FAF269B6886186EBB85BD";
const progressTime=(value:number)=>`${Math.floor(value/60)}:${String(Math.floor(value%60)).padStart(2,"0")}`;
export default function VideoDetail() {
  const { id = "" } = useParams(),
    navigate = useNavigate(),
    player = useRef<VideoPlayerHandle>(null),
    recommendationSeed = useRef(`${Date.now()}-${crypto.randomUUID()}`),
    lastProgressSaved = useRef(0),
    latestProgress = useRef(0),
    latestDuration = useRef(0),
    playTracked = useRef(false),
    effectiveTracked = useRef(false),
    startupTracked=useRef(false),failureTracked=useRef(false),completedTracked=useRef(false),startupAt=useRef(0),bufferingAt=useRef(0),watchSeconds=useRef(0),totalWatchSeconds=useRef(0),
    [video, setVideo] = useState<Detail>(),
    [favorite, setFavorite] = useState(false),
    [resumeProgress, setResumeProgress] = useState(0),
    [showResume, setShowResume] = useState(false),
    [copied, setCopied] = useState(false),
    [activeTime, setActiveTime] = useState(0),
    [error, setError] = useState(""),
    [detailRetry, setDetailRetry] = useState(0);
  const { videos: related, page: relatedPage, pageCount: relatedPageCount, loading: relatedLoading, error: relatedError, sentinel: relatedSentinel, retry: retryRelated, loadMore: loadMoreRelated } = usePagedVideos({ relatedTo: id, personalizeFeed: true, seed: recommendationSeed.current, enabled: Boolean(video && video.id === id), excludeId: id });
  useEffect(()=>{let active=true;void productRuntime.load().then(product=>{if(active)document.title=video?.title?`${video.title} - ${product.name}`:product.name});return()=>{active=false}},[video?.title]);
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(location.href);
    } catch {
      const input = document.createElement("textarea");
      input.value = location.href;
      input.style.position = "fixed";
      input.style.opacity = "0";
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      input.remove();
    }
    setCopied(true);
    if (video) analytics.track("share_copy", { videoId: video.id });
    setTimeout(() => setCopied(false), 1800);
  };
  const toggleFavorite = () => {
    if (!video) return;
    const value = library.toggleFavorite(video);
    setFavorite(value);
    analytics.track(value ? "favorite_add" : "favorite_remove", { videoId: video.id });
  };
  useEffect(() => {
    let cancelled = false;
    let loaded: Detail | undefined;
    window.scrollTo(0, 0);
    setVideo(undefined); setError("");
    playTracked.current = false; effectiveTracked.current = false;
    startupTracked.current = false; failureTracked.current = false;
    completedTracked.current = false; startupAt.current = 0; bufferingAt.current = 0;
    latestDuration.current = 0; latestProgress.current = 0; lastProgressSaved.current = 0; watchSeconds.current = 0; totalWatchSeconds.current = 0;
    recommendationSeed.current = `${Date.now()}-${crypto.randomUUID()}`;
    void videoApi.detail(id).then(value => {
      if (cancelled) return;
      loaded = value;
      setVideo(value);
      analytics.track("video_detail_view", { videoId: value.id });
      const savedProgress = library.progress(value.id);
      latestProgress.current = savedProgress;
      setResumeProgress(savedProgress); setShowResume(savedProgress>=5&&savedProgress<Math.max(value.duration-5,5)); setFavorite(library.isFavorite(value.id));
    }).catch(reason => { if (!cancelled) setError(reason.message); });
    const flush = () => {
      if (loaded && totalWatchSeconds.current >= 10) topicInterests.watch({ ...loaded, duration: latestDuration.current || loaded.duration }, totalWatchSeconds.current, recommendationSeed.current);
      if (loaded && playTracked.current && !completedTracked.current) library.record({ ...loaded, duration: latestDuration.current || loaded.duration }, latestProgress.current);
      if (totalWatchSeconds.current >= 10) analytics.track("recommendation_watch", { videoId: id, value: Math.floor(totalWatchSeconds.current), metadata: { measurement: "watch_seconds_v3", duration: latestDuration.current || loaded?.duration || 0 } });
      if (watchSeconds.current >= 1) {
        analytics.track("watch_time", { videoId: id, value: Math.floor(watchSeconds.current) });
        watchSeconds.current %= 1;
        analytics.flush();
      }
      if (totalWatchSeconds.current >= 10) analytics.flush();
    };
    window.addEventListener("pagehide", flush);
    return () => { cancelled = true; flush(); window.removeEventListener("pagehide", flush); };
  }, [id, detailRetry]);
  if (error)
    return (
      <div className="mx-auto grid min-h-screen max-w-[520px] place-items-center bg-background-50 px-6 text-center">
        <div>
          <p className="text-sm text-foreground-600">{error}</p><button onClick={() => setDetailRetry(value => value + 1)} className="mt-4 rounded-full bg-primary-500 px-5 py-2 text-white">重新加载视频</button>
          <Link
            to="/"
            className="mt-4 inline-block rounded-full bg-primary-500 px-5 py-2 text-sm text-white"
          >
            返回首页
          </Link>
        </div>
      </div>
    );
  if (!video)
    return (
      <div className="mx-auto grid min-h-screen max-w-[520px] place-items-center bg-background-50 text-sm text-foreground-400">
        正在加载视频…
      </div>
    );
  return (
    <div className="mx-auto min-h-screen w-full max-w-[520px] bg-background-50 pb-20">
      <header className="app-safe-header sticky top-0 z-20 flex items-center gap-3 border-b border-background-200 bg-background-50/95 px-3 py-2.5 backdrop-blur">
        <button
          onClick={() => navigate(-1)}
          className="grid h-9 w-9 place-items-center rounded-full bg-background-100"
        >
          <i className="ri-arrow-left-line" />
        </button>
        <h1 className="flex-1 truncate text-sm font-bold">{video.title}</h1>
        <button
          onClick={toggleFavorite}
          aria-label={favorite ? "取消收藏" : "收藏"}
          className={`flex h-9 flex-none items-center gap-1 rounded-full bg-background-100 px-2.5 text-[11px] ${favorite ? "text-primary-500" : ""}`}
        >
          <i className={favorite ? "ri-heart-fill" : "ri-heart-line"} />
          {favorite ? "已收藏" : "收藏"}
        </button>
        <button
          onClick={() => void copyLink()}
          className="flex h-9 flex-none items-center gap-1 rounded-full bg-background-100 px-2.5 text-[11px]"
        >
          <i className="ri-share-forward-line" />
          分享
        </button>
      </header>
      {copied && (
        <div className="fixed left-1/2 top-20 z-50 -translate-x-1/2 rounded-full bg-black/80 px-4 py-2 text-xs text-white shadow-lg">
          <i className="ri-checkbox-circle-line mr-1" />
          链接已经复制
        </div>
      )}
      <aside className="px-3 py-3" aria-label="横幅广告">
        <FiveKAdSlot zone={VIDEO_BANNER_ZONE} limit={1} className="min-h-[90px] overflow-hidden rounded-lg bg-foreground-100" />
      </aside>
      <VideoPlayer
        key={video.id}
        ref={player}
        src={video.playbackUrl}
        poster={video.thumbnail}
        title={video.title}
        trimStart={video.trimStart}
        trimEnd={video.trimEnd}
        initialTime={resumeProgress}
        onDuration={seconds => { latestDuration.current = seconds; }}
        onPlay={() => {
          setShowResume(false);
          if (completedTracked.current && latestProgress.current < (latestDuration.current || video.duration) - 5) completedTracked.current = false;
          if (!startupAt.current) startupAt.current = performance.now();
          if (!playTracked.current) {
            playTracked.current = true;
            analytics.track("video_play", { videoId: video.id });
          }
        }}
        onPlaying={() => {
          if (!startupTracked.current && startupAt.current) {
            startupTracked.current = true;
            analytics.track("playback_startup", { videoId: video.id, value: startupAt.current ? Math.round(performance.now() - startupAt.current) : 0, metadata: { measurement: "play_to_playing_v2" } });
          }
          if (bufferingAt.current) {
            analytics.track("buffering", { videoId: video.id, value: (performance.now() - bufferingAt.current) / 1000 });
            bufferingAt.current = 0;
          }
        }}
        onWaiting={() => { if (startupTracked.current && !bufferingAt.current) bufferingAt.current = performance.now(); }}
        onPause={() => { bufferingAt.current = 0; }}
        onRetry={() => { if (!startupTracked.current) startupAt.current = 0; failureTracked.current = false; bufferingAt.current = 0; analytics.track("playback_retry", { videoId: video.id }); }}
        onWatch={(seconds) => {
          watchSeconds.current += seconds; totalWatchSeconds.current += seconds;
          if (!effectiveTracked.current && totalWatchSeconds.current >= 10) {
            effectiveTracked.current = true;
            analytics.track("video_effective", { videoId: video.id, metadata: { measurement: "watch_seconds_v2" } });
          }
          if (watchSeconds.current >= 15) {
            const whole = Math.floor(watchSeconds.current);
            topicInterests.watch({ ...video, duration: latestDuration.current || video.duration }, totalWatchSeconds.current, recommendationSeed.current);
            analytics.track("recommendation_watch", { videoId: video.id, value: Math.floor(totalWatchSeconds.current), metadata: { measurement: "watch_seconds_v3", duration: latestDuration.current || video.duration } });
            analytics.track("watch_time", { videoId: video.id, value: whole });
            watchSeconds.current -= whole;
          }
        }}
        onError={(detail) => {
          if (!failureTracked.current) {
            failureTracked.current = true;
            analytics.track("playback_error", {
              videoId: video.id,
              value: startupAt.current ? Math.round(performance.now() - startupAt.current) : 0,
              metadata: {
                ...detail,
                title: video.title.slice(0, 200),
                network:
                  (navigator as Navigator & {
                    connection?: { effectiveType?: string };
                  }).connection?.effectiveType || "unknown",
                browser: navigator.userAgent.slice(0, 200),
              },
            });
          }
        }}
        onEnded={()=>{topicInterests.watch({ ...video, duration: latestDuration.current || video.duration }, totalWatchSeconds.current, recommendationSeed.current);library.complete({ ...video, duration: latestDuration.current || video.duration });if(!completedTracked.current){completedTracked.current=true;analytics.track("video_complete",{videoId:video.id})}if(watchSeconds.current>=1){analytics.track("watch_time",{videoId:video.id,value:Math.round(watchSeconds.current)});watchSeconds.current=0}}}
        onProgress={(time) => {
          latestProgress.current = time;
          if(video.highlights.length)setActiveTime(Math.max(0,time-video.trimStart));
          if (!playTracked.current || completedTracked.current) return;
          if (
            time - lastProgressSaved.current >= 5 ||
            time < lastProgressSaved.current
          ) {
            lastProgressSaved.current = time;
            library.record({ ...video, duration: latestDuration.current || video.duration }, time);
          }
        }}
      />
      <section className="px-3 pt-3" aria-label="精彩真人直播">
        <div className="mb-2 flex items-center justify-between">
          <b className="text-sm text-foreground-800">精彩真人直播</b>
          <small className="text-[9px] text-foreground-400">广告</small>
        </div>
        <FiveKAdSlot
          zone={VIDEO_LIVE_CARD_ZONE}
          limit={4}
          className="min-h-[520px] overflow-hidden rounded-xl bg-foreground-100/5"
        />
      </section>
      {showResume&&resumeProgress>=5&&<div role="status" className="mx-3 mt-3 flex items-center gap-2 rounded-xl border border-primary-100 bg-primary-50 px-3 py-2.5 text-xs text-primary-700">
        <i className="ri-history-line text-lg"/>
        <span className="min-w-0 flex-1">上次看到 {progressTime(resumeProgress)}</span>
        <button onClick={()=>{player.current?.restart();setActiveTime(0);setShowResume(false)}} className="rounded-full bg-background-50 px-3 py-2 font-semibold text-foreground-600">从头播放</button>
        <button onClick={()=>{player.current?.play();setShowResume(false)}} className="rounded-full bg-primary-500 px-3 py-2 font-bold text-white">继续</button>
      </div>}
      {video.highlights.length > 0 && (
        <section className="px-3 pt-3">
          <div className="mb-2 flex items-center justify-between">
            <b className="text-sm">视频截图</b>
            <span className="text-[11px] text-foreground-400">
              点击跳转播放
            </span>
          </div>
          <FrameGallery
            frames={video.highlights}
            activeTime={activeTime}
            onSelect={(frame) => {
              setActiveTime(frame.time);
              player.current?.seekTo(frame.time);
            }}
          />
        </section>
      )}
      <section className="px-3 pt-3" aria-label="热门推荐">
        <div className="mb-2 flex items-center justify-between">
          <b className="text-xs text-foreground-700">热门推荐</b>
          <small className="text-[9px] text-foreground-400">广告</small>
        </div>
        <FiveKAdSlot zone={VIDEO_RECOMMENDATION_ZONE} limit={0} className="min-h-[82px]" />
      </section>
      <main className="px-3 pb-12 pt-3">
        <div className="flex items-start gap-3">
          <h2 className="min-w-0 flex-1 text-base font-bold leading-snug">
            {video.title}
          </h2>
          <button
            type="button"
            onClick={toggleFavorite}
            className={`flex flex-none items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-bold ${favorite ? "border-primary-500 bg-primary-50 text-primary-600" : "border-background-300 bg-background-100 text-foreground-600"}`}
          >
            <i className={favorite ? "ri-heart-fill" : "ri-heart-line"} />
            {favorite ? "已收藏" : "收藏"}
          </button>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {video.tags.map((tag) => (
            <Link
              to={`/?q=${encodeURIComponent(tag)}`}
              key={tag}
              className="rounded-full bg-primary-50 px-2 py-1 text-[11px] text-primary-600"
            >
              #{tag}
            </Link>
          ))}
        </div>
        {video.description && (
          <p className="mt-3 text-sm leading-6 text-foreground-500">
            {video.description}
          </p>
        )}
        <ContentFeedback key={video.id} videoId={video.id} title={video.title} />
        <section className="mt-6">
          <h3 className="mb-1 text-sm font-bold">相关推荐</h3><p className="mb-3 text-xs text-foreground-400">综合分类、标签和时长，优先展示未看过的内容</p>
          <div className="-mx-3">
            <Waterfall videos={related} />
          </div>
          <div
            ref={relatedSentinel}
            className="py-8 text-center text-xs text-foreground-400"
          >
            {relatedError ? <div role="status"><p>推荐加载失败，视频可以继续播放</p><button onClick={retryRelated} className="mt-3 rounded-full bg-primary-500 px-4 py-2 text-white">重试推荐</button></div> : relatedLoading
              ? "正在加载…"
              : relatedPage < relatedPageCount
                ? <button onClick={loadMoreRelated} className="rounded-full px-4 py-2">加载更多</button>
                : related.length ? "已经到底了" : "暂无相关推荐"}
          </div>
        </section>
      </main>
      <BottomNav />
    </div>
  );
}
