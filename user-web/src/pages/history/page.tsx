import { useNavigate } from 'react-router-dom';
import type { MockVideo } from '@/mocks/videos';
import { useVideo } from '@/contexts/VideoContext';
import BottomNav from '@/components/base/BottomNav';
import { useMode } from '@/contexts/ModeContext';

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  if (days < 30) return `${days}天前`;
  return date.toLocaleDateString('zh-CN');
}

export default function History() {
  const navigate = useNavigate();
  const { watchHistory, removeFromHistory, videos: allMockVideos } = useVideo();
  const { mode } = useMode();

  const recordsWithVideo = watchHistory
    .map((record) => {
      const video = allMockVideos.find((v) => v.id === record.videoId);
      return video && (mode === '18+' || !video.isAdult) ? { ...record, video } : null;
    })
    .filter(Boolean) as { videoId: string; progress: number; duration: number; watchedAt: string; video: MockVideo }[];

  return (
    <div className="min-h-screen bg-background-50 pb-20">
      <header className="sticky top-0 z-40 bg-background-50/95 backdrop-blur-md safe-top">
        <div className="px-4 pt-3 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/profile')}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-background-200 text-foreground-400 hover:bg-background-300 transition-colors"
            >
              <i className="ri-arrow-left-line" />
            </button>
            <h1 className="font-heading text-lg font-bold text-foreground-50 tracking-tight">
              观看记录
            </h1>
          </div>
          {recordsWithVideo.length > 0 && (
            <button
              onClick={() => recordsWithVideo.forEach((record) => removeFromHistory(record.videoId))}
              className="text-xs text-foreground-500 hover:text-red-400 transition-colors whitespace-nowrap"
            >
              清空记录
            </button>
          )}
        </div>
      </header>

      <main className="px-4">
        {recordsWithVideo.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-28">
            <div className="w-20 h-20 rounded-full bg-background-200 flex items-center justify-center mb-5">
              <i className="ri-history-line text-3xl text-foreground-600" />
            </div>
            <p className="text-foreground-400 text-sm font-medium">{mode === 'normal' ? '普通模式下暂无观看记录' : '暂无观看记录'}</p>
            <p className="text-foreground-600 text-xs mt-1 mb-6">观看当前模式的视频后会记录在这里</p>
            <button
              onClick={() => navigate('/')}
              className="px-5 py-2.5 bg-primary-500 text-background-50 rounded-full text-sm font-medium hover:bg-primary-600 transition-colors whitespace-nowrap"
            >
              去发现视频
            </button>
          </div>
        ) : (
          <div className="space-y-3 mt-2">
            {recordsWithVideo.map((record) => {
              const progressPercent = record.duration > 0 ? (record.progress / record.duration) * 100 : 0;
              return (
                <div
                  key={record.videoId}
                  className="bg-background-100 rounded-xl overflow-hidden animate-fade-in"
                >
                  <div className="flex gap-3 p-3">
                    <div
                      className={`relative flex-shrink-0 rounded-lg overflow-hidden ${
                        record.video.aspectRatio === 'portrait' ? 'w-[72px] h-24' : 'w-32 h-[72px]'
                      }`}
                    >
                      <img
                        src={record.video.thumbnail}
                        alt={record.video.title}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute bottom-0 left-0 right-0 h-1 bg-foreground-50/20">
                        <div
                          className="h-full bg-primary-500"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                      <span className="absolute bottom-1.5 right-1.5 bg-black/70 text-foreground-50 text-[9px] px-1 py-0.5 rounded font-medium">
                        {formatTime(record.video.duration)}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0 flex flex-col justify-between">
                      <div>
                        <h3 className="text-foreground-200 text-[13px] font-medium line-clamp-2 leading-snug">
                          {record.video.title}
                        </h3>
                        <p className="text-foreground-500 text-[11px] mt-1">
                          观看至 {formatTime(record.progress)} / {formatTime(record.duration)}
                        </p>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-foreground-600 text-[10px]">
                          {timeAgo(record.watchedAt)}
                        </span>
                        <button
                          onClick={() => {
                            navigate(`/video/${record.videoId}`);
                          }}
                          className="px-3 py-1.5 bg-primary-500 text-background-50 rounded-full text-[11px] font-medium hover:bg-primary-600 transition-colors whitespace-nowrap"
                        >
                          继续播放
                        </button>
                      </div>
                    </div>

                    <button
                      onClick={() => removeFromHistory(record.videoId)}
                      className="flex-shrink-0 w-7 h-7 flex items-center justify-center text-foreground-600 hover:text-red-400 transition-colors"
                    >
                      <i className="ri-close-line text-sm" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
