import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useVideo } from '@/contexts/VideoContext';
import BottomNav from '@/components/base/BottomNav';
import { useMode } from '@/contexts/ModeContext';

function formatWatchTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0 && m > 0) return `${h}小时${m}分钟`;
  if (h > 0) return `${h}小时`;
  if (m > 0) return `${m}分钟`;
  return '0分钟';
}

export default function Profile() {
  const navigate = useNavigate();
  const { user, isGuest, login, bindAccount, logout, updatePassword, updateProfile } = useAuth();
  const { favorites, watchHistory, videos } = useVideo();
  const { mode } = useMode();

  const visibleVideoIds = useMemo(
    () => new Set(videos.filter((video) => mode === '18+' || !video.isAdult).map((video) => video.id)),
    [videos, mode],
  );
  const visibleFavorites = favorites.filter((id) => visibleVideoIds.has(id));
  const visibleHistory = watchHistory.filter((record) => visibleVideoIds.has(record.videoId));
  const totalWatchTime = visibleHistory.reduce((sum, r) => sum + r.progress, 0);

  // --- Bind account modal ---
  const [showBindModal, setShowBindModal] = useState(false);
  const [bindAccount2, setBindAccountVal] = useState('');
  const [bindPassword, setBindPassword] = useState('');
  const [bindConfirm, setBindConfirm] = useState('');
  const [bindError, setBindError] = useState('');
  const [bindSuccess, setBindSuccess] = useState('');

  const handleBind = async () => {
    setBindError('');
    setBindSuccess('');

    if (!bindAccount2.trim()) {
      setBindError('请输入账号');
      return;
    }
    if (bindAccount2.trim().length < 3) {
      setBindError('账号至少3个字符');
      return;
    }
    if (!bindPassword) {
      setBindError('请输入密码');
      return;
    }
    if (bindPassword.length < 6) {
      setBindError('密码至少6位');
      return;
    }
    if (bindPassword !== bindConfirm) {
      setBindError('两次输入的密码不一致');
      return;
    }

    const result = await bindAccount(bindAccount2.trim(), bindPassword);
    if (result.success) {
      setBindSuccess(result.message);
      setTimeout(() => {
        setShowBindModal(false);
        setBindAccountVal('');
        setBindPassword('');
        setBindConfirm('');
        setBindError('');
        setBindSuccess('');
      }, 1500);
    } else {
      setBindError(result.message);
    }
  };

  // --- Password change modal ---
  const [showPwdModal, setShowPwdModal] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pwdMsg, setPwdMsg] = useState('');
  const [pwdMsgType, setPwdMsgType] = useState<'success' | 'error'>('error');

  const handleUpdatePassword = async () => {
    if (!oldPassword || !newPassword) {
      setPwdMsg('请填写所有字段');
      setPwdMsgType('error');
      return;
    }
    if (newPassword.length < 6) {
      setPwdMsg('新密码至少6位');
      setPwdMsgType('error');
      return;
    }
    const result = await updatePassword(oldPassword, newPassword);
    setPwdMsg(result.message);
    setPwdMsgType(result.success ? 'success' : 'error');
    if (result.success) {
      setTimeout(() => {
        setShowPwdModal(false);
        setOldPassword('');
        setNewPassword('');
        setPwdMsg('');
      }, 1500);
    }
  };

  // --- Username edit ---
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');

  const startEditName = () => {
    setNameInput(user?.username || '');
    setEditingName(true);
  };

  const saveName = async () => {
    const trimmed = nameInput.trim();
    if (trimmed && trimmed !== user?.username) {
      await updateProfile(trimmed);
    }
    setEditingName(false);
  };

  // --- Logout ---
  const handleLogout = () => {
    void logout();
  };

  // --- Login modal (for already-bound users switching devices) ---
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginAccount, setLoginAccount] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const handleLogin = async () => {
    setLoginError('');
    if (!loginAccount.trim() || !loginPassword) {
      setLoginError('请填写账号和密码');
      return;
    }
    const result = await login(loginAccount.trim(), loginPassword);
    if (result.success) {
      setShowLoginModal(false);
      setLoginAccount('');
      setLoginPassword('');
    } else {
      setLoginError(result.message);
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background-50 pb-20">
      <header className="safe-top px-4 pt-3 pb-3">
        <h1 className="font-heading text-xl font-bold text-foreground-50 tracking-tight">
          我的
        </h1>
      </header>

      <main className="px-4">
        {/* ---- User card ---- */}
        <div className="flex items-center gap-4 py-5 border-b border-background-200">
          <img
            src={user.avatar}
            alt={user.username}
            className="w-16 h-16 rounded-full object-cover border-2 border-background-300 flex-shrink-0"
          />
          <div className="flex-1 min-w-0">
            {editingName ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  maxLength={12}
                  className="flex-1 bg-background-200 text-foreground-100 text-sm px-3 py-1.5 rounded-lg border border-background-300/50"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveName();
                  }}
                />
                <button
                  onClick={saveName}
                  className="text-primary-400 text-sm font-medium whitespace-nowrap hover:text-primary-300 transition-colors"
                >
                  确定
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <h2 className="text-foreground-100 text-base font-semibold">{user.username}</h2>
                <button
                  onClick={startEditName}
                  className="text-foreground-500 hover:text-foreground-300 transition-colors"
                >
                  <i className="ri-edit-line text-xs" />
                </button>
              </div>
            )}
            {isGuest ? (
              <p className="text-foreground-500 text-xs mt-0.5">游客账号</p>
            ) : (
              <p className="text-foreground-500 text-xs mt-0.5">账号：{user.account}</p>
            )}
          </div>

          {!isGuest && (
            <button
              onClick={() => setShowLoginModal(true)}
              className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-background-200 text-foreground-400 text-xs font-medium hover:bg-background-300 transition-colors whitespace-nowrap"
            >
              切换账号
            </button>
          )}
        </div>

        {/* ---- Stats ---- */}
        <div className="flex justify-around py-5 border-b border-background-200">
          <div className="flex flex-col items-center gap-1">
            <span className="text-foreground-100 text-lg font-bold">{visibleFavorites.length}</span>
            <span className="text-foreground-500 text-xs">收藏</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <span className="text-foreground-100 text-lg font-bold">{visibleHistory.length}</span>
            <span className="text-foreground-500 text-xs">观看记录</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <span className="text-foreground-100 text-lg font-bold">{formatWatchTime(totalWatchTime)}</span>
            <span className="text-foreground-500 text-xs">观看时长</span>
          </div>
        </div>

        {/* ---- Menu ---- */}
        <div className="mt-4 space-y-0.5">
          <button
            onClick={() => navigate('/favorites')}
            className="w-full flex items-center justify-between px-4 py-3.5 bg-background-100 rounded-xl hover:bg-background-200 transition-colors"
          >
            <div className="flex items-center gap-3">
              <i className="ri-heart-line text-lg text-foreground-400" />
              <span className="text-foreground-300 text-sm">我的收藏</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-foreground-500 text-xs">{visibleFavorites.length}</span>
              <i className="ri-arrow-right-s-line text-foreground-600" />
            </div>
          </button>

          <button
            onClick={() => navigate('/history')}
            className="w-full flex items-center justify-between px-4 py-3.5 bg-background-100 rounded-xl hover:bg-background-200 transition-colors"
          >
            <div className="flex items-center gap-3">
              <i className="ri-history-line text-lg text-foreground-400" />
              <span className="text-foreground-300 text-sm">观看记录</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-foreground-500 text-xs">{visibleHistory.length}</span>
              <i className="ri-arrow-right-s-line text-foreground-600" />
            </div>
          </button>

          {isGuest ? (
            <button
              onClick={() => {
                setShowBindModal(true);
                setBindError('');
                setBindSuccess('');
                setBindAccountVal('');
                setBindPassword('');
                setBindConfirm('');
              }}
              className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-colors whitespace-nowrap bg-primary-500/10 hover:bg-primary-500/20"
            >
              <i className="ri-link text-lg text-primary-400" />
              <span className="text-primary-400 text-sm font-medium">绑定账号</span>
              <span className="text-foreground-500 text-xs ml-auto">设置密码后可跨设备登录</span>
            </button>
          ) : (
            <>
              <button
                onClick={() => {
                  setShowPwdModal(true);
                  setPwdMsg('');
                  setOldPassword('');
                  setNewPassword('');
                }}
                className="w-full flex items-center gap-3 px-4 py-3.5 bg-background-100 rounded-xl hover:bg-background-200 transition-colors"
              >
                <i className="ri-lock-line text-lg text-foreground-400" />
                <span className="text-foreground-300 text-sm">修改密码</span>
              </button>
            </>
          )}
        </div>

        {!isGuest && (
          <div className="mt-6">
            <button
              onClick={handleLogout}
              className="w-full py-3 bg-background-200 text-foreground-400 rounded-xl text-sm font-medium hover:bg-background-300 transition-colors whitespace-nowrap"
            >
              退出登录
            </button>
            <p className="text-foreground-600 text-xs text-center mt-3">
              退出后将创建新的游客账号，收藏和记录保留在本地
            </p>
          </div>
        )}

        {isGuest && (
          <div className="mt-6">
            <p className="text-foreground-600 text-xs text-center">
              绑定账号后可使用已有账号登录，数据保留在本地
            </p>
          </div>
        )}
      </main>

      {/* ---- Bind account modal ---- */}
      {showBindModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6 animate-fade-in">
          <div className="w-full max-w-[320px] bg-background-200 rounded-2xl p-5">
            <h3 className="text-foreground-100 text-base font-semibold mb-1">绑定账号</h3>
            <p className="text-foreground-500 text-xs mb-4">设置账号密码后可在其他设备登录</p>

            <input
              type="text"
              value={bindAccount2}
              onChange={(e) => setBindAccountVal(e.target.value)}
              placeholder="设置账号（至少3个字符）"
              className="w-full bg-background-100 text-foreground-100 text-sm px-4 py-2.5 rounded-xl border border-background-300/50 mb-3 placeholder:text-foreground-500"
            />
            <input
              type="password"
              value={bindPassword}
              onChange={(e) => setBindPassword(e.target.value)}
              placeholder="设置密码（至少6位）"
              className="w-full bg-background-100 text-foreground-100 text-sm px-4 py-2.5 rounded-xl border border-background-300/50 mb-3 placeholder:text-foreground-500"
            />
            <input
              type="password"
              value={bindConfirm}
              onChange={(e) => setBindConfirm(e.target.value)}
              placeholder="确认密码"
              className="w-full bg-background-100 text-foreground-100 text-sm px-4 py-2.5 rounded-xl border border-background-300/50 mb-3 placeholder:text-foreground-500"
            />

            {bindError && (
              <p className="text-red-400 text-xs bg-red-400/10 px-3 py-2 rounded-lg mb-3">{bindError}</p>
            )}
            {bindSuccess && (
              <p className="text-primary-400 text-xs bg-primary-400/10 px-3 py-2 rounded-lg mb-3">{bindSuccess}</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowBindModal(false)}
                className="flex-1 py-2.5 bg-background-300 text-foreground-400 rounded-xl text-sm font-medium hover:bg-background-400 transition-colors whitespace-nowrap"
              >
                取消
              </button>
              <button
                onClick={handleBind}
                className="flex-1 py-2.5 bg-primary-500 text-background-50 rounded-xl text-sm font-medium hover:bg-primary-600 transition-colors whitespace-nowrap"
              >
                确认绑定
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---- Password change modal ---- */}
      {showPwdModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6 animate-fade-in">
          <div className="w-full max-w-[320px] bg-background-200 rounded-2xl p-5">
            <h3 className="text-foreground-100 text-base font-semibold mb-4">修改密码</h3>

            <input
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              placeholder="原密码"
              className="w-full bg-background-100 text-foreground-100 text-sm px-4 py-2.5 rounded-xl border border-background-300/50 mb-3 placeholder:text-foreground-500"
            />
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="新密码（至少6位）"
              className="w-full bg-background-100 text-foreground-100 text-sm px-4 py-2.5 rounded-xl border border-background-300/50 mb-3 placeholder:text-foreground-500"
            />

            {pwdMsg && (
              <p
                className={`text-xs mb-3 ${
                  pwdMsgType === 'success' ? 'text-primary-400' : 'text-red-400'
                }`}
              >
                {pwdMsg}
              </p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowPwdModal(false)}
                className="flex-1 py-2.5 bg-background-300 text-foreground-400 rounded-xl text-sm font-medium hover:bg-background-400 transition-colors whitespace-nowrap"
              >
                取消
              </button>
              <button
                onClick={handleUpdatePassword}
                className="flex-1 py-2.5 bg-primary-500 text-background-50 rounded-xl text-sm font-medium hover:bg-primary-600 transition-colors whitespace-nowrap"
              >
                确认修改
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---- Login modal (switch account) ---- */}
      {showLoginModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6 animate-fade-in">
          <div className="w-full max-w-[320px] bg-background-200 rounded-2xl p-5">
            <h3 className="text-foreground-100 text-base font-semibold mb-1">切换账号</h3>
            <p className="text-foreground-500 text-xs mb-4">使用已绑定的账号登录</p>

            <input
              type="text"
              value={loginAccount}
              onChange={(e) => setLoginAccount(e.target.value)}
              placeholder="账号"
              className="w-full bg-background-100 text-foreground-100 text-sm px-4 py-2.5 rounded-xl border border-background-300/50 mb-3 placeholder:text-foreground-500"
            />
            <input
              type="password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              placeholder="密码"
              className="w-full bg-background-100 text-foreground-100 text-sm px-4 py-2.5 rounded-xl border border-background-300/50 mb-3 placeholder:text-foreground-500"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleLogin();
              }}
            />

            {loginError && (
              <p className="text-red-400 text-xs bg-red-400/10 px-3 py-2 rounded-lg mb-3">{loginError}</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowLoginModal(false);
                  setLoginError('');
                }}
                className="flex-1 py-2.5 bg-background-300 text-foreground-400 rounded-xl text-sm font-medium hover:bg-background-400 transition-colors whitespace-nowrap"
              >
                取消
              </button>
              <button
                onClick={handleLogin}
                className="flex-1 py-2.5 bg-primary-500 text-background-50 rounded-xl text-sm font-medium hover:bg-primary-600 transition-colors whitespace-nowrap"
              >
                登录
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
