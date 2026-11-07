import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import {confirmCachedUpload} from '../design-systems/menu-local-20261029/confirmedUpload';
import {createOperationStore} from '../design-systems/menu-local-20261029/operations';
import {gallerySubmission,type GalleryUploadDraft} from '../design-systems/menu-local-20261029/galleryBackground';
const require=createRequire(import.meta.url);
test('actual gallery writer confirms partial saves, resumes without another transfer and isolates cached objects by account',async()=>{
 const writers=new Map<string,any>(),transfers:string[]=[],confirmed=new Set<string>(),completionAttempts:string[]=[],signed:string[]=[];let refreshes=0,failSecond=true,tenant='one';
 const supabase={from:()=>{let key='';const query:any={upsert(){return this;},update(){return this;},select(){return this;},eq(column:string,value:string){if(column==='storage_key')key=value;return this;},single:async()=>({data:{id:'album'},error:null}),maybeSingle:async()=>({data:confirmed.has(key)?{id:'server-'+key}:null,error:null})};return query;}};
 const session={previewSession:()=>({tenantId:tenant,userId:'user-'+tenant}),scoped:(url:string)=>url,request:async(url:string,_method:string,payload:any)=>{
  if(url.endsWith('/upload-url')){const key=tenant+':'+payload.fileName;signed.push(key);return {storageKey:key,uploadUrl:key,publicUrl:'https://qa.invalid/'+key};}
  if(url.endsWith('/complete-upload')){completionAttempts.push(payload.storageKey);if(failSecond&&payload.fileName==='two.jpg'){failSecond=false;throw Error('Confirmação temporariamente indisponível');}confirmed.add(payload.storageKey);return {success:true};}
  throw Error('Unexpected endpoint '+url);
 }};
 const deps:Record<string,unknown>={'./privateLibrary':{},'../confirmedUpload':{confirmCachedUpload},'./uploads':{uploadFile:async(url:string)=>{transfers.push(url);}},'../../../src/lib/supabase':{supabase},'./session':session,'./runtime':{registerLoader(){},registerWriter:(key:string,writer:any)=>writers.set(key,writer),refreshResource:async()=>{refreshes++;}},'./helpers':{equal:(a:any,b:any)=>JSON.stringify(a)===JSON.stringify(b),checked:async(promise:any)=>(await promise).data},'../../../lib/libraryStoragePath':{}};
 const code=ts.transpileModule(readFileSync('design-systems/menu-local-20261029/remote/media.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;runInNewContext(code,{exports:{},require:(name:string)=>deps[name]??require(name),File,Error,Map,Promise,JSON});
 const selection:GalleryUploadDraft={editor:{id:'album',kind:'new',name:'Memórias',description:'',category:'gira'},created:'2026-11-02T12:00:00Z',uploads:['one','two'].map(id=>({id,source:new File(['sample'],id+'.jpg',{type:'image/jpeg'}),title:id,caption:'',type:'image',fileName:id+'.jpg',bytes:6,illustrative:false}))};
 const empty={albums:[],media:[]},next=gallerySubmission(empty,selection),operations=createOperationStore(),first=operations.begin('Galeria','gallery');
 await assert.rejects(writers.get('gallery')(next,empty,first),/1 de 2 arquivos salvos/);assert.equal(refreshes,1);assert.deepEqual(transfers,['one:one.jpg','one:two.jpg']);assert.equal(confirmed.size,1);assert.equal(operations.snapshot()[0].files[0].phase,'done');assert.equal(operations.snapshot()[0].files[1].phase,'error');
 const partial={albums:next.albums,media:[{...next.media[0],id:'server-first',source:'https://qa.invalid/confirmed.jpg'}]},retry=gallerySubmission(partial,selection);await writers.get('gallery')(retry,partial,operations.begin('Retomar','gallery'));
 assert.equal(transfers.length,2);assert.equal(signed.length,2);assert.deepEqual(completionAttempts,['one:one.jpg','one:two.jpg','one:two.jpg']);assert.equal(confirmed.size,2);assert.equal(refreshes,2);assert.ok(operations.snapshot()[1].files.every(file=>file.phase==='done'));
 tenant='two';await writers.get('gallery')(next,empty,operations.begin('Outra conta','gallery'));assert.equal(signed.length,4);assert.equal(transfers.length,4);assert.equal(confirmed.size,4);
});
