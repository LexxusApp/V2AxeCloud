import type {Request,Response,NextFunction} from 'express';
import type {SupabaseClient} from '@supabase/supabase-js';
import {getBearerToken} from './requireAuth.js';
import {verifyUser} from './verifyUser.js';
import {checkDelegatedApiRequest} from './delegatedAccess.js';

export const delegatedAccessMiddleware=(sb:SupabaseClient)=>(async(req:Request,res:Response,next:NextFunction)=>{
 if(!req.path.startsWith('/api/')||req.method==='OPTIONS'||/^\/api\/(?:webhooks|cron|v1\/cron)(?:\/|$)/.test(req.path))return next();
 const token=getBearerToken(req);if(!token||!sb)return next();
 try{
  const {user,error}=await verifyUser(sb,token);
  if(error||!user)return res.status(401).json({error:'Sua sessão precisa ser renovada.'});
  const denial=await checkDelegatedApiRequest({sb,user,url:new URL(req.originalUrl,'https://axecloud.com.br'),method:req.method,body:req.body});
  if(denial)return res.status(denial.status).json(denial);
  next();
 }catch{res.status(503).json({error:'Não foi possível validar suas permissões. Tente novamente.'});}
});
