import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { ApiError, ensureGuest, request } from '@/services/api';

interface SessionUser {
  id: string;
  username: string;
  account: string;
  role?: 'user' | 'admin';
  isGuest: boolean;
  avatar: string;
}

interface AuthResult { success: boolean; message: string }
interface AuthResponse {
  token: string;
  user: Omit<SessionUser, 'avatar'>;
}

interface AuthContextType {
  user: SessionUser | null;
  isLoggedIn: boolean;
  isGuest: boolean;
  isLoading: boolean;
  login: (account: string, password: string) => Promise<AuthResult>;
  bindAccount: (account: string, password: string) => Promise<AuthResult>;
  logout: () => Promise<void>;
  updatePassword: (oldPassword: string, newPassword: string) => Promise<AuthResult>;
  updateProfile: (username: string) => Promise<AuthResult>;
}

const AuthContext = createContext<AuthContextType | null>(null);
const TOKEN_KEY = 'video_api_token';
const AVATAR = 'https://readdy.ai/api/search-image?query=Modern%20minimalist%20default%20user%20avatar%2C%20simple%20circular%20portrait%2C%20neutral%20expression%2C%20soft%20warm%20lighting%2C%20clean%20solid%20light%20gray%20background%2C%20friendly%20approachable%20feeling%2C%20editorial%20photography%20style%2C%20high%20detail&width=200&height=200&seq=avatar-guest-default&orientation=squarish';

function withAvatar(user: Omit<SessionUser, 'avatar'>): SessionUser {
  return { ...user, account: user.account || '', isGuest: user.isGuest ?? !user.account, avatar: AVATAR };
}

function messageOf(error: unknown, fallback: string) {
  return error instanceof ApiError || error instanceof Error ? error.message : fallback;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadSession = useCallback(async () => {
    await ensureGuest();
    const session = await request<Omit<SessionUser, 'avatar'>>('/me/session', { method: 'POST' });
    setUser(withAvatar(session));
  }, []);

  useEffect(() => {
    localStorage.removeItem('video_platform_all_users');
    localStorage.removeItem('video_platform_user');
    let active = true;
    void loadSession().catch(() => {
      if (active) setUser(null);
    }).finally(() => {
      if (active) setIsLoading(false);
    });
    return () => { active = false; };
  }, [loadSession]);

  const login = useCallback(async (account: string, password: string): Promise<AuthResult> => {
    try {
      const result = await request<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify({ account, password }) });
      localStorage.setItem(TOKEN_KEY, result.token);
      setUser(withAvatar({ ...result.user, isGuest: false }));
      return { success: true, message: '登录成功' };
    } catch (error) {
      return { success: false, message: messageOf(error, '登录失败') };
    }
  }, []);

  const bindAccount = useCallback(async (account: string, password: string): Promise<AuthResult> => {
    try {
      const result = await request<AuthResponse>('/auth/register', { method: 'POST', body: JSON.stringify({ account, password, username: user?.username }) });
      localStorage.setItem(TOKEN_KEY, result.token);
      setUser(withAvatar(result.user));
      return { success: true, message: '绑定成功' };
    } catch (error) {
      return { success: false, message: messageOf(error, '绑定失败') };
    }
  }, [user?.username]);

  const logout = useCallback(async () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem('video_platform_remember');
    setUser(null);
    try { await loadSession(); } catch { setUser(null); }
  }, [loadSession]);

  const updatePassword = useCallback(async (oldPassword: string, newPassword: string): Promise<AuthResult> => {
    try {
      await request('/me/password', { method: 'PUT', body: JSON.stringify({ oldPassword, newPassword }) });
      return { success: true, message: '密码修改成功' };
    } catch (error) {
      return { success: false, message: messageOf(error, '密码修改失败') };
    }
  }, []);

  const updateProfile = useCallback(async (username: string): Promise<AuthResult> => {
    try {
      const updated = await request<Omit<SessionUser, 'avatar'>>('/me/profile', { method: 'PATCH', body: JSON.stringify({ username }) });
      setUser(withAvatar(updated));
      return { success: true, message: '昵称已更新' };
    } catch (error) {
      return { success: false, message: messageOf(error, '昵称更新失败') };
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoggedIn: !!user && !user.isGuest, isGuest: !!user?.isGuest, isLoading, login, bindAccount, logout, updatePassword, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
