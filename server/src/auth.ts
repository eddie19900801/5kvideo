import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
export interface AuthRequest extends Request { auth?: {id:string;role:'user'|'admin'}; playbackViewer?: string }
const secret=()=>{
  const configured=process.env.JWT_SECRET?.trim();
  if(configured)return configured;
  if(process.env.NODE_ENV==='production')throw new Error('生产环境必须配置 JWT_SECRET');
  return 'dev-only-secret';
};
export const signToken=(id:string,role:'user'|'admin')=>jwt.sign({id,role},secret(),{expiresIn:'7d'});
export function authenticate(req:AuthRequest,res:Response,next:NextFunction){ const token=req.headers.authorization?.replace(/^Bearer\s+/,''); if(!token)return res.status(401).json({error:{code:'UNAUTHORIZED',message:'请先登录'}}); try{ req.auth=jwt.verify(token,secret()) as AuthRequest['auth']; next(); }catch{return res.status(401).json({error:{code:'INVALID_TOKEN',message:'登录已过期'}});} }
export function optionalAuthenticate(req:AuthRequest,_res:Response,next:NextFunction){const token=req.headers.authorization?.replace(/^Bearer\s+/,'');if(token){try{req.auth=jwt.verify(token,secret()) as AuthRequest['auth']}catch{/* anonymous recommendation fallback */}}next();}
export function adminOnly(req:AuthRequest,res:Response,next:NextFunction){ if(req.auth?.role!=='admin')return res.status(403).json({error:{code:'FORBIDDEN',message:'无管理权限'}}); next(); }
