import { NavLink, useLocation } from 'react-router-dom';

export default function BottomNav() {
  const location = useLocation();
  const hideNavOn = ['/login'];

  if (hideNavOn.includes(location.pathname)) {
    return null;
  }

  return (
    <nav aria-label="底部导航" className="app-bottom-nav fixed bottom-0 left-0 right-0 z-50 flex justify-center">
      <div className="w-full max-w-[520px] border-t border-background-300/50 bg-background-100/95 backdrop-blur-lg safe-bottom safe-x">
        <div className="flex items-center justify-around h-14">
          <NavLink
            to="/"
            end
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
            to="/recommend"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-0.5 px-6 py-1 transition-colors ${
                isActive ? 'text-primary-500' : 'text-foreground-500'
              }`
            }
          >
            <i className="ri-compass-3-line text-xl" />
            <span className="text-[10px] font-medium">推荐</span>
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
