import {useEffect,useRef,useState} from 'react';
import {Check,FileImage,RefreshCw} from 'lucide-react';
import {receiptAmountOnDate,receiptStatusLabel,type ReceiptReview} from '../../lib/receiptReview';
import {receiptRequest,signalReceiptUpdate,type ReceiptFeed} from '../../src/lib/receiptReviewClient';
import PageLoading from '../shared/PageLoading';
import {financialMoney} from './finance';
import {financialToday} from './billing';
import {WorkflowDialog,WorkflowEmpty} from './WorkflowUI';
import {decideReceipt} from './receiptActions';
import './receipt-reviews.css';

const stamp=(date:string)=>new Date(date).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'short'});
const money=(value:unknown)=>financialMoney(Math.round(Number(value||0)*100));
function ReceiptDecision({row,tenantId,onClose,onConfirmed}:{row:ReceiptReview;tenantId:string;onClose:()=>void;onConfirmed:()=>void}){
  const [image,setImage]=useState(''),[imageError,setImageError]=useState(''),[imageRetry,setImageRetry]=useState(0),[error,setError]=useState(''),[saving,setSaving]=useState<'aprovar'|'rejeitar'|null>(null),lock=useRef(false);
  const [fields,setFields]=useState({valor:row.analysis.valor==null?'':String(row.analysis.valor),data_pagamento:String(row.analysis.data||'').slice(0,10),beneficiario:row.analysis.beneficiario||'',id_transacao:row.analysis.id_transacao||'',motivo:'',confirmo_recebimento:false});
  const editable=row.status==='em_analise';
  useEffect(()=>{let alive=true;setImage('');setImageError('');if(!row.legacy)void receiptRequest(`/api/v1/financial/comprovantes/${encodeURIComponent(row.id)}/arquivo?tenantId=${encodeURIComponent(tenantId)}`).then(body=>{if(!/^https:\/\//.test(body.url))throw Error('Endereço do comprovante inválido.');if(alive)setImage(body.url);}).catch(reason=>{if(alive)setImageError(reason instanceof Error?reason.message:'Não foi possível carregar o comprovante.');});return()=>{alive=false;};},[row.id,tenantId,row.legacy,imageRetry]);
  async function decide(kind:'aprovar'|'rejeitar'){
    if(lock.current)return;lock.current=true;setSaving(kind);setError('');
    try{await decideReceipt(row,tenantId,kind,fields);signalReceiptUpdate();onConfirmed();onClose();}
    catch(reason){setError(reason instanceof Error?reason.message:'Não foi possível confirmar a decisão.');}
    finally{lock.current=false;setSaving(null);}
  }
  return <WorkflowDialog open onOpenChange={open=>{if(!open&&!lock.current)onClose();}} title={editable?'Conferir comprovante':'Comprovante da mensalidade'} description={`${row.nome||'Membro'} · ${receiptStatusLabel[row.status]}`}>
    <div className="rr-document">{row.legacy?<p>A imagem não está disponível neste comprovante antigo.</p>:imageError?<p className="wf-error" role="alert">{imageError} <button type="button" onClick={()=>setImageRetry(value=>value+1)}>Tentar novamente</button></p>:!image?<PageLoading variant="inline" label="Carregando comprovante privado…"/>:<><img src={image} alt={`Comprovante de ${row.nome||'mensalidade'}`} onError={()=>setImageError('Não foi possível abrir a imagem.')}/><a className="wf-button secondary" href={image} target="_blank" rel="noopener noreferrer">Abrir imagem</a></>}</div>
    <p className="rr-meta">Enviado em {stamp(row.created_at)} · Brasília</p><div className="wf-confirm-summary"><span>Total integral da mensalidade</span><strong>{money(receiptAmountOnDate(row,fields.data_pagamento))}</strong></div>
    {!!row.alerts.length&&<div className="rr-alerts"><strong>Confira antes de decidir</strong><ul>{row.alerts.map(message=><li key={message}>{message}</li>)}</ul></div>}
    {editable?<form className="rr-fields" onSubmit={event=>{event.preventDefault();void decide('aprovar');}} noValidate><p>A IA sugere os dados. Confira o crédito na conta da casa antes de confirmar o recebimento.</p>{row.analysis_status!=='concluida'&&<p>A leitura da IA está {row.analysis_status==='pendente'?'pendente':'indisponível'}. Confira a imagem manualmente.</p>}
      <fieldset disabled={!!saving}><div className="wf-pair"><label className="wf-field">Valor recebido (R$)<input inputMode="decimal" value={fields.valor} onChange={event=>setFields({...fields,valor:event.target.value})}/></label><label className="wf-field">Data efetiva do pagamento<input type="date" max={financialToday()} value={fields.data_pagamento} onChange={event=>setFields({...fields,data_pagamento:event.target.value})}/></label></div>
      <label className="wf-field">Beneficiário conferido<input maxLength={200} value={fields.beneficiario} onChange={event=>setFields({...fields,beneficiario:event.target.value})}/></label><label className="wf-field">Identificador bancário / E2E<input maxLength={128} value={fields.id_transacao} onChange={event=>setFields({...fields,id_transacao:event.target.value})}/></label>
      <label className="wf-field">Motivo / justificativa<textarea rows={3} maxLength={500} value={fields.motivo} onChange={event=>setFields({...fields,motivo:event.target.value})}/><small>Obrigatório para rejeitar ou confirmar quando houver alertas ou leitura indisponível.</small></label>
      <label className="rr-confirm"><input type="checkbox" checked={fields.confirmo_recebimento} onChange={event=>setFields({...fields,confirmo_recebimento:event.target.checked})}/>Conferi e confirmo o recebimento do valor integral na conta da casa.</label></fieldset>
      {error&&<p className="wf-error" role="alert">{error}</p>}<div className="wf-confirm-actions"><button className="wf-button secondary" type="button" disabled={!!saving} onClick={()=>void decide('rejeitar')}>{saving==='rejeitar'?'Rejeitando…':'Rejeitar comprovante'}</button><button className="wf-button" type="submit" disabled={!!saving||!fields.confirmo_recebimento}><Check size={16}/>{saving==='aprovar'?'Confirmando…':'Confirmar recebimento'}</button></div>
    </form>:<div className="rr-fields"><p>{receiptStatusLabel[row.status]}</p>{row.decided_at&&<p>Decisão em {stamp(row.decided_at)} · Brasília</p>}{row.decision_reason&&<p>Motivo: {row.decision_reason}</p>}{row.approved_fields&&<p>Recebido: {money(row.approved_fields.valor)} · Data: {String(row.approved_fields.data_pagamento||'').split('-').reverse().join('/')}</p>}</div>}
  </WorkflowDialog>;
}
export default function ReceiptReviews({feed,tenantId,onConfirmed}:{feed:ReceiptFeed;tenantId:string;onConfirmed:()=>void}){
  const [selected,setSelected]=useState<ReceiptReview|null>(null),[feedback,setFeedback]=useState('');
  useEffect(()=>{setSelected(null);setFeedback('');},[tenantId]);
  // Polling may bring another operator's decision while this dialog is open.
  const current=selected?(feed.rows.find(row=>row.id===selected.id)||((feed.loading||feed.error)?selected:null)):null;
  useEffect(()=>{
    if(selected&&!feed.loading&&!feed.error&&!feed.rows.some(row=>row.id===selected.id))setSelected(null);
  },[selected,feed.rows,feed.loading,feed.error]);
  return <section className="mp-list rr-panel" id="receipt-reviews" tabIndex={-1} aria-label="Revisão de comprovantes"><header className="mp-list-heading"><div><h2>Comprovantes para conferir</h2><p>{feed.pendingCount} aguardando análise. A baixa depende da sua confirmação.</p></div><button className="wf-button secondary" disabled={feed.loading} onClick={()=>void feed.refresh()}><RefreshCw size={16}/>Atualizar</button></header>
    {feedback&&<p className="wf-feedback" role="status">{feedback}</p>}<label className="wf-field">Mostrar<select value={feed.filter} onChange={event=>feed.setFilter(event.target.value)}><option value="em_analise">Em análise</option><option value="aceito">Confirmados</option><option value="rejeitado">Rejeitados</option><option value="encerrado">Encerrados</option><option value="todos">Todos</option></select></label>
    {feed.error&&<p className="wf-error" role="alert">{feed.error} <button type="button" onClick={()=>void feed.refresh()}>Tentar novamente</button></p>}{feed.loading&&!feed.rows.length?<PageLoading variant="inline" label="Carregando comprovantes…"/>:!feed.rows.length&&!feed.error?<WorkflowEmpty title="Nenhum comprovante neste filtro." text="Os comprovantes enviados pelos membros aparecem aqui para conferência."/>:null}
    {feed.rows.map(row=><article className="rr-row" key={row.id}><div><strong>{row.nome||'Membro'}</strong><p>{money(row.submitted_value)} · {stamp(row.created_at)}</p><small>{receiptStatusLabel[row.status]}</small>{row.decision_reason&&<p>Motivo: {row.decision_reason}</p>}</div><button className="wf-button secondary" onClick={()=>setSelected(row)}><FileImage size={16}/>{row.status==='em_analise'?'Conferir':'Ver comprovante'}</button></article>)}
    {feed.cursor&&<button className="wf-button secondary" disabled={feed.loading} onClick={()=>void feed.loadMore()}>{feed.loading?'Carregando…':'Carregar mais'}</button>}
    {current&&<ReceiptDecision key={`${tenantId}:${current.id}`} row={current} tenantId={tenantId} onClose={()=>setSelected(null)} onConfirmed={()=>{setFeedback('Decisão confirmada. O histórico do membro foi atualizado.');void feed.refresh();onConfirmed();}}/>}
  </section>;
}
