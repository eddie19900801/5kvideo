import { NavLink, useLocation } from 'react-router-dom';
import { useMode } from '@/contexts/ModeContext';

export default function BottomNav() {
  const location = useLocation();
  const { mode } = useMode();

  const hideNavOn = ['/login'];

  if (hideNavOn.includes(location.pathname)) {
    return null;
  }

  const isVideoPage = location.pathname.startsWith('/video/');
  if (isVideoPage) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex justify-center">
      <div className="w-full max-w-[480px] bg-background-100/95 backdrop-blur-lg border-t border-background-300/50 safe-bottom">
        <div className="flex items-center justify-around h-14">
          <NavLink
            to="/"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-0.5 px-6 py-1 transition-colors ${
                isActive ? 'text-primary-500' : 'text-foreground-500'
              }`
            }
          >
            <i className="ri-home-5-line text-xl" />
            <span className="text-[10px] font-medium">首页</span>
          </NavLink>

          <NavLink
            to="/favorites"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-0.5 px-6 py-1 transition-colors ${
                isActive ? 'text-primary-500' : 'text-foreground-500'
              }`
            }
          >
            <i className="ri-heart-line text-xl" />
            <span className="text-[10px] font-medium">收藏</span>
          </NavLink>

          {mode === '18+' && (
            <NavLink
              to="/recommend"
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-0.5 px-4 py-1 transition-colors ${
                  isActive ? 'text-primary-500' : 'text-foreground-500'
                }`
              }
            >
              <i className="ri-compass-3-line text-xl" />
              <span className="text-[10px] font-medium">推荐</span>
            </NavLink>
          )}

          <NavLink
            to="/profile"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-0.5 px-6 py-1 transition-colors ${
                isActive ? 'text-primary-500' : 'text-foreground-500'
              }`
            }
          >
            <i className="ri-user-3-line text-xl" />
            <span className="text-[10px] font-medium">我的</span>
          </NavLink>
        </div>
      </div>
    </nav>
  );
}
