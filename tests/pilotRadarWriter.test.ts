import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import * as contract from '../cloudflare/pilot-radar-contract.js';
import {radarFixture} from './pilotRadar.fixture';
function harness(){
 const calls:any[]=[],values=new Map<string,any>();let writer:any,loader:any,persisted:any=null,revision=0,failUpload=false;
 const initial={...radarFixture(),posts:[],services:[]};
 const request=async(path:string,method='GET',body?:any)=>{calls.push({path,method,body});
  if(path==='/api/pilot/radar'){if(method==='GET')return {profile:persisted,revision};if(body.revision!==revision)throw Error('concurrent');persisted=JSON.parse(JSON.stringify(body.profile));return {profile:persisted,revision:++revision};}
  if(path.endsWith('/upload-photo')){if(failUpload)throw Error('upload failed');return {publicUrl:'https://media.invalid/uploaded.jpg'};}
  if(path==='/api/v1/settings/directory-profile')return {profile:{nome:initial.publicName,endereco:'Rua de teste, 123, Sala 2, CEP 01001-000',cidade:initial.city,estado:initial.uf,bairro:initial.neighborhood,tradicao:'umbanda'}};
  if(path.endsWith('directory-publicacoes'))return {publicacoes:[]};if(path.endsWith('terreiro-servicos'))return {servicos:[]};throw Error('Unexpected request '+path);
 };
 const dependencies:any={'./session':{request},'./initial':{initialRadar:()=>structuredClone(initial)},'./runtime':{publishValue:(k:string,v:any)=>values.set(k,v),readValue:(k:string)=>values.get(k),registerLoader:(_:string,fn:any)=>loader=fn,registerWriter:(_:string,fn:any)=>writer=fn,refreshResource:async()=>loader()},'./helpers':{equal:(a:any,b:any)=>JSON.stringify(a)===JSON.stringify(b)},'./account':{fileBase64:async()=> 'mock-image-data'},'../../../cloudflare/pilot-radar-contract.js':contract};
 const source=readFileSync(new URL('../design-systems/menu-local-20261029/remote/radar.ts',import.meta.url),'utf8');
 const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 runInNewContext(compiled,{exports:{},require:(name:string)=>{if(!(name in dependencies))throw Error('Unexpected import '+name);return dependencies[name];},File,Blob,Map,WeakMap,structuredClone,Error});
 return {calls,values,load:()=>loader(),write:(next:any,before:any)=>writer(next,before),failUpload:()=>failUpload=true};
}
test('real Radar writer reloads structured extras after save and preserves disabled schedules privately',async()=>{
 const h=harness();await h.load();const before=h.values.get('radar'),next={...before,...radarFixture(),posts:[],services:[]};await h.write(next,before);
 const saved=h.values.get('radar');assert.equal(saved.address,'Rua de teste');assert.equal(saved.number,'123');assert.equal(saved.cep,'01001-000');assert.equal(saved.socials.length,5);assert.equal(saved.cover.caption,'Capa da casa');assert.equal(saved.schedules[0].end,'02:00');assert.equal(saved.schedules[1].enabled,false);assert.equal(saved.coverPosition,'top');
 await h.write({...saved,showAddress:false},saved);assert.equal(h.values.get('radar').showAddress,false);assert.equal(h.values.get('radar').address,'Rua de teste');
 assert.equal(h.calls.some(c=>c.method==='POST'&&c.path==='/api/v1/settings/directory-profile'),false);
 assert.equal(h.calls.filter(c=>c.method==='PUT').some(c=>'posts' in c.body.profile||'services' in c.body.profile),false);
});
test('upload failure never confirms or writes the profile and draft File remains available to retry',async()=>{
 const h=harness();await h.load();const before=h.values.get('radar'),file=new File(['mock'],'photo.jpg',{type:'image/jpeg'}),next={...before,...radarFixture(),cover:{...radarFixture().cover,source:file}};h.failUpload();await assert.rejects(h.write(next,before),/upload failed/);assert.equal(next.cover.source,file);assert.equal(h.calls.some(c=>c.method==='PUT'),false);assert.equal(h.values.get('radarRevision'),0);
});
test('uploaded image preserves caption and confirms server URL before the subsequent reload',async()=>{
 const h=harness();await h.load();const before=h.values.get('radar'),file=new File(['mock'],'photo.jpg',{type:'image/jpeg'}),next={...before,...radarFixture(),cover:{...radarFixture().cover,source:file}};await h.write(next,before);assert.equal(h.values.get('radar').cover.source,'https://media.invalid/uploaded.jpg');assert.equal(h.values.get('radar').cover.caption,'Capa da casa');
});
