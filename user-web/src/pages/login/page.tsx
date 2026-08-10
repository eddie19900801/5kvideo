import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!account.trim()) {
      setError('请输入账号');
      return;
    }
    if (!password) {
      setError('请输入密码');
      return;
    }

    const result = await login(account.trim(), password);
    if (result.success) {
      if (remember) {
        localStorage.setItem('video_platform_remember', 'true');
      } else {
        localStorage.removeItem('video_platform_remember');
      }
      navigate('/profile');
    } else {
      setError(result.message);
    }
  };

  return (
    <div className="min-h-screen bg-background-50 flex flex-col safe-top safe-bottom">
      <header className="px-4 pt-3 pb-2">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-background-200 text-foreground-400 hover:bg-background-300 transition-colors"
        >
          <i className="ri-arrow-left-line" />
        </button>
      </header>

      <main className="flex-1 flex flex-col justify-center px-6 pb-20">
        <div className="mb-10">
          <h1 className="font-heading text-2xl font-bold text-foreground-50 tracking-tight mb-2">
            登录账号
          </h1>
          <p className="text-foreground-500 text-sm">使用已绑定的账号登录，同步收藏和记录</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-foreground-400 text-xs font-medium mb-1.5 block">账号</label>
            <input
              type="text"
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              placeholder="请输入账号"
              className="w-full bg-background-200 text-foreground-100 text-sm px-4 py-3 rounded-xl border border-background-300/50 focus:border-primary-500/50 transition-colors placeholder:text-foreground-500"
            />
          </div>

          <div>
            <label className="text-foreground-400 text-xs font-medium mb-1.5 block">密码</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入密码"
                className="w-full bg-background-200 text-foreground-100 text-sm pl-4 pr-11 py-3 rounded-xl border border-background-300/50 focus:border-primary-500/50 transition-colors placeholder:text-foreground-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-500 hover:text-foreground-300 transition-colors"
              >
                <i className={`${showPassword ? 'ri-eye-off-line' : 'ri-eye-line'} text-sm`} />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setRemember((prev) => !prev)}
              className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                remember
                  ? 'bg-primary-500 border-primary-500'
                  : 'border-foreground-600 bg-transparent'
              }`}
            >
              {remember && <i className="ri-check-line text-[10px] text-background-50" />}
            </button>
            <span className="text-foreground-500 text-xs">记住登录状态</span>
          </div>

          {error && (
            <p className="text-red-400 text-xs bg-red-400/10 px-3 py-2 rounded-lg">{error}</p>
          )}

          <button
            type="submit"
            className="w-full py-3 bg-primary-500 text-background-50 rounded-xl text-sm font-semibold hover:bg-primary-600 transition-colors whitespace-nowrap mt-2"
          >
            登录
          </button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-foreground-600 text-xs">
            还没有账号？关闭此页面即可继续使用游客模式
          </p>
        </div>
      </main>
    </div>
  );
}
