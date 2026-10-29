import {analytics} from "./analytics";

type Metrics=Record<string,string|number|boolean>;
const extendedNavigator=navigator as Navigator&{userAgentData?:{mobile?:boolean};connection?:{effectiveType?:string}},startedAt=performance.now(),metrics:Metrics={path:location.pathname,viewport:`${innerWidth}x${innerHeight}`,device:extendedNavigator.userAgentData?.mobile?"mobile":"desktop",network:extendedNavigator.connection?.effectiveType||"unknown"};
let sent=false,priorityImages=0,imageFailures=0;
const round=(value:number)=>Math.max(0,Math.round(value));
function finalize(){if(sent)return;const lcp=Number(metrics.lcp||0),firstImages=Number(metrics.firstImages||0);sent=true;metrics.imageFailures=imageFailures;metrics.sampled=true;analytics.track("performance_page",{value:round(Math.max(lcp,firstImages,Number(metrics.dataReady||0))),metadata:metrics});analytics.flush()}
export const performanceMonitor={
  init(){const nav=performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming|undefined;if(nav){metrics.ttfb=round(nav.responseStart);metrics.domReady=round(nav.domContentLoadedEventEnd);metrics.load=round(nav.loadEventEnd)}try{new PerformanceObserver(list=>{for(const entry of list.getEntries())if(entry.name==="first-contentful-paint")metrics.fcp=round(entry.startTime)}).observe({type:"paint",buffered:true});new PerformanceObserver(list=>{const entries=list.getEntries();if(entries.length)metrics.lcp=round(entries.at(-1)!.startTime)}).observe({type:"largest-contentful-paint",buffered:true})}catch{ /* Storage may be unavailable in private browsing. */ }window.setTimeout(finalize,8_000);window.addEventListener("pagehide",finalize,{once:true})},
  dataReady(fromCache:boolean){if(metrics.dataReady==null){metrics.dataReady=round(performance.now()-startedAt);metrics.dataCache=fromCache}},
  imageLoaded(priority:boolean,source:string){if(!priority)return;priorityImages++;if(metrics.firstImage==null){metrics.firstImage=round(performance.now()-startedAt);try{metrics.imageHost=new URL(source).host}catch{ /* Storage may be unavailable in private browsing. */ }}if(priorityImages>=4&&metrics.firstImages==null)metrics.firstImages=round(performance.now()-startedAt)},
  imageFailed(_priority:boolean){imageFailures++},
};
