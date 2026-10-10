import { useState, useRef, useEffect } from 'react';
import { type MockVideo } from '@/mocks/videos';
import { useVideo } from '@/contexts/VideoContext';
import { useNavigate } from 'react-router-dom';
import { attachVideo } from '@/services/player';
import { track } from '@/services/analytics';
import { EncryptedCover, useEncryptedCover } from './EncryptedCover';

interface VideoCardProps {
  video: MockVideo;
  index: number;
  isFocused?: boolean;
  shouldPreload?: boolean;
}

function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatViews(views: number): string {
  if (views >= 10000) {
    return `${(views / 10000).toFixed(1)}万`;
  }
  return views.toString();
}

export default function VideoCard({ video, index, isFocused = false, shouldPreload = true }: VideoCardProps) {
  const coverUrl = useEncryptedCover(video.thumbnail);
  const navigate = useNavigate();
  const { isFavorited, toggleFavorite } = useVideo();
  const favorited = isFavorited(video.id);
  const [previewing, setPreviewing] = useState(false);
  const [previewReady, setPreviewReady] = useState(false);
  const previewRef = useRef<HTMLVideoElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressStart = useRef({ x: 0, y: 0 });
  const suppressClick = useRef(false);
  const focusedRef = useRef(isFocused);
  const impressionTracked = useRef(false);

  focusedRef.current = isFocused;

  const handleClick = () => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    const currentTime = previewRef.current?.currentTime ?? 0;
    if (currentTime > 0) {
      sessionStorage.setItem(`home_video_handoff_${video.id}`, String(currentTime));
    }
    navigate(`/video/${video.id}`);
  };

  const cancelLongPress = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTimer.current = null;
    setPreviewing(isFocused);
    if (isFocused) void previewRef.current?.play().catch(() => undefined);
    else previewRef.current?.pause();
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    pressStart.current = { x: e.clientX, y: e.clientY };
    // Must happen synchronously inside the user's press gesture on iOS.
    const player = previewRef.current;
    if (player) void player.play().catch(() => undefined);
    longPressTimer.current = setTimeout(() => {
      suppressClick.current = true;
      setPreviewing(true);
    }, 450);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const distance = Math.hypot(e.clientX - pressStart.current.x, e.clientY - pressStart.current.y);
    const threshold = e.pointerType === 'touch' ? (previewing ? 40 : 20) : 12;
    if (distance > threshold) {
      cancelLongPress();
    }
  };

  const handleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleFavorite(video.id);
  };

  useEffect(() => {
    const element = previewRef.current;
    if (!element || !video.playbackUrl || !shouldPreload) {
      setPreviewReady(false);
      return;
    }
    setPreviewReady(false);
    const detach = attachVideo(element, video.playbackUrl, { preview: true });
    element.muted = true;
    const seekPastBlackOpening = () => {
      if (Number.isFinite(element.duration) && element.duration > 1) {
        element.currentTime = Math.min(1, element.duration / 2);
      }
    };
    const revealFirstFrame = () => {
      if (element.readyState >= 2 && element.currentTime >= 0.15) setPreviewReady(true);
    };
    element.addEventListener('loadedmetadata', seekPastBlackOpening, { once: true });
    element.addEventListener('seeked', revealFirstFrame);
    element.addEventListener('timeupdate', revealFirstFrame);
    return () => {
      element.removeEventListener('loadedmetadata', seekPastBlackOpening);
      element.removeEventListener('seeked', revealFirstFrame);
      element.removeEventListener('timeupdate', revealFirstFrame);
      detach();
    };
  }, [video.playbackUrl, shouldPreload]);

  useEffect(() => {
    const player = previewRef.current;
    if (!player || !video.playbackUrl || !shouldPreload) return;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    const playWhenReady = () => {
      if (!focusedRef.current) return;
      player.muted = true;
      player.playsInline = true;
      void player.play().catch(() => {
        // HLS on mobile may reject play while switching/loading its source.
        // Retry briefly while this card remains the focused card.
        if (focusedRef.current) retryTimer = setTimeout(playWhenReady, 250);
      });
    };
    if (isFocused) {
      if (!impressionTracked.current) {
        impressionTracked.current = true;
        void track('video_impression', { videoId: video.id, metadata: { source: 'home' } });
      }
      setPreviewing(true);
      playWhenReady();
      player.addEventListener('loadeddata', playWhenReady);
      player.addEventListener('canplay', playWhenReady);
    } else {
      setPreviewing(false);
      player.pause();
    }
    return () => {
      if (retryTimer) clearTimeout(retryTimer);
      player.removeEventListener('loadeddata', playWhenReady);
      player.removeEventListener('canplay', playWhenReady);
    };
  }, [isFocused, video.id, video.playbackUrl, shouldPreload]);

  useEffect(() => () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  }, []);

  const isPortrait = video.aspectRatio === 'portrait';
  return (
    <div
      data-card-index={index}
      className="video-card w-full min-w-0 cursor-pointer group select-none"
      onClick={handleClick}
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={cancelLongPress}
      onPointerCancel={cancelLongPress}
      onPointerLeave={(e) => {
        // A held finger near the right screen edge can briefly leave the card's
        // hit box on mobile. Do not cancel an active touch preview for that.
        if (e.pointerType === 'mouse') cancelLongPress();
      }}
    >
      <div
        className={`relative overflow-hidden rounded-lg ${
          isPortrait ? 'aspect-[3/4]' : 'aspect-[16/9]'
        }`}
      >
        <EncryptedCover
          src={video.thumbnail}
          alt={video.title}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
          draggable={false}
        />

        {video.playbackUrl && (
          <video
            ref={previewRef}
            poster={coverUrl}
            muted
            playsInline
            preload={isFocused ? 'auto' : shouldPreload ? 'metadata' : 'none'}
            disablePictureInPicture
            className={`absolute inset-0 w-full h-full object-cover pointer-events-none transition-opacity duration-200 ${previewing && previewReady ? 'opacity-100' : 'opacity-0'}`}
          />
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

        <span className="absolute bottom-2 left-2 bg-black/70 text-foreground-50 text-[10px] px-1.5 py-0.5 rounded font-medium">
          {formatDuration(video.duration)}
        </span>

        <span className="absolute bottom-2 right-2 bg-black/70 text-foreground-50 text-[10px] px-1.5 py-0.5 rounded font-medium">
          {formatViews(video.views)}次播放
        </span>

        <button
          onClick={handleFavorite}
          className={`absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-full bg-black/50 backdrop-blur-sm transition-all active:scale-90 ${
            favorited ? 'text-primary-500' : 'text-foreground-50/80'
          }`}
        >
          <i className={`${favorited ? 'ri-heart-fill' : 'ri-heart-line'} text-sm`} />
        </button>
      </div>

      <div className="mt-2 px-0.5">
        <h3 className="text-foreground-100 text-[13px] font-medium leading-tight line-clamp-2">
          {video.title}
        </h3>

        <div className="flex flex-wrap gap-1 mt-1.5">
          {video.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="text-[10px] text-primary-400 bg-primary-500/10 px-1.5 py-0.5 rounded"
            >
              #{tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
