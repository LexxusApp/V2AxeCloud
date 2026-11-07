import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import * as receiptValidation from '../lib/receiptReview';
import * as billing from '../design-systems/menu-local-20261029/billing';
import type {ReceiptReview} from '../lib/receiptReview';
const require=createRequire(import.meta.url);
function load(file:string,deps:Record<string,any>){const exports:any={};const code=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;runInNewContext(code,{exports,require:(name:string)=>name.endsWith('.css')?{}:deps[name]??require(name),File,Error,Map,Promise,JSON,crypto});return exports;}
const review:ReceiptReview={id:'receipt',financeiro_id:'debt',filho_id:'child',nome:'Membro de teste',status:'em_analise',created_at:'2026-10-01T12:00:00Z',decided_at:null,decision_reason:null,analysis_status:'concluida',analysis:{},alerts:[],submitted_value:102,valor_atual:102};
const fields={valor:'102,00',data_pagamento:'2026-09-30',beneficiario:'Casa de teste',id_transacao:'E123456789012345',confirmo_recebimento:true,motivo:'Conferido em conta'};
test('invalid receipt responses never masquerade as an empty reviewed queue',()=>{
 const valid={data:[review],open_financeiro_ids:['debt'],pending_count:1,next_cursor:null};
 assert.equal(receiptValidation.readReceiptPage(valid).data.length,1);
 for(const input of [{},{...valid,data:{}},{...valid,pending_count:'1'},{...valid,data:[{...review,alerts:null}]},{...valid,data:[{...review,status:'unknown'}]}])assert.throws(()=>receiptValidation.readReceiptPage(input),/lista válida/);
});
test('receipt decisions require integral payment, confirmation, valid identity and reason before any API request',async()=>{
 let requests:any[]=[];const request=async(...args:any[])=>{requests.push(args);return {success:true,data:{id:review.id,status:'aceito'}};};
 const {decideReceipt}=load('design-systems/menu-local-20261029/receiptActions.ts',{'../../lib/receiptReview':receiptValidation,'../../src/lib/receiptReviewClient':{},'./billing':{financialToday:()=> '2026-11-02'}});
 for(const change of [{valor:100},{confirmo_recebimento:false},{data_pagamento:'2026-11-03'},{id_transacao:''}])await assert.rejects(decideReceipt(review,'house','aprovar',{...fields,...change},request));
 await assert.rejects(decideReceipt({...review,alerts:['Valor precisa de conferência']},'house','aprovar',{...fields,motivo:''},request));
 await assert.rejects(decideReceipt(review,'house','rejeitar',{motivo:''},request));assert.equal(requests.length,0);
 const result=await decideReceipt(review,'house','aprovar',fields,request);assert.equal(result.status,'aceito');assert.match(requests[0][0],/receipt\/aprovar\?tenantId=house/);assert.equal(JSON.parse(requests[0][1].body).valor,102);
 await assert.rejects(decideReceipt(review,'house','aprovar',fields,async()=>({success:true,data:{id:'another',status:'aceito'}})),/não confirmou/);
 await assert.rejects(decideReceipt({...review,status:'aceito'},'house','aprovar',fields,request),/já foi analisado/);
 const rejected=await decideReceipt(review,'house','rejeitar',{motivo:'Beneficiário incorreto'},async(_url:string,init:RequestInit)=>{assert.deepEqual(JSON.parse(String(init.body)),{motivo:'Beneficiário incorreto'});return {success:true,data:{id:review.id,status:'rejeitado'}};});assert.equal(rejected.status,'rejeitado');
});
test('monthly presentation includes review queue and prevents ordinary settlement/reminder while its receipt is being reviewed',()=>{
 const feed={openIds:['debt'],rows:[review],pendingCount:1,loading:false,error:'',filter:'em_analise',setFilter(){},refresh:async()=>{},cursor:null};
 const calls:any[]=[];const {default:Monthly}=load('design-systems/menu-local-20261029/MonthlyPage.tsx',{'../shared/PageLoading':{default:()=>null},'./ReceiptReviews':{default:(props:any)=>{calls.push(props);return createElement('section',{'aria-label':'Revisão de comprovantes'},'Fila real de comprovantes');}},'../../src/lib/receiptReviewClient':{useReceiptReviews:()=>feed},'./billing':billing,'./finance':{financialMoney:(value:number)=>String(value)},'./FinancialEntryDialog':{default:()=>null},'./WorkflowUI':{WorkflowDialog:()=>null,WorkflowEmpty:()=>null,textMatch:()=>true}});
 const currentReference=billing.financialToday().slice(0,7);
 const charge={id:'debt',memberId:'child',memberName:'Membro de teste',description:'Mensalidade',reference:currentReference,dueDate:`${currentReference}-10`,baseCents:10000,extraCents:200,totalCents:10200,status:'pending',source:'manual',interestMode:'percent',interestValue:'2',createdAt:0};
 const html=renderToStaticMarkup(createElement(Monthly,{members:[],charges:[charge],pix:null,receiptScope:{userId:'owner',tenantId:'house'},onSaveCharge(){},onReceive(){},onReopen(){},onSendReminder:async()=>{},onNavigate(){}}));
 assert.match(html,/Fila real de comprovantes/);assert.match(html,/Comprovante em análise/);assert.match(html,/<button[^>]*disabled=""[^>]*>[\s\S]*?Dar baixa/);assert.match(html,/<button[^>]*disabled=""[^>]*>[\s\S]*?Enviar cobrança/);assert.equal(calls[0].tenantId,'house');assert.equal(calls[0].feed,feed);
});
test('monthly page opens on the current competence and does not mix previous months by default',()=>{
 const feed={openIds:[],rows:[],pendingCount:0,loading:false,error:'',filter:'em_analise',setFilter(){},refresh:async()=>{},cursor:null};
 const {default:Monthly}=load('design-systems/menu-local-20261029/MonthlyPage.tsx',{'../shared/PageLoading':{default:()=>null},'./ReceiptReviews':{default:()=>null},'../../src/lib/receiptReviewClient':{useReceiptReviews:()=>feed},'./billing':billing,'./finance':{financialMoney:(value:number)=>String(value)},'./FinancialEntryDialog':{default:()=>null},'./WorkflowUI':{WorkflowDialog:()=>null,WorkflowEmpty:()=>null,textMatch:()=>true}});
 const current=billing.financialToday().slice(0,7),previousDate=new Date(`${current}-01T12:00:00Z`);previousDate.setUTCMonth(previousDate.getUTCMonth()-1);const previous=previousDate.toISOString().slice(0,7);
 const charge=(id:string,name:string,reference:string)=>({id,memberId:id,memberName:name,description:'Mensalidade',reference,dueDate:`${reference}-10`,baseCents:10000,extraCents:0,totalCents:10000,status:'pending',source:'manual',interestMode:'none',interestValue:'',createdAt:0});
 const html=renderToStaticMarkup(createElement(Monthly,{members:[],charges:[charge('current','Membro atual',current),charge('previous','Membro antigo',previous)],pix:null,onSaveCharge(){},onReceive(){},onReopen(){},onSendReminder:async()=>{},onNavigate(){}}));
 assert.match(html,/Mês das mensalidades/);assert.match(html,/Todo o histórico/);assert.match(html,/Membro atual/);assert.doesNotMatch(html,/Membro antigo/);assert.match(html,/sem misturar outros meses/);
});
test('financial writers persist historical dates through pilot-only atomic RPCs and keep retry identity after a lost response',async()=>{
 const writers=new Map<string,any>(),requests:any[]=[],rpcs:any[]=[];let fail=true,refreshes=0;
 const sb={rpc:async(name:string,args:any)=>{rpcs.push({name,args});if(fail){fail=false;return {data:null,error:{message:'Resposta perdida'}};}return {data:{id:args.p_financeiro||'created',status:'pago',data_pagamento:args.p_data_pagamento},error:null};}};
 const checked=async(p:any)=>{const result=await p;if(result.error)throw Error(result.error.message);return result.data;};
 load('design-systems/menu-local-20261029/remote/writers.ts',{'./session':{previewSession:()=>({tenantId:'house'}),request:async(...args:any[])=>{requests.push(args);return {success:true};}},'./runtime':{registerWriter:(key:string,fn:any)=>writers.set(key,fn),refreshResource:async()=>{refreshes++;}},'../billing':billing,'../finance':{},'../../../src/lib/supabase':{supabase:sb},'../../../lib/manualFinance':{},'./helpers':{checked}});
 const before:any={id:'debt',status:'pending',totalCents:10200};const next={...before,status:'paid',receivedDate:'2026-09-30'};
 await assert.rejects(writers.get('charges')([next],[before]),/Resposta perdida/);await writers.get('charges')([next],[before]);assert.equal(rpcs[0].name,'piloto_liquidar_mensalidade');assert.equal(rpcs[0].args.p_request,rpcs[1].args.p_request);assert.equal(rpcs[1].args.p_data_pagamento,'2026-09-30');assert.equal(requests.length,0);assert.equal(refreshes,1);
 const paid:any={id:'local',status:'paid',receivedDate:'2026-09-30',baseCents:10000,totalCents:10200,dueDate:'2026-09-10',memberId:'child',description:'Antiga',interestMode:'percent',interestValue:'2'};
 await writers.get('charges')([paid],[]);assert.equal(rpcs.at(-1).name,'piloto_criar_mensalidade_quitada');assert.equal(rpcs.at(-1).args.p_input.jurosValor,'2');assert.equal(paid.id,'created');assert.equal(refreshes,2);
});


