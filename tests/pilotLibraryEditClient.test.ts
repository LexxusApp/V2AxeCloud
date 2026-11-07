import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
function client(){
 const calls:any[]=[];let ok=false,actor='pilot-manager',serial=0;
 const deps:any={
  '../../../src/lib/authenticatedFetch':{authFetch:async(url:string,init:any)=>{calls.push({url,init});const form=init.body;return Response.json(ok?{success:true,id:form.get('id'),previous_id:form.get('previous')||null,visibilidade:form.get('visibility')}:{error:'Response lost'},{status:ok?200:503});}},
  '../uploadTransport':{xhrUploadTransport:()=>undefined},'./session':{previewSession:()=>({userId:actor})},
 };
 const exports:any={},code=ts.transpileModule(readFileSync('design-systems/menu-local-20261029/remote/library.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 runInNewContext(code,{exports,require:(name:string)=>{assert.ok(deps[name],name);return deps[name];},File,FormData,Map,JSON,Error,crypto:{randomUUID:()=>`new-revision-${++serial}`}});
 return{save:exports.saveLibraryRevision,calls,confirm:()=>ok=true,actor:(id:string)=>actor=id};
}
const old:any={id:'old',source:'/api/pilot/library/pdf-proxy?path=old.pdf',title:'Original',description:'',category:'Fundamentos',fileName:'old.pdf',bytes:8,illustrative:false,audience:{kind:'individual',memberId:'old-child'}};
test('editor retries retain the revision id; changed payloads and authenticated identities get new ids',async()=>{
 const f=client(),row={...old,title:'Edited',audience:{kind:'individual',memberId:'new-child'}};
 await assert.rejects(f.save(row,old),/Response lost/);const first=f.calls[0].init.body.get('id');f.confirm();await f.save({...row},old);assert.equal(f.calls[1].init.body.get('id'),first);
 assert.equal(f.calls[1].init.body.has('file'),false);assert.equal(f.calls[1].init.body.get('previous'),'old');assert.equal(f.calls[1].init.body.get('recipient'),'new-child');
 await f.save({...row,title:'Changed'},old);assert.notEqual(f.calls[2].init.body.get('id'),first);
 f.actor('another-identity');await f.save(row,old);assert.notEqual(f.calls[3].init.body.get('id'),first);
});
test('protected house conversion sends a null recipient and an explicit replacement without a legacy write',async()=>{
 const f=client();f.confirm();const file=new File(['%PDF-1.4'],'new.pdf',{type:'application/pdf'});
 await f.save({...old,source:file,audience:{kind:'house'}},old);
 const call=f.calls[0];assert.equal(call.url,'/api/pilot/library/revisions');assert.equal(call.init.body.get('visibility'),'casa');assert.equal(call.init.body.get('recipient'),'');assert.equal(await call.init.body.get('file').text(),'%PDF-1.4');
 await assert.rejects(f.save({...old,source:'/api/v1/library/pdf-proxy?path=other'},old),/PDF real/);assert.equal(f.calls.length,1);
});
test('actual library writer routes protected edits through revision confirmation and refreshes only after success',async()=>{
 const writers=new Map<string,any>(),calls:any[]=[],refreshes:string[]=[];let confirmed=false;
 const deps:any={
  '../confirmedUpload':{},'./uploads':{},'../../../src/lib/supabase':{supabase:{from:()=>{throw Error('Direct metadata write forbidden');}}},
  './session':{previewSession:()=>({tenantId:'pilot'}),scoped:(url:string)=>url},'../../../lib/libraryStoragePath':{},'./privateLibrary':{},
  './runtime':{registerLoader(){},registerWriter:(key:string,value:any)=>writers.set(key,value),readValue:(key:string)=>key==='libraryRows'?[{id:old.id,private_pilot:true}]:{revisionEditing:true},refreshResource:async(key:string)=>refreshes.push(key)},
  './helpers':{singleChange:(next:any[])=>({row:next[0],old,removed:false})},
  './library':{saveLibraryRevision:async(...args:any[])=>{calls.push(args);if(!confirmed)throw Error('Revision unconfirmed');return{id:'new'};}},
 };
 const code=ts.transpileModule(readFileSync('design-systems/menu-local-20261029/remote/media.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 runInNewContext(code,{exports:{},require:(name:string)=>{assert.ok(deps[name],name);return deps[name];},Map,File,JSON,Error});
 const row={...old,audience:{kind:'house'},source:new File(['%PDF-new'],'replacement.pdf',{type:'application/pdf'})};
 await assert.rejects(writers.get('library')({materials:[row]},{materials:[old]}),/Revision unconfirmed/);assert.equal(refreshes.length,0);
 confirmed=true;await writers.get('library')({materials:[row]},{materials:[old]});assert.deepEqual(refreshes,['library']);assert.equal(calls.length,2);assert.equal(calls[1][0].source,row.source);assert.equal(calls[1][1].id,old.id);
});
test('UI and migration retain the explicit legacy safety boundary and version-specific access and discussions',()=>{
 const page=readFileSync('design-systems/menu-local-20261029/LibraryPage.tsx','utf8'),sql=readFileSync('supabase/migrations/20261103130000_pilot_library_revisions.sql','utf8');
 assert.match(page,/disabled=\{legacyEditor \|\| pendingEditor \|\| saving\}/);assert.match(page,/comentários anteriores não serão transferidos/);assert.match(page,/saveInFlight\.current/);
 assert.match(sql,/b\.retired_at is null/);assert.match(sql,/f\.user_id=auth\.uid\(\)/);assert.match(sql,/for update/);assert.match(sql,/pilot_revision_one_successor/);assert.match(sql,/revoke update\(titulo,descricao,categoria,updated_at\)/);
 assert.match(sql,/bucket_id<>'piloto_biblioteca_privada'\) with check/);assert.match(sql,/material\.retired_at is not null/);
 assert.match(sql,/pilot_pdf_operation_guard/);assert.match(sql,/storage\.allow_only_operation\('object.get_authenticated'\)/);
 assert.doesNotMatch(sql,/update public\.biblioteca|delete from public\.biblioteca|biblioteca_estudos/);
});
