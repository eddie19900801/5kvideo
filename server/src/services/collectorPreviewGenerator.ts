import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { config } from '../config.js';
import { extractFrame } from '../media.js';
import { videoRepository } from '../db.js';
import type { Video } from '../types.js';
import { highlightCountForDuration } from './highlightGenerator.js';
import { storeLocalEncryptedImage } from './encryptedImageStorage.js';

export type CollectorPreview={id:string;time:number;slot:number;file:string;createdAt:string};
type PreviewMetadata={status:'idle'|'processing'|'ready'|'failed';error?:string;items:CollectorPreview[]};
type Task={remoteId:string;source:string;duration:number;trimStart:number;replace:boolean;priority:'high'|'normal';queuedAt:string;running?:boolean};
type QueueState={paused:boolean;completed:number;failed:number;jobs:Task[]};
const MAX_ACTIVE=2,running=new Set<string>();let active=0;
const queueFile=path.join(config.mediaDir,'collector-preview-queue.json');
let state:QueueState=loadQueue();

function loadQueue():QueueState{try{const value=JSON.parse(fs.readFileSync(queueFile,'utf8')) as QueueState;return{paused:Boolean(value.paused),completed:Number(value.completed||0),failed:Number(value.failed||0),jobs:Array.isArray(value.jobs)?value.jobs.map(job=>({...job,running:false})):[]}}catch{return{paused:false,completed:0,failed:0,jobs:[]}}}
function saveQueue(){fs.mkdirSync(path.dirname(queueFile),{recursive:true});const temporary=`${queueFile}.tmp`;fs.writeFileSync(temporary,JSON.stringify(state,null,2));fs.renameSync(temporary,queueFile)}
const safeId=(value:string)=>/^[0-9A-Za-z_-]{1,100}$/.test(value)?value:null;
export function collectorPreviewDirectory(remoteId:string){const id=safeId(remoteId);return id?path.join(config.mediaDir,'collector-previews',id):null}
const metadataFile=(remoteId:string)=>{const directory=collectorPreviewDirectory(remoteId);return directory?path.join(directory,'metadata.json'):null};
export function readCollectorPreviews(remoteId:string):PreviewMetadata{
  const file=metadataFile(remoteId);let stored:PreviewMetadata={status:'idle',items:[]};
  if(file&&fs.existsSync(file)){try{stored=JSON.parse(fs.readFileSync(file,'utf8')) as PreviewMetadata}catch{/* regenerate invalid metadata */}}
  return running.has(remoteId)||state.jobs.some(job=>job.remoteId===remoteId)?{...stored,status:'processing'}:stored;
}
function writeMetadata(remoteId:string,value:PreviewMetadata){const file=metadataFile(remoteId);if(!file)throw new Error('资源 ID 无效');fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(value,null,2))}

export function generateCollectorPreviews(remoteId:string,source:string,duration:number,trimStart:number,replace=false,priority:'high'|'normal'='high'){
  if(!safeId(remoteId)||running.has(remoteId))return false;
  const existing=state.jobs.find(job=>job.remoteId===remoteId);if(existing){if(priority==='high'&&!existing.running){existing.priority='high';saveQueue();pump()}return false}
  const task={remoteId,source,duration,trimStart,replace,priority,queuedAt:new Date().toISOString()} satisfies Task;
  priority==='high'?state.jobs.unshift(task):state.jobs.push(task);saveQueue();pump();return true;
}
export function collectorPreviewQueueStatus(){return{paused:state.paused,queued:state.jobs.filter(job=>!job.running).length,running:active,completed:state.completed,failed:state.failed,concurrency:MAX_ACTIVE}}
export function setCollectorPreviewQueuePaused(paused:boolean){state.paused=paused;saveQueue();if(!paused)pump();return collectorPreviewQueueStatus()}
export function resetCollectorPreviewQueueStats(){state.completed=0;state.failed=0;saveQueue();return collectorPreviewQueueStatus()}

