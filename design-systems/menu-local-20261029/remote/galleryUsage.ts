import type {GalleryUsage} from '../shellSummary';
import {GALLERY_LIMIT_BYTES} from '../shellSummary';
type UsageRow={id:string;size_bytes:number|string};
type Page={rows:UsageRow[];count?:number|null};
/** Read only IDs and sizes under the signed-in user's RLS; never fetch images. */
export async function readGalleryUsage(readPage:(after:string)=>Promise<Page>):Promise<GalleryUsage>{
 let after='',usedBytes=0,fileCount=0,expected:number|undefined;
 const seen=new Set<string>();
 for(let page=0;page<10000;page++){
  const result=await readPage(after);
  if(!Array.isArray(result.rows))throw Error('Não foi possível consultar o espaço da galeria.');
  if(page===0){if(!Number.isSafeInteger(result.count)||Number(result.count)<0)throw Error('A contagem da galeria não foi confirmada.');expected=Number(result.count);}
  for(const row of result.rows){
   if(typeof row.size_bytes!=='number'&&(typeof row.size_bytes!=='string'||!/^\d+$/.test(row.size_bytes)))throw Error('O tamanho dos arquivos da galeria não foi confirmado.');
   const size=Number(row.size_bytes);
   if(!row.id||seen.has(row.id)||!Number.isSafeInteger(size)||size<0||row.size_bytes==null)throw Error('O tamanho dos arquivos da galeria não foi confirmado.');
   seen.add(row.id);usedBytes+=size;fileCount++;
   if(!Number.isSafeInteger(usedBytes))throw Error('O uso da galeria excedeu o limite da consulta.');
  }
  if(fileCount===expected)return {usedBytes,limitBytes:GALLERY_LIMIT_BYTES,fileCount};
  if(!result.rows.length||fileCount>expected!)throw Error('A galeria mudou durante a consulta. Tente atualizar o uso novamente.');
  const next=result.rows.at(-1)!.id;
  if(next===after)throw Error('A consulta do espaço não foi concluída.');
  after=next;
 }
 throw Error('Não foi possível concluir a consulta do espaço da galeria.');
}
