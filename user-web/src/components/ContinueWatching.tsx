import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { library } from "@/services/library";
import { analytics } from "@/services/analytics";

export default function ContinueWatching() {
  const [items, setItems] = useState(() => library.continuing());
  const [collapsed, setCollapsed] = useState(() => {
    try { return sessionStorage.getItem("5knews_continue_collapsed") === "1"; } catch { return false; }
  });
  useEffect(() => {
    const refresh = () => setItems(library.continuing());
    window.addEventListener(library.event, refresh);
    window.addEventListener("storage", refresh);
    return () => { window.removeEventListener(library.event, refresh); window.removeEventListener("storage", refresh); };
  }, []);
  if (!items.length) return null;
  const item = items[0];
  const time = `${Math.floor(item.progress / 60)}:${String(Math.floor(item.progress % 60)).padStart(2, "0")}`;
  return <section className="mx-3 mb-4 rounded-xl border border-primary-200 bg-primary-50 p-3" aria-label="继续观看">
    <div className="flex items-center justify-between">
      <b className="text-sm text-foreground-800">继续观看</b>
      <button aria-expanded={!collapsed} onClick={() => {
        setCollapsed(!collapsed);
        try { sessionStorage.setItem("5knews_continue_collapsed", collapsed ? "0" : "1"); } catch { /* Optional session preference. */ }
      }} className="px-3 py-2 text-xs text-foreground-500">{collapsed ? "展开" : "收起"}</button>
    </div>
    {!collapsed && <>
      <Link to={`/video/${encodeURIComponent(item.id)}`} onClick={() => analytics.track("continue_watch_click", { videoId: item.id })} className="mt-2 flex items-center gap-3">
        <span className="relative aspect-video w-24 flex-none overflow-hidden rounded-lg bg-background-200"><i className="ri-video-line absolute inset-0 grid place-items-center text-xl text-foreground-300"/><img src={item.thumbnail} alt="" onError={event=>{event.currentTarget.hidden=true}} className="relative h-full w-full object-cover" /></span>
        <div className="min-w-0 flex-1"><p className="line-clamp-2 text-sm font-semibold">{item.title}</p><p className="mt-1 text-xs text-foreground-500">上次看到 {time}</p>
          <div className="mt-2 h-1 overflow-hidden rounded bg-primary-100"><div className="h-full bg-primary-500" style={{ width: `${Math.min(100, item.progress / item.duration * 100)}%` }} /></div>
        </div><span className="text-sm font-bold text-primary-600">续播</span>
      </Link>
      <Link to="/profile" className="mt-3 block text-right text-xs text-primary-600">查看全部历史</Link>
    </>}
  </section>;
}
