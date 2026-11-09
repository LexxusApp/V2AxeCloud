import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, CircleAlert, Copy, LoaderCircle, RefreshCw, ShieldCheck, Wallet } from 'lucide-react';
import { WorkflowDialog } from './WorkflowUI';
import { centsLabel as money } from './completion';
import { friendlyPaymentStatus, type SubscriptionCycle, type SubscriptionPrice } from './subscription';
import { checkRenewalPixStatus, createSubscriptionRenewalPix, type RenewalPixCharge } from './remote/subscriptionPix';
import './subscription-pix.css';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  cycle: SubscriptionCycle;
  price: SubscriptionPrice;
  recurring: boolean;
  onRefresh: () => Promise<void>;
};
type Phase = 'loading' | 'ready' | 'paid' | 'error' | 'expired';
const isEnded = (value: string) => /expir|cancel|remov|refund|devol/i.test(value);

export function SubscriptionPixDialog({ open, onOpenChange, tenantId, cycle, price, recurring, onRefresh }: Props) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [charge, setCharge] = useState<Extract<RenewalPixCharge, { paid: false }> | null>(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [copied, setCopied] = useState(false);
  const [checking, setChecking] = useState(false);
  const checkingRef = useRef(false);
  const liveRef = useRef(open);
  liveRef.current = open;
  const generationRef = useRef(0);
  // Reuse the in-flight promise across React StrictMode effect replay.
  const creationRef = useRef<{ key: string; promise: Promise<RenewalPixCharge> } | null>(null);

  const generate = useCallback(async (force = false) => {
    if (!tenantId || !(price.pixAvailable ?? price.available)) {
      setPhase('error'); setError('O Pix está indisponível para este período.'); return;
    }
    const generation = ++generationRef.current;
    setPhase('loading'); setCharge(null); setError(''); setStatus(''); setCopied(false);
    const key = tenantId + ':' + cycle;
    if (force || creationRef.current?.key !== key) {
      creationRef.current = { key, promise: createSubscriptionRenewalPix(tenantId, cycle) };
    }
    try {
      const result = await creationRef.current.promise;
      if (!liveRef.current || generation !== generationRef.current) return;
      if (result.paid === true) {
        setPhase('paid');
        try { await onRefresh(); } catch { setError('Pagamento confirmado. Não foi possível atualizar o painel agora; use Atualizar situação.'); }
        return;
      }
      setCharge(result); setStatus(result.status); setPhase(isEnded(result.status) ? 'expired' : 'ready');
    } catch (reason) {
      if (!liveRef.current || generation !== generationRef.current) return;
      creationRef.current = null;
      setError(reason instanceof Error ? reason.message : 'Não foi possível gerar a cobrança Pix.');
      setPhase('error');
    }
  }, [tenantId, cycle, price.pixAvailable, price.available, onRefresh]);

  useEffect(() => {
    if (!open) return;
    void generate();
    return () => { generationRef.current++; };
    // Only a fresh open, tenant or cycle starts a charge. Refreshing subscription
    // data while the modal is open must not generate a second payment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tenantId, cycle]);

  const verify = useCallback(async (manual = false) => {
    if (!charge || checkingRef.current || !liveRef.current) return;
    checkingRef.current = true;
    if (manual) setChecking(true);
    try {
      const result = await checkRenewalPixStatus(tenantId, charge.txid);
      if (!liveRef.current) return;
      setStatus(result.status);
      if (result.paid) {
        setPhase('paid');
        try { await onRefresh(); } catch { setError('Pagamento confirmado. Atualize a situação da assinatura na página.'); }
      } else if (isEnded(result.status)) {
        setPhase('expired');
      } else if (manual) {
        setError('Pagamento ainda não confirmado pela Efí. Você pode consultar novamente.');
      }
    } catch (reason) {
      if (manual && liveRef.current) setError(reason instanceof Error ? reason.message : 'Não foi possível consultar o Pix.');
    } finally { checkingRef.current = false; setChecking(false); }
  }, [charge, tenantId, onRefresh]);

  useEffect(() => {
    if (!open || phase !== 'ready' || !charge) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void verify();
    }, 6000);
    return () => window.clearInterval(timer);
  }, [open, phase, charge?.txid, verify]);

  const copy = async () => {
    if (!charge?.copyPaste) return;
    try {
      await navigator.clipboard.writeText(charge.copyPaste);
      setCopied(true);
    } catch {
      setError('Não foi possível copiar automaticamente. Selecione o código abaixo e copie manualmente.');
    }
  };

  return <WorkflowDialog open={open} onOpenChange={onOpenChange}
    title="Renovar assinatura via Pix"
    description="Tudo acontece aqui, sem sair do AxéCloud. O pagamento é confirmado pelo serviço oficial.">
    <div className="subscription-pix-modal">
      <div className="subscription-pix-summary">
        <span className="subscription-pix-icon"><Wallet size={19}/></span>
        <span><strong>Premium {cycle === 'monthly' ? 'Mensal' : 'Anual'}</strong><small>Renovação por {cycle === 'monthly' ? '30' : '365'} dias</small></span>
        <strong className="subscription-pix-value">{money(price.cents)}</strong>
      </div>
      {price.sandbox && <p className="subscription-pix-warning" role="status">Ambiente de homologação: este Pix não representa um pagamento real.</p>}
      {recurring && <p className="subscription-pix-warning">Esta casa possui uma referência de cobrança recorrente. Um Pix avulso pode resultar em pagamento adicional.</p>}
      {phase === 'loading' && <div className="subscription-pix-loading" role="status"><LoaderCircle className="subscription-pix-spin" size={30}/><strong>Preparando seu Pix seguro…</strong><span>O código é gerado diretamente pela Efí.</span></div>}
      {phase === 'ready' && charge && <>
        <div className="subscription-pix-body">
          {charge.qrCodeDataUrl && <img className="subscription-pix-qr" src={charge.qrCodeDataUrl} width={196} height={196} alt="QR Code Pix desta cobrança de renovação"/>}
          <p>Escaneie o QR Code ou copie o código abaixo no aplicativo do seu banco.</p>
          <label className="subscription-pix-label" htmlFor="subscription-pix-copy">Pix Copia e Cola</label>
          <textarea id="subscription-pix-copy" readOnly value={charge.copyPaste} rows={3} onFocus={event => event.currentTarget.select()}/>
          <button className="wf-button subscription-pix-copy-button" onClick={() => void copy()}><Copy size={17}/>{copied ? 'Código copiado!' : 'Copiar código Pix'}</button>
          <p className="subscription-pix-micro">Cobrança {charge.reused ? 'já existente' : 'gerada'} · Prazo informado pelo provedor: até {Math.max(1,Math.ceil(charge.expiresIn / 3600))}h após a emissão.</p>
        </div>
        <div className="subscription-pix-status" role="status"><span className="subscription-pix-pulse"/><span><strong>Aguardando pagamento</strong><small>{friendlyPaymentStatus(status)}. A confirmação será consultada automaticamente.</small></span></div>
      </>}
      {phase === 'paid' && <div className="subscription-pix-success" role="status"><Check size={33}/><strong>Pagamento confirmado pela Efí!</strong><p>O próximo período foi solicitado ao servidor. Confira a validade atualizada na assinatura.</p></div>}
      {phase === 'expired' && <div className="subscription-pix-info" role="status"><CircleAlert size={24}/><strong>Esta cobrança foi encerrada.</strong><p>Você pode solicitar um novo código Pix para continuar a renovação.</p></div>}
      {phase === 'error' && <div className="subscription-pix-info" role="alert"><CircleAlert size={25}/><strong>Não foi possível gerar o Pix.</strong><p>Confira sua conexão e tente novamente. Uma cobrança anterior pode ser reutilizada pelo servidor.</p></div>}
      {error && <p className="subscription-pix-warning" role="alert">{error}</p>}
      <div className="subscription-pix-actions">
        {(phase === 'ready') && <button className="wf-button secondary" disabled={checking} onClick={() => void verify(true)}><RefreshCw size={15}/>{checking ? 'Consultando…' : 'Já paguei, verificar'}</button>}
        {(phase === 'expired' || phase === 'error') && <button className="wf-button" onClick={() => void generate(true)}><RefreshCw size={15}/>Gerar Pix novamente</button>}
        <button className="wf-button secondary" onClick={() => onOpenChange(false)}>{phase === 'paid' ? 'Concluir' : 'Fechar'}</button>
      </div>
      <p className="subscription-pix-secure"><ShieldCheck size={15}/>O acesso só é renovado após confirmação pelo provedor. Fechar esta janela não cancela o Pix.</p>
    </div>
  </WorkflowDialog>;
}
