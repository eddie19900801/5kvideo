import { useEffect, useState } from "react";
import { library } from "@/services/library";

export default function RecommendationNotice() {
  const [id, setId] = useState("");
  useEffect(() => {
    const changed = (event: Event) => setId((event as CustomEvent<{ hiddenId?: string }>).detail?.hiddenId || "");
    window.addEventListener(library.preferenceEvent, changed);
    return () => window.removeEventListener(library.preferenceEvent, changed);
  }, []);
  useEffect(() => { if (!id) return; const timer = setTimeout(() => setId(""), 7000); return () => clearTimeout(timer); }, [id]);
  if (!id) return null;
  return <div role="status" className="fixed bottom-24 left-1/2 z-[60] flex w-[calc(100%-24px)] max-w-[496px] -translate-x-1/2 items-center justify-between gap-3 rounded-xl bg-black/90 px-4 py-3 text-sm text-white">
    <span>已从推荐中隐藏</span><button onClick={() => { library.restoreHidden(id); setId(""); }} className="rounded px-3 py-2 font-bold text-primary-200">撤销</button>
  </div>;
}
