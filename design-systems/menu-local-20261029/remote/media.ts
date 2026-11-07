import { confirmCachedUpload } from '../confirmedUpload';
import { uploadFile } from './uploads';
import { supabase } from '../../../src/lib/supabase';
import { previewSession,request,scoped } from './session';
import { publishValue,readValue,registerLoader,registerWriter,refreshResource,loadResource } from './runtime';
import { singleChange,equal,checked,tableRows } from './helpers';
import type { LocalGallery } from '../gallery';
import type { LocalInventory } from '../inventory';
import type {LocalLibrary} from '../library';
import {libraryStoragePath} from '../../../lib/libraryStoragePath';
import {publishPrivatePdf} from './privateLibrary';
registerLoader('gallery',async()=>{
  const [result,covers]=await Promise.all([request(scoped('/api/v1/gallery/albums')),tableRows('piloto_capas_galeria','*','album_id')]);publishValue('galleryCoverRows',covers);if(!Array.isArray(result.albums)||!Array.isArray(result.media))throw new Error('Resposta da galeria inválida.');
  publishValue('gallery',{albums:result.albums.map((row:any)=>({id:row.id,name:row.name,description:row.description||'',category:row.category||'lembranca',created:row.created_at,coverId:covers.find(item=>item.album_id===row.id)?.media_id||row.cover_media_id||result.media.find((item:any)=>item.album_id===row.id)?.id||''})),media:result.media.map((row:any)=>({id:row.id,albumId:row.album_id,title:row.title||row.file_name,caption:row.caption||'',type:row.media_type,source:row.public_url||row.url,fileName:row.file_name,bytes:Number(row.size_bytes)||0,created:row.created_at,illustrative:false,liked:!!row.user_has_liked,likeCount:Math.max(0,Number(row.likes_count)||0)}))});
  void loadResource('galleryUsage',true);
});
const galleryUploads=new Map<string,{upload:any;pushed:boolean;saved:boolean}>();
registerWriter('gallery',async(next:LocalGallery,before:LocalGallery,operation)=>{
  const tenantId=previewSession().tenantId;
  const addedMedia=next.media.filter(row=>!before.media.some(item=>item.id===row.id));
  // An album and all files selected in its modal are one user operation.
  // Validate the entire selection before creating an album or starting an upload.
  for(const row of addedMedia)if(!(row.source instanceof File)||row.illustrative)throw new Error('Selecione arquivos reais. Imagens de demonstração não serão publicadas.');
  if(addedMedia.length){
    operation?.files(addedMedia.map(row=>({id:row.id,name:(row.source as File).name,bytes:(row.source as File).size})));
    operation?.phase('Preparando o álbum e os arquivos…');
    const editedAlbums=next.albums.filter(row=>!equal(row,before.albums.find(item=>item.id===row.id)));
    if(editedAlbums.length>1||before.albums.some(row=>!next.albums.some(item=>item.id===row.id)))throw new Error('Envie registros para um álbum por vez.');
    for(const row of editedAlbums){
      const old=before.albums.find(item=>item.id===row.id);
      const payload={name:row.name,description:row.description,category:row.category};
      if(old)await checked(supabase.from('gallery_albums').update(payload).eq('id',row.id).eq('tenant_id',tenantId).select('id').single());
      else await checked(supabase.from('gallery_albums').upsert({...payload,id:row.id,tenant_id:tenantId,created_by:previewSession().userId},{onConflict:'id'}).select('id').single());
    }
    const failures:string[]=[];
    for(const [index,row] of addedMedia.entries()){
      const file=row.source as File;
      operation?.phase(`Arquivo ${index+1} de ${addedMedia.length}: ${file.name}`);
      operation?.file(row.id,{phase:'preparing'});
      try {
        const cacheKey=`${tenantId}:${previewSession().userId}:${row.id}`;
        let task=galleryUploads.get(cacheKey);
        if(!task){task={upload:await request('/api/v1/gallery/upload-url','POST',{tenantId,albumId:row.albumId,fileName:file.name,contentType:file.type,sizeBytes:file.size}),pushed:false,saved:false};galleryUploads.set(cacheKey,task);}
        await confirmCachedUpload(task,()=>uploadFile(task!.upload.uploadUrl,file,operation,row.id),async()=>{
          operation?.file(row.id,{phase:'confirming',progress:1});
          const {data:existing,error}=await supabase.from('gallery_media').select('id').eq('tenant_id',tenantId).eq('storage_key',task!.upload.storageKey).maybeSingle();
          if(error)throw error;
          if(!existing)await request('/api/v1/gallery/complete-upload','POST',{tenantId,albumId:row.albumId,storageKey:task!.upload.storageKey,publicUrl:task!.upload.publicUrl,fileName:file.name,contentType:file.type,sizeBytes:file.size,title:row.title,caption:row.caption,category:next.albums.find(item=>item.id===row.albumId)?.category});
        });
        operation?.file(row.id,{phase:'done',progress:1,message:undefined});
      }catch(error){const message=error instanceof Error?error.message:'O servidor não confirmou o arquivo.';failures.push(file.name);operation?.file(row.id,{phase:'error',message});}
    }
    if(failures.length){await refreshResource('gallery').catch(()=>{});throw new Error(`${addedMedia.length-failures.length} de ${addedMedia.length} arquivos salvos. ${failures.length} falharam. Tente novamente com a seleção preservada; os arquivos já confirmados não serão reenviados.`);}
    operation?.phase('Arquivos salvos. Atualizando o álbum…');
    await refreshResource('gallery');return;
  }
  if(!equal(next.albums,before.albums)){
    const {row,old,removed}=singleChange(next.albums,before.albums);
    if(removed)await request(scoped(`/api/v1/gallery/albums/${encodeURIComponent(row.id)}`),'DELETE');
    else if(old){
      if(row.coverId!==old.coverId){const result:any=await checked(supabase.rpc('piloto_definir_capa',{p_tenant:tenantId,p_album:row.id,p_media:row.coverId||null}));if(result.album_id!==row.id||result.media_id!==(row.coverId||null))throw Error('O servidor não confirmou a capa.');}
      if(row.name!==old.name||row.description!==old.description||row.category!==old.category)await checked(supabase.from('gallery_albums').update({name:row.name,description:row.description,category:row.category}).eq('id',row.id).eq('tenant_id',tenantId).select('id').single());
    }
    else await request('/api/v1/gallery/albums','POST',{tenantId,name:row.name,description:row.description,category:row.category});
  }else{
    const {row,old,removed}=singleChange(next.media,before.media);
    if(removed)await request(scoped(`/api/v1/gallery/media/${encodeURIComponent(row.id)}`),'DELETE');
    else if(old){if(row.liked!==old.liked)await request(`/api/v1/gallery/media/${encodeURIComponent(row.id)}/axe`,'POST',{tenantId});else{if(row.albumId!==old.albumId||row.source!==old.source)throw new Error('A edição permite título e legenda, preservando o arquivo e o álbum originais.');await checked(supabase.from('gallery_media').update({title:row.title,caption:row.caption}).eq('id',row.id).eq('tenant_id',tenantId).select('id').single());}}
    else{
      if(!(row.source instanceof File))throw new Error('Selecione um arquivo real para publicar na galeria.');
      const file=row.source,upload=await request('/api/v1/gallery/upload-url','POST',{tenantId,albumId:row.albumId,fileName:file.name,contentType:file.type,sizeBytes:file.size});
      operation?.files([{id:row.id,name:file.name,bytes:file.size}]);await uploadFile(upload.uploadUrl,file,operation,row.id);
      await request('/api/v1/gallery/complete-upload','POST',{tenantId,albumId:row.albumId,storageKey:upload.storageKey,publicUrl:upload.publicUrl,fileName:file.name,contentType:file.type,sizeBytes:file.size,title:row.title,caption:row.caption,category:next.albums.find(item=>item.id===row.albumId)?.category});
    }
  }await refreshResource('gallery');
});
registerLoader('library',async()=>{
 const result=await request(scoped('/api/pilot/library/materials'));
 if(!Array.isArray(result.data))throw Error('A API de acervo com controle de acesso não está disponível.');
 publishValue('libraryCapabilities',result.capabilities||{});publishValue('libraryRows',result.data);
 publishValue('library',{revisionEditing:result.capabilities?.revisionEditing===true,materials:result.data.map((row:any)=>{
  const path=row.storage_path||libraryStoragePath(row.arquivo_url||'');
  return{id:row.id,title:row.titulo,description:row.descricao||'',category:row.categoria||'Fundamentos',
   source:scoped(`/api/${row.private_pilot?'pilot':'v1'}/library/pdf-proxy?path=${encodeURIComponent(path)}`),
   fileName:path?.split('/').at(-1)||`${row.titulo}.pdf`,bytes:Number(row.size_bytes)||0,illustrative:false,
   audience:row.visibilidade==='individual'?{kind:'individual',memberId:row.destinatarios?.[0]||''}:{kind:'house'},
   created:row.created_at,updated:row.updated_at||row.created_at,
   editPolicy:row.private_pilot?(result.capabilities?.revisionEditing?'revision':'pending'):'legacy'};
 })});
});
registerWriter('library',async(next:LocalLibrary,before:LocalLibrary,operation)=>{
 const {row,old,removed}=singleChange(next.materials,before.materials),tenantId=previewSession().tenantId;
 const raw=(readValue<any[]>('libraryRows')||[]).find(item=>item.id===row.id),capabilities=readValue('libraryCapabilities');
 if(raw?.private_pilot){
  if(removed){const result=await request(scoped(`/api/pilot/library/private/${encodeURIComponent(row.id)}`),'DELETE');if(result.success!==true)throw Error('O servidor não confirmou a remoção do PDF.');}
  else{if(!old||!capabilities?.revisionEditing)throw Error('A edição protegida aguarda a revisão e ativação da migração do piloto.');await (await import('./library')).saveLibraryRevision(row,old,operation);}
 }else if(!old&&!removed){
  if(capabilities?.revisionEditing)await (await import('./library')).saveLibraryRevision(row,undefined,operation);
  else if(row.audience.kind==='individual'&&capabilities?.privatePilot)await publishPrivatePdf(row,operation);
  else throw Error('A publicação para a casa em armazenamento protegido aguarda a ativação da migração do piloto.');
 }else if(removed)await request(scoped(`/api/v1/library/material/${encodeURIComponent(row.id)}`),'DELETE');
 else{
  // A service-role legacy proxy and previously issued storage links bypass a
  // metadata-only change of audience. Never write those metadata first.
  if(!old||!equal(row.audience,old.audience)||row.source!==old.source||row.fileName!==old.fileName)throw Error('Este PDF usa o armazenamento legado. Trocar arquivo ou acesso exige retirar os links antigos antes de publicar uma revisão protegida. O PDF e o acesso originais foram preservados.');
  await checked(supabase.from('biblioteca').update({titulo:row.title.trim(),descricao:row.description.trim(),categoria:row.category}).eq('id',row.id).eq('tenant_id',tenantId).select('id').single());
 }
 await refreshResource('library');
});
registerLoader('inventory',async()=>{
  const [{data},metadata,movements]=await Promise.all([request(scoped('/api/inventory')),tableRows('piloto_estoque_itens','*','item_id'),tableRows('piloto_estoque_movimentos')]);
  if(!Array.isArray(data))throw new Error('Resposta do estoque inválida.');
  const meta=new Map(metadata.map(row=>[row.item_id,row]));
  publishValue('inventory',{items:data.filter((row:any)=>!meta.get(row.id)?.arquivado).map((row:any)=>{const details=meta.get(row.id),scale=Number(details?.escala)||1;return{id:row.id,name:row.item,category:row.categoria||'Rituais',unit:details?.unidade||'un.',quantity:Math.round(Number(row.quantidade_atual)*1000/scale),minimum:Math.round(Number(row.quantidade_minima)*1000/scale),location:details?.localizacao||'',notes:details?.observacoes||''};}),movements:movements.map(row=>({id:row.id,itemId:row.item_ref,name:row.nome,unit:row.unidade,kind:row.tipo,before:Number(row.antes),after:Number(row.depois),note:row.motivo,created:row.created_at}))});
});
registerWriter('inventory',async(next:LocalInventory,before:LocalInventory)=>{
  const {row,old,removed}=singleChange(next.items,before.items),tenantId=previewSession().tenantId;
  const movements=next.movements.filter(item=>!before.movements.some(previous=>previous.id===item.id));
  if(movements.length>1||movements.some(item=>item.itemId!==row.id)||before.movements.some(item=>!next.movements.some(previous=>previous.id===item.id)))throw Error('Registre uma movimentação por vez, preservando o histórico.');
  const result:any=await checked(supabase.rpc('piloto_salvar_estoque',{p_tenant:tenantId,p_item:row.id,p_input:removed?null:row,p_before:old||null,p_movement:movements[0]||null}));
  if(result.id!==row.id)throw Error('O servidor não confirmou a alteração do estoque.');
  await refreshResource('inventory');
});
