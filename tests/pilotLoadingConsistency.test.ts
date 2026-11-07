import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {Coffee,Wallet} from 'lucide-react';
import PageLoading,{pageLoadingVariant,type LoadingVariant} from '../design-systems/shared/PageLoading';
import FinancialTabs from '../design-systems/menu-local-20261029/FinancialTabs';
const require=createRequire(import.meta.url);
function runtime(){const exports:any={},code=ts.transpileModule(readFileSync('design-systems/menu-local-20261029/remote/runtime.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;runInNewContext(code,{exports,require:(name:string)=>({'../../shared/PageLoading':{default:PageLoading},react:{useEffect(){},useSyncExternalStore(_subscribe:any,snapshot:any){return snapshot();}},'../../../src/lib/supabase':{},'./session':{previewSession:()=>({userId:'qa'})},'./readModels':{},'./financeRead':{},'../operations':{}}[name]??require(name)),Promise,Error});return exports;}

test('all loading shapes expose one accessible status and no fictional data or progress',()=>{
 for(const variant of ['page','list','cards','form','conversation','document','inline'] as LoadingVariant[]){const html=renderToStaticMarkup(createElement(PageLoading,{variant}));assert.equal((html.match(/role="status"/g)||[]).length,1);assert.match(html,/aria-busy="true"/);assert.match(html,/aria-hidden="true"/);assert.doesNotMatch(html,/R\$|[0-9]+%|aria-valuenow|servidor|simula|<button|<h[12]/);}
 assert.equal(pageLoadingVariant('financial-cantina'),'cards');assert.equal(pageLoadingVariant('financial-mensalidades'),'list');assert.equal(pageLoadingVariant('financial-configs'),'form');assert.equal(pageLoadingVariant('chat'),'conversation');
});
test('gate keeps content hidden until authoritative resource arrives and renders the shared loader',async()=>{
 const api=runtime();let finish!:()=>void;api.registerLoader('qa',()=>new Promise<void>(resolve=>{finish=resolve;}));const pending=api.loadResource('qa');await Promise.resolve();let html=renderToStaticMarkup(api.RemotePageGate({tab:'qa',children:'SALDO AUTORIZADO'}));assert.match(html,/axe-loading/);assert.doesNotMatch(html,/SALDO AUTORIZADO|Consultando os servidores/);finish();await pending;html=renderToStaticMarkup(api.RemotePageGate({tab:'qa',children:'SALDO AUTORIZADO'}));assert.equal(html,'SALDO AUTORIZADO');
});
test('a failed read remains an actionable error and retry recovers, never a fake empty balance',async()=>{
 const api=runtime();api.registerLoader('qa',async()=>{throw Error('Conexão indisponível');});await api.loadResource('qa');const element=api.RemotePageGate({tab:'qa',children:'SALDO AUTORIZADO'});const html=renderToStaticMarkup(element);assert.match(html,/role="alert"/);assert.match(html,/Tentar novamente/);assert.doesNotMatch(html,/axe-loading|SALDO AUTORIZADO|R\$ 0/);api.registerLoader('qa',async()=>{});element.props.children[2].props.onClick();await api.loadResource('qa');assert.equal(renderToStaticMarkup(api.RemotePageGate({tab:'qa',children:'SALDO AUTORIZADO'})),'SALDO AUTORIZADO');
});
test('financial selection is exclusive and follows the supplied permitted routes',()=>{
 const items=[{id:'financial',label:'Visão geral',icon:Wallet},{id:'financial-cantina',label:'Cantina',icon:Coffee}];const clicked:string[]=[];const tree=FinancialTabs({items,selected:'financial-cantina',onSelect:id=>clicked.push(id)});const html=renderToStaticMarkup(tree);assert.equal((html.match(/aria-current="page"/g)||[]).length,1);assert.match(html,/Áreas do financeiro/);assert.doesNotMatch(html,/Mensalidades|Pix/);tree.props.children[0].props.onClick();assert.deepEqual(clicked,['financial']);const next=renderToStaticMarkup(createElement(FinancialTabs,{items,selected:clicked[0],onSelect(){}}));assert.match(next,/aria-current="page" class="financial-tab selected"[^>]*>.*?Visão geral/);
});

test('both pilot shells recover automatically when a deployed lazy chunk becomes stale',()=>{
 for(const file of ['design-systems/menu-local-20261029/main.tsx','design-systems/member-pilot-20261102/main.tsx']){
  const source=readFileSync(file,'utf8');
  assert.match(source,/vite:preloadError/);
  assert.match(source,/__axe_refresh/);
  assert.match(source,/location\.replace/);
  assert.match(source,/dynamically imported module/);
  assert.match(source,/safeLazy\(/);
 }
});