test('manual reversal uses expected payment snapshot and preserves retry identity after response loss',async()=>{
 const writers=new Map<string,any>(),rpcs:any[]=[];let loseResponse=true;
 const sb={rpc:async(name:string,args:any)=>{rpcs.push({name,args});if(loseResponse){loseResponse=false;return {data:null,error:{message:'Resposta perdida'}};}return {data:{id:'debt',status:'pendente',data_pagamento:null,data_vencimento:'2026-08-10'},error:null};}};
 const checked=async(p:any)=>{const r=await p;if(r.error)throw Error(r.error.message);return r.data;};
 load('design-systems/menu-local-20261029/remote/writers.ts',{'./session':{previewSession:()=>({tenantId:'house'}),request:async()=>{throw Error('Legacy API must not reopen historical payments');}},'./runtime':{registerWriter:(key:string,fn:any)=>writers.set(key,fn),refreshResource:async()=>{}},'../billing':billing,'../finance':{},'../../../src/lib/supabase':{supabase:sb},'../../../lib/manualFinance':{},'./helpers':{checked}});
 const paid:any={id:'debt',status:'paid',receivedDate:'2026-10-30',dueDate:'2026-08-10',totalCents:102};const pending={...paid,status:'pending'};
 await assert.rejects(writers.get('charges')([pending],[paid]),/Resposta perdida/);await writers.get('charges')([pending],[paid]);
 assert.equal(rpcs[0].name,'piloto_reabrir_mensalidade');assert.equal(rpcs[0].args.p_request,rpcs[1].args.p_request);assert.equal(rpcs[1].args.p_data_pagamento,'2026-10-30');assert.equal(rpcs[1].args.p_valor,1.02);
});
