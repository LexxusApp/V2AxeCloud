import React,{useEffect,useRef,useState} from 'react';
import {AlertCircle,CheckCircle2,Clock3,FileImage,Loader2,X} from 'lucide-react';
import BodyPortal from '../BodyPortal';
import {receiptStatusLabel,validateReceiptDecision,type ReceiptReview} from '../../../lib/receiptReview';
import {receiptRequest,signalReceiptUpdate,type ReceiptFeed} from '../../lib/receiptReviewClient';
import {showHouseToast} from '../../lib/houseToast';
const input='w-full rounded-xl border border-[#C8C0AF] bg-white px-3 py-2.5 text-sm text-[#17251D] focus:outline-none focus:ring-2 focus:ring-amber-500';
const action='inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#C8C0AF] px-4 py-2 text-sm font-bold text-[#17251D] disabled:opacity-50';
const money=(v:unknown)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0);
const dateTime=(s:string)=>new Date(s).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'short'});
function ReceiptDialog({row,tenantId,admin,onClose,onChanged}:{row:ReceiptReview;tenantId:string;admin:boolean;onClose:()=>void;onChanged:()=>void}){
  const dialog=useRef<HTMLDialogElement>(null);const [image,setImage]=useState(''),[imageError,setImageError]=useState(''),[error,setError]=useState(''),[saving,setSaving]=useState(false);
  const [fields,setFields]=useState({valor:row.analysis.valor==null?'':String(row.analysis.valor),data_pagamento:String(row.analysis.data||'').slice(0,10),beneficiario:row.analysis.beneficiario||'',id_transacao:row.analysis.id_transacao||'',motivo:'',confirmo_recebimento:false});
  const editable=admin&&row.status==='em_analise';
  useEffect(()=>{dialog.current?.showModal();return()=>dialog.current?.close();},[]);
  useEffect(()=>{if(row.legacy)return;let alive=true;void receiptRequest(`/api/v1/financial/comprovantes/${row.id}/arquivo?tenantId=${encodeURIComponent(tenantId)}`).then(body=>{if(!/^https?:\/\//.test(body.url))throw Error('Endereço do arquivo inválido.');if(alive)setImage(body.url);}).catch(e=>{if(alive)setImageError(e.message);});return()=>{alive=false;};},[row.id,tenantId,row.legacy]);
  async function decide(kind:'aprovar'|'rejeitar'){
    if(saving)return;setError('');
    try{
      const payload=kind==='aprovar'?validateReceiptDecision(fields,row.valor_atual??row.submitted_value,row.alerts.length>0||row.analysis_status!=='concluida',new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())):{motivo:fields.motivo.trim()};
      if(kind==='rejeitar'&&fields.motivo.trim().length<3)throw Error('Informe o motivo da rejeição.');
      setSaving(true);await receiptRequest(`/api/v1/financial/comprovantes/${row.id}/${kind}?tenantId=${encodeURIComponent(tenantId)}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      showHouseToast(kind==='aprovar'?'Recebimento confirmado e mensalidade quitada.':'Comprovante rejeitado. O motivo já está disponível ao membro.');signalReceiptUpdate();onChanged();onClose();
    }catch(e){setError(e instanceof Error?e.message:'Não foi possível registrar a decisão.');}finally{setSaving(false);}
  }
  return <BodyPortal><dialog ref={dialog} onCancel={event=>{event.preventDefault();if(!saving)onClose();}} className="fixed inset-0 m-auto max-h-[92dvh] w-[min(94vw,70rem)] overflow-auto rounded-2xl bg-[#FFFCF6] p-0 text-[#17251D] shadow-2xl backdrop:bg-black/65">
    <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[#E6DECF] bg-[#FFFCF6] p-5"><div><h2 className="text-xl font-extrabold">{editable?'Conferir comprovante':'Comprovante da mensalidade'}</h2><p className="mt-1 text-sm text-[#5F675C]">{row.nome} · {receiptStatusLabel[row.status]}</p></div><button autoFocus type="button" disabled={saving} onClick={onClose} className={action+' shrink-0'} aria-label="Fechar comprovante"><X size={18}/></button></header>
    <div className="grid gap-6 p-5 lg:grid-cols-2">
      <section aria-label="Imagem do comprovante" className="min-w-0">
        {row.legacy?<p className="rounded-xl border border-[#E6DECF] p-5 text-sm">A imagem não está disponível neste comprovante antigo.</p>:imageError?<p role="alert" className="text-sm text-red-800">{imageError} Feche e abra novamente para tentar carregar.</p>:image?<><img src={image} alt="Comprovante enviado pelo membro" className="max-h-[65dvh] w-full rounded-xl border border-[#E6DECF] object-contain"/><a href={image} target="_blank" rel="noopener noreferrer" className={action+' mt-3'}>Abrir imagem em outra aba</a></>:<p role="status" className="flex items-center gap-2 p-5 text-sm"><Loader2 className="h-4 w-4 animate-spin"/>Carregando imagem privada…</p>}
        <p className="mt-3 text-xs text-[#5F675C]">Enviado em {dateTime(row.created_at)} · Brasília</p>
      </section>
      <section className="min-w-0 space-y-4" aria-label="Conferência do recebimento">
        <div className="rounded-xl border border-[#D8D0BE] bg-[#F4F0E6] p-4"><p className="text-sm">Total integral da mensalidade</p><strong className="text-2xl">{money(row.valor_atual??row.submitted_value)}</strong><p className="mt-1 text-xs text-[#5F675C]">Competência: {row.competencia?new Date(row.competencia+'T12:00:00').toLocaleDateString('pt-BR',{month:'long',year:'numeric'}):'Cadastro financeiro'}</p></div>
        {row.alerts.length>0&&<div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"><h3 className="mb-2 flex items-center gap-2 font-bold"><AlertCircle size={17}/>Pontos para conferir</h3><ul className="list-disc space-y-1 pl-5">{row.alerts.map(message=><li key={message}>{message}</li>)}</ul></div>}
        {row.analysis_status!=='concluida'&&<p className="text-sm text-[#5F675C]">A leitura da IA está {row.analysis_status==='pendente'?'pendente':'indisponível'}. A imagem continua disponível para conferência manual.</p>}
        {editable?<>
          <p className="text-sm text-[#5F675C]">Confira o crédito na conta do terreiro. A IA apenas sugere os dados abaixo; você pode corrigir a leitura.</p>
          <div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1 text-sm font-semibold">Valor recebido (R$)<input className={input} inputMode="decimal" value={fields.valor} onChange={e=>setFields({...fields,valor:e.target.value})}/></label><label className="space-y-1 text-sm font-semibold">Data efetiva do pagamento<input className={input} type="date" value={fields.data_pagamento} onChange={e=>setFields({...fields,data_pagamento:e.target.value})}/></label></div>
          <label className="block space-y-1 text-sm font-semibold">Beneficiário conferido<input className={input} maxLength={200} value={fields.beneficiario} onChange={e=>setFields({...fields,beneficiario:e.target.value})}/></label>
          <label className="block space-y-1 text-sm font-semibold">Identificador bancário / E2E<input className={input} maxLength={128} value={fields.id_transacao} onChange={e=>setFields({...fields,id_transacao:e.target.value})}/></label>
          <label className="block space-y-1 text-sm font-semibold">Motivo / justificativa<textarea className={input} rows={3} maxLength={500} value={fields.motivo} onChange={e=>setFields({...fields,motivo:e.target.value})}/><span className="block text-xs font-normal text-[#5F675C]">Obrigatório para rejeitar ou confirmar quando houver alertas ou leitura indisponível.</span></label>
          <label className="flex min-h-11 items-start gap-3 rounded-xl border border-[#C8C0AF] p-3 text-sm"><input type="checkbox" className="mt-1 h-5 w-5 shrink-0 accent-[#175B43]" checked={fields.confirmo_recebimento} onChange={e=>setFields({...fields,confirmo_recebimento:e.target.checked})}/><span>Conferi e confirmo o recebimento do valor integral na conta do terreiro.</span></label>
          {error&&<p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-900">{error}</p>}
          <div className="flex flex-wrap gap-3"><button type="button" disabled={saving||!fields.confirmo_recebimento} onClick={()=>void decide('aprovar')} className={action+' flex-1 border-[#175B43] bg-[#175B43] text-white'}>{saving?<Loader2 className="h-4 w-4 animate-spin"/>:<CheckCircle2 size={18}/>}Confirmar recebimento</button><button type="button" disabled={saving} onClick={()=>void decide('rejeitar')} className={action+' bg-white text-red-800'}>Rejeitar</button></div>
        </>:<div className="space-y-2 text-sm"><p>{receiptStatusLabel[row.status]}</p>{row.decided_at&&<p>Decisão em {dateTime(row.decided_at)} · Brasília</p>}{row.decision_reason&&<p className="whitespace-pre-wrap break-words">Motivo: {row.decision_reason}</p>}{row.approved_fields&&<p>Recebido: {money(row.approved_fields.valor)} · Data: {String(row.approved_fields.data_pagamento||'')}</p>}</div>}
      </section>
    </div>
  </dialog></BodyPortal>;
}
export default function ReceiptReviewPanel({feed,tenantId,admin=true}:{feed:ReceiptFeed;tenantId:string;admin?:boolean}){
  const [selected,setSelected]=useState<ReceiptReview|null>(null);
  useEffect(()=>setSelected(null),[tenantId]);
  return <section className="space-y-4" aria-label={admin?'Revisão de comprovantes':'Seus comprovantes'}>
    <header className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-extrabold text-[#17251D]">{admin?'Comprovantes para conferir':'Seus comprovantes'}</h2><p className="mt-1 text-sm text-[#5F675C]">{admin?'A baixa só acontece após sua confirmação.':'Acompanhe a análise e a decisão do zelador.'}</p></div><label className="text-sm text-[#17251D]">Mostrar <select className={input+' ml-1 inline-block !w-auto'} value={feed.filter} onChange={e=>feed.setFilter(e.target.value)}><option value="em_analise">Em análise</option><option value="aceito">Confirmados</option><option value="rejeitado">Rejeitados</option><option value="encerrado">Encerrados</option><option value="todos">Todos</option></select></label></header>
    {feed.error&&<p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">{feed.error} <button className="min-h-11 underline" onClick={()=>void feed.refresh()}>Tentar novamente</button></p>}
    {feed.loading&&feed.rows.length===0?<p role="status" className="py-8 text-sm text-[#5F675C]">Carregando comprovantes…</p>:feed.rows.length===0&&!feed.error?<p className="rounded-xl border border-[#E6DECF] bg-[#FAF8F2] p-6 text-sm text-[#5F675C]">Nenhum comprovante neste filtro.</p>:null}
    <div className="space-y-3">{feed.rows.map(row=><article key={row.id} className="flex min-w-0 flex-col gap-3 rounded-xl border border-[#DDD5C5] bg-white p-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0 space-y-1"><div className="flex flex-wrap items-center gap-2"><strong className="break-words text-[#17251D]">{row.nome||'Seu comprovante'}</strong><span className="rounded-md bg-[#F4F0E6] px-2 py-1 text-xs font-bold text-[#425345]">{receiptStatusLabel[row.status]}</span></div><p className="text-sm text-[#5F675C]">{money(row.submitted_value)} · {dateTime(row.created_at)}</p>{row.status==='em_analise'&&<p className="flex items-center gap-1 text-xs text-[#5F675C]"><Clock3 size={14}/>Lembretes desta mensalidade pausados</p>}{row.decision_reason&&<p className="break-words text-sm text-[#5F675C]">{row.decision_reason}</p>}<p className="text-xs text-[#5F675C]">Protocolo {row.id.slice(0,8).toUpperCase()}</p></div><button type="button" className={action+' shrink-0 bg-[#F4F0E6]'} onClick={()=>setSelected(row)}><FileImage size={17}/>{admin&&row.status==='em_analise'?'Conferir':'Ver comprovante'}</button></article>)}</div>
    {feed.cursor&&<button type="button" className={action} disabled={feed.loading} onClick={()=>void feed.loadMore()}>Carregar mais</button>}
    {selected&&<ReceiptDialog key={selected.id} row={selected} tenantId={tenantId} admin={admin} onClose={()=>setSelected(null)} onChanged={()=>void feed.refresh()}/>}
  </section>;
}
