const base=import.meta.env.VITE_API_URL||'/api/v1';
export const getToken=()=>localStorage.getItem('video_api_token')||'';
export class ApiError extends Error { status:number;constructor(message:string,status:number){super(message);this.status=status} }
type ApiRequestInit = NonNullable<Parameters<typeof fetch>[1]>;
export async function request<T>(path:string,init:ApiRequestInit={}):Promise<T>{const res=await fetch(`${base}${path}`,{...init,headers:{'Content-Type':'application/json',...(getToken()?{Authorization:`Bearer ${getToken()}`}:{}) ,...init.headers}});const body=await res.json();if(!res.ok)throw new ApiError(body.error?.message||'网络请求失败',res.status);return body.data;}
async function createGuestSession(){localStorage.removeItem('video_api_token');const result=await request<{token:string}>('/auth/guest',{method:'POST'});localStorage.setItem('video_api_token',result.token);await request('/me/session',{method:'POST'});}
export async function ensureGuest(){if(!getToken())return createGuestSession();try{await request('/me/session',{method:'POST'});}catch(error){let isGuest=true;try{const localUser=JSON.parse(localStorage.getItem('video_platform_user')||'null');isGuest=!localUser?.account}catch{/* treat invalid local state as guest */}if(error instanceof ApiError&&error.status===401&&isGuest)return createGuestSession();throw error;}}
export const saveProgress=(videoId:string,progress:number,duration:number,mode:'normal'|'adult')=>request(`/videos/${videoId}/progress`,{method:'PUT',body:JSON.stringify({progress,duration,mode})});
