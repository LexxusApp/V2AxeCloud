import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as activityModule from '../design-systems/menu-local-20261029/operations';
import * as activityLifecycle from '../design-systems/menu-local-20261029/activityLifecycle';

const require = createRequire(import.meta.url);
function loadModule(path: string, dependencies: Record<string,unknown>) {
 const source=readFileSync(new URL(path,import.meta.url),'utf8');
 const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const exports:any={};
 runInNewContext(compiled,{exports,require:(name:string)=>name.endsWith('.css')?{}:dependencies[name]??(name==='./activityLifecycle'?activityLifecycle:require(name)),Headers,Response,Request,URL,fetch});
 return exports;
}
function authFixture() {
 let refreshes=0,expired=0,pending=0;
 const auth=loadModule('../src/lib/authenticatedFetch.ts',{
  './supabase':{supabase:{auth:{getSession:async()=>({data:{session:{access_token:'fixture-old',refresh_token:'fixture-refresh',expires_at:Date.now()/1000+3600}}}),refreshSession:async()=>{refreshes++;return {data:{session:{access_token:'fixture-new'}}};}}},isRefreshFailureFatal:()=>false,notifySessionExpired:()=>{expired++;},purgeLocalAuthSession:async()=>{}},
  './telemetryClient':{reportFeatureFailureClient:async()=>{}},
  './appOperations':{beginAppOperation:()=>{pending++;return()=>{pending--;};}},
 });
 return {auth,refreshes:()=>refreshes,expired:()=>expired,pending:()=>pending};
}
test('measured uploads preserve authenticatedFetch token renewal and reuse the injected transport after 401',async()=>{
 const f=authFixture(),headers:string[]=[],bodies:unknown[]=[];
 const transport=async(_input:any,init:any)=>{headers.push(init.headers.get('authorization'));bodies.push(init.body);return new Response('',{status:headers.length===1?401:200});};
 const response=await f.auth.authFetch('https://unit.invalid/photo',{method:'POST',body:'photo-body'},undefined,transport);
 assert.equal(response.status,200);assert.deepEqual(headers,['Bearer fixture-old','Bearer fixture-new']);assert.deepEqual(bodies,['photo-body','photo-body']);assert.equal(f.refreshes(),1);assert.equal(f.expired(),0);assert.equal(f.pending(),0);
});
test('a denied upload never refreshes or resends; network failures also never trigger a resend',async()=>{
 const f=authFixture();let calls=0;
 const response=await f.auth.authFetch('https://unit.invalid/photo',{method:'POST'},undefined,async()=>{calls++;return new Response('',{status:403});});
 assert.equal(response.status,403);assert.equal(calls,1);assert.equal(f.refreshes(),0);assert.equal(f.pending(),0);
 await assert.rejects(f.auth.authFetch('https://unit.invalid/photo',{method:'POST'},undefined,async()=>{calls++;throw Error('offline');}),/offline/);
 assert.equal(calls,2);assert.equal(f.refreshes(),0);assert.equal(f.pending(),0);
});
test('a repeated 401 ends the upload after one renewal and reports the expired session',async()=>{
 const f=authFixture();let calls=0;
 const response=await f.auth.authFetch('https://unit.invalid/photo',{method:'POST'},undefined,async()=>{calls++;return new Response('',{status:401});});
 assert.equal(response.status,401);assert.equal(calls,2);assert.equal(f.refreshes(),1);assert.equal(f.expired(),1);assert.equal(f.pending(),0);
});
test('the activity interface keeps gallery and dispatch details in the panel and ordinary failures compact',()=>{
 const store=activityModule.createOperationStore(),gallery=store.begin('Galeria','gallery'),finance=store.begin('Financeiro'),send=store.begin('Aviso');
 gallery.files([{id:'a',name:'Confirmada.jpg',bytes:100},{id:'b',name:'Aguardando.jpg',bytes:100}]);
 gallery.file('a',{phase:'done',progress:1});gallery.file('b',{phase:'confirming',progress:1});finance.fail(Error('Falha no caixa'));send.sent('message');send.complete();
 const {LocalFeedbackProvider}=loadModule('../design-systems/menu-local-20261029/LocalFeedback.tsx',{'./operations':{...activityModule,operations:store}});
 const html=renderToStaticMarkup(createElement(LocalFeedbackProvider,null,createElement('main',null,'Painel')));
 assert.match(html,/Galeria/);assert.match(html,/class="local-activity error/);assert.match(html,/Financeiro/);assert.match(html,/Falha no caixa/);assert.match(html,/1 de 2 arquivos salvos/);assert.match(html,/100% transmitido/);assert.match(html,/Transmitido; confirmando no servidor/);assert.match(html,/Enviado; entrega pendente/);assert.doesNotMatch(html,/>Entregue</);
 store.delivery('message','read');
 const updated=renderToStaticMarkup(createElement(LocalFeedbackProvider));assert.match(updated,/>Lido</);assert.match(updated,/Leitura confirmada pelo WhatsApp/);
});
