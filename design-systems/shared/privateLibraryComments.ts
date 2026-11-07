import {supabase} from '../../src/lib/supabase';
export async function readPrivateComments(materialId:string){
 const access=await supabase.rpc('piloto_pode_ler_pdf',{p_id:materialId});
 if(access.error||access.data!==true)throw Error('Não foi possível confirmar seu acesso a este estudo.');
 const rows:any[]=[];
 for(let from=0;;from+=500){
  const result=await supabase.from('piloto_biblioteca_comentarios').select('id,author_name,leadership,texto,created_at').eq('material_id',materialId).order('created_at').order('id').range(from,from+499);
  if(result.error||!Array.isArray(result.data))throw Error('Não foi possível carregar os comentários deste estudo.');
  rows.push(...result.data.map(row=>({...row,authorName:row.author_name})));if(result.data.length<500)return rows;
 }
}
export async function sendPrivateComment(materialId:string,text:string,requestId:string){
 const result=await supabase.rpc('piloto_comentar_pdf',{p_material:materialId,p_request:requestId,p_text:text});
 if(result.error||result.data?.id!==requestId)throw Error(result.error?.message||'O comentário não foi confirmado. Seu texto foi preservado.');
 return result.data;
}
