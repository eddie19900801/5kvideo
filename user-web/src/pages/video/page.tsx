import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useVideo } from '@/contexts/VideoContext';
import { attachVideo } from '@/services/player';
import { request } from '@/services/api';
import QRCode from 'qrcode';
import { track } from '@/services/analytics';
import { EncryptedCover, useEncryptedCover } from '@/components/base/EncryptedCover';

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function VideoPlayer() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { videos: allVideos, setVideoViews, isFavorited, toggleFavorite, addToHistory, getWatchProgress } = useVideo();
  const currentIndex = allVideos.findIndex((v) => v.id === id);
  const [videoIndex, setVideoIndex] = useState(currentIndex >= 0 ? currentIndex : 0);

  const sourceVideo = allVideos[videoIndex] || allVideos[0];
  const decryptedCover = useEncryptedCover(sourceVideo?.thumbnail);
  const video = sourceVideo ? { ...sourceVideo, thumbnail: decryptedCover || (sourceVideo.thumbnail.includes('/cover.enc') ? '' : sourceVideo.thumbnail) } : sourceVideo;

  const [isPlaying, setIsPlaying] = useState(true);
  const [isBuffering, setIsBuffering] = useState(true);
  const [progress, setProgress] = useState(() => getWatchProgress(video.id));
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [shareQr, setShareQr] = useState('');
  const [shareCopied, setShareCopied] = useState(false);

  const [showDescription, setShowDescription] = useState(false);
  const [infoCanExpand, setInfoCanExpand] = useState(false);
  const infoLineRef = useRef<HTMLDivElement>(null);

  const [isLongPressing, setIsLongPressing] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const videoElementRef = useRef<HTMLVideoElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const previewTimeRef = useRef(0);
  const viewCountedRef = useRef(false);
  const effectiveTrackedRef = useRef(false);
  const completedTrackedRef = useRef(false);
  const playbackStartedAtRef = useRef(performance.now());
  const watchSessionStartRef = useRef(Date.now());
  const analyticsPlayTrackedRef = useRef(false);
  const startupTrackedRef = useRef(false);
  const touchStartY = useRef(0);
  const touchStartX = useRef(0);
  const touchStartProgress = useRef(0);
  const isDragging = useRef(false);
  const ignorePlayerTouch = useRef(false);
  const lastTouchEnd = useRef(0);
  const isScrubbing = useRef(false);
  const suppressPlayerClick = useRef(false);
  const resumeAfterScrub = useRef(false);
  const controlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const controlsWereHiddenOnTouchStart = useRef(false);
  const hasStartedFromHistory = useRef(false);
  const loopSeekRef = useRef(false);
  const loopSeekTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // AB Loop state
  const [loopA, setLoopA] = useState<number | null>(null);
  const [loopB, setLoopB] = useState<number | null>(null);
  const [loopMode, setLoopMode] = useState<'off' | 'setting-a' | 'active'>('off');

  // Thumbnail preview on progress bar long-press
  const [thumbnailPreview, setThumbnailPreview] = useState<{ visible: boolean; percent: number; time: number }>({
    visible: false, percent: 0, time: 0,
  });
  const progressPressRef = useRef<{ timer: ReturnType<typeof setTimeout> | null; active: boolean }>({
    timer: null, active: false,
  });

  const chapters = video.chapters || [];
  const trimStart = video.trimStart || 0;
  const logicalToMediaTime = useCallback((time: number) => Math.max(0, Math.min(video.duration, time)) + trimStart, [video.duration, trimStart]);
  const mediaToLogicalTime = useCallback((time: number) => Math.max(0, Math.min(video.duration, time - trimStart)), [video.duration, trimStart]);
  const favorited = isFavorited(video.id);
  const shareUrl = `${window.location.origin}/video/${encodeURIComponent(video.id)}`;

  useEffect(() => {
    if (!showShare) return;
    setShareQr('');
    setShareCopied(false);
    void QRCode.toDataURL(shareUrl, {
      width: 240,
      margin: 2,
      color: { dark: '#111111', light: '#ffffff' },
    }).then(setShareQr).catch(() => setShareQr(''));
  }, [showShare, shareUrl]);

  const copyShareUrl = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      const input = document.createElement('textarea');
      input.value = shareUrl;
      input.style.position = 'fixed';
      input.style.opacity = '0';
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      input.remove();
    }
    setShareCopied(true);
    void track('share_copy', { videoId: video.id });
    window.setTimeout(() => setShareCopied(false), 1800);
  };

  useEffect(() => {
    setShowDescription(false);
    const measure = () => {
      const element = infoLineRef.current;
      if (element && !element.classList.contains('whitespace-normal')) {
        setInfoCanExpand(element.scrollWidth > element.clientWidth + 2);
      }
    };
    const frame = requestAnimationFrame(measure);
    const observer = new ResizeObserver(measure);
    if (infoLineRef.current) observer.observe(infoLineRef.current);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [video.id, video.title, video.description, video.tags]);

  useEffect(() => {
    const el = videoElementRef.current;
    if (!el || !video.playbackUrl) return;
    setIsBuffering(true);
    const detach = attachVideo(el, video.playbackUrl);
    const restorePlayback = () => {
      const handoffKey = `home_video_handoff_${video.id}`;
      const handoffTime = Number(sessionStorage.getItem(handoffKey));
      const savedTime = Number.isFinite(handoffTime) && handoffTime > 0
        ? handoffTime
        : getWatchProgress(video.id);
      if (savedTime > 0 && Number.isFinite(el.duration)) {
        el.currentTime = logicalToMediaTime(Math.min(savedTime, Math.max(0, video.duration - 0.1)));
      } else if (trimStart > 0) {
        el.currentTime = trimStart;
      }
      sessionStorage.removeItem(handoffKey);
      void el.play().catch(() => setIsPlaying(false));
    };
    if (el.readyState >= 1) restorePlayback();
    else el.addEventListener('loadedmetadata', restorePlayback, { once: true });
    return () => {
      el.removeEventListener('loadedmetadata', restorePlayback);
      detach();
    };
  }, [video.id, video.playbackUrl, video.duration, trimStart, logicalToMediaTime, getWatchProgress]);

  // 当前视频稳定后，按短视频信息流方式预热相邻内容：下一条约 6 秒，
  // 下下条和上一条只读取 metadata；省流量/弱网时全部降级为 metadata。
  useEffect(() => {
    if (isBuffering || allVideos.length < 2) return;
    const connection = (navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string };
    }).connection;
    const constrained = connection?.saveData || ['slow-2g', '2g'].includes(connection?.effectiveType || '');
    const indexes = [
      (videoIndex + 1) % allVideos.length,
      (videoIndex + 2) % allVideos.length,
      (videoIndex - 1 + allVideos.length) % allVideos.length,
    ].filter((value, index, list) => value !== videoIndex && list.indexOf(value) === index);
    const preloaders = indexes.map((index, order) => {
      const candidate = allVideos[index];
      if (!candidate?.playbackUrl) return null;
      const element = document.createElement('video');
      element.muted = true;
      element.playsInline = true;
      element.preload = !constrained && order === 0 ? 'auto' : 'metadata';
      element.src = candidate.playbackUrl;
      if (!constrained && order === 0) {
        const stopAfterSixSeconds = () => {
          if (!element.buffered.length || element.buffered.end(element.buffered.length - 1) < 6) return;
          element.removeEventListener('progress', stopAfterSixSeconds);
          element.pause();
          element.removeAttribute('src');
          element.load();
        };
        element.addEventListener('progress', stopAfterSixSeconds);
      }
      element.load();
      return element;
    });
    return () => preloaders.forEach((element) => {
      if (!element) return;
      element.removeAttribute('src');
      element.load();
    });
  }, [isBuffering, videoIndex, allVideos]);
  useEffect(()=>{viewCountedRef.current=false;effectiveTrackedRef.current=false;completedTrackedRef.current=false;analyticsPlayTrackedRef.current=false;startupTrackedRef.current=false;playbackStartedAtRef.current=performance.now();watchSessionStartRef.current=Date.now()},[video.id]);

  useEffect(() => {
    const element = videoElementRef.current;
    if (!element) return;
    const onPlay = () => { if (!analyticsPlayTrackedRef.current) { analyticsPlayTrackedRef.current = true; void track('video_play', { videoId: video.id }); } };
    const onPlaying = () => { if (!startupTrackedRef.current) { startupTrackedRef.current = true; void track('playback_startup', { videoId: video.id, value: Math.round(performance.now() - playbackStartedAtRef.current) }); } };
    const onWaiting = () => void track('buffering', { videoId: video.id, value: 1 });
    const onError = () => void track('playback_error', { videoId: video.id });
    element.addEventListener('play', onPlay);element.addEventListener('playing', onPlaying);element.addEventListener('waiting', onWaiting);element.addEventListener('error', onError);
    return () => { element.removeEventListener('play', onPlay);element.removeEventListener('playing', onPlaying);element.removeEventListener('waiting', onWaiting);element.removeEventListener('error', onError); };
  }, [video.id]);
  useEffect(() => { const el=videoElementRef.current;if(!el)return;el.playbackRate=isLongPressing?2:playbackRate;if(isPlaying)void el.play().catch(()=>setIsPlaying(false));else el.pause(); }, [isPlaying,playbackRate,isLongPressing]);

  useEffect(() => {
    if (getWatchProgress(video.id) > 0 && !hasStartedFromHistory.current) {
      setProgress(getWatchProgress(video.id));
      hasStartedFromHistory.current = true;
    } else if (video.id !== allVideos[videoIndex]?.id) {
      hasStartedFromHistory.current = false;
      setProgress(0);
      setLoopA(null);
      setLoopB(null);
      setLoopMode('off');
    }
  }, [video.id, videoIndex, allVideos, getWatchProgress]);

  useEffect(() => {
    if (showControls) {
      if (controlsTimer.current) clearTimeout(controlsTimer.current);
      controlsTimer.current = setTimeout(() => {
        if (!isScrubbing.current && !isDragging.current) {
          setShowControls(false);
          setShowSpeedMenu(false);
        }
      }, 4000);
    }
    return () => {
      if (controlsTimer.current) clearTimeout(controlsTimer.current);
    };
  }, [showControls, isPlaying]);

  useEffect(() => {
    if (progressInterval.current) clearInterval(progressInterval.current);

    if (video.playbackUrl) return;

    if (isPlaying) {
      const effectiveRate = isLongPressing ? 2 : playbackRate;
      progressInterval.current = setInterval(() => {
        setProgress((prev) => {
          const newProgress = prev + effectiveRate * 0.5;

          if (loopMode === 'active' && loopA !== null && loopB !== null) {
            if (newProgress >= loopB) {
              return loopA;
            }
          }

          if (newProgress >= video.duration) {
            return video.duration;
          }
          return newProgress;
        });
      }, 500);
    }

    return () => {
      if (progressInterval.current) clearInterval(progressInterval.current);
    };
  }, [isPlaying, isLongPressing, playbackRate, video.duration, video.playbackUrl, loopMode, loopA, loopB]);

  useEffect(() => {
    if (!loopMode || loopMode === 'off' || loopA === null || loopB === null) {
      if (progress >= video.duration && allVideos.length > 0) {
        setTimeout(() => {
          setVideoIndex((prev) => (prev + 1) % allVideos.length);
          setProgress(0);
        }, 800);
      }
    }
  }, [progress, video.duration, videoIndex, allVideos.length, loopMode, loopA, loopB]);

  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.deltaY > 30) {
        if (allVideos.length > 0) {
          setVideoIndex((prev) => (prev + 1) % allVideos.length);
          setProgress(0);
        }
      } else if (e.deltaY < -30) {
        if (allVideos.length > 0) {
          setVideoIndex((prev) => (prev - 1 + allVideos.length) % allVideos.length);
          setProgress(0);
        }
      }
    };
    const el = videoContainerRef.current;
    if (el) {
      el.addEventListener('wheel', handleWheel, { passive: false });
    }
    return () => {
      if (el) el.removeEventListener('wheel', handleWheel);
    };
  }, [videoIndex, allVideos.length]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp' && allVideos.length > 0) {
        setVideoIndex((prev) => (prev + 1) % allVideos.length);
        setProgress(0);
      } else if (e.key === 'ArrowDown' && allVideos.length > 0) {
        setVideoIndex((prev) => (prev - 1 + allVideos.length) % allVideos.length);
        setProgress(0);
      } else if (e.key === ' ' || e.key === 'k') {
        e.preventDefault();
        setIsPlaying((prev) => !prev);
      } else if (e.key === 'f') {
        setIsFullscreen((prev) => !prev);
      } else if (e.key === 'Escape') {
        navigate('/');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [videoIndex, allVideos.length, navigate]);



  const handleChapterClick = useCallback(
    (time: number) => {
      if (videoElementRef.current) videoElementRef.current.currentTime = logicalToMediaTime(time);
      setProgress(time);
      setShowControls(true);
      if (!isPlaying) setIsPlaying(true);
    },
    [isPlaying, logicalToMediaTime]
  );

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('button,[data-player-control]')) {
      ignorePlayerTouch.current = true;
      return;
    }
    ignorePlayerTouch.current = false;
    controlsWereHiddenOnTouchStart.current = !showControls;
    if (controlsTimer.current) clearTimeout(controlsTimer.current);
    setShowControls(true);
    touchStartY.current = e.touches[0].clientY;
    touchStartX.current = e.touches[0].clientX;
    touchStartProgress.current = videoElementRef.current ? mediaToLogicalTime(videoElementRef.current.currentTime) : progress;

    longPressTimer.current = setTimeout(() => {
      setIsLongPressing(true);
    }, 500);
  }, [progress, showControls, mediaToLogicalTime]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    const deltaY = e.touches[0].clientY - touchStartY.current;
    const deltaX = e.touches[0].clientX - touchStartX.current;
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
      e.preventDefault();
      isDragging.current = true;
      const secondsPerPixel=Math.max(0.1,Math.min(2,video.duration/600));
      const next=Math.max(0,Math.min(video.duration,touchStartProgress.current+deltaX*secondsPerPixel));
      if(videoElementRef.current)videoElementRef.current.currentTime=logicalToMediaTime(next);
      setProgress(next);
      setShowControls(true);
      setThumbnailPreview({visible:true,percent:(next/video.duration)*100,time:next});
    }
  }, [video.duration, logicalToMediaTime]);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (ignorePlayerTouch.current) {
        ignorePlayerTouch.current = false;
        if (longPressTimer.current) clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
        return;
      }
      lastTouchEnd.current = Date.now();
      if ((e.target as HTMLElement).closest('button')) return;
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }

      if (isLongPressing) {
        setIsLongPressing(false);
        return;
      }

      if (isDragging.current) {
        isDragging.current = false;
        setThumbnailPreview(x=>({...x,visible:false}));
        if (controlsTimer.current) clearTimeout(controlsTimer.current);
        controlsTimer.current=setTimeout(()=>{setShowControls(false);setShowSpeedMenu(false)},4000);
        return;
      }

      const deltaY = e.changedTouches[0].clientY - touchStartY.current;
      const deltaX = e.changedTouches[0].clientX - touchStartX.current;

      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
        const newProgress = progress + (deltaX > 0 ? -10 : 10);
        if (videoElementRef.current) videoElementRef.current.currentTime = logicalToMediaTime(newProgress);
        setProgress(Math.max(0, Math.min(video.duration, newProgress)));
        return;
      }

      if (Math.abs(deltaY) > 50) {
        // 抖音式方向：手指上滑看下一条，手指下滑返回上一条；首尾循环。
        if (deltaY < 0 && allVideos.length > 0) {
          setVideoIndex((prev) => (prev + 1) % allVideos.length);
          setProgress(0);
        } else if (deltaY > 0 && allVideos.length > 0) {
          setVideoIndex((prev) => (prev - 1 + allVideos.length) % allVideos.length);
          setProgress(0);
        }
        return;
      }

      if (Math.abs(deltaY) < 10 && Math.abs(deltaX) < 10) {
        if (controlsWereHiddenOnTouchStart.current) {
          controlsWereHiddenOnTouchStart.current = false;
          setShowControls(true);
          return;
        }
        setIsPlaying((prev) => !prev);
      }
    },
    [isLongPressing, allVideos.length, progress, video.duration, logicalToMediaTime]
  );

  const handleProgressBarClick = useCallback(
    (clientX: number, rect: DOMRect) => {
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      if (videoElementRef.current) videoElementRef.current.currentTime = logicalToMediaTime(ratio * video.duration);
      setProgress(ratio * video.duration);
    },
    [video.duration, logicalToMediaTime]
  );

  const scrubTo = useCallback((clientX:number, element:HTMLElement) => {
    const rect=element.getBoundingClientRect();
    const ratio=Math.max(0,Math.min(1,(clientX-rect.left)/rect.width));
    const time=ratio*video.duration;
    previewTimeRef.current=time;
    if(previewVideoRef.current&&previewVideoRef.current.readyState>=1)previewVideoRef.current.currentTime=logicalToMediaTime(time);
    if(videoElementRef.current)videoElementRef.current.currentTime=logicalToMediaTime(time);
    setProgress(time);
    setThumbnailPreview({visible:true,percent:ratio*100,time});
  },[video.duration, logicalToMediaTime]);

  const handleProgressPressStart = useCallback(
    (clientX: number, rect: DOMRect) => {
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      if (progressPressRef.current.timer) clearTimeout(progressPressRef.current.timer);
      progressPressRef.current.active = false;
      progressPressRef.current.timer = setTimeout(() => {
        progressPressRef.current.active = true;
        setThumbnailPreview({ visible: true, percent: ratio * 100, time: ratio * video.duration });
      }, 200);
    },
    [video.duration]
  );

  const handleProgressPressMove = useCallback(
    (clientX: number, rect: DOMRect) => {
      if (!progressPressRef.current.active) return;
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      setThumbnailPreview({ visible: true, percent: ratio * 100, time: ratio * video.duration });
    },
    [video.duration]
  );

  const handleProgressPressEnd = useCallback(
    (clientX: number, rect: DOMRect) => {
      if (progressPressRef.current.timer) {
        clearTimeout(progressPressRef.current.timer);
        progressPressRef.current.timer = null;
      }
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      if (progressPressRef.current.active) {
        if (videoElementRef.current) videoElementRef.current.currentTime = logicalToMediaTime(ratio * video.duration);
        setProgress(ratio * video.duration);
        setThumbnailPreview({ visible: false, percent: 0, time: 0 });
        progressPressRef.current.active = false;
      } else {
        if (videoElementRef.current) videoElementRef.current.currentTime = logicalToMediaTime(ratio * video.duration);
        setProgress(ratio * video.duration);
      }
    },
    [video.duration, logicalToMediaTime]
  );

  const handleProgressPressCancel = useCallback(() => {
    if (progressPressRef.current.timer) {
      clearTimeout(progressPressRef.current.timer);
      progressPressRef.current.timer = null;
    }
    if (progressPressRef.current.active) {
      setThumbnailPreview({ visible: false, percent: 0, time: 0 });
      progressPressRef.current.active = false;
    }
  }, []);

  const handleBack = useCallback(() => {
    addToHistory(video.id, progress, video.duration);
    void track('watch_time', { videoId: video.id, value: Math.round((Date.now() - watchSessionStartRef.current) / 1000) });
    navigate('/');
  }, [navigate, addToHistory, video.id, progress, video.duration]);

  const handleTagClick = useCallback(
    (tag: string) => {
      addToHistory(video.id, progress, video.duration);
      void track('watch_time', { videoId: video.id, value: Math.round((Date.now() - watchSessionStartRef.current) / 1000) });
      navigate(`/?tag=${tag}`);
    },
    [navigate, addToHistory, video.id, progress, video.duration]
  );

  const toggleFullscreen = useCallback(async () => {
    const container = videoContainerRef.current;
    const player = videoElementRef.current as (HTMLVideoElement & {
      webkitEnterFullscreen?: () => void;
      webkitExitFullscreen?: () => void;
      webkitDisplayingFullscreen?: boolean;
    }) | null;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }
      if (player?.webkitDisplayingFullscreen) {
        player.webkitExitFullscreen?.();
        return;
      }
      if (container?.requestFullscreen) {
        await container.requestFullscreen();
        return;
      }
      if (player?.webkitEnterFullscreen) {
        player.webkitEnterFullscreen();
        setIsFullscreen(true);
        return;
      }
      setShowControls(true);
    } catch {
      // iOS Safari may reject element fullscreen but allows native video fullscreen.
      if (player?.webkitEnterFullscreen) {
        player.webkitEnterFullscreen();
        setIsFullscreen(true);
      }
    }
  }, []);

  useEffect(() => {
    const player = videoElementRef.current;
    const syncDocumentFullscreen = () => setIsFullscreen(!!document.fullscreenElement);
    const enterNativeFullscreen = () => setIsFullscreen(true);
    const leaveNativeFullscreen = () => setIsFullscreen(false);
    document.addEventListener('fullscreenchange', syncDocumentFullscreen);
    player?.addEventListener('webkitbeginfullscreen', enterNativeFullscreen);
    player?.addEventListener('webkitendfullscreen', leaveNativeFullscreen);
    return () => {
      document.removeEventListener('fullscreenchange', syncDocumentFullscreen);
      player?.removeEventListener('webkitbeginfullscreen', enterNativeFullscreen);
      player?.removeEventListener('webkitendfullscreen', leaveNativeFullscreen);
    };
  }, [video.id]);

  // AB Loop handlers
  const handleLoopToggle = useCallback(() => {
    if (loopMode === 'off') {
      setLoopMode('setting-a');
      setLoopA(null);
      setLoopB(null);
    } else if (loopMode === 'setting-a') {
      setLoopA(progress);
      setLoopMode('active');
      setLoopB(null);
    } else {
      setLoopMode('off');
      setLoopA(null);
      setLoopB(null);
    }
  }, [loopMode, progress]);

  const handleSetLoopB = useCallback(() => {
    if (loopMode === 'active' && loopA !== null && progress > loopA) {
      setLoopB(progress);
    }
  }, [loopMode, loopA, progress]);

  const handleClearLoop = useCallback(() => {
    setLoopMode('off');
    setLoopA(null);
    setLoopB(null);
  }, []);

  const handleVideoTimeUpdate = useCallback((element: HTMLVideoElement) => {
    const logicalTime = mediaToLogicalTime(element.currentTime);
    if (element.currentTime < trimStart - 0.1) { element.currentTime = trimStart; return; }
    if (loopMode === 'active' && loopA !== null && loopB !== null && logicalTime >= loopB - 0.18) {
      loopSeekRef.current = true;
      if (loopSeekTimer.current) clearTimeout(loopSeekTimer.current);
      element.currentTime = logicalToMediaTime(loopA);
      setProgress(loopA);
      loopSeekTimer.current = setTimeout(() => { loopSeekRef.current = false; }, 1000);
      if (element.paused && isPlaying) void element.play().catch(() => setIsPlaying(false));
      return;
    }
    setProgress(logicalTime);
    if (logicalTime >= video.duration - 0.18) {
      element.pause(); setProgress(video.duration); setIsPlaying(false);
      if (!completedTrackedRef.current) { completedTrackedRef.current = true; void track('video_complete', { videoId: video.id }); }
      return;
    }
    if (logicalTime >= 10 && !effectiveTrackedRef.current) { effectiveTrackedRef.current = true; void track('video_effective', { videoId: video.id }); }
  }, [loopMode, loopA, loopB, isPlaying, video.id, video.duration, trimStart, mediaToLogicalTime, logicalToMediaTime]);

  const handleVideoEnded = useCallback((element: HTMLVideoElement) => {
    if (loopMode === 'active' && loopA !== null && loopB !== null) {
      loopSeekRef.current = true;
      element.currentTime = logicalToMediaTime(loopA);
      setProgress(loopA);
      if (loopSeekTimer.current) clearTimeout(loopSeekTimer.current);
      loopSeekTimer.current = setTimeout(() => { loopSeekRef.current = false; }, 1000);
      void element.play().catch(() => setIsPlaying(false));
      return;
    }
    setIsPlaying(false);
    if (!completedTrackedRef.current) { completedTrackedRef.current = true; void track('video_complete', { videoId: video.id }); }
  }, [loopMode, loopA, loopB, video.id, logicalToMediaTime]);

  useEffect(() => () => {
    if (loopSeekTimer.current) clearTimeout(loopSeekTimer.current);
  }, []);

  const progressPercent = video.duration > 0 ? (progress / video.duration) * 100 : 0;
  const isPortrait = video.aspectRatio === 'portrait';
  const loopRange = loopA !== null && loopB !== null
    ? { left: (loopA / video.duration) * 100, width: ((loopB - loopA) / video.duration) * 100 }
    : loopA !== null
    ? { left: (loopA / video.duration) * 100, width: 0 }
    : null;

  return (
    <div className="fixed inset-0 bg-black z-50 flex items-center justify-center">
      <div
        ref={videoContainerRef}
        className="relative w-full h-full flex items-center justify-center overflow-hidden select-none touch-manipulation"
        onContextMenu={(e) => e.preventDefault()}
        onDragStart={(e) => e.preventDefault()}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseMove={() => {
          setShowControls(true);
          if (controlsTimer.current) clearTimeout(controlsTimer.current);
          controlsTimer.current = setTimeout(() => {
            if (!isScrubbing.current) {
              setShowControls(false);
              setShowSpeedMenu(false);
            }
          }, 4000);
        }}
        onMouseLeave={() => {
          if (!isScrubbing.current) setShowControls(false);
        }}
        onClick={(e) => {
          if (Date.now() - lastTouchEnd.current < 500 || suppressPlayerClick.current || (e.target as HTMLElement).closest('button')) { suppressPlayerClick.current=false; return; }
          if (!showControls) {
            setShowControls(true);
            return;
          }
          setIsPlaying((prev) => !prev);
          setShowControls(true);
        }}
      >
        {/* Video area */}
        <div
          className={`relative ${
            isPortrait
              ? 'w-full h-full'
              : 'w-full'
          } ${isFullscreen && !isPortrait ? 'h-full' : ''}`}
        >
          {video.playbackUrl ? <video ref={videoElementRef} poster={video.thumbnail} playsInline preload="metadata" disablePictureInPicture onLoadStart={()=>setIsBuffering(true)} onWaiting={()=>{if(!loopSeekRef.current)setIsBuffering(true)}} onSeeking={()=>{if(!loopSeekRef.current)setIsBuffering(true)}} onCanPlay={()=>setIsBuffering(false)} onPlaying={()=>setIsBuffering(false)} onSeeked={()=>setIsBuffering(false)} onPlay={()=>{setIsPlaying(true);if(!viewCountedRef.current){viewCountedRef.current=true;void request<{views:number}>(`/videos/${video.id}/view`,{method:'POST'}).then(result=>setVideoViews(video.id,result.views)).catch(()=>{viewCountedRef.current=false})}}} onPause={()=>setIsPlaying(false)} onTimeUpdate={e=>handleVideoTimeUpdate(e.currentTarget)} onEnded={e=>handleVideoEnded(e.currentTarget)} onError={()=>{setIsBuffering(false);setIsPlaying(false);setShowControls(true)}} className={`w-full h-full object-contain pointer-events-none ${isPortrait&&!isFullscreen?'object-cover':''}`}/> : <img draggable={false} src={video.thumbnail} alt={video.title} className={`w-full h-full object-contain pointer-events-none ${isPortrait&&!isFullscreen?'object-cover':''}`}/>} 

          {/* Initial loading, resume seek and network buffering indicator */}
          {video.playbackUrl && isBuffering && (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center pointer-events-none bg-black/20">
              <div className="w-11 h-11 rounded-full border-[3px] border-white/30 border-t-primary-500 animate-spin" />
              <span className="mt-3 text-sm text-white/90 drop-shadow">加载中...</span>
            </div>
          )}

          {/* Pause overlay */}
          {!isPlaying && !isBuffering && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-16 h-16 bg-primary-500/90 rounded-full flex items-center justify-center animate-pulse-scale">
                <i className="ri-play-fill text-3xl text-background-50 ml-1" />
              </div>
            </div>
          )}

          {/* Long-press 2x indicator */}
          {isLongPressing && (
            <div className="fixed top-4 safe-top left-1/2 -translate-x-1/2 z-[70] pointer-events-none bg-primary-500/90 px-4 py-1.5 rounded-full shadow-lg">
              <span className="text-background-50 text-sm font-bold">2x</span>
            </div>
          )}

          {/* AB Loop indicator */}
          {loopMode !== 'off' && (
            <div className="fixed top-4 safe-top left-1/2 -translate-x-1/2 z-[70]">
              {loopMode === 'setting-a' && (
                <div className="bg-accent-500/90 px-4 py-1.5 rounded-full animate-pulse">
                  <span className="text-background-50 text-xs font-semibold whitespace-nowrap">点击设置循环起点 A</span>
                </div>
              )}
              {loopMode === 'active' && loopB === null && (
                <div className="bg-accent-500/90 px-4 py-1.5 rounded-full animate-pulse">
                  <span className="text-background-50 text-xs font-semibold whitespace-nowrap">点击设置循环终点 B</span>
                </div>
              )}
              {loopMode === 'active' && loopA !== null && loopB !== null && (
                <div className="bg-accent-500/90 px-4 py-2 rounded-full flex items-center gap-2">
                  <span className="text-background-50 text-xs font-semibold whitespace-nowrap">
                    AB循环: {formatTime(loopA)} - {formatTime(loopB)}
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleClearLoop(); }}
                    className="w-5 h-5 flex items-center justify-center rounded-full bg-background-50/30 text-background-50 hover:bg-background-50/50 transition-colors"
                  >
                    <i className="ri-close-line text-xs" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ─── Right Side Action Bar ─── */}
        {/* 垂直排列在右侧中下部，拇指热区 */}
        <div
          className={`absolute right-3 bottom-[28%] flex flex-col items-center gap-3 transition-all duration-300 z-20 ${
            showControls ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4 pointer-events-none'
          }`}
        >
          {/* 收藏 */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              void track(favorited ? 'favorite_remove' : 'favorite_add', { videoId: video.id });
              toggleFavorite(video.id);
            }}
            className="flex flex-col items-center gap-0.5 group"
          >
            <div data-player-control
              className={`w-10 h-10 flex items-center justify-center rounded-full bg-black/50 backdrop-blur-sm active:scale-90 transition-transform ${
                favorited ? 'text-primary-500' : 'text-foreground-50'
              }`}
            >
              <i className={`${favorited ? 'ri-heart-fill' : 'ri-heart-line'} text-xl`} />
            </div>
            <span className="text-[10px] text-foreground-50/80">
              {favorited ? '已收藏' : '收藏'}
            </span>
          </button>

          {/* 分享 */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              void track('share_open', { videoId: video.id });
              setShowShare(true);
            }}
            className="flex flex-col items-center gap-0.5 group"
          >
            <div data-player-control className="w-10 h-10 flex items-center justify-center rounded-full bg-black/50 backdrop-blur-sm text-foreground-50 active:scale-90 transition-transform">
              <i className="ri-share-forward-line text-xl" />
            </div>
            <span className="text-[10px] text-foreground-50/80">分享</span>
          </button>

          {/* AB循环 */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (loopMode === 'active' && loopA !== null && loopB === null) {
                handleSetLoopB();
              } else {
                handleLoopToggle();
              }
            }}
            className="flex flex-col items-center gap-0.5 group"
          >
            <div
              className={`w-10 h-10 flex items-center justify-center rounded-full bg-black/50 backdrop-blur-sm active:scale-90 transition-transform ${
                loopMode !== 'off' ? 'text-accent-400 bg-accent-500/20' : 'text-foreground-50'
              }`}
            >
              <i className={`ri-loop-left-line text-xl ${loopMode !== 'off' ? 'animate-spin-slow' : ''}`} />
            </div>
            <span className="text-[10px] text-foreground-50/80">
              {loopMode === 'off' ? '循环' : loopMode === 'setting-a' ? '设起点' : 'AB循环'}
            </span>
          </button>

          {/* 倍速 */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowSpeedMenu((prev) => !prev);
            }}
            className="flex flex-col items-center gap-0.5 group"
          >
            <div className="w-10 h-10 flex items-center justify-center rounded-full bg-black/50 backdrop-blur-sm text-foreground-50 active:scale-90 transition-transform">
              <span className="text-xs font-bold">{playbackRate}x</span>
            </div>
            <span className="text-[10px] text-foreground-50/80">倍速</span>
          </button>

          {/* 倍速菜单弹出 */}
          {showSpeedMenu && (
            <div className="absolute right-14 bottom-0 bg-background-200/95 backdrop-blur-md rounded-xl border border-background-300/50 overflow-hidden animate-fade-in z-30">
              {[0.5, 0.75, 1, 1.25, 1.5, 2].map((speed) => (
                <button
                  key={speed}
                  onClick={(e) => {
                    e.stopPropagation();
                    setPlaybackRate(speed);
                    setShowSpeedMenu(false);
                  }}
                  className={`w-full text-left px-4 py-2.5 text-sm whitespace-nowrap transition-colors ${
                    playbackRate === speed
                      ? 'text-primary-500 bg-primary-500/10'
                      : 'text-foreground-300 hover:bg-background-300'
                  }`}
                >
                  {speed}x
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ─── Top Bar - only back button ─── */}
        <div
          className={`absolute inset-x-0 top-0 p-4 safe-top transition-all duration-300 z-20 ${
            showControls ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'
          }`}
        >
          <div className="flex items-center justify-between">
            <button
              onClick={handleBack}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-black/50 backdrop-blur-sm text-foreground-50 hover:bg-black/70 transition-colors"
            >
              <span className="text-xs whitespace-nowrap">返回</span>
            </button>

            {/* 留空，操作按钮已移至右侧 */}
            <div />
          </div>
        </div>

        {/* ─── Bottom Controls ─── */}
        {/* Bottom gradient mask */}
        <div
          className={`absolute inset-x-0 bottom-0 h-40 z-10 pointer-events-none bg-gradient-to-t from-black/70 via-black/30 to-transparent transition-all duration-300 ${
            showControls ? 'opacity-100' : 'opacity-0'
          }`}
        />
        <div
          className={`player-bottom-controls absolute inset-x-0 bottom-0 p-4 transition-all duration-300 z-20 ${
            showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
          }`}
        >
          {!!video.highlights?.length && (
            <div className="mb-2 flex gap-2 overflow-x-auto pb-1" data-player-control>
              {video.highlights.map(item => (
                <button key={item.id} onClick={event=>{event.stopPropagation();if(videoElementRef.current)videoElementRef.current.currentTime=logicalToMediaTime(item.time);setProgress(item.time);setIsPlaying(true)}} className="relative h-14 w-24 flex-none overflow-hidden rounded-md border border-white/15 bg-black/40 active:scale-95">
                  <EncryptedCover src={item.image} alt={formatTime(item.time)} className="h-full w-full object-cover" />
                  <span className="absolute bottom-0 right-0 rounded-tl bg-black/70 px-1 py-0.5 text-[9px] text-white">{formatTime(item.time)}</span>
                </button>
              ))}
            </div>
          )}
          {/* Progress bar with chapters */}
          <div className="mb-3">
            {/* Chapter labels directly on progress bar */}
            <div className="relative h-7 mb-0.5">
              {chapters.map((chapter) => {
                const chapterPercent = (chapter.time / video.duration) * 100;
                const leftClamped = Math.max(0, Math.min(100, chapterPercent));
                return (
                  <button
                    key={`${chapter.label}-${chapter.time}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleChapterClick(chapter.time);
                    }}
                    className="absolute bottom-0 -translate-x-1/2 flex flex-col items-center whitespace-nowrap cursor-pointer group"
                    style={{ left: `${leftClamped}%` }}
                  >
                    <span className="inline-block bg-foreground-50/10 backdrop-blur-sm text-foreground-50/80 text-[9px] font-medium px-1.5 py-0.5 rounded-md group-hover:bg-foreground-50/20 group-hover:text-foreground-50 transition-colors">
                      {chapter.label}
                    </span>
                    {/* Triangle pointer */}
                    <div className="w-0 h-0 border-l-[4px] border-r-[4px] border-t-[4px] border-l-transparent border-r-transparent border-t-foreground-50/10 group-hover:border-t-foreground-50/20 transition-colors" />
                  </button>
                );
              })}
            </div>

            {/* Main progress bar */}
            <div
              className="relative cursor-pointer py-3 -my-2 group/progress touch-none select-none"
              onClick={e=>e.stopPropagation()}
              onTouchStart={e=>e.stopPropagation()}
              onTouchMove={e=>e.stopPropagation()}
              onTouchEnd={e=>e.stopPropagation()}
              onPointerDown={e=>{e.stopPropagation();e.preventDefault();if(controlsTimer.current)clearTimeout(controlsTimer.current);setShowControls(true);isScrubbing.current=true;suppressPlayerClick.current=true;resumeAfterScrub.current=!!videoElementRef.current&&!videoElementRef.current.paused;videoElementRef.current?.pause();e.currentTarget.setPointerCapture(e.pointerId);scrubTo(e.clientX,e.currentTarget)}}
              onPointerMove={e=>{if(!isScrubbing.current)return;e.stopPropagation();e.preventDefault();scrubTo(e.clientX,e.currentTarget)}}
              onPointerUp={e=>{if(!isScrubbing.current)return;e.stopPropagation();scrubTo(e.clientX,e.currentTarget);isScrubbing.current=false;setThumbnailPreview(x=>({...x,visible:false}));if(resumeAfterScrub.current)setIsPlaying(true);if(controlsTimer.current)clearTimeout(controlsTimer.current);controlsTimer.current=setTimeout(()=>{setShowControls(false);setShowSpeedMenu(false)},4000);if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId)}}
              onPointerCancel={e=>{e.stopPropagation();isScrubbing.current=false;setThumbnailPreview(x=>({...x,visible:false}));if(controlsTimer.current)clearTimeout(controlsTimer.current);controlsTimer.current=setTimeout(()=>{setShowControls(false);setShowSpeedMenu(false)},4000)}}
            >
              {/* Thumbnail preview */}
              {thumbnailPreview.visible && (
                <div
                  className="absolute z-30 pointer-events-none animate-fade-in"
                  style={{ left: `${thumbnailPreview.percent}%`, top: '-88px', transform: 'translateX(-50%)' }}
                >
                  <div className="flex flex-col items-center">
                    <div className="w-32 h-[72px] rounded-lg overflow-hidden shadow-lg ring-1 ring-foreground-50/20">
                      {video.playbackUrl ? <video ref={previewVideoRef} src={video.playbackUrl} muted playsInline preload="metadata" poster={video.thumbnail} onLoadedMetadata={e=>{e.currentTarget.currentTime=logicalToMediaTime(previewTimeRef.current)}} className="w-full h-full object-cover"/> : <img src={video.thumbnail} alt="" className="w-full h-full object-cover"/>}
                    </div>
                    <span className="text-[10px] font-semibold text-foreground-50 mt-1 bg-black/60 px-1.5 py-0.5 rounded">
                      {formatTime(thumbnailPreview.time)}
                    </span>
                  </div>
                  <div className="w-0 h-0 mx-auto border-l-[5px] border-r-[5px] border-t-[5px] border-l-transparent border-r-transparent border-t-black/60" />
                </div>
              )}
              <div className="h-1 bg-foreground-50/20 rounded-full overflow-hidden relative">
                {/* Loop range highlight */}
                {loopRange && loopRange.width > 0 && (
                  <div
                    className="absolute top-0 h-full bg-accent-500/40 rounded-full z-10"
                    style={{ left: `${loopRange.left}%`, width: `${loopRange.width}%` }}
                  />
                )}
                {/* Loop A marker */}
                {loopA !== null && (
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-accent-400 z-20"
                    style={{ left: `${(loopA / video.duration) * 100}%` }}
                  />
                )}
                {/* Loop B marker */}
                {loopB !== null && (
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-accent-400 z-20"
                    style={{ left: `${(loopB / video.duration) * 100}%` }}
                  />
                )}
                {/* Played progress */}
                <div
                  className="absolute top-0 left-0 h-full bg-primary-500 rounded-full transition-all duration-200 z-10"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[10px] text-foreground-50/70">{formatTime(progress)}</span>
                <span className="text-[10px] text-foreground-50/70">{formatTime(video.duration)}</span>
              </div>
            </div>
          </div>

          {/* Video info */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-start gap-2">
                <div
                  ref={infoLineRef}
                  className={`flex-1 min-w-0 text-xs leading-6 ${showDescription ? 'whitespace-normal' : 'whitespace-nowrap overflow-hidden'}`}
                >
                  <span className="text-foreground-50 text-sm font-semibold mr-1.5">{video.title}</span>
                {video.tags.map((tag) => (
                  <button
                    key={tag}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTagClick(tag);
                    }}
                    className="inline-block text-[11px] leading-5 text-primary-400 bg-primary-500/15 px-2 py-0 rounded-full hover:bg-primary-500/25 transition-colors whitespace-nowrap mr-1"
                  >
                    #{tag}
                  </button>
                ))}
                  {video.description && <span className="text-foreground-400 ml-0.5">{video.description}</span>}
                </div>
                {infoCanExpand && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowDescription((prev) => !prev);
                    }}
                    className="text-[11px] leading-6 text-primary-400 hover:text-primary-300 transition-colors whitespace-nowrap flex-shrink-0"
                  >
                    {showDescription ? '收起' : '展开'}
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>

      {showShare && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 px-5 backdrop-blur-sm"
          onClick={() => setShowShare(false)}
        >
          <div
            data-player-control
            className="w-full max-w-[360px] rounded-2xl border border-white/10 bg-background-100 p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
            onTouchStart={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <div className="text-base font-bold text-foreground-50">分享视频</div>
                <div className="mt-1 line-clamp-2 text-sm leading-5 text-foreground-300">{video.title}</div>
              </div>
              <button onClick={() => setShowShare(false)} className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-white/10 text-foreground-100">
                <i className="ri-close-line text-lg" />
              </button>
            </div>

            <div className="mx-auto mb-4 grid h-60 w-60 place-items-center overflow-hidden rounded-xl bg-white p-2">
              {shareQr ? <img src={shareQr} alt="视频分享二维码" className="h-full w-full" /> : <div className="h-7 w-7 animate-spin rounded-full border-2 border-black/20 border-t-primary-500" />}
            </div>

            <div className="mb-2 text-xs text-foreground-400">分享当前视频的地址</div>
            <div className="flex items-center gap-2 rounded-xl bg-background-200 p-2">
              <div className="min-w-0 flex-1 truncate px-1 text-xs text-foreground-300">{shareUrl}</div>
              <button onClick={() => void copyShareUrl()} className="flex-shrink-0 rounded-lg bg-primary-500 px-3 py-2 text-xs font-semibold text-background-50 active:scale-95">
                {shareCopied ? '已复制' : '复制'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
