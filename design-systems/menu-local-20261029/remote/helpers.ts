import { supabase } from '../../../src/lib/supabase';
import { previewSession } from './session';
export const equal=(a:unknown,b:unknown)=>JSON.stringify(a,(_key,value)=>value instanceof File?{file:value.name,size:value.size,modified:value.lastModified}:value)===JSON.stringify(b,(_key,value)=>value instanceof File?{file:value.name,size:value.size,modified:value.lastModified}:value);
export function singleChange<T extends {id:string}>(next:T[],before:T[]){
  const removed=before.filter(row=>!next.some(item=>item.id===row.id)),edits=next.filter(row=>!equal(row,before.find(item=>item.id===row.id)));
  if(removed.length+edits.length!==1)throw new Error('Conclua uma alteração por vez.');
  const row=edits[0]||removed[0];return{row,old:before.find(item=>item.id===row.id),removed:removed.length===1};
}
export async function tableRows(table:string,columns='*',cursorColumn='id'){
  const tenant=previewSession().tenantId,result:any[]=[];let after='';
  for(let page=0;page<100;page++){
    let query=supabase.from(table).select(columns).eq('tenant_id',tenant).order(cursorColumn).limit(500);if(after)query=query.gt(cursorColumn,after);
    const {data,error}=await query;if(error)throw error;const rows=(data||[]) as any[];result.push(...rows);if(rows.length<500)return result;after=String(rows.at(-1)[cursorColumn]||'');if(!after)throw Error('Não foi possível continuar a consulta com segurança.');
  }throw new Error('A consulta excedeu o limite. Nenhum resultado parcial será mostrado.');
}
export async function checked<T>(result:PromiseLike<{data:T;error:any}>){const {data,error}=await result;if(error)throw new Error(error.message||'Não foi possível gravar.');if(data==null)throw new Error('O servidor não confirmou o registro.');return data;}
