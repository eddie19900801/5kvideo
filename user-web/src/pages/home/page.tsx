import { topicInterests } from "@/services/topicInterests";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import CategoryTabs from "./components/CategoryTabs";
import Waterfall from "./components/Waterfall";
import SearchPanel from "./components/SearchPanel";
import VideoSkeleton from "./components/VideoSkeleton";
import PageSkeleton from "./components/PageSkeleton";
import NavigationBanner from "./components/NavigationBanner";
import FiveKAdSlot from "@/components/FiveKAdSlot";
import ContinueWatching from "@/components/ContinueWatching";
import EncryptedAssetImage, { productIconSource } from "@/components/EncryptedAssetImage";
import { videoApi } from "@/services/api";
import { analytics } from "@/services/analytics";
import { feedCache } from "@/services/feedCache";
import { performanceMonitor } from "@/services/performance";
import type { Category } from "@/types";
import { usePagedVideos } from "@/hooks/usePagedVideos";
import { productRuntime, type ProductRuntime } from "@/services/productRuntime";
const HOME_POPUP_ZONE = "ZN_9A10DE603D56C91A63A196EF";
const feedSessionKeys = {
  sort: "5knews_feed_sort",
  duration: "5knews_feed_duration",
  category: "5knews_feed_category",
  keyword: "5knews_feed_keyword",
  batchPage: "5knews_feed_batch_page",
  seed: "5knews_feed_seed",
};
const readSession = (key: string) => {
  try {
    return sessionStorage.getItem(key) || "";
  } catch {
    return "";
  }
};
const readUrlKeyword = () => {
  const params = new URLSearchParams(window.location.search);
  return (params.get("q") || params.get("keyword") || params.get("search") || "").trim();
};
const readUrlCategory = () =>
  new URLSearchParams(window.location.search).get("category")?.trim() || "";
