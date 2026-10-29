import type { Video } from "../types.js";

export function collectorVideoId(video: Video) {
  const remoteId=video.externalSource?.remoteId||video.id,sourceKey=video.externalSource?.sourceKey||"";
  return sourceKey&&sourceKey!=="hsckm3u8"?`${sourceKey}~${remoteId}`:remoteId;
}

export function collectorPreviewId(video: Video) {
  return collectorVideoId(video).replace(/[^a-zA-Z0-9_-]/g,"_");
}

export function collectorSourceName(video:Video,sources:Array<{key:string;name:string}>){
  return sources.find(item=>item.key===video.externalSource?.sourceKey)?.name||video.externalSource?.sourceKey||"未知来源";
}
