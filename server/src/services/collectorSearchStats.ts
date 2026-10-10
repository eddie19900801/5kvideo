import fs from "node:fs";
import path from "node:path";

type SearchItem={keyword:string;count:number;updatedAt:string};
type SearchStats={items:Record<string,SearchItem>};
const file=path.join(path.dirname(path.resolve(process.env.DATA_FILE||"./data/db.json")),"collected-search-stats.json");
const minimum=Math.max(1,Number(process.env.HOT_SEARCH_MIN_COUNT||3));
const maximum=Math.max(1,Math.min(30,Number(process.env.HOT_SEARCH_LIMIT||10)));
let cache:{mtime:number;value:SearchStats}|undefined;

function read(){if(!fs.existsSync(file))return{items:{}} as SearchStats;const mtime=fs.statSync(file).mtimeMs;if(cache?.mtime===mtime)return structuredClone(cache.value);const parsed=JSON.parse(fs.readFileSync(file,"utf8")) as SearchStats, value={items:parsed.items&&typeof parsed.items==="object"?parsed.items:{}};cache={mtime,value};return structuredClone(value)}
function write(value:SearchStats){fs.mkdirSync(path.dirname(file),{recursive:true});const temporary=`${file}.${process.pid}.tmp`;fs.writeFileSync(temporary,JSON.stringify(value),"utf8");fs.renameSync(temporary,file);cache=undefined}
const key=(value:string)=>value.trim().replace(/\s+/g," ").toLocaleLowerCase();
export function recordCollectorSearch(keyword:string){const normalized=key(keyword);if(!normalized)return;const value=read(),current=value.items[normalized];value.items[normalized]={keyword:current?.keyword||keyword.trim(),count:(current?.count||0)+1,updatedAt:new Date().toISOString()};write(value)}
export function hotCollectorSearches(){return Object.values(read().items).filter(item=>item.count>=minimum).sort((a,b)=>b.count-a.count||b.updatedAt.localeCompare(a.updatedAt)).slice(0,maximum).map(item=>({keyword:item.keyword,count:item.count}))}
