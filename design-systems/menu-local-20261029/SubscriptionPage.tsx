import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, CircleAlert, ReceiptText, RefreshCw } from 'lucide-react';
import { WorkflowEmpty } from './WorkflowUI';
import { SubscriptionPixDialog } from './SubscriptionPixDialog';
import { CancelSubscriptionDialog } from './CancelSubscriptionDialog';
import { DeleteAccountDialog } from './DeleteAccountDialog';
import { centsLabel as money, localDate, localDay } from './completion';
import { friendlyPaymentStatus, type LiveSubscription, type SubscriptionCycle } from './subscription';
import './completion.css';

type Props = {
  state: LiveSubscription;
  userEmail?: string;
  onRefresh: () => Promise<void>;
  onCheckPix: () => Promise<{ paid: boolean; status: string }>;
  onNavigate: (id: string) => void;
  memberCount: number;
};

export default function SubscriptionPage({ state, userEmail, onRefresh, onCheckPix, onNavigate, memberCount }: Props) {
  const [cycle, setCycle] = useState<SubscriptionCycle>(state.cycle);
  const [pixOpen, setPixOpen] = useState(false), [busy, setBusy] = useState<'refresh'|'pix'|null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [error, setError] = useState(''), [feedback, setFeedback] = useState('');
  const working = useRef(false), selected = state.pricing[cycle];
  const cancelled = /^(cancelled|canceled|inactive)$/i.test(state.status);
  const status = !state.active ? cancelled ? 'Assinatura inativa ou cancelada' : 'Acesso não liberado pelo servidor' : state.lifetime ? 'Acesso permanente' : state.trial ? 'Período de teste ativo' : 'Assinatura ativa';

  useEffect(() => { setPixOpen(false); setError(''); setFeedback(''); }, [state.tenantId]);
  useEffect(() => { if (!pixOpen) setCycle(state.cycle); }, [state.cycle, pixOpen]);
  useEffect(() => { const restore = () => { working.current = false; setBusy(null); }; window.addEventListener('pageshow', restore); return () => window.removeEventListener('pageshow', restore); }, []);

  const update = async (checkPix = false) => {
    if (working.current) return;
    working.current = true; setBusy(checkPix ? 'pix' : 'refresh'); setError(''); setFeedback('');
    try {
      const result = checkPix ? await onCheckPix() : null;
      await onRefresh();
      setFeedback(result ? result.paid ? 'Pagamento confirmado. A situação e a validade do plano foram atualizadas.' : `Pagamento ainda não confirmado: ${friendlyPaymentStatus(result.status)}.` : 'Assinatura atualizada com os dados do servidor.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível consultar a assinatura. Tente novamente.'); }
    finally { working.current = false; setBusy(null); }
  };

  return <div className="finish-page subscription-local" aria-busy={!!busy}>
    {feedback && <div className="wf-feedback" role="status"><Check size={17}/><span>{feedback}</span></div>}
    {error && <div className="wf-feedback" role="alert"><CircleAlert size={18}/><span>{error}</span></div>}
    <div className="subscription-ledger">
      <section className="subscription-contract">
        <div><ReceiptText size={25}/><span>Assinatura da casa</span></div><h2>{state.planName}</h2>
        <p>Organização para a rotina da casa,<br/>sem perder de vista as pessoas.</p>
        <dl><div><dt>Situação</dt><dd>{status}</dd></div><div><dt>Ciclo atual</dt><dd>{state.lifetime ? 'Permanente' : state.cycle === 'annual' ? 'Anual' : 'Mensal'}</dd></div><div><dt>Acesso até</dt><dd>{state.lifetime ? 'Sem expiração' : state.until ? localDay(state.until) : 'Data não informada pelo servidor'}</dd></div><div><dt>Renovação</dt><dd>{state.lifetime ? 'Não é necessária' : state.recurring ? 'Renovação automática cadastrada' : 'Pix no próprio painel'}</dd></div></dl>
        <span className="subscription-note">{state.lifetime ? 'Este plano não exige renovação.' : state.recurring ? 'Há uma referência de recorrência no cadastro; ela não comprova futuras cobranças. Para alterar ou cancelar, entre em contato com o suporte.' : 'A liberação do próximo período depende da confirmação do pagamento.'}</span>
        {!state.lifetime && state.until && <span className="subscription-note">A data de acesso segue o horário de Brasília, incluindo todo o dia informado.</span>}
        <button className="subscription-contract-link" disabled={!!busy} onClick={() => void update()}><RefreshCw size={16}/>{busy === 'refresh' ? 'Consultando assinatura…' : 'Atualizar situação'}</button>
      </section>
      <section className="subscription-review">
        <div className="finish-section-head"><div><h2>{state.lifetime ? 'Seu acesso é permanente' : 'Planeje o próximo período'}</h2><p>{state.lifetime ? 'Este plano não exige renovação mensal ou anual.' : 'Valores oficiais do serviço. Escolha o ciclo e gere seu Pix aqui mesmo.'}</p></div></div>
        {!state.lifetime && <>
          <div className="subscription-cycle" role="group" aria-label="Ciclo da renovação"><button disabled={!!busy} aria-pressed={cycle === 'monthly'} onClick={() => setCycle('monthly')}>Mensal</button><button disabled={!!busy} aria-pressed={cycle === 'annual'} onClick={() => setCycle('annual')}>Anual</button></div>
          <div className="subscription-price"><strong>{money(selected.cents)}</strong><span>/{cycle === 'monthly' ? 'mês' : 'ano'}</span></div>
          {cycle === 'annual' && <p className="finish-note">Equivalente a {money(Math.round(selected.cents / 12))} por mês, com pagamento do valor anual por Pix.</p>}
          <p className="finish-note">Após confirmação, o serviço acrescenta {cycle === 'annual' ? '365' : '30'} dias a partir do maior valor entre a validade atual e a data da confirmação.</p>
          {selected.sandbox && <p className="finish-note" role="status">O serviço de pagamento está em homologação. Os pagamentos desse ambiente não têm validade de produção.</p>}
          <ul className="subscription-features">{['Corrente, agenda e comunicação', 'Financeiro, mensalidades e cantina', 'Acervo, memória e estoque da casa'].map(text => <li key={text}><Check size={17}/>{text}</li>)}</ul>
          <button className="wf-button" disabled={!!busy || !(selected.pixAvailable ?? selected.available)} onClick={() => { setError(''); setPixOpen(true); }}>Renovar assinatura<ArrowRight size={17}/></button>
          <p className="finish-note">{(selected.pixAvailable ?? selected.available) ? 'O Pix Copia e Cola e o QR Code aparecem em uma janela nesta página. A renovação é confirmada automaticamente pelo serviço de pagamentos.' : 'O Pix está indisponível no momento. Atualize a situação ou entre em contato com o suporte.'}</p>
        </>}
        <div className="subscription-usage"><span>Corrente da casa</span><strong>{memberCount} membros</strong><button className="finish-link" onClick={() => onNavigate('children')}>Ver corrente<ArrowRight size={15}/></button></div>
      </section>
    </div>
    <section className="subscription-history">
      <div className="finish-section-head"><div><h2>Registros da assinatura</h2><p>Acompanhe a cobrança atual e o último pagamento confirmado da assinatura.</p></div></div>
      {!state.records.length ? <WorkflowEmpty title="Nenhuma cobrança registrada." text={state.trial ? 'O acesso está no período de teste. A renovação pode ser feita por Pix nesta página.' : 'Quando uma cobrança Pix for criada, sua referência aparecerá aqui.'}/> : state.records.map(record => <details className="subscription-invoice subscription-live-record" key={record.id}><summary><ReceiptText size={21}/><span><strong>{record.method}</strong><small>{record.cycle === 'annual' ? 'Renovação anual' : record.cycle === 'monthly' ? 'Renovação mensal' : 'Último pagamento confirmado'}</small></span><span className={`finish-status ${record.confirmed ? 'positive' : 'neutral'}`}>{record.confirmed ? 'Pagamento confirmado' : 'Aguardando confirmação'}</span><span aria-hidden="true">+</span></summary><div><p style={{overflowWrap:'anywhere'}}>Código da cobrança: {record.id.replace(/^pix:/, '')}</p><p>O valor de cobranças anteriores pode ser diferente do preço atual do plano.</p>{state.pixTxid && !record.confirmed && record.id.replace(/^pix:/, '') === state.pixTxid && <button className="wf-button secondary" disabled={!!busy} onClick={() => void update(true)}>{busy === 'pix' ? 'Verificando pagamento…' : 'Verificar pagamento'}</button>}</div></details>)}
      {state.updatedAt && <p className="finish-note">Última atualização do cadastro da assinatura: {localDate(state.updatedAt)}.</p>}
    </section>

    <section style={{ marginTop: 24, padding: 22, borderRadius: 16, border: '1px solid #dfd7ca', background: '#fffcf7' }}>
      <div className="finish-section-head">
        <div>
          <h2>Gerenciamento e Encerramento</h2>
          <p>Opções para encerramento de plano, suspensão de cobranças e exclusão definitiva de acesso e dados.</p>
        </div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 16 }}>
        {!state.lifetime && (
          <button
            type="button"
            className="wf-button secondary"
            style={{ fontSize: 13, borderColor: '#d4c5b3', color: '#854d0e', fontWeight: 700 }}
            onClick={() => setCancelOpen(true)}
          >
            {state.trial ? 'Cancelar teste gratuito' : 'Cancelar assinatura'}
          </button>
        )}
        <button
          type="button"
          className="wf-button secondary"
          style={{ fontSize: 13, borderColor: '#fca5a5', color: '#b91c1c', fontWeight: 700 }}
          onClick={() => setDeleteOpen(true)}
        >
          Excluir acesso e conta permanentemente
        </button>
      </div>
    </section>

    <div className="subscription-help">
      <span>Dúvidas sobre a assinatura ou faturamento? Nossa equipe de suporte está à disposição.</span>
      <button className="finish-link" onClick={() => onNavigate('suporte')}>Conversar com o suporte<ArrowRight size={16}/></button>
    </div>

    {pixOpen && <SubscriptionPixDialog
      open={pixOpen}
      onOpenChange={setPixOpen}
      tenantId={state.tenantId}
      cycle={cycle}
      price={selected}
      recurring={state.recurring}
      onRefresh={onRefresh}
    />}

    <CancelSubscriptionDialog
      open={cancelOpen}
      onOpenChange={setCancelOpen}
      isTrial={Boolean(state.trial)}
      expiresAt={state.until ? localDay(state.until) : null}
      onSuccess={async () => {
        await onRefresh();
      }}
    />

    <DeleteAccountDialog
      open={deleteOpen}
      onOpenChange={setDeleteOpen}
      userEmail={userEmail}
    />
  </div>;
}
