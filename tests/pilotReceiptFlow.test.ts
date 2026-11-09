import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import {createHash,randomUUID} from 'node:crypto';
import ts from 'typescript';
import * as React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import * as validation from '../lib/receiptReview';
import * as imageValidation from '../api/lib/comprovanteVisionExtract';
import * as bankValidation from '../api/lib/comprovanteValidation';
import {safeErrorMessage} from '../api/lib/safeError';
import sharp from 'sharp';

// Only route orchestration is exercised here. RPC responses are scripted, not
// substitutes for PostgreSQL/RLS; pilotReceiptFlow.validation.sql covers those.
const require=createRequire(import.meta.url);
function load(file:string,deps:Record<string,unknown>){
 const exports:Record<string,any>={};
 const code=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 runInNewContext(code,{exports,require:(name:string)=>name.endsWith('.css')?{}:deps[name]??require(name),Buffer,console,setTimeout,clearTimeout});
 return exports;
}
const owner='fad75b91-d2eb-4805-b5a3-c19e8a073bed',member='ab2eef13-604c-4c8f-9d14-f3da41cc5a81';
const child='3666b777-1066-4eb7-a0c3-f63c2e01ae90',debt='20000000-0000-4000-8000-000000000002',receipt='30000000-0000-4000-8000-000000000003';
const full={valor:'102,00',data_pagamento:'1904-02-29',beneficiario:'Casa QA',id_transacao:'EQA1234567890123',confirmo_recebimento:true,motivo:'Crédito conferido manualmente'};
const row=()=>({id:receipt,financeiro_id:debt,filho_id:child,tenant_id:owner,submitted_by:member,request_id:randomUUID(),storage_path:`${owner}/${child}/qa.png`,arquivo_sha256:'a'.repeat(64),status:'em_analise',created_at:'2026-11-03T12:00:00Z',decided_at:null,decision_reason:null,analysis_status:'concluida',analysis:{},alerts:[],submitted_value:102,valor_atual:102});

