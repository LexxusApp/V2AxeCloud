import { getRuntimeSupabaseUrl } from '../../../src/lib/runtimeConfig';
import { xhrUploadTransport } from '../uploadTransport';
import type { Operation } from '../operations';
export async function uploadFile(url: string, file: File, operation?: Operation, id = file.name, headers?: HeadersInit) {
  operation?.file(id,{phase:'uploading',progress:0});
  try {
    const response = await xhrUploadTransport((loaded,total) => { operation?.progress(id,loaded,total); if(total && loaded>=total)operation?.file(id,{phase:'confirming',progress:1}); })(url,{method:'PUT',body:file,headers:headers||{'Content-Type':file.type}});
    if (!response.ok) throw new Error(`O arquivo ${file.name} não foi confirmado pelo armazenamento (${response.status}).`);
    operation?.file(id,{phase:'confirming',progress:1});
  } catch(error) { operation?.file(id,{phase:'error',message:error instanceof Error ? error.message : 'Falha no envio.'}); throw error; }
}
export async function uploadSignedFile(bucket: 'biblioteca_estudos'|'loja_imagens', path: string, token: string, file: File, operation?: Operation, id = file.name) {
  // Same signed PUT endpoint and raw-body headers as the installed StorageFileApi.
  const url = new URL(`${getRuntimeSupabaseUrl().replace(/\/$/,'')}/storage/v1/object/upload/sign/${bucket}/${path.split('/').map(encodeURIComponent).join('/')}`);
  url.searchParams.set('token',token);
  await uploadFile(url.toString(),file,operation,id,{'Content-Type':file.type,'Cache-Control':'max-age=3600','x-upsert':'false'});
}
