import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import ffmpegStatic from 'ffmpeg-static';
import ffprobe from 'ffprobe-static';

export interface MediaInfo { duration:number; width:number; height:number; aspectRatio:'portrait'|'landscape' }
const bundledFfmpeg=(ffmpegStatic as unknown as {default?:string})?.default||(ffmpegStatic as unknown as string);
const ffmpegPath=process.env.FFMPEG_PATH||bundledFfmpeg;
function run(executable:string,args:string[]){return new Promise<string>((resolve,reject)=>{const child=spawn(executable,args);let out='',err='';child.stdout.on('data',x=>out+=x);child.stderr.on('data',x=>err+=x);child.on('error',reject);child.on('close',code=>code===0?resolve(out):reject(new Error(err||`process exited ${code}`)));});}
export async function inspectMedia(file:string):Promise<MediaInfo>{const raw=await run(ffprobe.path,['-v','quiet','-print_format','json','-show_streams','-show_format',file]);const data=JSON.parse(raw);const stream=data.streams.find((x:{codec_type:string})=>x.codec_type==='video');if(!stream)throw new Error('文件中没有视频轨道');const width=Number(stream.width||0),height=Number(stream.height||0);return{duration:Math.round(Number(data.format?.duration||stream.duration||0)),width,height,aspectRatio:height>=width?'portrait':'landscape'};}
export async function createCover(video:string,output:string){if(!ffmpegPath)throw new Error('FFmpeg 不可用');await run(ffmpegPath,['-y','-ss','0','-i',video,'-frames:v','1','-vf','scale=720:-2',output]);return path.basename(output);}
export async function extractFrame(video:string,output:string,time:number){if(!ffmpegPath)throw new Error('FFmpeg 不可用');const hlsOptions=video.includes('.m3u8')?['-allowed_extensions','ALL','-allowed_segment_extensions','ALL','-extension_picky','0']:[];await run(ffmpegPath,['-y','-ss',String(Math.max(0,time)),...hlsOptions,'-i',video,'-frames:v','1','-vf','scale=720:-2',output]);return path.basename(output);}
export async function createCandidateFrames(video:string,directory:string,duration:number,refresh=false){
  if(!ffmpegPath)throw new Error('FFmpeg 不可用');
  fs.mkdirSync(directory,{recursive:true});
  if(refresh)for(const name of fs.readdirSync(directory))if(/^candidate-\d+\.jpg$/i.test(name))fs.rmSync(path.join(directory,name),{force:true});
  const files:string[]=[];
  for(let index=0;index<10;index++){
    const output=path.join(directory,`candidate-${String(index+1).padStart(2,'0')}.jpg`);
    if(!fs.existsSync(output)){
      const time=Math.max(0.1,Math.min(Math.max(0.1,duration-0.1),duration*(.05+Math.random()*.9)));
      await extractFrame(video,output,time);
    }
    files.push(output);
  }
  return files;
}
function playlistUris(text:string,base:string){return text.split(/\r?\n/).map(line=>line.trim()).filter(line=>line&&!line.startsWith('#')).map(line=>new URL(line,base).toString());}
export async function createRemoteCandidateFrames(masterUrl:string,directory:string,refresh=false){
  if(!ffmpegPath)throw new Error('FFmpeg 不可用');
  fs.mkdirSync(directory,{recursive:true});
  if(refresh)for(const name of fs.readdirSync(directory))if(/^candidate-\d+\.jpg$/i.test(name))fs.rmSync(path.join(directory,name),{force:true});
  const outputs=Array.from({length:10},(_,index)=>path.join(directory,`candidate-${String(index+1).padStart(2,'0')}.jpg`));
  const missing=outputs.map((output,index)=>({output,index})).filter(item=>!fs.existsSync(item.output));
  if(!missing.length)return outputs;
  const masterResponse=await fetch(masterUrl);
  if(!masterResponse.ok)throw new Error(`无法读取视频清单 (${masterResponse.status})`);
  const masterText=await masterResponse.text();
  const variants=playlistUris(masterText,masterUrl);
  const variantUrl=variants.find(url=>/720p/i.test(url))||variants[0]||masterUrl;
  const variantResponse=variantUrl===masterUrl?masterResponse:await fetch(variantUrl);
  if(!variantResponse.ok)throw new Error(`无法读取视频分片 (${variantResponse.status})`);
  const segments=playlistUris(variantUrl===masterUrl?masterText:await variantResponse.text(),variantUrl);
  if(!segments.length)throw new Error('视频清单中没有可用分片');
  const shuffled=[...segments].sort(()=>Math.random()-.5);
  let cursor=0;
  const workers=Array.from({length:Math.min(3,missing.length)},async()=>{
    while(cursor<missing.length){const item=missing[cursor++],segment=shuffled[item.index%shuffled.length];await extractFrame(segment,item.output,.1);}
  });
  await Promise.all(workers);
  return outputs;
}
export async function createHls(video:string){if(!ffmpegPath)throw new Error('FFmpeg 不可用');const directory=`${video.slice(0,-path.extname(video).length)}-hls`;fs.mkdirSync(directory,{recursive:true});const playlist=path.join(directory,'index.m3u8');await run(ffmpegPath,['-y','-i',video,'-c','copy','-start_number','0','-hls_time','4','-hls_list_size','0','-hls_playlist_type','vod','-hls_flags','independent_segments','-hls_segment_filename',path.join(directory,'segment-%05d.ts'),playlist]);return playlist;}