function fixture(withReceipt=true){
 const tables:Record<string,any[]>={filhos_de_santo:[{id:child,user_id:member,tenant_id:owner,lider_id:owner,nome:'QA sem telefone',cpf:'12345678900',telefone:null}],financeiro:[{id:debt,filho_id:child,tenant_id:owner,lider_id:owner,categoria:'Mensalidade',status:'pendente',valor:102,data:'1904-01-10',data_vencimento:'1904-01-10'}],mensalidade_comprovante_envios:withReceipt?[row()]:[],financeiro_comprovantes:[],configuracoes_pix:[{terreiro_id:owner,nome_beneficiario:'Casa QA'}]};
 const calls:{name:string;args:any}[]=[],writes:string[]=[],storage:string[]=[],notices:any[]=[];
 let rpcResult:any={data:{id:receipt,status:'aceito',valor:102,competencia:'1904-01-10',replayed:false}},offline=false;
 function from(table:string){
  const filters:((r:any)=>boolean)[]=[];let single=false,patch:any;
  const q:any={select(){return q;},eq(key:string,value:any){filters.push(r=>r[key]===value);return q;},neq(key:string,value:any){filters.push(r=>r[key]!==value);return q;},in(key:string,values:any[]){filters.push(r=>values.includes(r[key]));return q;},or(value:string){const parts=value.split(',').map(s=>s.split('.eq.'));filters.push(r=>parts.some(([k,v])=>r[k]===v));return q;},limit(){return q;},order(){return q;},maybeSingle(){single=true;return q;},update(value:any){writes.push(table);patch=value;return q;},then(resolve:any){const rows=(tables[table]||[]).filter(r=>filters.every(f=>f(r)));if(patch)rows.forEach(r=>Object.assign(r,patch));return Promise.resolve({data:single?rows[0]||null:rows,count:rows.length,error:null}).then(resolve);}};return q;
 }
 const sb={from,rpc:async(name:string,args:any)=>{calls.push({name,args});return typeof rpcResult==='function'?rpcResult(name,args):rpcResult;},storage:{from:()=>({upload:async(path:string)=>{storage.push(path);return {error:null};},remove:async()=>({error:null}),createSignedUrl:async()=>({data:{signedUrl:'https://example.invalid/qa-private'}})})}};
 const routes=new Map<string,any>();
 const app:any={post:(path:string,...handlers:any[])=>routes.set('POST '+path,handlers.at(-1)),get:(path:string,...handlers:any[])=>routes.set('GET '+path,handlers.at(-1))};
 const {registerReceiptReviewRoutes}=load('api/lib/receiptReviewRoutes.ts',{
  './requireAuth.js':{requireAuthOrRespond:async(_sb:any,req:any)=>req.user},
  './tenantAccess.js':{normalizeFilhoRequestTenantId:async(_sb:any,_user:any,id:string)=>id,assertUserCanAccessTenant:async(_sb:any,_user:any,id:string)=>id===owner,assertZeladorTenantAccess:async(_sb:any,id:string)=>id===owner,resolveFilhoHouseRefs:async()=>null},
  './rateLimit.js':{comprovanteVisionRateLimit:()=>{},sensitiveActionRateLimit:()=>{}},
  './safeError.js':{safeErrorMessage},'./comprovanteVisionExtract.js':imageValidation,'./comprovanteValidation.js':bankValidation,'../../lib/receiptReview.js':validation,
  './resolveFilhoRowIdForFinance.js':{resolveFilhoRowIdForFinance:async(_sb:any,{jwtUserId}:any)=>jwtUserId===member?child:null},
 });
 registerReceiptReviewRoutes(app,{supabaseAdmin:sb,resolveLeaderId:async()=>owner,extract:async()=>{if(offline)throw Error('IA indisponível');return {valor:102,data:'1904-02-29',beneficiario:'Casa QA',cpf_pagador:'12345678900',id_transacao:full.id_transacao,estado_pagamento:'concluido'};},notifyMensalidadeConfirmadaWhatsApp:async(_sb:any,args:any)=>{notices.push(args);}});
 async function call(method:string,path:string,body:any={},who=owner,query:Record<string,string>={tenantId:owner}){
  let status=200,result:any;const headers:Record<string,string>={};
  const response:any={status(value:number){status=value;return response;},json(value:any){result=value;return response;},setHeader(key:string,value:string){headers[key]=value;return response;}};
  await routes.get(method+' '+path)({body,query,params:{id:receipt},user:{id:who,email:'qa@example.invalid'}},response);
  return {status,body:result,headers};
 }
 return {tables,calls,writes,storage,notices,call,setRPC:(result:any)=>{rpcResult=result;},offline:()=>{offline=true;}};
}
const approve='/api/v1/financial/comprovantes/:id/aprovar',reject='/api/v1/financial/comprovantes/:id/rejeitar',submit='/api/v1/financeiro/validar-comprovante';

test('pilot receipt approval rejects partial, excess precision, future/invalid dates and member self-decision before RPC',async()=>{
 const ctx=fixture();
 for(const change of [{valor:101.99},{valor:102.001},{data_pagamento:'1904-02-30'},{data_pagamento:'2999-01-01'},{confirmo_recebimento:false}])assert.equal((await ctx.call('POST',approve,{...full,...change})).status,422);
 assert.equal((await ctx.call('POST',approve,full,member)).status,403);
 assert.equal((await ctx.call('POST',approve,full,owner,{tenantId:randomUUID()})).status,403);
 assert.equal(ctx.calls.length,0);assert.equal(ctx.notices.length,0);
});

test('stale decision conflicts are returned without notification; a successful retry does not repeat the side effect',async()=>{
 const ctx=fixture();ctx.setRPC({error:{code:'23505',message:'Comprovante já decidido ou mensalidade quitada por outra via'}});
 assert.equal((await ctx.call('POST',approve,full)).status,409);assert.equal(ctx.notices.length,0);
 ctx.setRPC({data:{id:receipt,status:'aceito',replayed:true}});
 const replay=await ctx.call('POST',approve,full);assert.equal(replay.status,200);assert.equal(replay.body.data.replayed,true);assert.equal(ctx.notices.length,0);
 assert.ok(ctx.calls.every(call=>call.name==='decidir_envio_comprovante'));
 assert.equal(ctx.tables.financeiro[0].status,'pendente','route must not settle outside the atomic RPC');
});

