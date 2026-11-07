import {authFetch} from '../../../src/lib/authenticatedFetch';
import {xhrUploadTransport} from '../uploadTransport';
import type {LibraryMaterial} from '../library';
import type {Operation} from '../operations';
import {previewSession} from './session';

// The request id survives response loss and retries of the same editor payload.
// A changed payload gets a different path; staged objects are never overwritten.
const revisions=new Map<string,{key:string;source:string|File;id:string}>();
export async function saveLibraryRevision(row:LibraryMaterial,old?:LibraryMaterial,operation?:Operation){
 const session=previewSession(),key=JSON.stringify([session.userId,session.tenantId,row.title.trim(),row.description.trim(),row.category,row.audience]);
 let attempt=revisions.get(row.id);
 if(!attempt||attempt.key!==key||attempt.source!==row.source){attempt={key,source:row.source,id:old?crypto.randomUUID():row.id};revisions.set(row.id,attempt);}
 if(row.illustrative)throw Error('Selecione o PDF real. Arquivos ilustrativos não serão publicados.');
 const form=new FormData();
 for(const [name,value] of Object.entries({id:attempt.id,previous:old?.id||'',visibility:row.audience.kind==='house'?'casa':'individual',recipient:row.audience.kind==='individual'?row.audience.memberId:'',title:row.title.trim(),description:row.description.trim(),category:row.category}))form.set(name,value);
 if(row.source instanceof File){form.set('file',row.source,row.source.name);operation?.files([{id:row.id,name:row.fileName,bytes:row.source.size}]);}
 else if(!old||row.source!==old.source)throw Error('Selecione o PDF real para trocar o arquivo.');
 operation?.phase('Confirmando o PDF e a nova revisão de acesso…');
 const response=await authFetch('/api/pilot/library/revisions',{method:'POST',body:form},undefined,xhrUploadTransport((loaded,total)=>operation?.progress(row.id,loaded,total)));
 const result=await response.json().catch(()=>({}));
 const current=previewSession();if(current.userId!==session.userId||current.tenantId!==session.tenantId)throw Error('A conta ou a casa mudou durante a edição. Confira o acervo antes de repetir.');
 if(!response.ok||result.success!==true||result.id!==attempt.id||result.previous_id!==(old?.id||null)||result.visibilidade!==(row.audience.kind==='house'?'casa':'individual'))throw Error(result.error||'O servidor não confirmou a revisão. Confira o acervo antes de repetir.');
 operation?.file(row.id,{phase:'done',progress:1});return result;
}

