import {authFetch as baseAuthFetch} from '../../src/lib/authenticatedFetch';
export {authHeaders,getAccessToken,ensureFreshAccessToken} from '../../src/lib/authenticatedFetch';
import {operations} from '../menu-local-20261029/operations';
import {xhrUploadTransport} from '../menu-local-20261029/uploadTransport';
const labels:[RegExp,string][]=[[/validar-comprovante/,'Enviando comprovante'],[/profile-photo/,'Atualizando sua foto'],[/filho\/profile/,'Salvando seus dados'],[/participantes\/respond/,'Registrando sua resposta'],[/checkout/,'Confirmando pedido'],[/comments/,'Enviando comentário'],[/\/messages/,'Enviando mensagem'],[/\/upload/,'Enviando anexo'],[/\/action/,'Atualizando pedido'],[/\/read/,'Marcando mensagens como lidas']];
export async function authFetch(input:RequestInfo|URL,init:RequestInit={},token?:string|null,transport?:typeof fetch):Promise<Response>{
 const url=typeof input==='string'?input:input instanceof URL?input.toString():input.url,method=init.method||(typeof input==='object'&&'method' in input?input.method:'GET');
 // Chat owns its in-thread pending, upload and error states. Never open a global
 // activities drawer just to open/read/send a conversation.
 if(!/^(POST|PUT|PATCH|DELETE)$/i.test(method)||/\/api\/v1\/chat(?:\/|\?)|telemetry|interface-access|\/read$/.test(url)){let response=await baseAuthFetch(input,init,token,transport);if(method.toUpperCase()==='GET'&&[500,502,503,504].includes(response.status)){await response.body?.cancel().catch(()=>{});response=await baseAuthFetch(input,init,token,transport);}return response;}
 const label=labels.find(([pattern])=>pattern.test(url))?.[1]||'Confirmando sua solicitação',operation=operations.begin(label);
 let file=init.body instanceof File?init.body:null,encoded=false;
 if(typeof init.body==='string'){try{encoded=!!JSON.parse(init.body).fileData;}catch{/* Non-JSON bodies still use the authenticated request. */}}
 if(file||encoded)operation.files([{id:'file',name:file?.name||(/comprovante/.test(url)?'Comprovante de pagamento':'Foto do perfil'),bytes:file?.size||new Blob([init.body as string]).size}]);
 try{
  const response=await baseAuthFetch(input,init,token,transport||((file||encoded)?xhrUploadTransport((loaded,total)=>{operation.progress('file',loaded,total);if(total&&loaded>=total)operation.file('file',{phase:'confirming',progress:1});}):undefined));
  const data=await response.clone().json().catch(()=>({}));
  const confirmed=/validar-comprovante/.test(url)?Boolean(data?.data?.id):/\/checkout(?:\?|$)/.test(url)?data?.success===true&&Boolean(data?.order?.id):/\/filho\/profile-photo/.test(url)?Boolean(data?.publicUrl):true;
  if(!response.ok||data?.success===false||!confirmed){operation.fail(Error(data?.error||data?.message||'A solicitação não foi confirmada. Confira os dados antes de repetir.'));return response;}
  if(file||encoded)operation.file('file',{phase:'done',progress:1});
  operation.complete(/validar-comprovante/.test(url)?'Comprovante recebido para análise. Isso ainda não confirma o pagamento.':/\/upload/.test(url)?'Arquivo recebido. A mensagem será confirmada separadamente.':'Solicitação confirmada pelo sistema.');return response;
 }catch(error){operation.fail(error);throw error;}
}
