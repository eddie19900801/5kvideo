import { useEffect, useRef } from "react";
import { videoApi } from "@/services/api";
import type { Highlight } from "@/types";

const time=(value:number)=>`${Math.floor(value/60)}:${String(Math.floor(value%60)).padStart(2,"0")}`;

export default function FrameGallery({frames,activeTime,onSelect}:{frames:Highlight[];activeTime:number;onSelect:(frame:Highlight)=>void}) {
  const container=useRef<HTMLDivElement>(null);
  const active=frames.reduce<Highlight|undefined>((closest,frame)=>!closest||Math.abs(frame.time-activeTime)<Math.abs(closest.time-activeTime)?frame:closest,undefined);
  useEffect(()=>{
    if(!active||!container.current)return;
    [...container.current.querySelectorAll<HTMLElement>("[data-frame-id]")].find(node=>node.dataset.frameId===active.id)?.scrollIntoView({behavior:"smooth",block:"nearest",inline:"center"});
  },[active?.id]);
  return <div ref={container} className="no-scrollbar -mx-3 flex gap-2.5 overflow-x-auto px-3">
    {frames.map(frame=><button key={frame.id} data-frame-id={frame.id} aria-label={`跳转到 ${time(frame.time)}`} aria-current={active?.id===frame.id?"true":undefined} onClick={()=>onSelect(frame)} className={`relative w-32 flex-none overflow-hidden rounded-lg border-2 ${active?.id===frame.id?"border-primary-500":"border-transparent"}`}>
      <span className="absolute inset-0 grid place-items-center bg-background-200 text-foreground-400"><i className="ri-image-line"/></span>
      <img src={videoApi.asset(frame.image)} alt={`${time(frame.time)} 截图`} loading="lazy" onError={event=>{event.currentTarget.style.visibility="hidden"}} className="relative aspect-video w-full object-cover"/>
      <span className="absolute left-1.5 top-1.5 rounded bg-black/65 px-1.5 py-0.5 text-[10px] text-white">{time(frame.time)}</span>
    </button>)}
  </div>;
}
