import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { adminOnly, authenticate, type AuthRequest } from '../auth.js';
import { readDb, updateDb, userRepository } from '../db.js';
import { ok } from '../http.js';

export const adminCatalogRouter = Router();
adminCatalogRouter.use(authenticate, adminOnly);

adminCatalogRouter.get('/users', (_, res) => ok(res, userRepository.listManagedUsers()));

adminCatalogRouter.get('/tags', (_, res) => {
  const db = readDb();
  return ok(res, db.tags.map(tag => ({ ...tag, usageCount: db.videos.filter(video => video.tags.includes(tag.name)).length })).sort((a, b) => b.usageCount - a.usageCount));
});

adminCatalogRouter.post('/tags', (req: AuthRequest, res) => {
  const input = z.object({ name: z.string().trim().min(1).max(20).refine(name => !/[,，、;；\r\n\[\]"]/.test(name)) }).strict().safeParse(req.body);
  if (!input.success) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: '请一次添加一个标签，不能包含逗号或引号' } });
  let tag: { id: string; name: string; createdAt: string } | undefined;
  let exists = false;
  updateDb(db => {
    exists = db.tags.some(item => item.name.toLowerCase() === input.data.name.toLowerCase());
    if (!exists) { tag = { id: randomUUID(), name: input.data.name, createdAt: new Date().toISOString() }; db.tags.push(tag); }
  });
  if (exists) return res.status(409).json({ error: { code: 'TAG_EXISTS', message: '标签已存在' } });
  res.status(201);
  return ok(res, tag);
});

adminCatalogRouter.delete('/tags/:id', (req, res) => {
  let used = false;
  updateDb(db => {
    const tag = db.tags.find(item => item.id === req.params.id);
    if (tag && db.videos.some(video => video.tags.includes(tag.name))) { used = true; return; }
    db.tags = db.tags.filter(item => item.id !== req.params.id);
  });
  if (used) return res.status(409).json({ error: { code: 'TAG_IN_USE', message: '标签正在被视频使用，不能删除' } });
  return ok(res, { deleted: true });
});

adminCatalogRouter.get('/categories',(_,res)=>{const db=readDb();return ok(res,db.categories.map(item=>({...item,videoCount:db.videos.filter(video=>(video.categoryIds||[]).includes(item.id)).length})).sort((a,b)=>a.name.localeCompare(b.name,'zh-CN')))});
adminCatalogRouter.post('/categories',(req:AuthRequest,res)=>{const input=z.object({name:z.string().trim().min(1).max(30)}).strict().safeParse(req.body);if(!input.success)return res.status(400).json({error:{code:'VALIDATION_ERROR',message:'分类名称为1至30个字符'}});let created:{id:string;name:string;createdAt:string}|undefined;let exists=false;updateDb(db=>{exists=db.categories.some(x=>x.name.toLowerCase()===input.data.name.toLowerCase());if(!exists){created={id:randomUUID(),name:input.data.name,createdAt:new Date().toISOString()};db.categories.push(created)}});if(exists)return res.status(409).json({error:{code:'CATEGORY_EXISTS',message:'分类名称已存在'}});res.status(201);return ok(res,created)});
adminCatalogRouter.patch('/categories/:id',(req,res)=>{const input=z.object({name:z.string().trim().min(1).max(30)}).strict().safeParse(req.body);if(!input.success)return res.status(400).json({error:{code:'VALIDATION_ERROR',message:'分类名称为1至30个字符'}});let updated:any,exists=false;updateDb(db=>{exists=db.categories.some(x=>x.id!==req.params.id&&x.name.toLowerCase()===input.data.name.toLowerCase());if(exists)return;const item=db.categories.find(x=>x.id===req.params.id);if(item){item.name=input.data.name;updated=item}});if(exists)return res.status(409).json({error:{code:'CATEGORY_EXISTS',message:'分类名称已存在'}});if(!updated)return res.status(404).json({error:{code:'NOT_FOUND',message:'分类不存在'}});return ok(res,updated)});
adminCatalogRouter.delete('/categories/:id',(req,res)=>{let found=false;updateDb(db=>{found=db.categories.some(x=>x.id===req.params.id);db.categories=db.categories.filter(x=>x.id!==req.params.id);for(const video of db.videos)video.categoryIds=(video.categoryIds||[]).filter(id=>id!==req.params.id)});if(!found)return res.status(404).json({error:{code:'NOT_FOUND',message:'分类不存在'}});return ok(res,{deleted:true})});
