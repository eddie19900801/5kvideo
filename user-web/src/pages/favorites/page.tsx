import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useVideo } from '@/contexts/VideoContext';
import VideoCard from '@/components/base/VideoCard';
import BottomNav from '@/components/base/BottomNav';
import { useMode } from '@/contexts/ModeContext';

export default function Favorites() {
  const navigate = useNavigate();
  const { favorites, videos: allMockVideos } = useVideo();
  const { mode } = useMode();
  const [searchQuery, setSearchQuery] = useState('');

  const favoritedVideos = useMemo(() => {
    let videos = allMockVideos.filter(
      (v) => favorites.includes(v.id) && (mode === '18+' || !v.isAdult),
    );
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      videos = videos.filter(
        (v) =>
          v.title.toLowerCase().includes(q) ||
          v.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    return videos;
  }, [allMockVideos, favorites, searchQuery, mode]);

  return (
    <div className="min-h-screen bg-background-50 pb-20">
      <header className="sticky top-0 z-40 bg-background-50/95 backdrop-blur-md safe-top">
        <div className="px-4 pt-3 pb-3">
          <h1 className="font-heading text-xl font-bold text-foreground-50 tracking-tight mb-3">
            我的收藏
          </h1>
          {favoritedVideos.length > 0 && (
            <div className="relative">
              <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-foreground-500 text-sm" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索收藏内容"
                className="w-full bg-background-200 text-foreground-100 text-sm pl-9 pr-4 py-2.5 rounded-xl border border-background-300/50 focus:border-primary-500/50 transition-colors placeholder:text-foreground-500"
              />
            </div>
          )}
        </div>
      </header>

      <main className="px-3 mt-2">
        {favoritedVideos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-28">
            <div className="w-20 h-20 rounded-full bg-background-200 flex items-center justify-center mb-5">
              <i className="ri-heart-line text-3xl text-foreground-600" />
            </div>
            <p className="text-foreground-400 text-sm font-medium">你还没有收藏视频</p>
            <p className="text-foreground-600 text-xs mt-1 mb-6">发现感兴趣的视频，点击爱心即可收藏</p>
            <button
              onClick={() => navigate('/')}
              className="px-5 py-2.5 bg-primary-500 text-background-50 rounded-full text-sm font-medium hover:bg-primary-600 transition-colors whitespace-nowrap"
            >
              去发现视频
            </button>
          </div>
        ) : (
          <>
            <p className="text-foreground-500 text-xs px-1 mb-3">
              共 {favoritedVideos.length} 个收藏
            </p>
            <div className="grid grid-cols-2 items-start gap-2.5">
              {[0, 1].map((column) => (
                <div key={column} className="flex min-w-0 flex-col gap-2.5">
                  {favoritedVideos.map((video, i) =>
                    i % 2 === column ? <VideoCard key={video.id} video={video} index={i} /> : null
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