function nextTask(){const task=state.jobs.find(job=>!job.running&&job.priority==='high')||state.jobs.find(job=>!job.running);if(task)task.running=true;return task}
function pump(){if(state.paused)return;while(active<MAX_ACTIVE){const task=nextTask();if(!task)break;active++;running.add(task.remoteId);saveQueue();void run(task).then(success=>{success?state.completed++:state.failed++}).finally(()=>{active--;running.delete(task.remoteId);state.jobs=state.jobs.filter(job=>job!==task);saveQueue();pump()})}}
async function run(task:Task){
  const directory=collectorPreviewDirectory(task.remoteId);if(!directory)return false;
  fs.mkdirSync(directory,{recursive:true});let metadata:PreviewMetadata=task.replace?{status:'processing',items:[]}:{...readStoredMetadata(task.remoteId),status:'processing',error:undefined};
  if(task.replace)for(const name of fs.readdirSync(directory))if(name.endsWith('.webp'))fs.rmSync(path.join(directory,name),{force:true});
  writeMetadata(task.remoteId,metadata);
  try{
    const duration=Math.max(1,task.duration),count=highlightCountForDuration(duration),edge=Math.min(duration*.03,8),usable=Math.max(.3,duration-edge*2);
    for(let slot=0;slot<count;slot++){
      if(metadata.items.some(item=>item.slot===slot))continue;
      const zone=usable/count,time=Math.max(.1,Math.min(duration-.1,edge+zone*(slot+.5))),name=`${String(slot).padStart(2,'0')}-${randomUUID()}.webp`,file=path.join(directory,name);
      await extractFrame(task.source,file,time+task.trimStart,480,'webp',true);
      metadata.items.push({id:randomUUID(),time:Number(time.toFixed(3)),slot,file:name,createdAt:new Date().toISOString()});metadata.items.sort((a,b)=>a.slot-b.slot);writeMetadata(task.remoteId,metadata);
    }
    const referenced=new Set(metadata.items.map(item=>item.file));for(const name of fs.readdirSync(directory))if(name.endsWith('.webp')&&!referenced.has(name))fs.rmSync(path.join(directory,name),{force:true});
    writeMetadata(task.remoteId,{...metadata,status:'ready',error:undefined});return true;
  }catch(error){writeMetadata(task.remoteId,{...metadata,status:'failed',error:error instanceof Error?error.message:'预览截图生成失败'});return false}
}
function readStoredMetadata(remoteId:string):PreviewMetadata{const file=metadataFile(remoteId);if(file&&fs.existsSync(file)){try{return JSON.parse(fs.readFileSync(file,'utf8')) as PreviewMetadata}catch{/* ignore */}}return{status:'idle',items:[]}}

export function deleteCollectorPreview(remoteId:string,previewId:string){
  const metadata=readStoredMetadata(remoteId),target=metadata.items.find(item=>item.id===previewId),directory=collectorPreviewDirectory(remoteId);if(!target||!directory)return false;
  fs.rmSync(path.join(directory,path.basename(target.file)),{force:true});writeMetadata(remoteId,{...metadata,status:'idle',items:metadata.items.filter(item=>item.id!==previewId)});return true;
}

export function adoptCollectorPreviews(video:Video,adminId:string){
  const remoteId=video.externalSource?.remoteId;if(!remoteId)return 0;const metadata=readStoredMetadata(remoteId),directory=collectorPreviewDirectory(remoteId);if(!directory||!metadata.items.length)return 0;
  const highlights=metadata.items.filter(item=>fs.existsSync(path.join(directory,item.file))).map(item=>({id:randomUUID(),time:item.time,slot:item.slot,image:storeLocalEncryptedImage(path.join(directory,item.file),video.id,'image/webp'),source:'auto' as const,createdAt:new Date().toISOString()}));
  if(highlights.length)videoRepository.update(video.id,{highlights,highlightStatus:metadata.status==='ready'?'ready':'processing',highlightError:metadata.error},adminId);return highlights.length;
}

// Persisted jobs left by a restart resume automatically.
setImmediate(pump);
