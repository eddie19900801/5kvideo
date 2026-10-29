import { apiBase } from "./api";

const installKey = "5knews_install_id_v1",
  firstOpenKey = "5knews_first_open_sent_v1",
  sessionKey = "5knews_analytics_session_v2",
  channelKey = "5knews_attribution_channel_v1",
  sessionTimeout = 30 * 60_000;
type TrackInput = {videoId?:string;value?:number;metadata?:Record<string,string|number|boolean>};
type AppPlatform="web"|"android"|"ios";
type EventPayload=TrackInput&{eventName:string;installId:string;sessionId:string;platform:AppPlatform;appVersion:string;channel:string};
const stableId = () => {
  let value = localStorage.getItem(installKey);
  if (!value) { value = crypto.randomUUID(); localStorage.setItem(installKey, value); }
  return value;
};
const sessionId = () => {
  const now=Date.now();let current:{id:string;activeAt:number}|null=null;
  try{current=JSON.parse(localStorage.getItem(sessionKey)||"null")}catch{ /* Storage may be unavailable in private browsing. */ }
  if(!current?.id||now-current.activeAt>sessionTimeout)current={id:crypto.randomUUID(),activeAt:now};
  else current.activeAt=now;
  localStorage.setItem(sessionKey,JSON.stringify(current));return current.id;
};
const disabled=()=>navigator.webdriver||location.search.includes("analytics=off");
const attributionChannel=()=>{
  const query=new URLSearchParams(location.search),incoming=query.get("channel")||query.get("cid")||query.get("utm_source")||"";
  if(incoming&&/^[a-z0-9_-]{1,50}$/i.test(incoming)){localStorage.setItem(channelKey,incoming);return incoming}
  return localStorage.getItem(channelKey)||"direct";
};
const platform=():AppPlatform=>{
  const key="5knews_app_platform_v1",query=new URLSearchParams(location.search),incoming=query.get("app_platform");
  if(incoming==="android"||incoming==="ios"){localStorage.setItem(key,incoming);return incoming}
  if(/PPFreeApp|5KVideoApp/i.test(navigator.userAgent)){localStorage.setItem(key,"android");return "android"}
  const saved=localStorage.getItem(key);return saved==="android"||saved==="ios"?saved:"web";
};
const payload=(eventName:string,input:TrackInput={}):EventPayload=>({
  eventName,installId:stableId(),sessionId:sessionId(),platform:platform(),appVersion:"5knews",channel:attributionChannel(),...input,
  metadata:{
    productSlug:localStorage.getItem("5knews_product_slug_v1")||"",
    productId:localStorage.getItem("5knews_product_id_v1")||"",
    productHost:location.hostname.toLowerCase(),
    ...(input.metadata||{}),
  },
});
async function send(events:EventPayload[]){
  if(disabled())return false;
  try{
    const token=localStorage.getItem("5knews_guest_token_v1"),response=await fetch(`${apiBase}/analytics/events`,{method:"POST",keepalive:true,signal:AbortSignal.timeout(15000),headers:{"Content-Type":"application/json",Accept:"application/json",...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify({events})});
    return response.ok;
  }catch{return false}
}
let queue:EventPayload[]=[],timer:number|undefined;
const flush=()=>{if(timer)window.clearTimeout(timer);timer=undefined;const events=queue.splice(0,40);if(events.length)void send(events);if(queue.length)timer=window.setTimeout(flush,250)};
const enqueue=(event:EventPayload)=>{if(disabled())return;queue.push(event);if(queue.length>=20)flush();else if(!timer)timer=window.setTimeout(flush,750)};
window.addEventListener("pagehide",flush);
export const analytics={
  track(eventName:string,input:TrackInput={}){enqueue(payload(eventName,input))},
  flush,
  report(eventName:string,input:TrackInput){return send([payload(eventName,input)])},
  async appOpen(){const product=localStorage.getItem("5knews_product_slug_v1")||location.hostname,key=`${firstOpenKey}_${product}_${platform()}`,firstOpen=!localStorage.getItem(key),ok=await send([payload("app_open",{metadata:{firstOpen,attributionChannel:attributionChannel()}})]);if(firstOpen&&ok)localStorage.setItem(key,"1")},
};
