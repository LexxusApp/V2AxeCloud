import {receiptAmountOnDate,receiptNeedsJustification,validateReceiptDecision,type ReceiptReview} from '../../lib/receiptReview';
import {receiptRequest} from '../../src/lib/receiptReviewClient';
import {financialToday} from './billing';

export async function decideReceipt(row:ReceiptReview,tenantId:string,kind:'aprovar'|'rejeitar',fields:Record<string,unknown>,request=receiptRequest){
  if(row.status!=='em_analise')throw Error('Este comprovante já foi analisado. Atualize a lista.');
  if(!tenantId)throw Error('Não foi possível identificar a casa.');
  const reason=String(fields.motivo||'').trim();
  if(kind==='rejeitar'&&(reason.length<3||reason.length>500))throw Error('Informe o motivo da rejeição, entre 3 e 500 caracteres.');
  const payload=kind==='aprovar'?validateReceiptDecision(fields,receiptAmountOnDate(row,String(fields.data_pagamento||'')),receiptNeedsJustification(row),financialToday()):{motivo:reason};
  const result=await request(`/api/v1/financial/comprovantes/${encodeURIComponent(row.id)}/${kind}?tenantId=${encodeURIComponent(tenantId)}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  if(result.success!==true||result.data?.id!==row.id||result.data?.status!==(kind==='aprovar'?'aceito':'rejeitado'))throw Error('O servidor não confirmou a decisão. Atualize a lista antes de tentar novamente.');
  return result.data;
}
