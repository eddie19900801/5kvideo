import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { config } from '../config.js';
import { videoRepository } from '../db.js';
import { extractFrame } from '../media.js';
import { storeLocalEncryptedImage, uploadEncryptedImage } from './encryptedImageStorage.js';

const running=new Set<string>();
const queue:{videoId:string;source:string;adminId:string;replace:boolean}[]=[];let active=0;
export function highlightGenerationRunning(videoId:string){return running.has(videoId)}
export function highlightCountForDuration(duration:number){return duration<=300?5:duration<=900?8:duration<=1800?12:20}

export function generateMissingHighlights(videoId:string,source:string,adminId:string,replace=false){
  if(running.has(videoId))return false;
  running.add(videoId);
  queue.push({videoId,source,adminId,replace});pump();return true;
}

function pump(){while(active<2&&queue.length){const task=queue.shift()!;active++;void run(task).finally(()=>{active--;running.delete(task.videoId);pump()})}}

async function run({videoId,source,adminId,replace}:{videoId:string;source:string;adminId:string;replace:boolean}){
    const initial=videoRepository.findById(videoId);if(!initial)return;
    videoRepository.update(videoId,{highlightStatus:'processing',highlightError:undefined,...(replace?{highlights:[]}: {})},adminId);
    const directory=path.join(config.mediaDir,'highlight-work',videoId);fs.mkdirSync(directory,{recursive:true});
    try{
      const trimStart=initial.sourceType==='external'&&initial.duration>=70?30:0,trimEnd=trimStart;
      const duration=Math.max(1,initial.duration-trimStart-trimEnd),count=highlightCountForDuration(duration),edge=Math.min(duration*.03,8),usable=Math.max(.3,duration-edge*2);
      let cursor=0;
      const workers=Array.from({length:Math.min(initial.sourceType==='external'?1:3,count)},async()=>{while(true){const slot=cursor++;if(slot>=count)return;const current=videoRepository.findById(videoId);if(current?.highlights?.some(item=>item.slot===slot))continue;
        const zone=usable/count,jitter=zone*.12*(Math.random()*2-1),preferred=initial.highlightTimes?.[slot],time=Math.max(.1,Math.min(Math.max(.1,duration-.1),Number.isFinite(preferred)?Number(preferred):edge+zone*(slot+.5)+jitter));
        const file=path.join(directory,`slot-${String(slot).padStart(2,'0')}-${Date.now()}.webp`);
        await extractFrame(source,file,time+trimStart,480,'webp',true);
        const date=new Date().toISOString().slice(0,10).replaceAll('-','/');
        const image=initial.sourceType==='external'?storeLocalEncryptedImage(file,videoId,'image/webp'):await uploadEncryptedImage(file,`videos/${date}/${videoId}/highlights`,'image/webp');fs.rmSync(file,{force:true});
        const latest=videoRepository.findById(videoId);const highlights=[...(latest?.highlights||[]).filter(item=>item.slot!==slot),{id:randomUUID(),time:Number(time.toFixed(3)),slot,image,source:'auto' as const,createdAt:new Date().toISOString()}].sort((a,b)=>a.slot-b.slot);
        videoRepository.update(videoId,{highlights},adminId);
      }});
      await Promise.all(workers);videoRepository.update(videoId,{highlightStatus:'ready',highlightError:undefined},adminId);
    }catch(error){videoRepository.update(videoId,{highlightStatus:'failed',highlightError:error instanceof Error?error.message:'精彩截图生成失败'},adminId)}
    finally{fs.rmSync(directory,{recursive:true,force:true})}
}
