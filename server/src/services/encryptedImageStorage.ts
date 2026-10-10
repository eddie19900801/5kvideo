import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { encryptCoverForStorage } from './encryptedCover.js';
import { signedR2Url } from './playback.js';

export async function uploadEncryptedImage(file:string,keyPrefix:string,mime='image/webp'){
  const encrypted=encryptCoverForStorage(fs.readFileSync(file),mime);
  const key=`${keyPrefix}/${randomUUID()}.enc`,contentType='application/octet-stream';
  const response=await fetch(signedR2Url('PUT',key,Date.now()+15*60_000,encrypted.length,contentType),{method:'PUT',headers:{'Content-Type':contentType,'Content-Length':String(encrypted.length)},body:encrypted});
  if(!response.ok)throw new Error(`R2 图片上传失败（HTTP ${response.status}）`);
  return `r2enc://${config.r2Bucket}/${key}`;
}

export function storeLocalEncryptedImage(file:string,videoId:string,mime='image/webp'){
  const directory=path.join(config.mediaDir,'external-highlights',videoId);fs.mkdirSync(directory,{recursive:true});
  const name=`${randomUUID()}.enc`,target=path.join(directory,name);
  fs.writeFileSync(target,encryptCoverForStorage(fs.readFileSync(file),mime));
  return `localenc://external-highlights/${videoId}/${name}`;
}

export function localEncryptedImagePath(source:string){
  const prefix='localenc://external-highlights/';if(!source.startsWith(prefix))return null;
  const relative=source.slice(prefix.length);if(!/^[0-9a-f-]+\/[0-9a-f-]+\.enc$/i.test(relative))return null;
  const absolute=path.resolve(config.mediaDir,'external-highlights',...relative.split('/'));
  const root=path.resolve(config.mediaDir,'external-highlights')+path.sep;
  return absolute.startsWith(root)?absolute:null;
}
