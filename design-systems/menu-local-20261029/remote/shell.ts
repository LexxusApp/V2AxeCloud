import {supabase} from '../../../src/lib/supabase';
import {previewSession} from './session';
import {publishValue,registerLoader} from './runtime';
import {readGalleryUsage} from './galleryUsage';
registerLoader('galleryUsage',async()=>{
 const scope=previewSession();
 const usage=await readGalleryUsage(async after=>{
  let query=supabase.from('gallery_media').select('id,size_bytes',after?undefined:{count:'exact'}).eq('tenant_id',scope.tenantId).order('id',{ascending:true}).limit(500);
  if(after)query=query.gt('id',after);
  const {data,error,count}=await query;
  if(error)throw Error('Não foi possível consultar o espaço da galeria.');
  if(previewSession().userId!==scope.userId||previewSession().tenantId!==scope.tenantId)throw Error('A conta mudou durante a consulta.');
  return {rows:data||[],count};
 });
 publishValue('galleryUsage',usage);
});
