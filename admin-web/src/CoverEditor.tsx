import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { Button, Card, Input, message, Slider, Space, Spin, Tag } from "antd";
import { ArrowLeftOutlined, CameraOutlined, SaveOutlined } from "@ant-design/icons";
import Hls from "hls.js";
import { api, uploadVideoCover } from "./api";

type CoverVideo = { id:string; title:string; thumbnail:string; playbackUrl:string; duration:number; aspectRatio:"portrait"|"landscape" };
type LayoutMode = "split"|"grid"|"diagonal"|"magazine";
type MosaicStroke = { radius:number; points:{x:number;y:number}[] };
const layouts:{key:LayoutMode;name:string}[]=[{key:"split",name:"均衡分栏"},{key:"grid",name:"宫格拼图"},{key:"diagonal",name:"动感斜切"},{key:"magazine",name:"杂志主视觉"}];
const artStyles=[
  {name:"抖音爆款",fill:"#fff",stroke:"#ff3158",font:'900 74px "Microsoft YaHei",sans-serif'},
  {name:"黑金杂志",fill:"#ffd75e",stroke:"#111",font:'900 68px "Microsoft YaHei",sans-serif'},
  {name:"清新白字",fill:"#fff",stroke:"#1677ff",font:'800 66px "Microsoft YaHei",sans-serif'},
  {name:"国潮红金",fill:"#ffe6a7",stroke:"#b20d18",font:'900 72px "STKaiti","Microsoft YaHei",serif'},
  {name:"极简标题",fill:"#fff",stroke:"#000",font:'700 62px "Microsoft YaHei",sans-serif'},
];

function loadImage(src:string){return new Promise<HTMLImageElement>((resolve,reject)=>{const image=new Image();image.crossOrigin="anonymous";image.onload=()=>resolve(image);image.onerror=reject;image.src=src;});}
function drawCover(ctx:CanvasRenderingContext2D,image:HTMLImageElement,x:number,y:number,w:number,h:number){const scale=Math.max(w/image.width,h/image.height),sw=w/scale,sh=h/scale,sx=(image.width-sw)/2,sy=(image.height-sh)/2;ctx.drawImage(image,sx,sy,sw,sh,x,y,w,h);}
function clipPolygon(ctx:CanvasRenderingContext2D,points:number[][]){ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.clip();}
function repairStamp(base:HTMLCanvasElement,x:number,y:number,radius:number){
  const size=Math.max(4,Math.ceil(radius*2)),blur=Math.max(14,Math.round(radius*.42)),padding=blur*2,source=document.createElement("canvas"),stamp=document.createElement("canvas");source.width=size+padding*2;source.height=size+padding*2;stamp.width=size;stamp.height=size;const sourceCtx=source.getContext("2d"),stampCtx=stamp.getContext("2d");if(!sourceCtx||!stampCtx)return stamp;
  sourceCtx.drawImage(base,x-radius-padding,y-radius-padding,size+padding*2,size+padding*2,0,0,size+padding*2,size+padding*2);
  stampCtx.filter=`blur(${blur}px)`;stampCtx.globalAlpha=.72;stampCtx.drawImage(source,-padding,-padding);stampCtx.globalAlpha=.16;for(const shift of [-blur*.5,blur*.5])stampCtx.drawImage(source,-padding,-padding+shift);stampCtx.globalAlpha=1;stampCtx.filter="none";
  stampCtx.globalCompositeOperation="destination-in";const feather=stampCtx.createRadialGradient(radius,radius,radius*.62,radius,radius,radius);feather.addColorStop(0,"rgba(0,0,0,1)");feather.addColorStop(.76,"rgba(0,0,0,.98)");feather.addColorStop(1,"rgba(0,0,0,0)");stampCtx.fillStyle=feather;stampCtx.fillRect(0,0,size,size);return stamp;
}
function paintMosaic(canvas:HTMLCanvasElement,base:HTMLCanvasElement,strokes:MosaicStroke[]){
  const ctx=canvas.getContext("2d");if(!ctx)return;ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(base,0,0);
  strokes.forEach(stroke=>stroke.points.forEach((point,index)=>{const previous=stroke.points[index-1],distance=previous?Math.hypot(point.x-previous.x,point.y-previous.y):0,steps=Math.max(1,Math.ceil(distance/(stroke.radius*.42)));for(let step=1;step<=steps;step++){const ratio=step/steps,x=previous?previous.x+(point.x-previous.x)*ratio:point.x,y=previous?previous.y+(point.y-previous.y)*ratio:point.y,stamp=repairStamp(base,x,y,stroke.radius);ctx.drawImage(stamp,x-stroke.radius,y-stroke.radius)}}));
}

