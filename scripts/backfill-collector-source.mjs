import fs from "node:fs";
import path from "node:path";
import { randomInt, randomUUID } from "node:crypto";

const dataDirectory=process.env.DATA_DIRECTORY||"/app/data";
const catalogFile=path.join(dataDirectory,"collected-catalog.json");
const sourceKey=String(process.env.SOURCE_KEY||"").trim();
const sourceName=String(process.env.SOURCE_NAME||sourceKey).trim();
const endpoint=String(process.env.SOURCE_ENDPOINT||"").trim();
if(!/^[a-z0-9_-]{2,50}$/i.test(sourceKey)||!/^https:\/\//i.test(endpoint))throw new Error("SOURCE_KEY 或 SOURCE_ENDPOINT 无效");
const statusFile=path.join(dataDirectory,`${sourceKey}-backfill-status.json`);
const lockFile=path.join(dataDirectory,"collector-sync.lock");
const concurrency=Math.max(1,Math.min(12,Number(process.env.CONCURRENCY||6)));
const requestedStartPage=Math.max(1,Number(process.env.START_PAGE||1));
let lock;

const writeJson=(file,value)=>{const temporary=`${file}.${process.pid}.tmp`;fs.writeFileSync(temporary,JSON.stringify(value));fs.renameSync(temporary,file)};
const clean=(value,max=5000)=>String(value||"").replace(/<[^>]*>/g," ").replace(/&nbsp;/gi," ").replace(/\s+/g," ").trim().slice(0,max);
const duration=value=>{const text=String(value||"").trim();if(/^\d+(?::\d+){1,2}$/.test(text))return Math.max(1,text.split(":").reduce((sum,part)=>sum*60+Number(part),0));return Math.max(1,Number(text.match(/(\d+)\s*分/)?.[1]||0)*60+Number(text.match(/(\d+)\s*秒/)?.[1]||0))};
const stream=value=>{for(const entry of String(value||"").split("#")){const at=entry.indexOf("$"),url=(at>=0?entry.slice(at+1):entry).trim();if(/^https:\/\/\S+\.m3u8(?:\?\S*)?$/i.test(url))return url}return null};
const convert=(item,old)=>{const remoteId=String(item.vod_id||""),playbackUrl=stream(item.vod_play_url),thumbnail=String(item.vod_pic||"");if(!remoteId||!playbackUrl||!/^https:\/\//i.test(thumbnail))return null;const now=new Date().toISOString(),category=clean(item.type_name,100);return{id:old?.id||randomUUID(),title:clean(item.vod_name,200)||`采集视频 ${remoteId}`,description:clean(item.vod_content||item.vod_blurb),thumbnail,playbackUrl,duration:duration(item.vod_duration),tags:category?[category,"采集视频"]:["采集视频"],categoryIds:old?.categoryIds||[],views:old?.views??randomInt(10_000,100_000),aspectRatio:"landscape",isAdult:true,status:"draft",createdAt:old?.createdAt||now,sourceType:"external",externalSource:{sourceKey,remoteId,remoteUpdatedAt:String(item.vod_time||""),importedAt:old?.externalSource?.importedAt||now}}};
async function fetchPage(page){let last;for(let attempt=1;attempt<=4;attempt++){try{const url=new URL(endpoint);url.search=new URLSearchParams({ac:"detail",pg:String(page)});const response=await fetch(url,{headers:{"User-Agent":"5KVIDEO-Collector-Backfill/2.0"},signal:AbortSignal.timeout(30000)});if(!response.ok)throw new Error(`HTTP ${response.status}`);const result=await response.json();if(!Array.isArray(result.list))throw new Error("invalid response");return result}catch(error){last=error;await new Promise(resolve=>setTimeout(resolve,attempt*800))}}throw last}

async function main(){
  fs.mkdirSync(dataDirectory,{recursive:true});
  try{lock=fs.openSync(lockFile,"wx")}catch{throw new Error("采集任务正在运行，无法启动历史回填")}
  const payload=fs.existsSync(catalogFile)?JSON.parse(fs.readFileSync(catalogFile,"utf8")):{videos:[]};
  const videos=Array.isArray(payload.videos)?payload.videos:[],byId=new Map(videos.map(video=>[`${video.externalSource?.sourceKey||""}~${video.externalSource?.remoteId||""}`,video]));
  const first=await fetchPage(1),pageCount=Math.max(1,Number(first.pagecount||1));
  let added=0,updated=0,skipped=0,failedPages=0,completedPages=0;
  const startedAt=new Date().toISOString();
  const saveStatus=(running,error)=>writeJson(statusFile,{running,sourceKey,sourceName,endpoint,startedAt,updatedAt:new Date().toISOString(),pageCount,startPage:requestedStartPage,completedPages,failedPages,added,updated,skipped,total:videos.length,error});
  saveStatus(true);
  for(let start=requestedStartPage;start<=pageCount;start+=concurrency){
    const pages=Array.from({length:Math.min(concurrency,pageCount-start+1)},(_,index)=>start+index);
    const results=await Promise.allSettled(pages.map(page=>page===1?Promise.resolve(first):fetchPage(page)));
    results.forEach(result=>{completedPages++;if(result.status==="rejected"){failedPages++;return}for(const item of result.value.list){const remoteId=String(item.vod_id||""),key=`${sourceKey}~${remoteId}`,old=byId.get(key),converted=convert(item,old);if(!converted){skipped++;continue}if(!old){videos.unshift(converted);byId.set(key,converted);added++}else if(old.externalSource?.remoteUpdatedAt!==converted.externalSource.remoteUpdatedAt||old.playbackUrl!==converted.playbackUrl||old.title!==converted.title||old.thumbnail!==converted.thumbnail){Object.assign(old,converted);updated++}}});
    if(completedPages%20<concurrency)saveStatus(true);
    if(completedPages%200<concurrency){payload.videos=videos;payload.pageCounts={...(payload.pageCounts||{}),[sourceKey]:pageCount};writeJson(catalogFile,payload)}
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  payload.videos=videos;payload.pageCounts={...(payload.pageCounts||{}),[sourceKey]:pageCount};writeJson(catalogFile,payload);saveStatus(false,failedPages?`${failedPages} 个页面失败，可再次执行补齐`:undefined);
}

main().catch(error=>{try{writeJson(statusFile,{running:false,sourceKey,sourceName,endpoint,updatedAt:new Date().toISOString(),error:error instanceof Error?error.message:String(error)})}catch{}process.exitCode=1}).finally(()=>{if(lock!==undefined)fs.closeSync(lock);fs.rmSync(lockFile,{force:true})});
