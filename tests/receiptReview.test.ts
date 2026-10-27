import test from 'node:test';import assert from 'node:assert/strict';
import sharp from 'sharp';import {randomUUID} from 'node:crypto';import express from 'express';import type {AddressInfo} from 'node:net';
import {validateReceiptDecision,receiptMoneyCents} from '../lib/receiptReview.js';
import {buildReceiptAlerts,registerReceiptReviewRoutes} from '../api/lib/receiptReviewRoutes.js';
import {validateComprovanteImage,normalizeComprovanteMime} from '../api/lib/comprovanteVisionExtract.js';
import {withoutReceiptReviews} from '../api/lib/receiptReviewReminders.js';
const owner='10000000-0000-4000-8000-000000000001',member='20000000-0000-4000-8000-000000000002',child='30000000-0000-4000-8000-000000000003',debt='40000000-0000-4000-8000-000000000004',another='50000000-0000-4000-8000-000000000005';
const full={valor:102,data_pagamento:'2026-10-27',beneficiario:'Casa de Axe Oxum',id_transacao:'E1234567890TEST',confirmo_recebimento:true,motivo:'Conferido em conta'};
test('decision requires exact full cents, explicit confirmation, real date, reviewed identity and reason',()=>{
 assert.equal(receiptMoneyCents('102,00'),10200);assert.equal(validateReceiptDecision(full,102,true,'2026-10-27').valor,102);
 for(const change of [{valor:100},{valor:102.01},{valor:102.001},{confirmo_recebimento:false},{data_pagamento:'2026-02-30'},{data_pagamento:'2026-10-28'},{id_transacao:'short'},{beneficiario:''},{motivo:''}])assert.throws(()=>validateReceiptDecision({...full,...change},102,true,'2026-10-27'));
});
test('AI warns about scheduled/partial/uncertain data, not an automatic payment decision',()=>{
 const good={valor:102,data:'2026-10-27',cpf_pagador:'***.456.789-**',beneficiario:'Casa de Axe Oxum',id_transacao:'E1234567890TEST',estado_pagamento:'concluido' as const};
 assert.deepEqual(buildReceiptAlerts(good,'12345678900','Casa de Axe Oxum',102),[]);
 for(const change of [{valor:100},{cpf_pagador:'***.***.789-**'},{beneficiario:'Casa de Axe Ogum'},{data:'2099-01-01'},{id_transacao:null},{estado_pagamento:'agendado' as const},{estado_pagamento:'cancelado' as const},{}]){
  const analysis=Object.keys(change).length?{...good,...change}:{};assert.ok(buildReceiptAlerts(analysis,'12345678900','Casa de Axe Oxum',102).length);
 }
});
test('file validation checks real format, damage, size and declared MIME',async()=>{
 const png=await sharp({create:{width:8,height:8,channels:3,background:'#123123'}}).png().toBuffer();
 assert.equal(await validateComprovanteImage(png,'image/png'),'image/png');
 assert.equal(normalizeComprovanteMime('application/pdf'),'application/pdf');
 for(const [bytes,mime] of [[png,'application/pdf'],[png,'image/jpeg'],[Buffer.from('not a picture'),'image/png'],[Buffer.alloc(5*1024*1024+1),'image/png']] as const)await assert.rejects(()=>validateComprovanteImage(bytes,mime));
});
test('reminders skip only reviewed debt and fail closed on lookup failure',async()=>{
 const sb:any={from:()=>({select:()=>({eq:()=>({in:async()=>({data:[{financeiro_id:debt}],error:null})})})})};
 assert.deepEqual(await withoutReceiptReviews(sb,[{id:debt},{id:another}]),[{id:another}]);
 const fail:any={from:()=>({select:()=>({eq:()=>({in:async()=>({error:Error('offline')})})})})};await assert.rejects(()=>withoutReceiptReviews(fail,[{id:debt}]));
});
function fixture(){
 const tables:Record<string,any[]>={perfil_lider:[{id:owner,tenant_id:owner}],filhos_de_santo:[{id:child,user_id:member,lider_id:owner,tenant_id:owner,nome:'Teste',cpf:'12345678900',email:'member@example.invalid'}],financeiro:[{id:debt,filho_id:child,tenant_id:owner,lider_id:owner,categoria:'Mensalidade',status:'pendente',valor:102,data:'2026-09-10'}],configuracoes_pix:[{terreiro_id:owner,nome_beneficiario:'Casa de Axe Oxum'}],financeiro_comprovantes:[],mensalidade_comprovante_envios:[],mensalidade_comprovante_eventos:[]};
 let uploads=0,removes=0,notifies=0,lost=false,aiOffline=false;
 function from(table:string){let filters:((r:any)=>boolean)[]=[],one=false,patch:any,limit=1000;const q:any={select(){return q;},eq(k:string,v:any){filters.push(r=>r[k]===v);return q;},neq(k:string,v:any){filters.push(r=>r[k]!==v);return q;},in(k:string,v:any[]){filters.push(r=>v.includes(r[k]));return q;},or(s:string){const parts=s.split(',').map(p=>p.split('.eq.'));filters.push(r=>parts.some(([k,v])=>String(r[k])===v));return q;},order(){return q;},limit(n:number){limit=n;return q;},update(v:any){patch=v;return q;},maybeSingle(){one=true;return q;},then(resolve:any){const raw=table==='mensalidade_comprovante_lista'?tables.mensalidade_comprovante_envios:tables[table]||[];let rows=raw.filter(r=>filters.every(f=>f(r)));const count=rows.length;rows=rows.slice(0,limit);if(patch)rows.forEach(r=>Object.assign(r,patch));return Promise.resolve({data:one?rows[0]||null:rows,count,error:null}).then(resolve);}};return q;}
 const sb:any={from,auth:{getUser:async(token:string)=>({data:{user:{id:token.startsWith('owner')?owner:member,email:token.startsWith('owner')?'owner@example.invalid':'member@example.invalid'}},error:null})},storage:{from:()=>({upload:async()=>{uploads++;return {error:null};},remove:async()=>{removes++;return {error:null};},createSignedUrl:async()=>({data:{signedUrl:'https://example.invalid/private?expires=300'}})})},rpc:async(name:string,args:any)=>{
  if(name==='registrar_envio_comprovante'){const row={id:randomUUID(),tenant_id:owner,filho_id:child,financeiro_id:debt,submitted_by:member,request_id:args.p_request,storage_path:args.p_path,arquivo_sha256:args.p_sha,status:'em_analise',analysis_status:'pendente',analysis:{},alerts:[],created_at:new Date().toISOString(),submitted_value:102};tables.mensalidade_comprovante_envios.push(row);if(lost)return {error:{message:'Lost RPC response'}};return {data:row};}
  const row=tables.mensalidade_comprovante_envios.find(r=>r.id===args.p_envio);const replayed=row.status===args.p_decisao;row.status=args.p_decisao;return {data:{id:row.id,status:row.status,valor:102,competencia:'2026-09-10',replayed}};
 }};
 const app=express();app.use(express.json({limit:'8mb'}));registerReceiptReviewRoutes(app,{supabaseAdmin:sb,resolveLeaderId:async()=>owner,extract:async()=>{if(aiOffline)throw Error('Provider offline');return {valor:102,data:'2026-10-27',cpf_pagador:'***.456.789-**',beneficiario:'Casa de Axe Oxum',id_transacao:'E1234567890TEST',estado_pagamento:'concluido'};},notifyMensalidadeConfirmadaWhatsApp:async()=>{notifies++;}});
 return {app,tables,state:()=>({uploads,removes,notifies}),loseResponse:()=>{lost=true;},offline:()=>{aiOffline=true;}};
}
async function runCase(work:(ctx:ReturnType<typeof fixture>,call:(path:string,body?:any,who?:string)=>Promise<{status:number,body:any,headers:Headers}>)=>Promise<void>){
 const ctx=fixture(),server=ctx.app.listen(0);await new Promise<void>(resolve=>server.once('listening',resolve));const port=(server.address() as AddressInfo).port;
 const call=async(path:string,body?:any,who='member')=>{const res=await fetch(`http://localhost:${port}${path}`,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',Authorization:'Bearer '+who+'-'+randomUUID(),'X-Forwarded-For':`192.0.2.${Math.floor(Math.random()*200)}`},body:body?JSON.stringify(body):undefined});return {status:res.status,body:await res.json(),headers:res.headers};};
 try{await work(ctx,call);}finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}
}
async function uploadBody(extra={}){const png=await sharp({create:{width:8,height:8,channels:3,background:'#123123'}}).png().toBuffer();return {tenant_id:owner,financeiro_id:debt,request_id:randomUUID(),workflow:'manual_review_v1',fileData:png.toString('base64'),contentType:'image/png',...extra};}
test('upload, retry, listing and approval use review workflow without auto-settlement',()=>runCase(async(ctx,call)=>{
 const payload=await uploadBody();let response=await call('/api/v1/financeiro/validar-comprovante',payload);assert.equal(response.status,202);assert.equal(response.body.status,'em_analise');assert.equal(ctx.tables.financeiro[0].status,'pendente');assert.equal(ctx.state().notifies,0);const id=response.body.data.id;
 response=await call('/api/v1/financeiro/validar-comprovante',payload);assert.equal(response.body.replayed,true);assert.equal(ctx.state().uploads,1);
 response=await call(`/api/v1/financial/comprovantes?tenantId=${owner}&status=todos`);assert.equal(response.body.pending_count,1);assert.deepEqual(response.body.open_financeiro_ids,[debt]);assert.ok(!('storage_path' in response.body.data[0]));assert.ok(!response.body.data[0].analysis.cpf_pagador.includes('123'));
 assert.equal((await call(`/api/v1/financial/comprovantes/${id}/arquivo?tenantId=${owner}`)).body.expires_in,300);
 assert.equal((await call(`/api/v1/financial/comprovantes/${id}/aprovar?tenantId=${owner}`,full)).status,403);
 assert.equal((await call(`/api/v1/financial/comprovantes/${id}/aprovar?tenantId=${owner}`,{...full,valor:101},'owner')).status,422);
 assert.equal((await call(`/api/v1/financial/comprovantes/${id}/aprovar?tenantId=${owner}`,full,'owner')).status,200);
 assert.equal((await call(`/api/v1/financial/comprovantes/${id}/aprovar?tenantId=${owner}`,full,'owner')).status,200);assert.equal(ctx.state().notifies,1);
}));
test('legacy clients cannot report review as a confirmed payment',()=>runCase(async(ctx,call)=>{
 const response=await call('/api/v1/financeiro/validar-comprovante',await uploadBody({workflow:undefined}));assert.equal(response.status,202);assert.equal(response.body.success,false);assert.equal(response.body.requires_review,true);assert.match(response.body.error,/ainda não foi quitada/);assert.equal(ctx.state().notifies,0);
}));
test('AI outage and incomplete CPF retain a reviewable upload',()=>runCase(async(ctx,call)=>{
 ctx.offline();ctx.tables.filhos_de_santo[0].cpf='123456';const response=await call('/api/v1/financeiro/validar-comprovante',await uploadBody());assert.equal(response.status,202);assert.equal(response.body.data.analysis_status,'indisponivel');assert.equal(ctx.tables.financeiro[0].status,'pendente');
}));
test('lost RPC response never deletes an image already registered; retry finds it',()=>runCase(async(ctx,call)=>{
 ctx.loseResponse();const payload=await uploadBody();const response=await call('/api/v1/financeiro/validar-comprovante',payload);assert.equal(response.status,500);assert.equal(ctx.state().removes,0);const retry=await call('/api/v1/financeiro/validar-comprovante',payload);assert.equal(retry.status,202);assert.equal(retry.body.replayed,true);assert.equal(ctx.state().uploads,1);
}));
test('member cannot view another member private file; invalid MIME is 422',()=>runCase(async(ctx,call)=>{
 const id=randomUUID();ctx.tables.mensalidade_comprovante_envios.push({id,tenant_id:owner,filho_id:another,storage_path:'secret'});assert.equal((await call(`/api/v1/financial/comprovantes/${id}/arquivo?tenantId=${owner}`)).status,404);
 assert.equal((await call('/api/v1/financeiro/validar-comprovante',await uploadBody({contentType:'application/pdf'}))).status,422);assert.equal(ctx.state().uploads,0);
}));
