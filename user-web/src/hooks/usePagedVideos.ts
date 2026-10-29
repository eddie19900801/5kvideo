import { useCallback, useEffect, useRef, useState } from "react";
import { videoApi, type FeedSort, type DurationFilter } from "@/services/api";
import { library } from "@/services/library";
import { personalize } from "@/services/recommendations";
import { feedCache } from "@/services/feedCache";
import type { VideoPage, VideoSummary } from "@/types";

type Options = { personalizeFeed?: boolean; product?: string; relatedTo?: string; sort?: FeedSort; duration?: DurationFilter; category?: string; q?: string; seed?: string; startPage?: number; enabled?: boolean; cache?: boolean; excludeId?: string };
export function usePagedVideos({ category = "", q = "", seed = "", product = "", startPage = 1, enabled = true, cache = false, excludeId = "", sort = "recommended", duration = "all", personalizeFeed = false, relatedTo = "" }: Options) {
  const [, setPreferences] = useState("");
  useEffect(() => {
    const update = () => setPreferences(JSON.stringify([
      library.history().filter(item => item.completed || item.progress >= 10).map(item => [item.id, item.category, item.tags]),
      library.favorites().map(item => [item.id, item.category, item.tags]),
      library.hidden().map(item => item.id),
    ]));
    update(); window.addEventListener(library.event, update); window.addEventListener("storage", update);
    return () => { window.removeEventListener(library.event, update); window.removeEventListener("storage", update); };
  }, []);
  const [videos, setVideos] = useState<VideoSummary[]>([]);
  const [page, setPage] = useState(startPage - 1);
  const [total, setTotal] = useState(0);
  const [pageCount, setPageCount] = useState(startPage);
  const [loading, setLoading] = useState(enabled);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const generation = useRef(0), busy = useRef(false), failedPage = useRef(startPage);
  const sentinel = useRef<HTMLDivElement>(null);
  const filter = useCallback((items: VideoSummary[]) => [...new Map(items.filter(item => item.id !== excludeId).map(item => [item.id, item])).values()], [excludeId]);
  const cacheKey=product?`product:${product}:${category||"recommended"}`:category;

  useEffect(() => {
    const current = ++generation.current;
    busy.current = enabled;
    setLoading(enabled); setError(""); setReady(false);
    setPage(startPage - 1); setPageCount(startPage); failedPage.current = startPage;
    const cached = cache && !relatedTo && !q && sort === "recommended" && duration === "all" && startPage === 1 ? feedCache.page(cacheKey) : undefined;
    setVideos(cached ? filter(cached.items) : []); setTotal(cached?.total || 0);
    if (cached) { setPage(cached.page); setPageCount(cached.pageCount); setReady(true); }
    if (enabled) void videoApi.list({ page: startPage, q, category, seed, product, sort, duration, relatedTo }).then(result => {
      if (generation.current !== current) return;
      const restored=cached&&cached.page>startPage?{...result,page:cached.page,items:filter([...result.items,...cached.items])}:result;
      setVideos(filter(restored.items)); setPage(restored.page); setTotal(restored.total); setPageCount(restored.pageCount);
      if (cache && !relatedTo && !q && sort === "recommended" && duration === "all" && startPage === 1) feedCache.savePage(cacheKey, restored);
    }).catch(reason => {
      if (generation.current === current) setError(reason instanceof Error ? reason.message : "加载失败，请重试");
    }).finally(() => {
      if (generation.current === current) { busy.current = false; setLoading(false); setReady(true); }
    });
    return () => { generation.current = current + 1; };
  }, [category, q, seed, product, sort, duration, relatedTo, startPage, enabled, cache, cacheKey, filter, reload]);

  const loadMore = useCallback((retry = false) => {
    if (!enabled || busy.current || (!retry && (error || page >= pageCount))) return;
    const next = retry ? failedPage.current : page + 1;
    if (next === startPage) { setReload(value => value + 1); return; }
    const current = generation.current;
    busy.current = true; setLoading(true); setError(""); failedPage.current = next;
    void videoApi.list({ page: next, q, category, seed, product, sort, duration, relatedTo }).then((result: VideoPage) => {
      if (generation.current !== current) return;
      setVideos(items => {const combined=filter([...items, ...result.items]);if(cache&&!relatedTo&&!q&&sort==="recommended"&&duration==="all"&&startPage===1)feedCache.savePage(cacheKey,{...result,page:next,items:combined});return combined});
      setPage(next); setTotal(result.total); setPageCount(result.pageCount);
    }).catch(reason => {
      if (generation.current === current) setError(reason instanceof Error ? reason.message : "加载失败，请重试");
    }).finally(() => {
      if (generation.current === current) { busy.current = false; setLoading(false); }
    });
  }, [enabled, error, page, pageCount, startPage, q, category, seed, product, sort, duration, relatedTo, cache, cacheKey, filter]);

  useEffect(() => {
    const node = sentinel.current;
    if (!node || !ready || loading || error || !enabled) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) loadMore();
    }, { rootMargin: "480px 0px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [ready, loading, error, enabled, loadMore]);

  const displayed = personalizeFeed ? personalize(videos, library.history(), library.favorites(), library.hidden()) : videos;
  return { videos: displayed, page, total, pageCount, loading, ready, error, sentinel, refresh: () => setReload(value => value + 1), loadMore: () => loadMore(), retry: () => loadMore(true) };
}
