import { useEffect, useState } from "react";
import { analytics } from "@/services/analytics";
import { appDownloadEntry, isAndroidDevice, slowPlaybackEvent } from "@/services/appDownload";

const inApp = /5KVideoApp/i.test(navigator.userAgent);

export default function AppDownloadFloating() {
  const [visible, setVisible] = useState(false);
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (inApp) return;
    const showSlow = () => {
      if (sessionStorage.getItem("5knews_app_float_closed") === "1" || sessionStorage.getItem("5knews_app_slow_shown") === "1") return;
      sessionStorage.setItem("5knews_app_slow_shown", "1");
      setSlow(true);
      setVisible(true);
      analytics.track("app_download_prompt", { metadata: { reason: "slow_playback" } });
    };
    window.addEventListener(slowPlaybackEvent, showSlow);
    return () => window.removeEventListener(slowPlaybackEvent, showSlow);
  }, []);

  if (!visible || inApp) return null;
  return (
    <aside className="fixed bottom-4 left-1/2 z-50 flex w-[calc(100%-24px)] max-w-[496px] -translate-x-1/2 items-center gap-2 rounded-xl border border-primary-200 bg-white/95 p-2.5 shadow-[0_8px_30px_rgba(0,0,0,.24)] backdrop-blur">
      <span className="grid h-10 w-10 flex-none place-items-center rounded-lg bg-primary-500 text-xl text-white"><i className="ri-flashlight-fill" /></span>
      <div className="min-w-0 flex-1">
        <b className="block truncate text-sm text-foreground-800">{slow ? "也可使用 PP免费 APP" : "下载 PP免费 APP"}</b>
        <small className="block truncate text-[10px] text-foreground-400">{slow ? "可关闭提示，继续在网页观看" : "桌面快捷打开，观看更方便"}</small>
      </div>
      <a href={appDownloadEntry} download={isAndroidDevice ? "5kvideo-latest.apk" : undefined} onClick={() => analytics.track("app_download_click", { metadata: { reason: slow ? "slow_playback" : "floating", device: isAndroidDevice ? "android" : "landing" } })} className="flex-none rounded-full bg-primary-500 px-3.5 py-2 text-xs font-bold text-white">{isAndroidDevice ? "立即下载" : "扫码下载"}</a>
      <button aria-label="关闭" onClick={() => { sessionStorage.setItem("5knews_app_float_closed", "1"); setVisible(false); }} className="grid h-7 w-7 flex-none place-items-center text-foreground-400"><i className="ri-close-line" /></button>
    </aside>
  );
}
