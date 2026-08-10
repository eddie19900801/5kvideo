import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

type Platform = 'android' | 'ios' | 'desktop';
type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const DISMISSED_KEY = '5k_app_banner_dismissed_at';

export default function AppDownloadBanner() {
  const location = useLocation();
  const [platform, setPlatform] = useState<Platform>('desktop');
  const [visible, setVisible] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [showAndroidGuide, setShowAndroidGuide] = useState(false);
  const [iosBrowser, setIosBrowser] = useState<'safari' | 'chrome' | 'embedded'>('safari');
  const [copied, setCopied] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    const standalone = matchMedia('(display-mode: standalone)').matches ||
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone) ||
      Boolean((window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.());
    const dismissedAt = Number(localStorage.getItem(DISMISSED_KEY) || 0);
    if (standalone || Date.now() - dismissedAt < 7 * 86400000) return;
    const ua = navigator.userAgent;
    const detectedPlatform = /Android/i.test(ua) ? 'android' : /iPhone|iPad|iPod/i.test(ua) ? 'ios' : 'desktop';
    setPlatform(detectedPlatform);
    if (detectedPlatform === 'ios') {
      setIosBrowser(/CriOS/i.test(ua) ? 'chrome' : /Safari/i.test(ua) && !/FBAN|FBAV|MicroMessenger|Instagram/i.test(ua) ? 'safari' : 'embedded');
    }
    setVisible(true);
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  if (!visible || location.pathname.startsWith('/video/') || location.pathname === '/login') return null;

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    setVisible(false);
  };

  const action = async () => {
    if (platform === 'ios') return setShowIosGuide(true);
    if (platform === 'android') {
      if (installPrompt) {
        await installPrompt.prompt();
        await installPrompt.userChoice;
      } else {
        setShowAndroidGuide(true);
      }
      return;
    }
  };

  return (
    <>
      <aside className="fixed left-1/2 -translate-x-1/2 bottom-[calc(56px+env(safe-area-inset-bottom,0px))] z-[60] w-[calc(100%-24px)] max-w-[456px] rounded-2xl border border-white/10 bg-background-100/95 p-3 shadow-2xl backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <img src="/icons/5k-video-app-icon-192.png" alt="5K视频" className="h-12 w-12 rounded-xl object-cover" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-foreground-50">下载 5K视频 APP</div>
            <div className="mt-0.5 truncate text-[11px] text-foreground-400">
              {platform === 'ios' ? '添加到主屏幕，像 APP 一样使用' : platform === 'android' ? '安装后打开更快、体验更流畅' : '使用手机扫码安装或添加到主屏幕'}
            </div>
          </div>
          {platform === 'desktop' ? (
            <img src="/icons/5k-video-install-qr.png" alt="手机扫码" className="h-14 w-14 rounded-lg bg-white p-1" />
          ) : (
            <button onClick={action} className="rounded-full bg-primary-500 px-3.5 py-2 text-xs font-semibold text-background-50">
              {platform === 'ios' ? '添加' : '安装'}
            </button>
          )}
          <button onClick={dismiss} aria-label="关闭" className="flex h-7 w-7 items-center justify-center rounded-full text-foreground-400 hover:bg-white/10">
            <i className="ri-close-line text-lg" />
          </button>
        </div>
      </aside>

      {showIosGuide && (
        <div className="fixed inset-0 z-[80] flex items-end bg-black/65" onClick={() => setShowIosGuide(false)}>
          <div className="w-full rounded-t-3xl bg-background-100 px-6 pb-[calc(24px+env(safe-area-inset-bottom,0px))] pt-5" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-foreground-500/40" />
            <div className="flex items-center gap-3">
              <img src="/icons/5k-video-app-icon-192.png" alt="" className="h-14 w-14 rounded-2xl" />
              <div><h3 className="font-semibold text-foreground-50">添加“5K视频”到主屏幕</h3><p className="mt-1 text-xs text-foreground-400">{iosBrowser === 'safari' ? '通过 Safari 浏览器添加' : iosBrowser === 'chrome' ? '通过 Chrome 菜单添加' : '请先在 Safari 浏览器中打开'}</p></div>
            </div>
            <ol className="mt-5 space-y-4 text-sm text-foreground-100">
              <li className="flex gap-3"><span className="text-xl text-primary-400">①</span><span>{iosBrowser === 'safari' ? '轻点页面让工具栏出现，再点击工具栏的分享图标' : iosBrowser === 'chrome' ? '点击右下角“⋯”菜单，然后选择“分享”' : '点击当前浏览器的“⋯”菜单，选择“在 Safari 中打开”'} <i className="ri-share-box-line text-primary-400" /></span></li>
              <li className="flex gap-3"><span className="text-xl text-primary-400">②</span><span>{iosBrowser === 'embedded' ? '进入 Safari 后，点击工具栏分享图标' : '在分享菜单中向下滑动，选择“添加到主屏幕”'}</span></li>
              <li className="flex gap-3"><span className="text-xl text-primary-400">③</span><span>名称保持“5K视频”，然后点击右上角“添加”</span></li>
            </ol>
            {iosBrowser === 'embedded' && (
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText('https://5k.ag/');
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="mt-5 w-full rounded-xl border border-primary-500/40 bg-primary-500/10 py-3 text-sm font-semibold text-primary-400"
              >
                {copied ? '网址已复制，请打开 Safari 粘贴' : '复制网址 5k.ag'}
              </button>
            )}
            <button onClick={() => setShowIosGuide(false)} className="mt-6 w-full rounded-xl bg-primary-500 py-3 text-sm font-semibold text-background-50">我知道了</button>
          </div>
        </div>
      )}
      {showAndroidGuide && (
        <div className="fixed inset-0 z-[80] flex items-end bg-black/65" onClick={() => setShowAndroidGuide(false)}>
          <div className="w-full rounded-t-3xl bg-background-100 px-6 pb-[calc(24px+env(safe-area-inset-bottom,0px))] pt-5" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-foreground-500/40" />
            <div className="flex items-center gap-3">
              <img src="/icons/5k-video-app-icon-192.png" alt="" className="h-14 w-14 rounded-2xl" />
              <div><h3 className="font-semibold text-foreground-50">安装“5K视频”</h3><p className="mt-1 text-xs text-foreground-400">当前浏览器没有自动弹出安装窗口</p></div>
            </div>
            <ol className="mt-5 space-y-4 text-sm text-foreground-100">
              <li className="flex gap-3"><span className="text-xl text-primary-400">①</span><span>点击 Chrome 右上角的“⋮”菜单</span></li>
              <li className="flex gap-3"><span className="text-xl text-primary-400">②</span><span>选择“安装应用”或“添加到主屏幕”</span></li>
              <li className="flex gap-3"><span className="text-xl text-primary-400">③</span><span>确认安装，桌面会出现“5K视频”图标</span></li>
            </ol>
            <button onClick={() => setShowAndroidGuide(false)} className="mt-6 w-full rounded-xl bg-primary-500 py-3 text-sm font-semibold text-background-50">我知道了</button>
          </div>
        </div>
      )}
    </>
  );
}
