import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import AccountAvatar from '../design-systems/menu-local-20261029/AccountAvatar';
import SidebarUsage from '../design-systems/menu-local-20261029/SidebarUsage';
import {accountInitials,GALLERY_LIMIT_BYTES,planExpiryLabel,storageSize,type GalleryUsage} from '../design-systems/menu-local-20261029/shellSummary';
import {readGalleryUsage} from '../design-systems/menu-local-20261029/remote/galleryUsage';
const require=createRequire(import.meta.url);
function load(file:string,deps:Record<string,unknown>){const exports:any={},code=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;runInNewContext(code,{exports,require:(name:string)=>deps[name]??require(name),Promise,Error,Number,Set});return exports;}
const noop=()=>{};
test('gallery usage reads all pages even when a server returns fewer rows than requested',async()=>{
 const rows=Array.from({length:1201},(_,index)=>({id:String(index+1).padStart(5,'0'),size_bytes:index%2?'1024':2048})),cursors:string[]=[];
 const usage=await readGalleryUsage(async after=>{cursors.push(after);const start=after?rows.findIndex(row=>row.id===after)+1:0;return {rows:rows.slice(start,start+200),count:after?undefined:rows.length};});
 assert.equal(usage.fileCount,1201);assert.equal(usage.usedBytes,rows.reduce((sum,row)=>sum+Number(row.size_bytes),0));assert.equal(usage.limitBytes,100*1024**3);assert.equal(cursors.length,7);assert.equal(cursors[1],'00200');
});
test('only a confirmed empty gallery produces zero; missing or incomplete responses fail',async()=>{
 assert.deepEqual(await readGalleryUsage(async()=>({rows:[],count:0})),{usedBytes:0,limitBytes:GALLERY_LIMIT_BYTES,fileCount:0});
 await assert.rejects(readGalleryUsage(async()=>({rows:[]})),/contagem/);
 let calls=0;await assert.rejects(readGalleryUsage(async()=>++calls===1?{rows:[{id:'one',size_bytes:12}],count:2}:{rows:[]}),/mudou/);
 await assert.rejects(readGalleryUsage(async()=>{throw Error('offline');}),/offline/);
 for(const bytes of [-1,NaN,'',null,'invalid',true])await assert.rejects(readGalleryUsage(async()=>({rows:[{id:'bad',size_bytes:bytes as any}],count:1})),/tamanho/);
});
test('usage query is scoped by the authenticated house, requests metadata only and does not publish another account',async()=>{
 const loaders=new Map<string,any>(),published:any[]=[],calls:any[]=[];let scope={userId:'leader',tenantId:'house'};
 const query:any={select(...args:any[]){calls.push(['select',...args]);return this;},eq(...args:any[]){calls.push(['eq',...args]);return this;},order(){return this;},limit(value:number){calls.push(['limit',value]);return this;},then(resolve:any){return Promise.resolve({data:[{id:'file',size_bytes:10}],count:1,error:null}).then(resolve);}};
 load('design-systems/menu-local-20261029/remote/shell.ts',{'../../../src/lib/supabase':{supabase:{from:(name:string)=>{calls.push(['table',name]);return query;}}},'./session':{previewSession:()=>scope},'./runtime':{registerLoader:(key:string,fn:any)=>loaders.set(key,fn),publishValue:(...args:any[])=>published.push(args)},'./galleryUsage':{readGalleryUsage}});
 await loaders.get('galleryUsage')();assert.equal(published[0][1].usedBytes,10);assert.deepEqual(calls.find(row=>row[0]==='eq'),['eq','tenant_id','house']);assert.equal(calls.find(row=>row[0]==='select')[1],'id,size_bytes');assert.doesNotMatch(JSON.stringify(calls),/public_url|storage_key|file_name/);
 published.length=0;const then=query.then;query.then=(resolve:any)=>{scope={userId:'another',tenantId:'another-house'};return then(resolve);};await assert.rejects(loaders.get('galleryUsage')(),/conta mudou/);assert.equal(published.length,0);
});
test('menu distinguishes actual usage, pending load, failure and stale data without displaying invented zero',()=>{
 const usage:GalleryUsage={usedBytes:1024**2*25,limitBytes:GALLERY_LIMIT_BYTES,fileCount:3},props={plan:'Plano até 21/11/2026',onGallery:noop,onSubscription:noop,onRetry:noop};
 let html=renderToStaticMarkup(createElement(SidebarUsage,{...props,usage}));assert.match(html,/25 MB de 100 GB/);assert.match(html,/Plano até 21\/11\/2026/);assert.match(html,/aria-valuetext="25 MB de 100 GB"/);assert.doesNotMatch(html,/Teste Radar|Minha conta e configurações/);
 html=renderToStaticMarkup(createElement(SidebarUsage,props));assert.match(html,/Consultando uso/);assert.doesNotMatch(html,/<progress|0 B|0 GB/);
 html=renderToStaticMarkup(createElement(SidebarUsage,{...props,error:true}));assert.match(html,/Uso indisponível|Tentar novamente/);assert.doesNotMatch(html,/<progress|0 B/);
 html=renderToStaticMarkup(createElement(SidebarUsage,{...props,error:true,usage}));assert.match(html,/Última consulta/);assert.match(html,/Atualizar uso/);
});
test('expiry uses the verified tenant and Brasília civil date, handles trials, expiry and lifetime',()=>{
 const now=new Date('2026-11-02T15:00:00Z'),base={tenant_id:'house',plan:'premium',expires_at:'2026-11-22T01:00:00Z'};
 assert.equal(planExpiryLabel(base,'house',null,now),'Plano até 21/11/2026');assert.equal(planExpiryLabel({...base,is_trial:true},'house',null,now),'Teste até 21/11/2026');assert.equal(planExpiryLabel({...base,expires_at:'2026-11-01'},'house',null,now),'Plano venceu em 01/11/2026');assert.equal(planExpiryLabel({...base,plan:'vita',expires_at:null},'house',null,now),'Plano sem vencimento');assert.equal(planExpiryLabel({...base,expires_at:'2026-02-31'},'house',null,now),'Consultar assinatura');assert.equal(planExpiryLabel(base,'another-house',null,now),'Consultar assinatura');
 assert.equal(planExpiryLabel(base,'house',{tenantId:'house',plan:'premium',until:'2027-01-05',trial:false,lifetime:false} as any,now),'Plano até 05/01/2027');assert.equal(planExpiryLabel(base,'house',{tenantId:'another-house',until:'2099-12-31'} as any,now),'Plano até 21/11/2026');
});
test('header renders the saved photo and preserves initials only as fallback; startup reuses the verified photo',()=>{
 const html=renderToStaticMarkup(createElement(AccountAvatar,{src:'https://qa.invalid/saved.jpg',name:'Teste Radar'}));assert.match(html,/<img[^>]*src="https:\/\/qa.invalid\/saved.jpg"/);assert.match(html,/alt=""/);assert.match(renderToStaticMarkup(createElement(AccountAvatar,{name:'Teste Radar'})),/>TR<\/span>/);assert.equal(accountInitials('  '),'Z');assert.equal(storageSize(GALLERY_LIMIT_BYTES),'100 GB');
 const initial=load('design-systems/menu-local-20261029/remote/initial.ts',{'./session':{previewSession:()=>({profile:{foto_url:'https://qa.invalid/saved.jpg'},email:'test@example.invalid'})}});assert.equal(initial.initialAccount().profile.photoUrl,'https://qa.invalid/saved.jpg');
});
