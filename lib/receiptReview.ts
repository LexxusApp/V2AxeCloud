export type ReceiptStatus = 'em_analise' | 'aceito' | 'rejeitado' | 'encerrado';
export type ReceiptAnalysis = {
  valor?: number | null; data?: string | null; cpf_pagador?: string | null;
  beneficiario?: string | null; id_transacao?: string | null;
  estado_pagamento?: 'concluido' | 'agendado' | 'cancelado' | 'indeterminado';
};
export type ReceiptReview = {
  id: string; financeiro_id: string; filho_id: string; nome?: string;
  status: ReceiptStatus; created_at: string; decided_at: string | null; decision_reason: string | null;
  analysis_status: 'pendente' | 'concluida' | 'indisponivel'; analysis: ReceiptAnalysis; alerts: string[];
  submitted_value: number; valor_atual?: number; competencia?: string; approved_fields?: Record<string, unknown> | null;
  legacy?: boolean;
};
export const receiptStatusLabel: Record<ReceiptStatus,string> = {
  em_analise:'Aguardando análise do zelador',aceito:'Pagamento confirmado',rejeitado:'Comprovante rejeitado',encerrado:'Mensalidade encerrada por outra via',
};
export function receiptMoneyCents(value: unknown): number {
  const text=String(value??'').trim().replace(',','.');
  if(!/^\d+(\.\d{1,2})?$/.test(text))throw Error('Informe um valor válido, com até duas casas decimais.');
  const number=Number(text),cents=Math.round(number*100);
  if(!Number.isSafeInteger(cents)||cents<=0||cents>999999999999)throw Error('Informe um valor válido.');
  return cents;
}
export function validateReceiptDecision(body: Record<string,unknown>, dueValue: unknown, needsReason: boolean, today: string) {
  const cents=receiptMoneyCents(body.valor);
  if(cents!==receiptMoneyCents(dueValue))throw Error('O valor recebido deve corresponder ao total integral da mensalidade.');
  const date=String(body.data_pagamento||'');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date||date>today)throw Error('Informe a data efetiva do pagamento, sem data futura.');
  const transaction=String(body.id_transacao||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
  const name=String(body.beneficiario||'').trim(),reason=String(body.motivo||'').trim();
  if(transaction.length<10||transaction.length>128||name.length<2||name.length>200)throw Error('Complete o identificador bancário e o beneficiário conferidos.');
  if(body.confirmo_recebimento!==true)throw Error('Confirme o recebimento na conta do terreiro.');
  if(reason.length>500||(needsReason&&reason.length<3))throw Error('Justifique a confirmação dos alertas ou da leitura indisponível.');
  return {valor:cents/100,data_pagamento:date,id_transacao:transaction,beneficiario:name,motivo:reason,confirmo_recebimento:true};
}
