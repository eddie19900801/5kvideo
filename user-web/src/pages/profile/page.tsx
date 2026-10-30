import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { library, type HistoryItem, type FavoriteItem, type FavoriteGroup } from "@/services/library";
import FavoriteGroups from "@/components/FavoriteGroups";
import HiddenVideos from "@/components/HiddenVideos";
import BottomNav from "@/components/base/BottomNav";

const time = (value: number) =>
  `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, "0")}`;

export default function Profile({ initialTab = "history" }: { initialTab?: "history" | "favorites" }) {
  const navigate = useNavigate(),
    [tab, setTab] = useState<"history" | "favorites">(initialTab),
    [history, setHistory] = useState<HistoryItem[]>([]),
    [favorites, setFavorites] = useState<FavoriteItem[]>([]),
    [query, setQuery] = useState(""),
    [historyFilter, setHistoryFilter] = useState("all"),
    [groups, setGroups] = useState<FavoriteGroup[]>(library.groups()),
    [activeGroup, setActiveGroup] = useState("all"),
    [selected, setSelected] = useState<string[]>([]),
    [groupError, setGroupError] = useState("");
  const refresh = () => {
    setHistory(library.history());
    const saved = library.favorites(), savedGroups = library.groups();
    setFavorites(saved); setGroups(savedGroups);
    setSelected(ids => ids.filter(id => saved.some(item => item.id === id)));
    setActiveGroup(id => id === "all" || id === "ungrouped" || savedGroups.some(group => group.id === id) ? id : "ungrouped");
  };
  useEffect(() => {
    refresh();
    window.addEventListener(library.event, refresh);
    window.addEventListener("storage", refresh);
    return () => { window.removeEventListener(library.event, refresh); window.removeEventListener("storage", refresh); };
  }, []);
  useEffect(() => { setSelected([]); setGroupError(""); }, [tab, query, activeGroup]);
  const move = (ids: string[], groupId: string) => {
    try { library.assignGroup(ids, groupId); setSelected([]); setGroupError(""); }
    catch (error) { setGroupError(error instanceof Error ? error.message : "移动失败"); }
  };
  const sourceItems = tab === "history" ? history : favorites;
  const keyword = query.trim().toLocaleLowerCase();
  const items = sourceItems.filter(item => {
    if (tab === "favorites" && activeGroup !== "all" && ((item as FavoriteItem).groupId || "ungrouped") !== activeGroup) return false;
    if (tab === "history" && historyFilter !== "all" && Boolean((item as HistoryItem).completed) !== (historyFilter === "completed")) return false;
    return !keyword || `${item.title} ${item.category} ${item.tags.join(" ")}`.toLocaleLowerCase().includes(keyword);
  });
  return (
    <div className="mx-auto min-h-screen w-full max-w-[520px] bg-background-50 pb-20">
      <header className="app-safe-header sticky top-0 z-20 flex items-center gap-3 border-b border-background-200 bg-background-50/95 px-3 py-2.5 backdrop-blur">
        <button
          onClick={() => navigate(-1)}
          className="grid h-9 w-9 place-items-center rounded-full bg-background-100"
        >
          <i className="ri-arrow-left-line" />
        </button>
        <h1 className="flex-1 text-base font-bold">个人中心</h1>
      </header>
      <section className="bg-gradient-to-br from-primary-500 to-primary-600 px-4 py-5 text-white">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-white/20 text-2xl">
            <i className="ri-user-3-line" />
          </span>
          <div>
            <b className="block">本机用户</b>
            <small className="opacity-70">收藏和历史仅保存在当前设备</small>
          </div>
        </div>
      </section>
      <div className="grid grid-cols-2 border-b border-background-200">
        <button
          onClick={() => setTab("history")}
          className={`py-3 text-sm font-bold ${tab === "history" ? "border-b-2 border-primary-500 text-primary-600" : "text-foreground-500"}`}
        >
          播放历史 ({history.length})
        </button>
        <button
          onClick={() => setTab("favorites")}
          className={`py-3 text-sm font-bold ${tab === "favorites" ? "border-b-2 border-primary-500 text-primary-600" : "text-foreground-500"}`}
        >
          我的收藏 ({favorites.length})
        </button>
      </div>
      <HiddenVideos />
      <div className="space-y-2 px-3 pt-3">
        {tab === "favorites" && <FavoriteGroups groups={groups} active={activeGroup} onChange={setActiveGroup} />}
        <div className="flex gap-2"><input aria-label="搜索收藏或历史" value={query} onChange={event => setQuery(event.target.value)} placeholder={tab === "history" ? "搜索播放历史" : "搜索我的收藏"} className="min-w-0 flex-1 rounded-lg border border-background-300 bg-background-50 p-3 text-sm" />
          {query && <button onClick={() => setQuery("")} className="px-3 text-sm text-primary-600">清除</button>}
        </div>
        {tab === "history" && <select aria-label="观看状态" value={historyFilter} onChange={event => setHistoryFilter(event.target.value)} className="rounded-lg border border-background-300 bg-background-50 p-2 text-sm"><option value="all">全部历史</option><option value="unfinished">未看完</option><option value="completed">已看完</option></select>}
        <p role="status" className="text-xs text-foreground-400">显示 {items.length} / {sourceItems.length} 条</p>
      </div>
      {tab === "favorites" && items.length > 0 && <div className="flex flex-wrap items-center gap-2 px-3 py-2">
        <button onClick={() => setSelected(items.map(item => item.id))} className="rounded-full bg-background-100 px-3 py-2 text-xs">选择当前结果</button>
        {selected.length > 0 && <><span className="text-xs">已选 {selected.length} 条</span><select aria-label="批量移动收藏" value="" onChange={event => move(selected, event.target.value === "ungrouped" ? "" : event.target.value)} className="max-w-full rounded-lg border border-background-300 bg-background-50 p-2 text-xs"><option value="" disabled>移动到分组</option><option value="ungrouped">未分组</option>{groups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}</select><button onClick={() => setSelected([])} className="p-2 text-xs">取消选择</button></>}
      </div>}
      {groupError && <p role="alert" className="px-3 text-xs text-red-500">{groupError}</p>}
      <div className="flex justify-end px-3 py-2">
        {sourceItems.length > 0 && (
          <button
            onClick={() => {
              if (!window.confirm(`确定清空${tab === "history" ? "播放历史" : "全部收藏"}？此操作无法撤销。`)) return;
              if (tab === "history") library.clearHistory(); else library.clearFavorites();
            }}
            className="text-xs text-foreground-400"
          >
            <i className="ri-delete-bin-line mr-1" />
            清空全部{tab === "history" ? "历史" : "收藏"}
          </button>
        )}
      </div>
      {items.length ? (
        <div className="space-y-2 px-3 pb-24">
          {items.map((item) => (
            <div
              key={item.id}
              className="relative flex gap-3 overflow-hidden rounded-xl bg-background-100 p-2"
            >
              {tab === "favorites" && <input type="checkbox" aria-label={`选择收藏：${item.title}`} checked={selected.includes(item.id)} onChange={event => setSelected(value => event.target.checked ? [...value, item.id] : value.filter(id => id !== item.id))} className="h-5 w-5 flex-none self-center" />}
              <Link
                to={`/video/${item.id}`}
                className="flex min-w-0 flex-1 gap-3"
              >
                <div className="relative w-20 flex-none overflow-hidden rounded-lg bg-black">
                  <span className="absolute inset-0 grid place-items-center text-lg text-white/40" aria-hidden="true"><i className="ri-video-line" /></span>
                  <img
                    src={item.thumbnail}
                    alt={item.title}
                    loading="lazy"
                    onError={event=>{event.currentTarget.hidden=true}}
                    className="relative aspect-video h-full w-full object-cover"
                  />
                  <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 text-[9px] text-white">
                    {tab === "history"
                      ? ((item as HistoryItem).completed ? "已看完" : time((item as HistoryItem).progress))
                      : "收藏"}
                  </span>
                </div>
                <div className="min-w-0 py-1">
                  <b className="line-clamp-2 text-sm leading-snug">
                    {item.title}
                  </b>
                  <small className="mt-2 block text-foreground-400">
                    {item.category === "网曝门" ? "吃瓜" : item.category}
                  </small>
                </div>
              </Link>
              <div className={`flex ${tab === "favorites" ? "w-20" : "w-8"} flex-none flex-col items-end gap-2`}>
                {tab === "favorites" && <select aria-label={`收藏分组：${item.title}`} value={(item as FavoriteItem).groupId || ""} onChange={event => move([item.id], event.target.value)} className="w-full rounded border border-background-300 bg-background-50 p-1 text-xs"><option value="">未分组</option>{groups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}</select>}
              <button
                onClick={() =>
                  tab === "history"
                    ? library.removeHistory(item.id)
                    : library.toggleFavorite(item)
                }
                aria-label="删除"
                className="grid h-8 w-8 flex-none place-items-center text-foreground-400"
              >
                <i className="ri-close-line" />
              </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-24 text-center text-sm text-foreground-400">
          <i
            className={`${tab === "history" ? "ri-history-line" : "ri-heart-line"} mb-2 block text-3xl`}
          />
          <p>{sourceItems.length ? "没有符合条件的记录" : tab === "history" ? "暂无播放历史" : "暂无收藏视频"}</p>
          {sourceItems.length > 0 && <button onClick={() => { setQuery(""); setHistoryFilter("all"); setActiveGroup("all"); }} className="mt-3 block w-full text-primary-600">清除筛选</button>}
          <Link
            to="/"
            className="mt-4 inline-block rounded-full bg-primary-500 px-5 py-2 text-xs font-bold text-white"
          >
            去看视频
          </Link>
        </div>
      )}
      <BottomNav />
    </div>
  );
}
