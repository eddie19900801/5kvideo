import { useEffect, useState } from 'react';

interface SplashScreenProps {
  minDuration?: number;
  onComplete?: () => void;
}

export default function SplashScreen({ minDuration = 2000, onComplete }: SplashScreenProps) {
  const [phase, setPhase] = useState<'enter' | 'hold' | 'exit' | 'done'>('enter');

  useEffect(() => {
    const enterTimer = setTimeout(() => setPhase('hold'), 400);
    const exitTimer = setTimeout(() => setPhase('exit'), minDuration);
    const doneTimer = setTimeout(() => {
      setPhase('done');
      onComplete?.();
    }, minDuration + 500);

    return () => {
      clearTimeout(enterTimer);
      clearTimeout(exitTimer);
      clearTimeout(doneTimer);
    };
  }, [minDuration, onComplete]);

  if (phase === 'done') return null;

  const opacityClass = phase === 'enter'
    ? 'opacity-0'
    : phase === 'exit'
    ? 'opacity-0'
    : 'opacity-100';

  const translateClass = phase === 'enter'
    ? 'translate-y-4'
    : phase === 'exit'
    ? '-translate-y-4'
    : 'translate-y-0';

  return (
    <div
      className={`fixed inset-0 z-[100] bg-background-50 flex flex-col items-center justify-center transition-all duration-500 ${opacityClass}`}
    >
      <div className={`flex flex-col items-center gap-5 transition-all duration-500 ${translateClass}`}>
        {/* Icon */}
        <div className="relative">
          <div className="absolute inset-2 rounded-3xl bg-primary-500/30 blur-xl animate-pulse" />
          <img
            src="/icons/5k-video-app-icon-192.png"
            alt="5K视频"
            className="relative w-24 h-24 rounded-[24px] object-cover shadow-2xl shadow-primary-500/20"
          />
        </div>

        {/* Brand name */}
        <h1 className="font-heading text-3xl font-bold text-foreground-50 tracking-wide">
          5K视频
        </h1>

        {/* Tagline */}
        <p className="text-foreground-500 text-sm">永久域名：5k.ag</p>

        {/* Loading bar */}
        <div className="w-32 h-0.5 bg-background-200 rounded-full overflow-hidden mt-2">
          <div className="h-full bg-primary-400 rounded-full animate-[shimmer_1.5s_infinite]" />
        </div>
      </div>
    </div>
  );
}
