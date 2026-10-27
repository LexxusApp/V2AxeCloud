/** A submitted receipt pauses only the corresponding debt, never the whole member. */
export async function withoutReceiptReviews<T extends {id?:string}>(sb:any,rows:T[]):Promise<T[]>{
  if(!rows.length)return rows;
  const paused=new Set<string>();
  for(let start=0;start<rows.length;start+=100){
    const ids=rows.slice(start,start+100).map(r=>r.id).filter(Boolean);
    if(!ids.length)continue;
    const {data,error}=await sb.from('mensalidade_comprovante_envios').select('financeiro_id').eq('status','em_analise').in('financeiro_id',ids);
    // Do not send an automatic charge if the pause state cannot be checked.
    if(error)throw error;
    for(const row of data||[])paused.add(String(row.financeiro_id));
  }
  return rows.filter(row=>!paused.has(String(row.id)));
}
