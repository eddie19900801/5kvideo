import { useEffect, useRef, useState } from "react";
import type { Category } from "@/types";
import { videoApi } from "@/services/api";
const defaultHotTags = ["动漫", "国产", "欧美"];
const recentSearchKey = "5knews_recent_searches",
  recentSearchLimit = 10;

interface SearchPanelProps {
  open: boolean;
  keyword: string;
  onClose: () => void;
  onSearch: (kw: string) => void;
  onTagSelect: (tag: string) => void;
  categories: Category[];
  onCategorySelect: (id: string) => void;
}

export default function SearchPanel({
  open,
  keyword,
  onClose,
  onSearch,
  onTagSelect,
  categories,
  onCategorySelect,
}: SearchPanelProps) {
  const [draft, setDraft] = useState(keyword);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [hotTags, setHotTags] = useState<{ keyword: string; count: number }[]>(
    [],
  );
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  const saveRecentSearch = (value: string) => {
    const kw = value.trim();
    if (!kw) return;
    const next = [kw, ...recentSearches.filter((item) => item !== kw)].slice(
      0,
      recentSearchLimit,
    );
    setRecentSearches(next);
    try {
      localStorage.setItem(recentSearchKey, JSON.stringify(next));
    } catch { /* Storage may be unavailable in private browsing. */ }
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    try {
      localStorage.removeItem(recentSearchKey);
    } catch { /* Storage may be unavailable in private browsing. */ }
  };

  useEffect(() => {
    if (open) {
      setDraft(keyword);
      try {
        const saved = JSON.parse(localStorage.getItem(recentSearchKey) || "[]");
        setRecentSearches(
          Array.isArray(saved)
            ? saved
                .filter((item) => typeof item === "string")
                .slice(0, recentSearchLimit)
            : [],
        );
      } catch {
        setRecentSearches([]);
      }
      setTimeout(() => inputRef.current?.focus(), 100);
      void videoApi
        .hotSearches()
        .then(setHotTags)
        .catch(() => setHotTags([]));
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open, keyword]);

  if (!open) return null;
  const displayedHotTags = [
    ...defaultHotTags,
    ...hotTags.map((item) => item.keyword),
  ]
    .filter((tag, index, items) => items.indexOf(tag) === index)
    .slice(0, 10);

  const handleSearch = () => {
    const kw = draft.trim();
    if (kw) {
      saveRecentSearch(kw);
      void videoApi.recordSearch(kw).catch(() => {});
      onSearch(kw);
    }
  };

  const handleTagClick = (tag: string) => {
    setActiveTag(tag);
    saveRecentSearch(tag);
    void videoApi.recordSearch(tag).catch(() => {});
    onTagSelect(tag);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  };

  return (
    <div className="safe-panel fixed bottom-0 left-1/2 top-0 z-[60] flex w-full max-w-[520px] -translate-x-1/2 flex-col bg-background-950 shadow-2xl">
      {/* 搜索头部 */}
      <div className="flex items-center gap-2.5 px-3 py-3">
        {/* 品牌 */}
        <div className="flex flex-none flex-col items-center">
          <div className="flex items-center gap-1">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-background-50/15 text-background-50">
              <i className="ri-play-mini-fill text-lg"></i>
            </span>
            <span className="font-heading text-[15px] font-extrabold tracking-wide text-background-50">
              PP免费
            </span>
          </div>
          <span className="whitespace-nowrap text-[9px] font-bold text-background-50/50">
            永久免费
          </span>
        </div>

        {/* 搜索框 */}
        <form
          className="flex h-11 flex-1 items-center gap-2 rounded-full bg-background-50/15 px-3"
          onSubmit={(e) => {
            e.preventDefault();
            handleSearch();
          }}
        >
          <i className="ri-search-line text-lg text-background-50/60"></i>
          <input
            ref={inputRef}
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="请输入关键字搜索"
            className="w-full bg-transparent text-sm text-background-50 placeholder:text-background-50/40 outline-none"
          />
          <button
            type="submit"
            className="flex flex-none cursor-pointer items-center gap-1 rounded-full bg-primary-500 px-4 py-1.5 text-xs font-bold text-background-50 transition-colors hover:bg-primary-600"
          >
            搜索
          </button>
        </form>

        {/* 关闭 */}
        <button
          type="button"
          aria-label="关闭"
          onClick={onClose}
          className="flex h-9 w-9 flex-none cursor-pointer items-center justify-center rounded-full bg-background-50/15 text-background-50"
        >
          <i className="ri-close-line text-lg"></i>
        </button>
      </div>

      {/* 热搜标签区域 */}
      <div className="flex-1 overflow-y-auto px-3 pb-6">
        {recentSearches.length > 0 && (
          <div className="mt-4">
            <div className="mb-2.5 flex items-center justify-between">
              <h3 className="text-xs font-bold text-background-50/50">
                最近搜索
              </h3>
              <button
                type="button"
                onClick={clearRecentSearches}
                className="flex items-center gap-1 text-[11px] text-background-50/40"
              >
                <i className="ri-delete-bin-line" />
                清空
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {recentSearches.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => handleTagClick(tag)}
                  className="max-w-full truncate rounded-full bg-background-50/10 px-3 py-2 text-xs text-background-50/80 transition-colors hover:bg-background-50/20"
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="mt-4">
          <h3 className="mb-2.5 text-xs font-bold text-background-50/50">
            热搜
          </h3>
          <div className="grid grid-cols-5 gap-2">
            {displayedHotTags.map((tag) => {
              const isActive = activeTag === tag;
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => handleTagClick(tag)}
                  className={`cursor-pointer rounded-lg px-2 py-2 text-center text-xs font-medium leading-tight transition-colors ${
                    isActive
                      ? "bg-primary-500 text-background-50"
                      : "bg-background-50/10 text-background-50/80 hover:bg-background-50/20"
                  }`}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        </div>
        <div className="mt-5">
          <h3 className="mb-2.5 text-xs font-bold text-background-50/50">
            所有分类
          </h3>
          <div className="grid grid-cols-4 gap-2">
            {categories.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => {
                  onCategorySelect(category.id);
                  onClose();
                }}
                className="truncate rounded-lg bg-background-50/10 px-2 py-2 text-center text-xs font-medium text-background-50/80 transition-colors hover:bg-background-50/20"
              >
                {category.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
