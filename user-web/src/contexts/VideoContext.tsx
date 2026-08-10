import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { type MockVideo } from '@/mocks/videos';
import { request, saveProgress } from '@/services/api';
import { trackAppOpen } from '@/services/analytics';
import { useAuth } from '@/contexts/AuthContext';
import { useMode } from '@/contexts/ModeContext';

interface WatchRecord {
  videoId: string;
  progress: number;
  duration: number;
  watchedAt: string;
}

interface VideoContextType {
  videos: MockVideo[];
  videosLoading: boolean;
  setVideoViews: (videoId: string, views: number) => void;
  favorites: string[];
  watchHistory: WatchRecord[];
  addToFavorites: (videoId: string) => void;
  removeFromFavorites: (videoId: string) => void;
  toggleFavorite: (videoId: string) => void;
  isFavorited: (videoId: string) => boolean;
  addToHistory: (videoId: string, progress: number, duration: number) => void;
  removeFromHistory: (videoId: string) => void;
  clearHistory: () => void;
  getWatchProgress: (videoId: string) => number;
}

const VideoContext = createContext<VideoContextType | null>(null);
const modeValue = (mode: 'normal' | '18+') => mode === '18+' ? 'adult' as const : 'normal' as const;
const cacheKey = (kind: 'favorites' | 'history', userId: string, mode: 'normal' | '18+') => `5k_${kind}_${userId}_${modeValue(mode)}`;

function readCache<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) || '') as T; } catch { return fallback; }
}

export function VideoProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { mode } = useMode();
  const apiMode = modeValue(mode);
  const [videos, setVideos] = useState<MockVideo[]>([]);
  const [videosLoading, setVideosLoading] = useState(true);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [watchHistory, setWatchHistory] = useState<WatchRecord[]>([]);
  const setVideoViews = useCallback((videoId:string, views:number)=>setVideos(prev=>prev.map(v=>v.id===videoId?{...v,views}:v)),[]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    const favoriteKey = cacheKey('favorites', user.id, mode);
    const historyKey = cacheKey('history', user.id, mode);
    setVideosLoading(true);
    setFavorites(readCache(favoriteKey, []));
    setWatchHistory(readCache(historyKey, []));
    void Promise.all([
      request<(Omit<MockVideo,'chapters'> & {chapters?:MockVideo['chapters']})[]>(`/videos?adult=${mode === '18+'}`),
      request<MockVideo[]>(`/me/favorites?mode=${apiMode}`),
      request<Array<{videoId:string;progress:number;duration:number;updatedAt:string}>>(`/me/history?mode=${apiMode}`),
    ]).then(([videoRows, favoriteRows, historyRows]) => {
      if (!active) return;
      setVideos(videoRows.map(video=>({...video,chapters:video.chapters||[]})));
      const favoriteIds = favoriteRows.map(video=>video.id);
      const history = historyRows.map(item=>({videoId:item.videoId,progress:item.progress,duration:item.duration,watchedAt:item.updatedAt}));
      setFavorites(favoriteIds);
      setWatchHistory(history);
      localStorage.setItem(favoriteKey, JSON.stringify(favoriteIds));
      localStorage.setItem(historyKey, JSON.stringify(history));
      void trackAppOpen();
    }).catch(console.error).finally(()=>{if(active)setVideosLoading(false)});
    return()=>{active=false};
  }, [user, mode, apiMode]);

  useEffect(() => {
    if (user) localStorage.setItem(cacheKey('favorites', user.id, mode), JSON.stringify(favorites));
  }, [favorites, user, mode]);
  useEffect(() => {
    if (user) localStorage.setItem(cacheKey('history', user.id, mode), JSON.stringify(watchHistory));
  }, [watchHistory, user, mode]);

  const addToFavorites = useCallback((videoId: string) => {
    setFavorites(prev=>prev.includes(videoId)?prev:[...prev,videoId]);
    void request(`/videos/${videoId}/favorite`,{method:'PUT',body:JSON.stringify({mode:apiMode})}).catch(()=>setFavorites(prev=>prev.filter(id=>id!==videoId)));
  }, [apiMode]);
  const removeFromFavorites = useCallback((videoId: string) => {
    setFavorites(prev=>prev.filter(id=>id!==videoId));
    void request(`/videos/${videoId}/favorite?mode=${apiMode}`,{method:'DELETE'}).catch(()=>setFavorites(prev=>prev.includes(videoId)?prev:[...prev,videoId]));
  }, [apiMode]);
  const toggleFavorite = useCallback((videoId: string) => {
    if(favorites.includes(videoId))removeFromFavorites(videoId);else addToFavorites(videoId);
  }, [favorites, addToFavorites, removeFromFavorites]);
  const isFavorited = useCallback((videoId: string) => favorites.includes(videoId), [favorites]);

  const addToHistory = useCallback((videoId: string, progress: number, duration: number) => {
    if (progress >= 10) void saveProgress(videoId, progress, duration, apiMode).catch(console.error);
    setWatchHistory(prev=>{
      const record={videoId,progress,duration,watchedAt:new Date().toISOString()};
      const existing=prev.findIndex(item=>item.videoId===videoId);
      if(existing<0)return [record,...prev];
      const updated=[...prev];updated[existing]=record;return updated;
    });
  }, [apiMode]);
  const removeFromHistory = useCallback((videoId: string) => {
    setWatchHistory(prev=>prev.filter(item=>item.videoId!==videoId));
    void request(`/videos/${videoId}/progress?mode=${apiMode}`,{method:'DELETE'}).catch(console.error);
  }, [apiMode]);
  const clearHistory = useCallback(() => {
    setWatchHistory([]);
    void request(`/me/history?mode=${apiMode}`,{method:'DELETE'}).catch(console.error);
  }, [apiMode]);
  const getWatchProgress = useCallback((videoId: string) => watchHistory.find(item=>item.videoId===videoId)?.progress || 0, [watchHistory]);

  return <VideoContext.Provider value={{videos,videosLoading,setVideoViews,favorites,watchHistory,addToFavorites,removeFromFavorites,toggleFavorite,isFavorited,addToHistory,removeFromHistory,clearHistory,getWatchProgress}}>{children}</VideoContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useVideo() {
  const ctx = useContext(VideoContext);
  if (!ctx) throw new Error('useVideo must be used within VideoProvider');
  return ctx;
}
