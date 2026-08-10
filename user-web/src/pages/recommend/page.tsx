import BottomNav from '@/components/base/BottomNav';
import { Navigate } from 'react-router-dom';
import { useMode } from '@/contexts/ModeContext';

export default function Recommend() {
  const { mode } = useMode();
  if (mode === 'normal') return <Navigate to="/" replace />;
  return (
    <main className="fixed inset-0 bg-background-50">
      <div className="mx-auto h-[calc(100%-56px-env(safe-area-inset-bottom,0px))] w-full max-w-[480px] overflow-hidden bg-background-50">
        <iframe
          title="5K推荐"
          src="/dahang/"
          className="block h-full w-full border-0"
          allow="autoplay; clipboard-write"
        />
      </div>
      <BottomNav />
    </main>
  );
}
