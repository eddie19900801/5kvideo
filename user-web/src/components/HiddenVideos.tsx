import { useEffect, useState } from "react";
import { library } from "@/services/library";

export default function HiddenVideos() {
  const [items, setItems] = useState(() => library.hidden()), [query, setQuery] = useState(""), [limit, setLimit] = useState(20);
  useEffect(() => {
    const update = () => setItems(library.hidden());
    window.addEventListener(library.event, update); window.addEventListener("storage", update);
    return () => { window.removeEventListener(library.event, update); window.removeEventListener("storage", update); };
  }, []);
  const matches = items.filter(item => item.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  return <details className="m-3 rounded-xl border border-background-200 p-3">
    <summary className="cursor-pointer text-sm">不感兴趣管理（{items.length}）</summary>
    <p className="mt-2 text-xs text-foreground-400">只影响推荐，仍可通过搜索和收藏访问。设置仅保存在本机。</p>
    {items.length > 0 && <>
      <input aria-label="搜索不感兴趣记录" value={query} onChange={event => { setQuery(event.target.value); setLimit(20); }} placeholder="搜索已隐藏的视频" className="mt-3 w-full rounded-lg border border-background-300 bg-background-50 p-2 text-sm" />
      <button onClick={() => library.restoreAllHidden()} className="my-2 rounded-full bg-background-100 px-3 py-2 text-xs">恢复全部推荐</button>
    </>}
    {matches.slice(0, limit).map(item => <div key={item.id} className="flex items-center gap-2 border-t border-background-200 py-2"><span className="min-w-0 flex-1 truncate text-xs">{item.title}</span><button onClick={() => library.restoreHidden(item.id)} className="flex-none rounded-full bg-primary-50 px-3 py-2 text-xs text-primary-600">恢复推荐</button></div>)}
    {matches.length > limit && <button onClick={() => setLimit(value => value + 20)} className="mt-2 text-xs text-primary-600">显示更多</button>}
    {!matches.length && <p className="mt-2 text-xs text-foreground-400">{items.length ? "没有匹配的记录" : "暂无不感兴趣记录"}</p>}
  </details>;
}
