import { request } from './api';

const INSTALL_KEY = '5k_install_id';
const SESSION_KEY = '5k_session_id';
const FIRST_OPEN_KEY = '5k_first_open_sent';

function createId() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();

  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).reduce(
    (id, byte, index) => id + ([4, 6, 8, 10].includes(index) ? '-' : '') + byte,
    '',
  );
}

function stableId(key: string) {
  let value = localStorage.getItem(key);
  if (!value) {
    value = createId();
    localStorage.setItem(key, value);
  }
  return value;
}

function sessionId() {
  let value = sessionStorage.getItem(SESSION_KEY);
  if (!value) {
    value = createId();
    sessionStorage.setItem(SESSION_KEY, value);
  }
  return value;
}

function platform(): 'web' | 'android' | 'ios' {
  const native = (window as unknown as { Capacitor?: { getPlatform?: () => string } }).Capacitor?.getPlatform?.();
  if (native === 'android' || native === 'ios') return native;
  return 'web';
}

export function track(eventName: string, options: { videoId?: string; value?: number; metadata?: Record<string, string | number | boolean> } = {}) {
  return request('/analytics/events', {
    method: 'POST',
    body: JSON.stringify({ events: [{ eventName, installId: stableId(INSTALL_KEY), sessionId: sessionId(), platform: platform(), appVersion: import.meta.env.VITE_APP_VERSION || 'web', channel: new URLSearchParams(location.search).get('channel') || 'direct', ...options }] }),
  }).catch(() => undefined);
}

export function trackAppOpen() {
  const firstOpen = !localStorage.getItem(FIRST_OPEN_KEY);
  if (firstOpen) localStorage.setItem(FIRST_OPEN_KEY, '1');
  return track('app_open', { metadata: { firstOpen, path: location.pathname } });
}
