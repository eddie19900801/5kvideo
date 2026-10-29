import { useMemo, useState } from "react";
import type { Category } from "@/types";

export default function CategoryTabs({active,categories,onChange}:{active:string;categories:Category[];onChange:(value:string)=>void}) {
  const [expanded,setExpanded]=useState(false);
  const common=useMemo(()=>{
    const first=categories.slice(0,5);
    const selected=categories.find(item=>item.id===active);
    return selected&&!first.some(item=>item.id===selected.id)?[selected,...first.slice(0,4)]:first;
  },[active,categories]);
  const select=(value:string)=>{onChange(value);setExpanded(false)};
  const buttonClass=(selected:boolean)=>`h-9 min-w-0 flex-1 truncate border-b-2 px-1 text-[13px] font-semibold ${selected?"border-primary-500 bg-primary-50 text-primary-600":"border-transparent text-foreground-600"}`;
  return <>
    <nav className="w-full max-w-full overflow-hidden border-b border-background-100 bg-background-50" aria-label="视频分类">
      <div className="flex min-w-0 items-center px-1">
        <button onClick={()=>select("")} className={buttonClass(active==="")}>推荐</button>
        {common.map(item=><button key={item.id} onClick={()=>select(item.id)} className={buttonClass(active===item.id)}>{item.name}</button>)}
        <button aria-haspopup="dialog" aria-expanded={expanded} onClick={()=>setExpanded(true)} className="flex h-9 w-12 flex-none items-center justify-center gap-0.5 border-l border-background-200 text-xs font-semibold text-foreground-600">更多<i className="ri-arrow-down-s-line"/></button>
      </div>
    </nav>
    {expanded&&<div className="fixed inset-0 z-50 flex items-end bg-black/45" role="presentation" onClick={()=>setExpanded(false)}>
      <section role="dialog" aria-modal="true" aria-label="全部视频分类" className="max-h-[72vh] w-full overflow-hidden rounded-t-2xl bg-background-50 pb-[max(16px,env(safe-area-inset-bottom))]" onClick={event=>event.stopPropagation()}>
        <header className="flex items-center justify-between border-b border-background-200 px-4 py-3">
          <div><h2 className="text-base font-bold text-foreground-900">全部分类</h2><p className="mt-0.5 text-[11px] text-foreground-400">选择分类后自动回到页面顶部</p></div>
          <button aria-label="关闭分类" onClick={()=>setExpanded(false)} className="grid h-9 w-9 place-items-center rounded-full bg-background-100"><i className="ri-close-line text-lg"/></button>
        </header>
        <div className="no-scrollbar grid max-h-[calc(72vh-70px)] grid-cols-4 gap-2 overflow-y-auto p-3">
          <button onClick={()=>select("")} className={`truncate rounded-lg px-2 py-2.5 text-xs ${active===""?"bg-primary-500 font-bold text-white":"bg-background-100 text-foreground-700"}`}>推荐</button>
          {categories.map(item=><button key={item.id} onClick={()=>select(item.id)} className={`truncate rounded-lg px-2 py-2.5 text-xs ${active===item.id?"bg-primary-500 font-bold text-white":"bg-background-100 text-foreground-700"}`}>{item.name}</button>)}
        </div>
      </section>
    </div>}
  </>;
}
