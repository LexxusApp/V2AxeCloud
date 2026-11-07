import {authFetch} from '../../../src/lib/authenticatedFetch';
import {xhrUploadTransport} from '../uploadTransport';
import type {LibraryMaterial} from '../library';
import type {Operation} from '../operations';
export async function publishPrivatePdf(row:LibraryMaterial,operation?:Operation){
 if(row.audience.kind!=='individual'||!(row.source instanceof File)||row.illustrative)throw Error('Selecione o PDF real e o destinatário.');
 const file=row.source;
 if(file.type!=='application/pdf'||file.size>20*1024*1024||await file.slice(0,5).text()!=='%PDF-')throw Error('Selecione um PDF válido de até 20 MB.');
 const form=new FormData();
 for(const [key,value] of Object.entries({id:row.id,recipient:row.audience.memberId,title:row.title,description:row.description,category:row.category}))form.set(key,value);
 form.set('file',file,file.name);operation?.files([{id:row.id,name:file.name,bytes:file.size}]);operation?.file(row.id,{phase:'uploading',progress:0});
 const response=await authFetch('/api/pilot/library/private',{method:'POST',body:form},undefined,xhrUploadTransport((loaded,total)=>{operation?.progress(row.id,loaded,total);if(total&&loaded>=total)operation?.file(row.id,{phase:'confirming',progress:1});}));
 const result=await response.json().catch(()=>({}));
 if(!response.ok||result.success!==true||result.id!==row.id||result.visibilidade!=='individual')throw Error(result.error||'O servidor não confirmou o PDF privado. Confira o acervo antes de repetir.');
 operation?.file(row.id,{phase:'done',progress:1});return result;
}
