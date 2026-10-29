import type {Category,VideoPage} from "@/types";

const key="5knews_feed_snapshot_v1",maxAge=24*60*60_000;
type Snapshot={savedAt:number;categories:Category[];pages:Record<string,VideoPage>};
function read():Snapshot|undefined{try{const value=JSON.parse(localStorage.getItem(key)||"null") as Snapshot|null;if(value&&Date.now()-value.savedAt<maxAge)return value}catch{ /* Storage may be unavailable in private browsing. */ }return undefined}
function write(update:(value:Snapshot)=>void){try{const value=read()||{savedAt:Date.now(),categories:[],pages:{}};update(value);value.savedAt=Date.now();localStorage.setItem(key,JSON.stringify(value))}catch{ /* Storage may be unavailable in private browsing. */ }}
export const feedCache={categories:()=>read()?.categories||[],page:(category:string)=>read()?.pages[category||"recommended"],saveCategories:(categories:Category[])=>write(value=>{value.categories=categories}),savePage:(category:string,page:VideoPage)=>write(value=>{value.pages[category||"recommended"]=page})};
