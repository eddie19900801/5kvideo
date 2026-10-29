import Hls from "hls.js";
import { WatchClock } from "@/services/watchClock";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

export type VideoPlayerHandle = {
  seekTo: (time: number) => void;
  restart: () => void;
  play: () => void;
};

type Props = {
  src: string;
  poster: string;
  title: string;
  trimStart: number;
  trimEnd: number;
  initialTime?: number;
  onProgress?: (time: number) => void;
  onPlay?: () => void;
  onPlaying?: () => void;
  onWaiting?: () => void;
  onEnded?: () => void;
  onPause?: () => void;
  onRetry?: () => void;
  onWatch?: (seconds: number) => void;
  onDuration?: (seconds: number) => void;
  onError?: (detail: PlaybackErrorDetail) => void;
};

export type PlaybackErrorDetail = {
  source: "hls" | "native" | "unsupported";
  type: string;
  detail: string;
  fatal: boolean;
  httpStatus?: number;
  host?: string;
  position: number;
  readyState: number;
  networkState: number;
};

const sourceHost = (value?: string) => {
  try { return value ? new URL(value, location.href).host.slice(0, 200) : undefined; }
  catch { return undefined; }
};

const VideoPlayer = forwardRef<VideoPlayerHandle, Props>(
  (
    {
      src,
      poster,
      title,
      trimStart,
      initialTime = 0,
      onProgress,
      onPlay,
      onPlaying,
      onWaiting,
      onEnded,
      onPause,
      onRetry,
      onWatch,
      onDuration,
      onError,
    },
    ref,
  ) => {
    const videoRef = useRef<HTMLVideoElement>(null),
      progressRef = useRef(onProgress),
      playRef = useRef(onPlay),
      playingRef=useRef(onPlaying),waitingRef=useRef(onWaiting),endedRef=useRef(onEnded),errorRef=useRef(onError),
      completedRef=useRef(false),
      [error, setError] = useState("");
    const [attempt, setAttempt] = useState(0), [slow, setSlow] = useState(false);
    const retryPosition = useRef<number | null>(null);
    const autoRecovery = useRef(0);
    const watchRef = useRef(onWatch), pauseRef = useRef(onPause);
    const durationRef = useRef(onDuration);
    durationRef.current = onDuration;
    watchRef.current = onWatch; pauseRef.current = onPause;
    progressRef.current = onProgress;
    playRef.current = onPlay;
    playingRef.current=onPlaying;waitingRef.current=onWaiting;endedRef.current=onEnded;errorRef.current=onError;

    useImperativeHandle(ref, () => ({
      seekTo(time) {
        const video = videoRef.current;
        if (video) {
          // Preview timestamps are relative to the generated preview range,
          // which still starts after the opening offset.
          video.currentTime = time + trimStart;
          void video.play().catch(() => {});
        }
      },
      restart() {
        const video = videoRef.current;
        if (video) { video.currentTime = 0; void video.play().catch(() => {}); }
      },
      play() {
        void videoRef.current?.play().catch(() => {});
      },
    }));

    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;
      setError("");
      completedRef.current=false;
      const watch = new WatchClock();
      let waiting = false, slowTimer: ReturnType<typeof setTimeout> | undefined;
      const clearSlow = () => { clearTimeout(slowTimer); setSlow(false); };
      const sample = () => {
        const seconds = watch.sample(performance.now(), video.currentTime, video.playbackRate,
          !video.paused && !video.ended && !video.seeking && !waiting && !document.hidden && video.readyState >= 3);
        if (seconds > 0) watchRef.current?.(seconds);
      };
      const resetWatch = () => watch.reset();
      const paused = () => { watch.reset(); clearSlow(); pauseRef.current?.(); };
      const stalled = () => { waiting = true; watch.reset(); clearTimeout(slowTimer); slowTimer = setTimeout(() => setSlow(true), 3000); };
      const resumed = () => { waiting = false; autoRecovery.current = 0; watch.reset(); clearSlow(); };
      const watchTimer = setInterval(sample, 250);
      video.addEventListener("pause", paused);
      video.addEventListener("seeking", resetWatch);
      video.addEventListener("seeked", resetWatch);
      video.addEventListener("ratechange", resetWatch);
      video.addEventListener("waiting", stalled);
      video.addEventListener("playing", resumed);
      document.addEventListener("visibilitychange", resetWatch);

      const reportProgress = () => {
        progressRef.current?.(Math.max(0, video.currentTime));
      };

      const restoreProgress = () => {
        const saved = retryPosition.current ?? initialTime;
        const maximum = video.duration;
        if (Number.isFinite(maximum) && maximum > 0) {
          durationRef.current?.(maximum);
          // Only the initial start skips the opening 30 seconds. Once loaded,
          // users may seek anywhere, including back into the opening segment.
          video.currentTime = saved > 0 && saved < maximum - 1
            ? saved
            : Math.min(trimStart, Math.max(0, maximum - 1));
        }
        retryPosition.current = null;
        watch.reset();
        if (attempt > 0) void video.play().catch(() => {});

      };

      video.addEventListener("loadedmetadata", restoreProgress);
      video.addEventListener("timeupdate", reportProgress);
      const handlePlay = () => playRef.current?.();
      const handlePlaying=()=>playingRef.current?.(),handleWaiting=()=>waitingRef.current?.(),handleEnded=()=>{if(!completedRef.current){completedRef.current=true;endedRef.current?.()}},handleError=()=>{setError("视频暂时无法播放，请重试");clearSlow();const mediaError=video.error;errorRef.current?.({source:"native",type:`media_${mediaError?.code||0}`,detail:(mediaError?.message||"HTML5 video error").slice(0,200),fatal:true,host:sourceHost(src),position:Math.round(video.currentTime||0),readyState:video.readyState,networkState:video.networkState})};
      video.addEventListener("play", handlePlay);
      video.addEventListener("playing",handlePlaying);video.addEventListener("waiting",handleWaiting);video.addEventListener("ended",handleEnded);video.addEventListener("error",handleError);

      let hls: Hls | undefined;
      if (Hls.isSupported()) {
        hls = new Hls({ enableWorker: true, maxBufferLength: 30 });
        hls.loadSource(src);
        hls.attachMedia(video);
        hls.on(Hls.Events.ERROR, (_, data) => {
          if (data.fatal) {
            const response=data.response as {code?:number;url?:string}|undefined;
            errorRef.current?.({source:"hls",type:String(data.type||"hls_error").slice(0,200),detail:String(data.details||"unknown").slice(0,200),fatal:true,httpStatus:Number(response?.code)||undefined,host:sourceHost(response?.url||data.url||src),position:Math.round(video.currentTime||0),readyState:video.readyState,networkState:video.networkState});
            if (data.type === Hls.ErrorTypes.NETWORK_ERROR && autoRecovery.current < 2) {
              autoRecovery.current += 1;
              retryPosition.current = Math.max(0, video.currentTime || initialTime || trimStart);
              setSlow(true); onRetry?.();
              window.setTimeout(() => hls?.startLoad(retryPosition.current || -1), 800);
            } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR && autoRecovery.current < 2) {
              autoRecovery.current += 1;
              setSlow(true); onRetry?.();
              window.setTimeout(() => hls?.recoverMediaError(), 500);
            } else if (autoRecovery.current < 2) {
              autoRecovery.current += 1;
              retryPosition.current = Math.max(0, video.currentTime || initialTime || trimStart);
              setSlow(true); onRetry?.();
              window.setTimeout(() => setAttempt(value => value + 1), 800);
            } else setError("视频线路暂时无法播放，请重试或稍后再看");
          }
        });
      } else if (video.canPlayType("application/vnd.apple.mpegurl"))
        video.src = src;
      else {setError("当前浏览器不支持 HLS 播放");errorRef.current?.({source:"unsupported",type:"hls_unsupported",detail:"Browser does not support HLS",fatal:true,host:sourceHost(src),position:0,readyState:video.readyState,networkState:video.networkState})}

      return () => {
        clearInterval(watchTimer); clearTimeout(slowTimer);
        video.removeEventListener("pause", paused);
        video.removeEventListener("seeking", resetWatch);
        video.removeEventListener("seeked", resetWatch);
        video.removeEventListener("ratechange", resetWatch);
        video.removeEventListener("waiting", stalled);
        video.removeEventListener("playing", resumed);
        document.removeEventListener("visibilitychange", resetWatch);
        video.removeEventListener("loadedmetadata", restoreProgress);
        video.removeEventListener("timeupdate", reportProgress);
        video.removeEventListener("play", handlePlay);
        video.removeEventListener("playing",handlePlaying);video.removeEventListener("waiting",handleWaiting);video.removeEventListener("ended",handleEnded);video.removeEventListener("error",handleError);
        hls?.destroy();
      };
    }, [src, trimStart, initialTime, attempt]);

    const retry = () => {
      retryPosition.current = Math.max(0, videoRef.current?.currentTime || trimStart);
      videoRef.current?.pause();
      setSlow(false); onRetry?.(); setAttempt(value => value + 1);
    };

    return (
      <div className="relative aspect-video w-full overflow-hidden bg-black">
        <video
          ref={videoRef}
          poster={poster}
          title={title}
          controls
          playsInline
          preload="metadata"
          className="h-full w-full object-contain"
        />
        {error && (
          <div className="absolute inset-0 grid place-items-center bg-black/80 px-8 text-center text-sm text-white">
            <div role="alert"><p>{error}</p><button onClick={retry} className="mt-4 rounded-full bg-primary-500 px-5 py-3 font-bold">重试播放</button><p className="mt-2 text-xs text-white/70">保留当前进度</p></div>
          </div>
        )}
        {slow && !error && <div role="status" className="absolute inset-x-3 top-3 rounded-lg bg-black/80 p-3 text-center text-xs text-white">网络较慢，正在重新连接视频线路<button onClick={retry} className="ml-3 rounded bg-primary-500 px-3 py-2">立即重试</button></div>}
      </div>
    );
  },
);

VideoPlayer.displayName = "VideoPlayer";
export default VideoPlayer;
