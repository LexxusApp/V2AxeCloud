import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import React,{createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import * as ui from '../design-systems/member-pilot-20261102/ui';
import * as operationsModule from '../design-systems/menu-local-20261029/operations';
const require=createRequire(import.meta.url);
function load(file:string,dependencies:Record<string,unknown>={}){const exports:any={},source=readFileSync(new URL('../design-systems/member-pilot-20261102/'+file,import.meta.url),'utf8'),compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;runInNewContext(compiled,{exports,require:(name:string)=>dependencies[name]??(name==='./ui'?ui:require(name)),Headers,Response,Request,URL,File,Blob,Date,Error,fetch});return exports;}
const noop=()=>{};
test('monthly shows actual individual amounts and receipt review without claiming that an upload paid the debt',()=>{
 const Monthly=load('Monthly.tsx').default;
 const html=renderToStaticMarkup(createElement(Monthly,{active:true,pending:null,pendingList:[{id:'debt',descricao:'Setembro com multa',valor:102,data:'2026-09-10'}],dueDay:10,pixUnavailable:false,uploading:false,history:[],receiptOpenIds:['debt'],receiptInputRef:{current:null},onTalkToHouse:noop}));
 assert.match(html,/102,00/);assert.match(html,/Setembro com multa/);assert.match(html,/Comprovante em análise/);assert.match(html,/até a confirmação do pagamento/);assert.match(html,/accept="image\/jpeg,image\/png,image\/webp"/);assert.doesNotMatch(html,/application\/pdf/);assert.doesNotMatch(html,/Pagamento confirmado/);
});
test('monthly empty state never fabricates debt from the configured subscription amount',()=>{
 const Monthly=load('Monthly.tsx').default,html=renderToStaticMarkup(createElement(Monthly,{active:true,pendingList:[],configuredValue:89.9,dueDay:10,history:[],receiptInputRef:{current:null},onTalkToHouse:noop}));
 assert.match(html,/0,00/);assert.match(html,/Nenhuma mensalidade em aberto/);assert.doesNotMatch(html,/89,90/);
});
test('a failed financial query cannot be presented as paid or debt-free',()=>{
 const Monthly=load('Monthly.tsx').default,html=renderToStaticMarkup(createElement(Monthly,{loadError:'Servidor indisponível',active:true,pendingList:[],history:[]}));
 assert.match(html,/Não foi possível confirmar sua situação/);assert.doesNotMatch(html,/Tudo em dia|Nenhuma mensalidade pendente|0,00/);
});
test('agenda provides date navigation, real response state and marks only a live save as busy',()=>{
 const Agenda=load('Agenda.tsx').default,html=renderToStaticMarkup(createElement(Agenda,{events:[{id:'event',titulo:'Encontro da casa',data:'2099-11-20',hora:'20:00',tipo:'Gira'}],currentMonth:new Date('2099-11-01T12:00:00Z'),loading:false,error:null,participations:{},busyEventId:'event',onRefresh:noop,onPreviousMonth:noop,onNextMonth:noop,onRespond:noop,onOpenEvent:noop}));
 assert.match(html,/Encontro da casa/);assert.match(html,/20:00/);assert.match(html,/Mês anterior/);assert.match(html,/Salvando…/);assert.match(html,/<button[^>]+disabled=""[^>]+aria-busy="true"[^>]*>/);
});
test('disabled member controls use a neutral cursor while only explicit work uses progress',()=>{
 const css=readFileSync(new URL('../design-systems/member-pilot-20261102/member.css',import.meta.url),'utf8');
 const notificationCss=readFileSync(new URL('../design-systems/menu-local-20261029/operations.css',import.meta.url),'utf8');
 const updateCss=readFileSync(new URL('../design-systems/shared/pilot-update.css',import.meta.url),'utf8');
 assert.match(css,/button:disabled\{cursor:default;/);
 assert.match(css,/button\[aria-busy=true\]\{cursor:progress\}/);
 assert.doesNotMatch(css,/button:disabled\{cursor:(?:wait|progress)/);
 assert.doesNotMatch(notificationCss,/button:disabled\{[^}]*cursor:(?:wait|progress)/);
 assert.doesNotMatch(updateCss,/button:disabled\{[^}]*cursor:(?:wait|progress)/);
 assert.match(updateCss,/left:50%/);
 assert.match(updateCss,/transform:translateX\(-50%\)/);
 assert.doesNotMatch(updateCss,/\.pilot-update\{[^}]*right:/);
});
test('library identifies individually scoped material and carries authenticated scope into its PDF reader',()=>{
 const observed:any[]=[];
 const Pdf=(props:any)=>{observed.push(props);return createElement('div',null,'Leitor autenticado');};
 const Library=load('Library.tsx',{'../../src/components/library/AuthenticatedPdfFrame':{AuthenticatedPdfFrame:Pdf},'../../src/lib/libraryDownload':{downloadLibraryDocument:async()=>{}},'./comments':{Comments:()=>null}}).default;
 const material={id:'private',titulo:'Estudo reservado',categoria:'Fundamentos',visibilidade:'individual',arquivo_url:'/api/v1/library/pdf-proxy?path=own',storage_path:'own/reserved.pdf',created_at:'2026-11-02T12:00:00Z'};
 const props={materials:[material],loading:false,searchQuery:'',selectedCategory:null,selectedMaterial:null,categories:['Fundamentos'],tenantId:'own',onSearchChange:noop,onCategoryChange:noop,onSelectMaterial:noop,onOpenFundamentos:noop};
 const catalog=renderToStaticMarkup(createElement(Library,props));assert.match(catalog,/Reservado para você/);assert.match(catalog,/Estudo reservado/);
 renderToStaticMarkup(createElement(Library,{...props,selectedMaterial:material}));assert.equal(observed[0].tenantId,'own');assert.equal(observed[0].storagePath,'own/reserved.pdf');assert.equal(observed[0].url,material.arquivo_url);
});
test('store shows stock and actual prices without fake image content',()=>{
 const Store=load('Store.tsx').default,html=renderToStaticMarkup(createElement(Store,{products:[{id:'product',nome:'Guia da casa',descricao:'Produto real',categoria:'Guias',preco:45,estoque_atual:0,imagem_url:''}],loading:false,cartQuantity:2,cartTotal:90,memberName:'Membro',onOpenCart:noop,onBuy:noop,onReserve:noop}));
 assert.match(html,/Guia da casa/);assert.match(html,/45,00/);assert.match(html,/90,00/);assert.match(html,/Sem estoque/);assert.match(html,/<button[^>]+disabled=""[^>]*>Adicionar/);assert.doesNotMatch(html,/<img/);
});
test('chat keeps a real thread, attachments and read callbacks bound to the current member and tenant',()=>{
 const seen:any[]=[];
 const Chat=load('Chat.tsx',{'../../src/components/chat/ChatThread':{ChatThread:(props:any)=>{seen.push(props);return createElement('div',null,'Conversa real');}},'../../src/lib/chatTypes':{formatChatTime:()=>''}}).default;
 const conversation={id:'thread',type:'direct',peer:{nome:'Zeladoria'},lastMessageAt:null,lastMessagePreview:'Axé',unreadCount:1};
 let read='';const html=renderToStaticMarkup(createElement(Chat,{tenantId:'own-house',userId:'own-user',conversations:[conversation],contacts:[],selected:conversation,selectedId:'thread',loading:false,creating:false,showNewChat:false,totalUnread:1,onSelect:noop,onToggleNewChat:noop,onContactSearch:noop,onTalkToLeader:noop,onTalkToContact:noop,onMessageSent:noop,onRead:(id:string)=>{read=id;}}));
 assert.match(html,/Conversa real/);assert.equal(seen[0].tenantId,'own-house');assert.equal(seen[0].userId,'own-user');seen[0].onRead();assert.equal(read,'thread');
});
test('member progress transport preserves request body and token, with receipt acceptance distinct from financial settlement',async()=>{
 const store=operationsModule.createOperationStore(),calls:any[]=[];
 const api=load('authenticatedFetch.ts',{'../../src/lib/authenticatedFetch':{authFetch:async(...args:any[])=>{calls.push(args);return Response.json({data:{id:'review',status:'em_analise'}});}},'../menu-local-20261029/operations':{operations:store},'../menu-local-20261029/uploadTransport':{xhrUploadTransport:()=>async()=>Response.json({})}});
 const body=JSON.stringify({fileData:'Zml4dHVyZQ==',financeiro_id:'debt',request_id:'idempotency-key'}),response=await api.authFetch('/api/v1/financeiro/validar-comprovante',{method:'POST',body},'unit-token');
 assert.equal(response.status,200);assert.equal(calls[0][1].body,body);assert.equal(calls[0][2],'unit-token');assert.equal(store.snapshot()[0].files[0].phase,'done');assert.match(store.snapshot()[0].detail,/ainda não confirma o pagamento/);
});
test('member mutation failures preserve the original response and produce one independent failure activity',async()=>{
 const store=operationsModule.createOperationStore();
 const api=load('authenticatedFetch.ts',{'../../src/lib/authenticatedFetch':{authFetch:async()=>Response.json({error:'Sem autorização'},{status:403})},'../menu-local-20261029/operations':{operations:store},'../menu-local-20261029/uploadTransport':{xhrUploadTransport:()=>fetch}});
 const response=await api.authFetch('/api/v1/store/checkout',{method:'POST',body:'{}'});assert.equal(response.status,403);assert.equal(store.snapshot().length,1);assert.equal(store.snapshot()[0].state,'error');assert.equal(store.snapshot()[0].detail,'Sem autorização');
});
test('HTTP 200 alone never confirms a receipt without its protocol or a checkout without its persisted order',async()=>{
 const store=operationsModule.createOperationStore();
 const api=load('authenticatedFetch.ts',{'../../src/lib/authenticatedFetch':{authFetch:async()=>Response.json({})},'../menu-local-20261029/operations':{operations:store},'../menu-local-20261029/uploadTransport':{xhrUploadTransport:()=>fetch}});
 await api.authFetch('/api/v1/financeiro/validar-comprovante',{method:'POST',body:'{}'});await api.authFetch('/api/v1/store/checkout',{method:'POST',body:'{}'});assert.equal(store.snapshot().length,2);assert.ok(store.snapshot().every(row=>row.state==='error'));
});