test('human rejection forwards only to the atomic decision and never invokes payment confirmation',async()=>{
 const ctx=fixture();ctx.setRPC({data:{id:receipt,status:'rejeitado',replayed:false}});
 const result=await ctx.call('POST',reject,{motivo:'Pagamento agendado, crédito não localizado'});
 assert.equal(result.status,200);assert.equal(ctx.calls[0].args.p_decisao,'rejeitado');assert.equal(ctx.calls[0].args.p_actor,owner);assert.equal(ctx.notices.length,0);assert.equal(ctx.tables.financeiro[0].status,'pendente');
});

test('upload and AI outage preserve pending debt; accepted hash is blocked before upload; request replay preserves timestamp',async()=>{
 const bytes=await sharp({create:{width:4,height:4,channels:3,background:'#ffffff'}}).png().toBuffer();
 const payload={workflow:'manual_review_v1',tenant_id:owner,financeiro_id:debt,request_id:randomUUID(),fileData:bytes.toString('base64'),contentType:'image/png'};
 const ctx=fixture(false);ctx.offline();
 ctx.setRPC((_name:string,args:any)=>{const saved={...row(),request_id:args.p_request,arquivo_sha256:args.p_sha,storage_path:args.p_path,analysis_status:'pendente'};ctx.tables.mensalidade_comprovante_envios.push(saved);return {data:saved};});
 const sent=await ctx.call('POST',submit,payload,member);
 assert.equal(sent.status,202);assert.equal(sent.body.requires_review,true);assert.equal(sent.body.data.analysis_status,'indisponivel');assert.equal(ctx.notices.length,0);assert.equal(ctx.tables.financeiro[0].status,'pendente');assert.deepEqual(ctx.writes,['mensalidade_comprovante_envios']);
 const retried=await ctx.call('POST',submit,payload,member);assert.equal(retried.body.replayed,true);assert.equal(retried.body.data.created_at,sent.body.data.created_at);assert.equal(ctx.storage.length,1);assert.equal(ctx.calls.length,1);assert.equal(ctx.calls[0].name,'registrar_envio_comprovante');
 const duplicate=fixture(false);duplicate.tables.financeiro_comprovantes.push({id:randomUUID(),arquivo_sha256:createHash('sha256').update(bytes).digest('hex')});
 assert.equal((await duplicate.call('POST',submit,payload,member)).status,409);assert.equal(duplicate.storage.length,0);assert.equal(duplicate.calls.length,0);
});

test('modal reflects a polled decision instead of offering approval for its stale selected copy',()=>{
 const selected=row();
 for(const status of ['aceito','rejeitado','encerrado','removed'] as const){
  let hook=0;
  const react={...React,useState:(initial:any)=>[++hook===1?selected:typeof initial==='function'?initial():initial,()=>{}],useEffect:()=>{}};
  const {default:Reviews}=load('design-systems/menu-local-20261029/ReceiptReviews.tsx',{
   react,'../../lib/receiptReview':validation,'../../src/lib/receiptReviewClient':{},'../shared/PageLoading':{default:()=>null},'./finance':{financialMoney:(value:number)=>String(value)},'./billing':{financialToday:()=> '2026-11-03'},'./receiptActions':{},
   './WorkflowUI':{WorkflowDialog:({children}:any)=>React.createElement('div',null,children),WorkflowEmpty:()=>null},
  });
  const feed={rows:status==='removed'?[]:[{...selected,status,decided_at:'2026-11-03T12:05:00Z',decision_reason:'Conferido por outro operador'}],pendingCount:0,filter:status==='removed'?'em_analise':'todos',loading:false};
  const html=renderToStaticMarkup(React.createElement(Reviews as React.ComponentType<any>,{feed,tenantId:owner,onConfirmed(){}}));
  assert.doesNotMatch(html,/Confirmar recebimento|Rejeitar comprovante/);
  if(status!=='removed'){assert.match(html,/Decisão em/);assert.match(html,/Conferido por outro operador/);}
 }
});
