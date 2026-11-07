import { supabase } from '../../../src/lib/supabase';
import { previewSession, scoped } from './session';
import {authFetch} from '../../../src/lib/authenticatedFetch';
import {fetchAllFinancialTransactions} from '../../../src/lib/financialTransactions';
/** Read-only keyset sweep: no offset gaps, capped to avoid unbounded requests. */
async function sweep() {
  const { tenantId } = previewSession();
  const rows: Record<string,any>[] = [];
  let after = '';
  for (let page=0;page<200;page++) {
    let query = supabase.from('financeiro').select('*').or(`tenant_id.eq.${tenantId},lider_id.eq.${tenantId}`).order('id',{ascending:true}).limit(500);
    if (after) query = query.gt('id',after);
    const { data, error } = await query;
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length<500) return rows;
    after = String(data[data.length-1].id);
  }
  throw new Error('O extrato excedeu o limite de consulta. Nenhum saldo parcial será mostrado.');
}
export async function readFinance() {
  // Compare with the existing authorized endpoint to detect legacy rows hidden by RLS.
  const base=scoped('/api/transactions');
  const first=await authFetch(base+'&limit=500&offset=0',{cache:'no-store'});
  const initial=await first.clone().json().catch(()=>({}));
  if(first.ok&&typeof initial.ledgerRevision!=='string'){
    // A legacy server cannot prove completeness from a short response. Keep
    // the existing RLS/repeat-snapshot verification for that version only.
  }else{
    let saved:Response|undefined=first;
    const result=await fetchAllFinancialTransactions<any>(url=>{if(saved){const response=saved;saved=undefined;return Promise.resolve(response);}return authFetch(url,{cache:'no-store'});},base);
    return result.data;
  }
  const reference = initial;
  if (!Array.isArray(reference.data)) throw new Error('Resposta financeira inválida.');
  let before = await sweep();
  for (let attempt=0;attempt<3;attempt++) {
    const after = await sweep();
    if (JSON.stringify(before)===JSON.stringify(after)) {
      const ids = new Set(after.map(row=>String(row.id)));
      if (reference.data.some((row:any)=>!ids.has(String(row.id)))) throw new Error('As permissões de leitura do extrato precisam ser conferidas antes de calcular o saldo.');
      return after;
    }
    before=after;
  }
  throw new Error('O extrato está mudando durante a consulta. Tente novamente para ver um saldo consistente.');
}
