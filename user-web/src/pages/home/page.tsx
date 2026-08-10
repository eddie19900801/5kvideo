import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { MockVideo } from '@/mocks/videos';
import VideoCard from '@/components/base/VideoCard';
import TagCapsule from '@/components/base/TagCapsule';
import BottomNav from '@/components/base/BottomNav';
import PinModal from '@/components/feature/PinModal';
import { useMode } from '@/contexts/ModeContext';
import { useVideo } from '@/contexts/VideoContext';
import { request } from '@/services/api';

const countryTags = ['国产', '日韩', '欧美'];

interface Suggestion {
  type: 'tag' | 'title';
  text: string;
  display: string;
}

export default function Home() {
  const { videos } = useVideo();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedTags, setSelectedTags] = useState<string[]>(() => {
    const tagParam = searchParams.get('tag');
    return tagParam ? [tagParam] : [];
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [catalogTags, setCatalogTags] = useState<{name:string;usageCount:number}[]>([]);
  const [tagUsage, setTagUsage] = useState<Record<string,number>>(()=>{try{return JSON.parse(localStorage.getItem('video_tag_usage')||'{}')}catch{return {}}});
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [tagsExpanded, setTagsExpanded] = useState(false);
  const [visibleCount, setVisibleCount] = useState(12);
  const [loading, setLoading] = useState(false);
  const loaderRef = useRef<HTMLDivElement>(null);
  const waterfallRef = useRef<HTMLDivElement>(null);
  const tagScrollRef = useRef<HTMLDivElement>(null);
  const [tagScroll, setTagScroll] = useState({ top: 0, height: 20 });
  const [focusedVideoId, setFocusedVideoId] = useState<string | null>(null);

  const { mode, pinSet, setPin, switchToNormal, switchTo18Plus, verifyPin } = useMode();
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [pinModalMode, setPinModalMode] = useState<'setup' | 'verify'>('setup');
  const [pinError, setPinError] = useState('');

  const updateTagScroll = useCallback(() => {
    const element = tagScrollRef.current;
    if (!element) return;
    const height = Math.max(12, (element.clientHeight / Math.max(element.scrollHeight, 1)) * 100);
    const available = Math.max(0, element.scrollHeight - element.clientHeight);
    const top = available > 0 ? (element.scrollTop / available) * (100 - height) : 0;
    setTagScroll({ top, height });
  }, []);

  useEffect(() => {
    let frame = 0;
    const selectFocusedVideo = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const cards = waterfallRef.current?.querySelectorAll<HTMLElement>('[data-home-video-id]');
        if (!cards?.length || document.visibilityState !== 'visible') {
          setFocusedVideoId(null);
          return;
        }
        const viewportTop = 0;
        const viewportBottom = window.innerHeight;
        const viewportCenter = window.innerHeight / 2;
        let bestId: string | null = null;
        let bestScore = -Infinity;
        cards.forEach((card, order) => {
          const rect = card.getBoundingClientRect();
          const visibleHeight = Math.max(0, Math.min(rect.bottom, viewportBottom) - Math.max(rect.top, viewportTop));
          const visibleRatio = visibleHeight / Math.max(1, rect.height);
          if (visibleRatio < 0.35) return;
          const centerDistance = Math.abs((rect.top + rect.bottom) / 2 - viewportCenter);
          // One winner only. Equal side-by-side cards resolve by DOM order (left first).
          const score = visibleRatio * 10000 - centerDistance - order * 0.001;
          if (score > bestScore) {
            bestScore = score;
            bestId = card.dataset.homeVideoId || null;
          }
        });
        setFocusedVideoId(bestId);
      });
    };
    selectFocusedVideo();
    window.addEventListener('scroll', selectFocusedVideo, { passive: true });
    // Mobile Safari can defer scroll events until momentum scrolling ends.
    // Track the finger as well so the largest visible card changes immediately.
    window.addEventListener('touchmove', selectFocusedVideo, { passive: true });
    window.addEventListener('touchend', selectFocusedVideo, { passive: true });
    window.addEventListener('resize', selectFocusedVideo);
    document.addEventListener('visibilitychange', selectFocusedVideo);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', selectFocusedVideo);
      window.removeEventListener('touchmove', selectFocusedVideo);
      window.removeEventListener('touchend', selectFocusedVideo);
      window.removeEventListener('resize', selectFocusedVideo);
      document.removeEventListener('visibilitychange', selectFocusedVideo);
    };
  }, [visibleCount, videos, selectedTags, searchQuery]);
  useEffect(()=>{void request<{name:string;usageCount:number}[]>('/tags').then(setCatalogTags).catch(console.error)},[videos]);
  const rememberTag=useCallback((tag:string)=>{setTagUsage(prev=>{const next={...prev,[tag]:(prev[tag]||0)+1};localStorage.setItem('video_tag_usage',JSON.stringify(next));return next})},[]);

  const handleModeToggle = () => {
    if (mode === '18+') {
      switchToNormal();
      return;
    }

    if (!pinSet) {
      setPinModalMode('setup');
      setPinError('');
      setPinModalOpen(true);
    } else {
      setPinModalMode('verify');
      setPinError('');
      setPinModalOpen(true);
    }
  };

  const handlePinConfirm = (pin: string) => {
    if (pinModalMode === 'setup') {
      setPin(pin);
      switchTo18Plus();
      setPinModalOpen(false);
      setPinError('');
    } else {
      if (verifyPin(pin)) {
        switchTo18Plus();
        setPinModalOpen(false);
        setPinError('');
      } else {
        setPinError('PIN码错误，请重新输入');
      }
    }
  };

  useEffect(() => {
    const tagParam = searchParams.get('tag');
    if (tagParam) {
      setSelectedTags([tagParam]);
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('tag');
      setSearchParams(newParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    if (mode === '18+') catalogTags.forEach(t=>tagSet.add(t.name));
    videos
      .filter((video) => mode === '18+' || !video.isAdult)
      .forEach((video) => video.tags.forEach((tag) => tagSet.add(tag)));
    return Array.from(tagSet);
  }, [catalogTags, videos, mode]);

  const visibleCountryTags = useMemo(
    () => countryTags.filter((tag) => allTags.includes(tag)),
    [allTags],
  );

  const otherTagPool = useMemo(() => {
    return allTags.filter((t) => !countryTags.includes(t)).sort((a,b)=>{
      const personal=(tagUsage[b]||0)-(tagUsage[a]||0);
      return personal||((catalogTags.find(x=>x.name===b)?.usageCount||0)-(catalogTags.find(x=>x.name===a)?.usageCount||0));
    });
  }, [allTags, catalogTags, tagUsage]);

  useEffect(() => {
    if (!tagsExpanded) return;
    const frame = requestAnimationFrame(updateTagScroll);
    return () => cancelAnimationFrame(frame);
  }, [tagsExpanded, otherTagPool, updateTagScroll]);

  const [currentOtherTags, setCurrentOtherTags] = useState<string[]>([]);
  useEffect(()=>setCurrentOtherTags(otherTagPool.slice(0,7)),[otherTagPool]);

  const suggestions = useMemo((): Suggestion[] => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.trim().toLowerCase();
    const results: Suggestion[] = [];

    const matchingTags = allTags.filter((t) => t.toLowerCase().includes(q));
    matchingTags.slice(0, 5).forEach((t) => {
      results.push({ type: 'tag', text: t, display: `#${t}` });
    });

    const matchingVideos = videos.filter(
      (v) =>
        v.title.toLowerCase().includes(q) ||
        v.description.toLowerCase().includes(q) ||
        v.tags.some((t) => t.toLowerCase().includes(q))
    );
    matchingVideos.slice(0, 5).forEach((v) => {
      results.push({ type: 'title', text: v.id, display: v.title });
    });

    return results.slice(0, 8);
  }, [searchQuery, allTags, videos]);

  const filteredVideos = useMemo(() => {
    let result = mode === 'normal' ? videos.filter((v) => !v.isAdult) : videos;

    if (selectedTags.length > 0) {
      result = result.filter((v) =>
        selectedTags.some((tag) => v.tags.includes(tag))
      );
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (v) =>
          v.title.toLowerCase().includes(q) ||
          v.description.toLowerCase().includes(q) ||
          v.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    return result;
  }, [videos, selectedTags, searchQuery, mode]);

  const displayedVideos = useMemo(() => {
    return filteredVideos.slice(0, visibleCount);
  }, [filteredVideos, visibleCount]);
  const focusedVideoIndex = useMemo(
    () => displayedVideos.findIndex((video) => video.id === focusedVideoId),
    [displayedVideos, focusedVideoId]
  );

  const hasMore = visibleCount < filteredVideos.length;

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          setLoading(true);
          setTimeout(() => {
            setVisibleCount((prev) => prev + 12);
            setLoading(false);
          }, 600);
        }
      },
      { threshold: 0.1 }
    );

    const el = loaderRef.current;
    if (el) observer.observe(el);

    return () => {
      if (el) observer.unobserve(el);
    };
  }, [hasMore, loading]);

  const toggleTag = useCallback((tag: string) => {
    rememberTag(tag);
    setSelectedTags((prev) => {
      const removing = prev.length === 1 && prev[0] === tag;
      setSearchQuery(removing ? '' : tag);
      return removing ? [] : [tag];
    });
    setShowSuggestions(false);
    setVisibleCount(12);
  }, [rememberTag]);

  const clearAllTags = useCallback(() => {
    setSelectedTags([]);
    setSearchQuery('');
    setVisibleCount(12);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowSuggestions(false);
    setVisibleCount(12);
  };

  const handleSuggestionClick = (suggestion: Suggestion) => {
    if (suggestion.type === 'tag') {
      rememberTag(suggestion.text);
      setSelectedTags([suggestion.text]);
      setSearchQuery(suggestion.text);
    } else {
      navigate(`/video/${suggestion.text}`);
    }
    setShowSuggestions(false);
    setVisibleCount(12);
  };

  return (
    <div className="min-h-screen bg-background-50 pb-20">
      <header className="sticky top-0 z-40 bg-background-50/95 backdrop-blur-md safe-top">
        <div className="px-4 pt-3 pb-2">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <img
                src="/icons/5k-video-app-icon-192.png"
                alt="5K视频"
                className="w-9 h-9 rounded-[10px] object-cover shadow-lg shadow-primary-500/10"
              />
              <div>
                <h1 className="font-heading text-xl font-bold text-foreground-50 tracking-wide">
                  5K视频
                </h1>
                <p className="text-[10px] text-foreground-500 leading-tight">永久域名：5k.ag</p>
              </div>
            </div>

            <button
              onClick={handleModeToggle}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] font-medium transition-colors whitespace-nowrap ${
                mode === '18+'
                  ? 'bg-primary-500/15 text-primary-400'
                  : 'bg-secondary-500/10 text-secondary-400'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${mode === '18+' ? 'bg-primary-400' : 'bg-secondary-400'}`} />
              {mode === 'normal' ? '普通模式' : '18+ 模式'}
            </button>
          </div>

          <form onSubmit={handleSearchSubmit} className="relative">
            <div className="relative">
              <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-foreground-500 text-sm" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSelectedTags([]);
                  setShowSuggestions(true);
                }}
                onFocus={() => {
                  setShowSuggestions(true);
                  setTagsExpanded(true);
                }}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                placeholder="搜索视频、标题或 #标签"
                className="w-full bg-background-200 text-foreground-100 text-sm pl-9 pr-4 py-2.5 rounded-xl border border-background-300/50 focus:border-primary-500/50 transition-colors placeholder:text-foreground-500"
              />
            </div>

            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-background-200 rounded-xl border border-background-300/50 overflow-hidden shadow-2xl z-50 animate-fade-in">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleSuggestionClick(s)}
                    className="w-full text-left px-4 py-2.5 text-sm text-foreground-300 hover:bg-background-300 transition-colors flex items-center gap-2"
                  >
                    <i
                      className={`${
                        s.type === 'tag' ? 'ri-hashtag' : 'ri-video-line'
                      } text-foreground-500 text-xs`}
                    />
                    <span className="line-clamp-1">{s.display}</span>
                  </button>
                ))}
              </div>
            )}
          </form>
        </div>

        <div className="px-4 pb-2">
          <div className="mb-1.5">
            {tagsExpanded ? (
              <>
                <div className="relative">
                  <div
                    ref={tagScrollRef}
                    onScroll={updateTagScroll}
                    className="h-[225px] overflow-y-scroll pr-3"
                  >
                    <div className="flex flex-wrap gap-x-1.5 gap-y-1.5 pb-4">
                      {visibleCountryTags.map((tag) => (
                        <TagCapsule key={tag} label={tag} selected={selectedTags.includes(tag)} onClick={() => toggleTag(tag)} />
                      ))}
                      <span className="w-px h-4 bg-background-300/60 mx-0.5 self-center" />
                      {otherTagPool.map((tag) => (
                        <TagCapsule key={tag} label={tag} selected={selectedTags.includes(tag)} onClick={() => toggleTag(tag)} />
                      ))}
                    </div>
                  </div>
                  <div className="pointer-events-none absolute bottom-0 right-0 top-0 w-1 rounded-full bg-background-300/70">
                    <div
                      className="absolute left-0 w-1 rounded-full bg-primary-400"
                      style={{ top: `${tagScroll.top}%`, height: `${tagScroll.height}%` }}
                    />
                  </div>
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-3 bg-gradient-to-t from-background-50 to-transparent" />
                </div>
                <div className="flex justify-end pt-1">
                  <button onClick={() => setTagsExpanded(false)} className="flex h-6 items-center gap-0.5 rounded-full px-2 text-[11px] text-primary-400 hover:bg-background-200 transition-colors">
                    收起<i className="ri-arrow-up-s-line text-sm" />
                  </button>
                </div>
              </>
            ) : (
              <div className="flex flex-wrap gap-x-1.5 gap-y-1.5">
              {visibleCountryTags.map((tag) => (
                <TagCapsule
                  key={tag}
                  label={tag}
                  selected={selectedTags.includes(tag)}
                  onClick={() => toggleTag(tag)}
                />
              ))}
              <span className="w-px h-4 bg-background-300/60 mx-0.5 self-center" />
              {currentOtherTags.map((tag) => (
                <TagCapsule
                  key={tag}
                  label={tag}
                  selected={selectedTags.includes(tag)}
                  onClick={() => toggleTag(tag)}
                />
              ))}
              <button
                onClick={() => setTagsExpanded((value) => !value)}
                className="ml-auto flex h-6 items-center gap-0.5 rounded-full px-2 text-[11px] text-primary-400 hover:bg-background-200 transition-colors"
              >
                展开
                <i className="ri-arrow-down-s-line text-sm" />
              </button>
              </div>
            )}
          </div>

          {selectedTags.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex flex-wrap gap-1.5">
                {selectedTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className="whitespace-nowrap bg-primary-500/15 text-primary-400 text-[11px] px-2.5 py-1 rounded-full flex items-center gap-1 hover:bg-primary-500/25 transition-colors"
                  >
                    #{tag}
                    <i className="ri-close-line text-xs" />
                  </button>
                ))}
              </div>
              <button
                onClick={clearAllTags}
                className="whitespace-nowrap text-[11px] text-foreground-500 hover:text-foreground-300 transition-colors"
              >
                清除全部
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="px-3 mt-2">
        {filteredVideos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <i className="ri-search-line text-5xl text-foreground-700 mb-4" />
            <p className="text-foreground-500 text-sm">没有找到相关视频</p>
            <p className="text-foreground-600 text-xs mt-1">尝试其他搜索词或标签</p>
            {selectedTags.length > 0 && (
              <button
                onClick={clearAllTags}
                className="mt-4 px-4 py-2 bg-primary-500 text-background-50 rounded-full text-sm font-medium hover:bg-primary-600 transition-colors"
              >
                清除筛选
              </button>
            )}
          </div>
        ) : (
          <>
            <div
              ref={waterfallRef}
              className="grid w-full items-start gap-2.5"
              style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}
            >
              {[0, 1].map((column) => (
                <div key={column} className="flex w-full min-w-0 flex-col gap-2.5">
                  {displayedVideos.map((video, i) =>
                    i % 2 === column ? (
                      <div key={video.id} data-home-video-id={video.id}>
                        <VideoCard
                          video={video}
                          index={i}
                          isFocused={focusedVideoId === video.id}
                          shouldPreload={focusedVideoIndex >= 0 && Math.abs(i - focusedVideoIndex) <= 2}
                        />
                      </div>
                    ) : null
                  )}
                </div>
              ))}
            </div>

            <div ref={loaderRef} className="py-6 flex justify-center">
              {loading && (
                <div className="flex items-center gap-2 text-foreground-500 text-sm">
                  <div className="w-4 h-4 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
                  加载中...
                </div>
              )}
              {!hasMore && filteredVideos.length > 0 && (
                <p className="text-foreground-600 text-xs">已加载全部视频</p>
              )}
            </div>
          </>
        )}
      </main>

      {pinModalOpen && (
        <PinModal
          mode={pinModalMode}
          error={pinError}
          onConfirm={handlePinConfirm}
          onCancel={() => {
            setPinModalOpen(false);
            setPinError('');
          }}
        />
      )}

      <BottomNav />
    </div>
  );
}
