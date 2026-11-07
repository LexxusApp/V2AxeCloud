import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import {managerTab} from '../design-systems/menu-local-20261029/navigation';
import {memberTabFromLocation,memberTabs} from '../design-systems/member-pilot-20261102/navigation';
import {buildZeladorNavEntries,flattenZeladorNavEntries} from '../src/constants/appNav';
const require=createRequire(import.meta.url);
function load(file:string,deps:Record<string,unknown>){const exports:any={},code=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;runInNewContext(code,{exports,require:(name:string)=>deps[name]??require(name),File,Error,Promise,Map,WeakMap,JSON});return exports;}
const same=(a:any,b:any)=>JSON.stringify(a)===JSON.stringify(b);
const helpers={equal:same,singleChange:(next:any[],before:any[])=>{const row=next.find(row=>!same(row,before.find(old=>old.id===row.id)))||before.find(row=>!next.some(next=>next.id===row.id));return {row,old:before.find(old=>old.id===row.id),removed:!next.some(next=>next.id===row.id)};},checked:async(value:any)=>(await value).data};
test('every allowed manager and member page resolves both its copied URL and legacy tab link',()=>{
 const tabs=flattenZeladorNavEntries(buildZeladorNavEntries('mista','house','test@example.invalid')).map(row=>row.id);
 assert.equal(tabs.length,19);
 for(const tab of tabs){assert.equal(managerTab({hash:'#'+tab,search:''},tabs),tab);assert.equal(managerTab({hash:'',search:'?tab='+tab},tabs),tab);assert.equal(managerTab({hash:'#'+tab+'?source=notice',search:'?tab=invalid'},tabs),tab);}
 assert.equal(managerTab({hash:'#notices',search:''},tabs),'mural');assert.equal(managerTab({hash:'#messages',search:''},tabs),'chat');assert.equal(managerTab({hash:'#support',search:''},tabs),'suporte');
 for(const tab of memberTabs){assert.equal(memberTabFromLocation({hash:'#'+tab,search:''}),tab);assert.equal(memberTabFromLocation({hash:'',search:'?tab='+tab}),tab);}
 assert.equal(memberTabFromLocation({hash:'',search:'?tab=financial-mensalidades'}),'financial');assert.equal(memberTabFromLocation({hash:'#library',search:'?tab=financial'}),'library');assert.equal(managerTab({hash:'#not-allowed',search:''},tabs),'dashboard');
});
test('production dashboard never falls back to fictional people, balances or metrics',()=>{
 const source=readFileSync('design-systems/menu-local-20261029/DashboardPage.tsx','utf8');
 for(const fictional of ['Mariana','Joana','Rafael','pending * 20000','live?.views7 ?? 84','live?.sent7 ?? 12','Alteração simulada'])assert.doesNotMatch(source,new RegExp(fictional.replace(/[?.*+^$[\]\\(){}|-]/g,'\\$&')));
});
test('real manager surfaces do not describe production data as examples or previews',()=>{
 const files=['FinancialOverview.tsx','SettingsPage.tsx','shopLogic.ts','GalleryPage.tsx','LibraryPage.tsx','RadarMedia.tsx','ObligationsPage.tsx','MessagesPage.tsx','RadarPage.tsx'];
 const source=files.map(file=>readFileSync(`design-systems/menu-local-20261029/${file}`,'utf8')).join('\n');
 for(const stale of ['Sem valor disponível neste exemplo','Nenhuma pendência neste exemplo','Exemplo de{" "}','Nenhuma configuração disponível neste exemplo','Pedido não encontrado na prévia','Usar PDF de exemplo','Usar capa de exemplo','imagens de demonstração','Tentar novamente na prévia','concluídos na prévia'])assert.doesNotMatch(source,new RegExp(stale.replace(/[?.*+^$[\]\\(){}|-]/g,'\\$&')));
});
test('pilot runtime and build contain no production dependency on prototype fixture libraries',()=>{
 const files=['main.tsx','StorePage.tsx','gallery.ts','library.ts','SettingsPage.tsx'];
 const source=files.map(file=>readFileSync(`design-systems/menu-local-20261029/${file}`,'utf8')).join('\n');
 for(const fixture of ['demoInventory','demoLibrary','demoShop','demoAccount','demoSupport','demoRadarStudio','demoGallery','demoInbox','demoObligations','demoAttendance','demoNotices','shopPhotos','librarySample','galleryLibrary','radarExampleMedia'])assert.doesNotMatch(source,new RegExp(`\\b${fixture}\\b`));
 const build=readFileSync('scripts/build-pilot-interface.mjs','utf8');
 assert.match(build,/rmSync\(path\.join\(outDir,'assets'\),\{recursive:true,force:true\}\)/);
 assert.doesNotMatch(build,/rmSync\(path\.join\(outDir,'member'/);
});
test('new event keeps its server ID after saving, including a deduplicated response',async()=>{
 const writers=new Map<string,any>(),requests:any[]=[],refreshed:string[]=[];let body:any={success:true,data:{id:'server-event-id'},deduped:true};
 load('design-systems/menu-local-20261029/remote/house.ts',{'./uploads':{},'../../../src/lib/supabase':{supabase:{rpc:async(name:string,args:any)=>{assert.equal(name,'piloto_agendar_lembrete_gira');return {data:{event_id:args.p_event,active:args.p_ativo}};}}},'./session':{previewSession:()=>({tenantId:'house'}),request:async(...args:any[])=>{requests.push(args);return body;}},'./runtime':{readValue:()=>undefined,registerLoader(){},registerWriter:(key:string,writer:any)=>writers.set(key,writer),readValue:()=>[],refreshResource:async(key:string)=>{refreshed.push(key);}},'./helpers':helpers,'./readModels':{}});
 const event:any={id:'local-id',title:'Gira',date:'2026-11-12',time:'20:00',place:'Casa',instructions:'Orientações',type:'Gira',status:'scheduled',responses:{},tasks:[],queue:[],highlight:false,reminder:true};await writers.get('giras')([event],[]);assert.equal(event.id,'server-event-id');assert.equal(requests[0][0],'/api/events');assert.deepEqual(refreshed,['giras']);
 body={success:true};await assert.rejects(writers.get('giras')([{...event,id:'other-local'}],[]),/não confirmou/);assert.equal(refreshed.length,1);
});
test('library metadata edit persists without touching the PDF or its recipients; permission/file changes are rejected before writes',async()=>{
 const writers=new Map<string,any>(),writes:any[]=[],refreshed:string[]=[];const query:any={update:(data:any)=>{writes.push(data);return query;},eq:()=>query,select:()=>query,single:async()=>({data:{id:'material'},error:null})};
 load('design-systems/menu-local-20261029/remote/media.ts',{'./privateLibrary':{},'../confirmedUpload':{},'./uploads':{},'../../../src/lib/supabase':{supabase:{from:(table:string)=>{assert.equal(table,'biblioteca');return query;}}},'./session':{previewSession:()=>({tenantId:'house'})},'./runtime':{readValue:()=>undefined,registerLoader(){},registerWriter:(key:string,writer:any)=>writers.set(key,writer),refreshResource:async(key:string)=>{refreshed.push(key);}},'./helpers':helpers,'../../../lib/libraryStoragePath':{}});
 const original:any={id:'material',title:'Título',description:'Descrição',category:'Cantigas',source:'/api/v1/library/pdf-proxy?path=own.pdf',fileName:'own.pdf',audience:{kind:'individual',memberId:'child'}};await writers.get('library')({materials:[{...original,title:'Título editado',description:'Nova descrição'}]},{materials:[original]});assert.deepEqual(JSON.parse(JSON.stringify(writes)),[{titulo:'Título editado',descricao:'Nova descrição',categoria:'Cantigas'}]);assert.deepEqual(refreshed,['library']);
 for(const change of [{source:new File(['pdf'],'outro.pdf')},{audience:{kind:'house'}}])await assert.rejects(writers.get('library')({materials:[{...original,...change}]},{materials:[original]}),/preservados/);assert.equal(writes.length,1);
});
test('chat keeps server conversation IDs, received media and drafts, and rejects an unconfirmed send',async()=>{
 const writers=new Map<string,any>(),loaders=new Map<string,any>(),requests:any[]=[],values=new Map<string,any>();let valid=true,refreshes=0;
 values.set('inbox',{conversations:[],drafts:{existing:{body:'Rascunho'}}});
 const mediaUrl='/api/v1/chat/media?key=chat%2Ffad75b91-d2eb-4805-b5a3-c19e8a073bed%2Fab2eef13-604c-4c8f-9d14-f3da41cc5a81%2Fimage.jpg';
 const request=async(path:string,method='GET',body?:unknown)=>{requests.push({path,method,body});
   if(method==='POST'&&path==='/api/v1/chat/conversations')return valid?{conversationId:'server-conversation',created:false}:{};
   if(method==='POST')return valid?{message:{id:'server-message'}}:{};
   if(path.endsWith('/conversations'))return {conversations:[{id:'server-conversation',type:'direct',participants:[{filhoId:'child'}],unreadCount:1}]};
   return {messages:[{id:'received',body:'Veja a foto',senderFilhoId:'child',createdAt:'2026-11-02T12:00:00Z',messageType:'image',mediaUrl,mediaMime:'image/jpeg',isOwn:false}]};
 };
 const history=load('design-systems/menu-local-20261029/remote/chatHistory.ts',{'./session':{previewSession:()=>({tenantId:'house',userId:'owner'})},'./runtime':{},'./helpers':helpers,'../../../src/lib/supabase':{supabase:{rpc:async()=>({data:{messages:[{id:'received',body:'Veja a foto',sender_filho_id:'child',created_at:'2026-11-02T12:00:00Z',message_type:'image',media_url:mediaUrl,media_mime:'image/jpeg'}],hasMore:false}})}}});
 load('design-systems/menu-local-20261029/remote/communication.ts',{'./notices':{},'./chatHistory':history,'./uploads':{},'../../../src/lib/supabase':{},'./session':{previewSession:()=>({tenantId:'house'}),request,scoped:(path:string)=>path},'./runtime':{registerLoader:(key:string,fn:any)=>loaders.set(key,fn),registerWriter:(key:string,fn:any)=>writers.set(key,fn),readValue:(key:string)=>values.get(key),publishValue:(key:string,value:any)=>values.set(key,value),refreshResource:async()=>{refreshes++;}},'./helpers':{...helpers,tableRows:async()=>[]}});
 const row:any={id:'local-conversation',kind:'direct',title:'',memberIds:['child'],messages:[],unread:false,archived:false};
 await writers.get('inbox')({conversations:[row],drafts:{}},{conversations:[],drafts:{}});assert.equal(row.id,'server-conversation');assert.equal(refreshes,1);
 valid=false;await assert.rejects(writers.get('inbox')({conversations:[{...row,messages:[{id:'local-message',body:'Oi'}]}],drafts:{}},{conversations:[row],drafts:{'server-conversation':{body:'Oi'}}}),/não confirmou a mensagem/);assert.equal(refreshes,1);
 values.set('inbox',{conversations:[],drafts:{existing:{body:'Rascunho'}}});valid=true;await loaders.get('inbox')();const actual=JSON.parse(JSON.stringify(values.get('inbox')));
 assert.equal(actual.conversations[0].messages[0].state,'sent');assert.deepEqual(actual.conversations[0].messages[0].media,{url:mediaUrl,type:'image',mime:'image/jpeg'});assert.equal(actual.drafts.existing.body,'Rascunho');assert.equal(actual.conversations[0].unread,true);
 valid=false;await assert.rejects(writers.get('inbox')({conversations:[{...row,id:'unconfirmed'}],drafts:{}},{conversations:[],drafts:{}}),/não confirmou a conversa/);
});