export default function CoverEditor({video,onBack,onSaved}:{video:CoverVideo;onBack:()=>void;onSaved:(thumbnail:string)=>void}){
  const playerRef=useRef<HTMLVideoElement>(null),canvasRef=useRef<HTMLCanvasElement>(null),baseCanvasRef=useRef<HTMLCanvasElement>(document.createElement("canvas"));
  const paintingRef=useRef(false),strokesRef=useRef<MosaicStroke[]>([]);
  const [assets,setAssets]=useState<string[]>([]),[selected,setSelected]=useState<string[]>([]);
  const [loading,setLoading]=useState(true),[refreshing,setRefreshing]=useState(false),[capturing,setCapturing]=useState(false),[saving,setSaving]=useState(false);
  const [time,setTime]=useState(0),[layout,setLayout]=useState<LayoutMode>("diagonal"),[art,setArt]=useState(0),[title,setTitle]=useState("");
  const [mosaicEnabled,setMosaicEnabled]=useState(false),[brushSize,setBrushSize]=useState(48),[strokes,setStrokes]=useState<MosaicStroke[]>([]);
  const size=useMemo(()=>video.aspectRatio==="portrait"?{w:720,h:960}:{w:1280,h:720},[video.aspectRatio]);

  useEffect(()=>{const element=playerRef.current;if(!element)return;let hls:Hls|undefined;if(video.playbackUrl.includes(".m3u8")&&!element.canPlayType("application/vnd.apple.mpegurl")&&Hls.isSupported()){hls=new Hls();hls.loadSource(video.playbackUrl);hls.attachMedia(element)}else element.src=video.playbackUrl;return()=>hls?.destroy()},[video.playbackUrl]);
  useEffect(()=>{setLoading(true);void api<string[]>(`/admin/videos/${video.id}/cover-assets`).then(list=>{setAssets(list);setSelected(list.slice(0,1))}).catch(e=>message.error(e.message)).finally(()=>setLoading(false))},[video.id]);

  useEffect(()=>{let cancelled=false;void (async()=>{const canvas=canvasRef.current;if(!canvas||selected.length<1)return;const ctx=canvas.getContext("2d");if(!ctx)return;const images=await Promise.all(selected.map(loadImage));if(cancelled)return;canvas.width=size.w;canvas.height=size.h;ctx.fillStyle="#090909";ctx.fillRect(0,0,size.w,size.h);const gap=8,n=images.length;
    if(layout==="diagonal")images.forEach((img,i)=>{ctx.save();const band=size.w/n,x=i*band,slant=size.w*.07;clipPolygon(ctx,[[x-slant,0],[x+band+slant,0],[x+band-slant,size.h],[x+slant,size.h]]);drawCover(ctx,img,x-slant,0,band+slant*2,size.h);ctx.restore()});
    else if(layout==="magazine"){drawCover(ctx,images[0],0,0,size.w,size.h);images.slice(1).forEach((img,i)=>{const w=size.w*.31,h=size.h*.24,x=size.w-w-24,y=24+i*(h+12);ctx.save();ctx.shadowColor="rgba(0,0,0,.6)";ctx.shadowBlur=18;drawCover(ctx,img,x,y,w,h);ctx.restore();ctx.strokeStyle="#fff";ctx.lineWidth=5;ctx.strokeRect(x,y,w,h)})}
    else if(n===2){const vertical=layout==="grid";images.forEach((img,i)=>drawCover(ctx,img,vertical?0:i*size.w/2,vertical?i*size.h/2:0,vertical?size.w:size.w/2-gap/2,vertical?size.h/2-gap/2:size.h))}
    else if(n===3){drawCover(ctx,images[0],0,0,size.w*.62-gap/2,size.h);drawCover(ctx,images[1],size.w*.62+gap/2,0,size.w*.38-gap/2,size.h/2-gap/2);drawCover(ctx,images[2],size.w*.62+gap/2,size.h/2+gap/2,size.w*.38-gap/2,size.h/2-gap/2)}
    else images.forEach((img,i)=>drawCover(ctx,img,(i%2)*size.w/2+(i%2?gap/2:0),Math.floor(i/2)*size.h/2+(i>1?gap/2:0),size.w/2-gap/2,size.h/2-gap/2));
    const shade=ctx.createLinearGradient(0,size.h*.45,0,size.h);shade.addColorStop(0,"transparent");shade.addColorStop(1,"rgba(0,0,0,.82)");ctx.fillStyle=shade;ctx.fillRect(0,0,size.w,size.h);
    const style=artStyles[art];ctx.textAlign="left";ctx.textBaseline="bottom";ctx.lineJoin="round";ctx.font=style.font;ctx.lineWidth=12;ctx.strokeStyle=style.stroke;ctx.fillStyle=style.fill;const chars=Array.from(title.trim()),max=video.aspectRatio==="portrait"?10:16,lines=[chars.slice(0,max).join(""),chars.slice(max,max*2).join("")].filter(Boolean);lines.reverse().forEach((line,i)=>{const y=size.h-105-i*90;ctx.strokeText(line,36,y,size.w-72);ctx.fillText(line,36,y,size.w-72)});
    try{const logo=await loadImage(`${location.origin}/icons/5k-video-app-icon-192.png`);if(cancelled)return;ctx.drawImage(logo,size.w-245,size.h-76,44,44)}catch{/* text watermark remains */}ctx.font='700 24px "Microsoft YaHei",sans-serif';ctx.lineWidth=4;ctx.strokeStyle="rgba(0,0,0,.8)";ctx.fillStyle="#fff";ctx.textAlign="right";ctx.textBaseline="middle";ctx.strokeText("永久域名：5k.ag",size.w-24,size.h-51);ctx.fillText("永久域名：5k.ag",size.w-24,size.h-51);
    const base=baseCanvasRef.current;base.width=size.w;base.height=size.h;base.getContext("2d")?.drawImage(canvas,0,0);paintMosaic(canvas,base,strokesRef.current);
  })().catch(()=>message.error("封面预览生成失败"));return()=>{cancelled=true}},[selected,layout,art,title,size,video.aspectRatio]);

  useEffect(()=>{strokesRef.current=strokes;const canvas=canvasRef.current,base=baseCanvasRef.current;if(canvas&&base.width)paintMosaic(canvas,base,strokes)},[strokes]);

  const toggle=(url:string)=>setSelected(current=>current.includes(url)?current.filter(x=>x!==url):current.length>=4?(message.warning("最多选择4张图片"),current):[...current,url]);
  const capture=async()=>{setCapturing(true);try{const result=await api<{url:string}>(`/admin/videos/${video.id}/cover-assets/capture`,{method:"POST",body:JSON.stringify({time:playerRef.current?.currentTime||time})});setAssets(x=>[result.url,...x]);setSelected(x=>[result.url,...x].slice(0,4));message.success("当前画面已加入图片资源区")}catch(e){message.error((e as Error).message)}finally{setCapturing(false)}};
  const refreshAssets=async()=>{setRefreshing(true);try{const list=await api<string[]>(`/admin/videos/${video.id}/cover-assets?refresh=1`);setAssets(list);setSelected(list.slice(0,1));message.success("已重新随机截取10张候选图")}catch(e){message.error((e as Error).message)}finally{setRefreshing(false)}};
  const save=()=>{if(selected.length<1)return message.warning("请至少选择1张图片");const canvas=canvasRef.current;if(!canvas)return;setSaving(true);canvas.toBlob(blob=>{if(!blob){setSaving(false);return message.error("封面生成失败")}void uploadVideoCover(video.id,blob).then(result=>{message.success("新封面已保存");onSaved(result.thumbnail)}).catch(e=>message.error(e.message)).finally(()=>setSaving(false))},"image/jpeg",.92)};
  const canvasPoint=(event:ReactPointerEvent<HTMLCanvasElement>)=>{const canvas=event.currentTarget,rect=canvas.getBoundingClientRect();return{x:(event.clientX-rect.left)*canvas.width/rect.width,y:(event.clientY-rect.top)*canvas.height/rect.height}};
  const startMosaic=(event:ReactPointerEvent<HTMLCanvasElement>)=>{if(!mosaicEnabled)return;event.preventDefault();const point=canvasPoint(event);event.currentTarget.setPointerCapture(event.pointerId);paintingRef.current=true;setStrokes(current=>[...current,{radius:brushSize,points:[point]}])};
  const moveMosaic=(event:ReactPointerEvent<HTMLCanvasElement>)=>{if(!mosaicEnabled||!paintingRef.current)return;event.preventDefault();const point=canvasPoint(event);setStrokes(current=>current.map((stroke,index)=>index===current.length-1?{...stroke,points:[...stroke.points,point]}:stroke))};
  const stopMosaic=()=>{paintingRef.current=false};

  return <div className="cover-page"><div className="cover-page-head"><Space><Button icon={<ArrowLeftOutlined/>} onClick={onBack}>返回视频列表</Button><div><h2>封面编辑</h2><span>{video.title}</span></div></Space><Button type="primary" size="large" icon={<SaveOutlined/>} loading={saving} disabled={selected.length<1} onClick={save}>保存为视频封面</Button></div>
    <Card title="1. 从视频截取画面"><video ref={playerRef} className="cover-source-video" controls poster={video.thumbnail} onTimeUpdate={e=>setTime(e.currentTarget.currentTime)}/><div className="cover-capture-row"><Slider min={0} max={video.duration} step={.1} value={time} onChange={value=>{setTime(value);if(playerRef.current)playerRef.current.currentTime=value}}/><Button type="primary" icon={<CameraOutlined/>} loading={capturing} onClick={capture}>截取当前帧</Button><span>{time.toFixed(1)} 秒</span></div></Card>
    <Card title="2. 图片资源区（随机10张，可选择1至4张）" extra={<Space><Button loading={refreshing} onClick={refreshAssets}>刷新10张</Button><Tag color="orange">已选择 {selected.length}/4</Tag></Space>}><Spin spinning={loading||refreshing}><div className="cover-assets">{assets.map(url=><button key={url} className={selected.includes(url)?"selected":""} onClick={()=>toggle(url)}><img src={url}/><span>{selected.includes(url)?selected.indexOf(url)+1:"选择"}</span></button>)}</div></Spin></Card>
    <Card title="3. 封面排版、艺术字与去字修复"><div className="cover-workbench"><div className="cover-options"><b>自适应同色马赛克</b><Space wrap><Button type={mosaicEnabled?"primary":"default"} onClick={()=>setMosaicEnabled(value=>!value)}>{mosaicEnabled?"同色马赛克已开启":"开启同色马赛克"}</Button><Button disabled={!strokes.length} onClick={()=>setStrokes(value=>value.slice(0,-1))}>撤销上一笔</Button><Button danger disabled={!strokes.length} onClick={()=>setStrokes([])}>清空修复</Button></Space><div className="mosaic-size"><span>涂抹大小</span><Slider min={20} max={100} value={brushSize} onChange={setBrushSize}/></div><p>{mosaicEnabled?"请直接按住并涂过原图文字。色块会自动采用当前位置的背景颜色，并柔化边缘。":"开启后直接涂抹需要遮盖的原图文字，不需要取样。"}</p><b>排版模式</b><div className="cover-preset-list">{layouts.map(item=><Button key={item.key} type={layout===item.key?"primary":"default"} onClick={()=>setLayout(item.key)}>{item.name}</Button>)}<Button onClick={()=>setLayout(layouts[Math.floor(Math.random()*layouts.length)].key)}>随机排版</Button></div><b>封面标题</b><Input.TextArea value={title} maxLength={32} rows={3} onChange={e=>setTitle(e.target.value)}/><b>艺术字模板</b><div className="cover-art-list">{artStyles.map((item,index)=><button key={item.name} className={art===index?"selected":""} style={{color:item.fill,WebkitTextStroke:`1px ${item.stroke}`}} onClick={()=>setArt(index)}>{item.name}</button>)}</div></div><div className={`cover-canvas-wrap ${video.aspectRatio} ${mosaicEnabled?"mosaic-active":""}`}><canvas ref={canvasRef} onPointerDown={startMosaic} onPointerMove={moveMosaic} onPointerUp={stopMosaic} onPointerCancel={stopMosaic}/></div></div></Card>
  </div>;
}