const recommendationSeed = () => {
  const saved = readSession(feedSessionKeys.seed);
  if (saved) return saved;
  const value = `${Date.now()}-${crypto.randomUUID()}`;
  try {
    sessionStorage.setItem(feedSessionKeys.seed, value);
  } catch { /* Storage may be unavailable in private browsing. */ }
  return value;
};
export default function Home() {
  const params = useRef(new URLSearchParams(window.location.search)).current;
  const hasUrlFilters = ["q", "keyword", "search", "category", "sort", "duration"].some(key => params.has(key));
  const hasRendered = useRef(false);
  const initialUrlKeyword = useRef(readUrlKeyword()).current;
  const initialUrlCategory = useRef(readUrlCategory()).current;
  const initialBatchPage=useRef(hasUrlFilters || readSession(feedSessionKeys.sort) === "latest" || ["short", "medium", "long"].includes(readSession(feedSessionKeys.duration)) ? 1 : Math.max(1,Number(readSession(feedSessionKeys.batchPage))||1)).current;
  const initialCategory=initialUrlCategory||(hasUrlFilters?"":readSession(feedSessionKeys.category));
  const initialCategories=useRef(feedCache.categories()).current;
  const [category, setCategory] = useState(() =>
      initialCategory,
    ),
    [keyword, setKeyword] = useState(() =>
      initialUrlKeyword || (hasUrlFilters ? "" : readSession(feedSessionKeys.keyword)),
    ),
    [categories, setCategories] = useState<Category[]>(initialCategories),
    [batchPage, setBatchPage] = useState(initialBatchPage),
    [searchOpen, setSearchOpen] = useState(false);
  const [product, setProduct] = useState<ProductRuntime | null>(null);
  const [productReady, setProductReady] = useState(false);
  const recommendationSeedRef = useRef(recommendationSeed());
  const searchCategory = keyword ? "" : category;
  const customRecommendations = (product?.recommendationCategoryIds?.length||0) > 0 || (product?.recommendationKeywords?.length||0) > 0 || product?.recommendationStrategy === "stable";
  const { videos, total, page, pageCount, loading, ready: firstVideosReady, error, sentinel, retry, loadMore, refresh } = usePagedVideos({ category: searchCategory, q: keyword, product: !keyword && !category && customRecommendations ? product?.slug || "" : "", seed: recommendationSeedRef.current, startPage: batchPage, enabled: productReady && product !== null, cache: true, personalizeFeed: !keyword && product?.recommendationStrategy === "shuffle" });
  useEffect(() => { if (firstVideosReady) performanceMonitor.dataReady(false); }, [firstVideosReady]);
  useEffect(() => {
    if (!firstVideosReady) return;
    try {
      if (sessionStorage.getItem("5knews_home_restore") !== "1") return;
      const top=Math.max(0,Number(sessionStorage.getItem("5knews_home_scroll"))||0);
      requestAnimationFrame(()=>requestAnimationFrame(()=>window.scrollTo({top,behavior:"auto"})));
      sessionStorage.removeItem("5knews_home_restore");
    } catch { /* Storage may be unavailable in private browsing. */ }
  }, [firstVideosReady]);
  useEffect(() => { void productRuntime.load().then(value => { setProduct(value); document.title = value.name; }).finally(()=>setProductReady(true)); }, []);
  useEffect(() => {
    try {
      sessionStorage.removeItem(feedSessionKeys.sort);
      sessionStorage.removeItem(feedSessionKeys.duration);
      sessionStorage.setItem(feedSessionKeys.category, category);
      sessionStorage.setItem(feedSessionKeys.keyword, keyword);
      sessionStorage.setItem(feedSessionKeys.batchPage, String(batchPage));
    } catch { /* Storage may be unavailable in private browsing. */ }
    const url = new URL(window.location.href);
    url.searchParams.delete("keyword");
    url.searchParams.delete("search");
    if (keyword) url.searchParams.set("q", keyword);
    else url.searchParams.delete("q");
    const categoryName = categories.find((item) => item.id === category)?.name;
    if (category) url.searchParams.set("category", categoryName || category);
    else url.searchParams.delete("category");
    url.searchParams.delete("sort");
    url.searchParams.delete("duration");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }, [category, keyword, batchPage, categories]);
  useEffect(() => {
    void videoApi
      .categories()
      .then((items) => {
        const mapped = items
          .map((item) => ({
            ...item,
            name: item.name === "网曝门" ? "吃瓜" : item.name,
          }))
          .sort((left, right) => right.count - left.count);
        setCategories(mapped);
        feedCache.saveCategories(mapped);
        if (initialUrlCategory) {
          const selected = mapped.find(
            (item) => item.id === initialUrlCategory || item.name === initialUrlCategory,
          );
          if (selected) setCategory(selected.id);
        }
      })
      .catch(() => {});
  }, [initialUrlCategory]);
  const enterCategory = (value: string) => {
    analytics.track("category_select", { metadata: { category: value || "recommended" } });
    setKeyword("");
    setBatchPage(1);
    setCategory(value);
    try { sessionStorage.removeItem("5knews_home_restore"); sessionStorage.setItem("5knews_home_scroll","0"); } catch {}
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const clearSearch = () => {
    setKeyword("");
    setBatchPage(1);
  };
  const resetFilters = () => { setKeyword(""); setCategory(""); setBatchPage(1); };
  const swapFeed = () => {
    if (keyword) clearSearch();
    else setBatchPage((value) => (pageCount > 1 ? (value % pageCount) + 1 : 1));
  };
  if (productReady && product && firstVideosReady) hasRendered.current = true;
  if (!productReady || !product || !hasRendered.current) return <PageSkeleton />;
  return (
    <div className="mx-auto min-h-screen w-full max-w-[520px] overflow-x-hidden bg-background-50 shadow-2xl shadow-black/5">
      <header className="sticky top-0 z-20 px-3 py-3" style={{ background: `linear-gradient(180deg, ${product.themeColor}, ${product.themeColor}dd)` }}>
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex min-w-0 flex-none items-center gap-1.5 text-white">
            <span className="grid h-8 w-8 place-items-center overflow-hidden rounded-lg bg-white/20">
              {productIconSource(product.slug, product.iconUrl) ? <EncryptedAssetImage src={productIconSource(product.slug, product.iconUrl)} alt={product.name} className="h-full w-full object-cover" /> : <i className="ri-play-fill text-lg" />}
            </span>
            <div className="hidden min-w-0 min-[360px]:block">
              <b className="block max-w-20 truncate text-[14px]">{product.name}</b>
              <small className="block whitespace-nowrap text-[9px] opacity-70">
                永久免费
              </small>
            </div>
          </div>
          <button
            onClick={() => setSearchOpen(true)}
            className="flex h-10 flex-1 items-center gap-2 rounded-full bg-black/25 px-3 text-left"
          >
            <i className="ri-search-line text-white/80" />
            <span className="truncate text-sm text-white/55">
              {keyword || "搜索感兴趣的视频"}
            </span>
          </button>
          <Link
            to="/profile"
            aria-label="个人中心"
            title="个人中心"
            className="grid h-10 w-10 flex-none place-items-center rounded-full bg-accent-500 text-white"
          >
            <i className="ri-user-3-line text-lg" />
          </Link>
        </div>
      </header>
      <div className="sticky top-[64px] z-10 border-b border-background-200 bg-background-50">
        <CategoryTabs
          active={keyword ? "" : category}
          categories={categories}
          onChange={enterCategory}
        />
      </div>
      <NavigationBanner />
      <FiveKAdSlot zone={HOME_POPUP_ZONE} limit={1} />
      <main className="pb-24 pt-3">
        {!keyword && !category && <ContinueWatching />}
        {(category || keyword) && <button onClick={resetFilters} className="mb-3 ml-3 rounded-full bg-background-100 px-3 py-2 text-xs text-foreground-600">清除全部筛选</button>}
        {keyword && (
          <div className="mx-3 mb-3 flex items-center justify-between rounded-lg bg-primary-50 px-3 py-2">
            <span className="min-w-0 truncate text-xs text-primary-700">
              搜索：{keyword}
            </span>
            <button
              onClick={clearSearch}
              className="ml-2 flex-none text-xs font-bold text-primary-600"
            >
              <i className="ri-arrow-left-line mr-1" />
              返回
            </button>
          </div>
        )}
        <div className="mb-2 flex items-center justify-between px-3">
          <b className="text-sm text-foreground-900">
            {keyword ? "搜索结果" : categories.find((item) => item.id === category)?.name || "为你推荐"}
            <small className="ml-1 font-normal text-foreground-400">
              {total.toLocaleString()} 条
            </small>
          </b>
          <button
            onClick={swapFeed}
            className="flex items-center gap-1 rounded-full bg-background-100 px-3 py-1 text-xs font-semibold text-foreground-600"
          >
            <i className="ri-shuffle-line" />
            {keyword ? "清除搜索" : "换一批"}
          </button>
        </div>
        {error && !videos.length ? (
          <div className="px-6 py-20 text-center">
            <p className="text-sm text-red-500">{error}</p>
            <button
              onClick={retry}
              className="mt-3 rounded-full bg-primary-500 px-4 py-2 text-xs text-white"
            >
              重新加载
            </button>
          </div>
        ) : loading && !videos.length ? (
          <VideoSkeleton />
        ) : videos.length ? (
          <Waterfall videos={videos} />
        ) : (
          <div className="py-20 text-center text-sm text-foreground-400">
            <p>没有找到相关视频</p>
            <button
              onClick={resetFilters}
              className="mt-4 rounded-full bg-primary-500 px-5 py-2 text-xs font-bold text-white"
            >
              返回全部视频
            </button>
          </div>
        )}
        <div
          ref={sentinel}
          className="py-8 text-center text-xs text-foreground-400"
        >
          {error && videos.length > 0 ? <div role="status"><p>{error}</p><button onClick={retry} className="mt-3 rounded-full bg-primary-500 px-4 py-2 text-white">重试加载</button></div> : loading && videos.length
            ? "正在加载…"
            : !loading && page < pageCount
              ? <button onClick={loadMore} className="rounded-full px-4 py-2">加载更多</button>
              : !loading
                ? "已经到底了"
                : ""}
        </div>
      </main>
      <SearchPanel
        open={searchOpen}
        keyword={keyword}
        categories={categories}
        onCategorySelect={enterCategory}
        onClose={() => setSearchOpen(false)}
        onSearch={(value) => {
          topicInterests.search(value);
          analytics.track("search", { metadata: { keyword: value } });
          setBatchPage(1);
          setKeyword(value);
          refresh();
          setSearchOpen(false);
        }}
        onTagSelect={(value) => {
          topicInterests.search(value);
          analytics.track("search", { metadata: { keyword: value, source: "tag" } });
          setBatchPage(1);
          setKeyword(value);
          refresh();
          setSearchOpen(false);
        }}
      />
    </div>
  );
}
