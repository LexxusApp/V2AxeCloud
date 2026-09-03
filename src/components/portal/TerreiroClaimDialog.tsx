import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Check,
  CheckCircle2,
  FileCheck2,
  Loader2,
  LockKeyhole,
  ShieldCheck,
  UserRoundCheck,
  X,
} from 'lucide-react';
import { getConversionContext } from '../../lib/trackConversion';
import { rememberDirectoryClaim } from './TerreiroClaimStatusDialog';
import { PLAN_PRICE_STANDARD_LABEL, TRIAL_DAYS } from '../../../lib/planPricing';

type ClaimForm = {
  name: string;
  role: string;
  email: string;
  phone: string;
  evidence: string;
  message: string;
  website: string;
  acceptedTerms: boolean;
};

const EMPTY_FORM: ClaimForm = {
  name: '', role: '', email: '', phone: '', evidence: '', message: '', website: '', acceptedTerms: false,
};

async function submitClaim(slug: string, form: ClaimForm) {
  const response = await fetch(`/api/v1/public/diretorio/terreiro/${encodeURIComponent(slug)}/reivindicar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...form, conversion: getConversionContext() }),
  });
  const text = await response.text();
  let payload: { error?: string; requestId?: string; message?: string } = {};
  try { payload = text ? JSON.parse(text) : {}; } catch { payload = {}; }
  if (response.status === 409 && payload.requestId) return payload;
  if (!response.ok) throw new Error(payload.error || 'Não foi possível enviar a solicitação.');
  return payload;
}

const fieldClass = 'mt-2 w-full rounded-xl border border-[#d8cdbb] bg-[#fffdf8] px-4 py-3.5 text-sm font-semibold text-[#1b1813] outline-none transition placeholder:text-[#1b1813]/32 hover:border-[#bcae96] focus:border-[#c58e08] focus:ring-4 focus:ring-[#e5ae12]/15';

export function TerreiroClaimDialog({ slug, terreiroNome, onTrack }: { slug: string; terreiroNome: string; onTrack?: () => void }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState<ClaimForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape' && !submitting) setOpen(false); };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, submitting]);

  function openDialog() {
    setOpen(true);
    setStep(1);
    setError(null);
    if (requestId) { setForm(EMPTY_FORM); setRequestId(null); }
    onTrack?.();
  }

  function closeDialog() { if (!submitting) setOpen(false); }

  function continueToEvidence() {
    setError(null);
    if (formRef.current?.reportValidity()) setStep(2);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const result = await submitClaim(slug, form);
      setRequestId(result.requestId || 'enviada');
      rememberDirectoryClaim(slug, form.email.trim(), result.requestId);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Não foi possível enviar a solicitação.');
    } finally {
      setSubmitting(false);
    }
  }

  const activeStep = requestId ? 3 : step;
  const progress = [
    { number: '01', title: 'Responsável', note: 'Quem cuida da casa', icon: UserRoundCheck },
    { number: '02', title: 'Vínculo', note: 'Como podemos confirmar', icon: FileCheck2 },
    { number: '03', title: 'Protocolo', note: 'Análise protegida', icon: ShieldCheck },
  ];

  return (
    <>
      <button type="button" onClick={openDialog} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-[#e5ae12] px-6 py-3.5 text-sm font-extrabold text-[#1b1813] shadow-[0_12px_30px_rgba(229,174,18,.18)] transition hover:-translate-y-0.5 hover:bg-[#ffcd38]">
        <BadgeCheck className="h-4 w-4" aria-hidden /> Assumir a gestão deste perfil
      </button>

      {open && typeof document !== 'undefined' ? createPortal((
        <div className="fixed inset-0 z-[200] grid place-items-center overflow-y-auto bg-[#070906]/82 p-0 backdrop-blur-md sm:p-5" role="presentation">
          <button type="button" className="absolute inset-0 cursor-default" aria-label="Fechar formulário" onClick={closeDialog} />
          <section role="dialog" aria-modal="true" aria-labelledby="claim-dialog-title" className="relative my-auto grid min-h-dvh w-full overflow-hidden bg-[#f4eddf] text-[#1b1813] shadow-[0_35px_120px_rgba(0,0,0,.55)] sm:min-h-0 sm:max-w-5xl sm:rounded-[2rem] sm:border sm:border-[#ae9c7c]/45 lg:grid-cols-[19rem_minmax(0,1fr)]">
            <aside className="relative overflow-hidden bg-[#0b110c] px-6 pb-6 pt-7 text-white sm:px-8 sm:py-8 lg:min-h-[42rem]">
              <div className="pointer-events-none absolute inset-0 opacity-35 [background-image:linear-gradient(rgba(229,174,18,.13)_1px,transparent_1px),linear-gradient(90deg,rgba(229,174,18,.13)_1px,transparent_1px)] [background-size:58px_58px]" aria-hidden />
              <div className="pointer-events-none absolute -bottom-40 -left-36 h-96 w-96 rounded-full border border-[#e5ae12]/20" aria-hidden />
              <div className="pointer-events-none absolute -bottom-24 -left-20 h-64 w-64 rounded-full border border-[#e5ae12]/12" aria-hidden />
              <div className="relative flex h-full flex-col">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <img src="/axecloud-trident.png" alt="" className="h-10 w-8 object-contain" />
                    <div><strong className="block text-sm font-extrabold">AxéCloud</strong><small className="block text-[8px] font-bold uppercase tracking-[0.2em] text-[#e5ae12]">Diretório verificado</small></div>
                  </div>
                  <button type="button" onClick={closeDialog} className="rounded-full border border-white/12 p-2.5 text-white/65 transition hover:bg-white/8 hover:text-white lg:hidden" aria-label="Fechar"><X className="h-5 w-5" /></button>
                </div>

                <div className="mt-7 hidden lg:block">
                  <p className="text-[9px] font-extrabold uppercase tracking-[0.22em] text-[#d6aa31]">A casa reconhece quem cuida</p>
                  <h2 className="mt-3 text-3xl font-extrabold leading-[1.02] tracking-[-0.045em]">Sua casa.<br /><span className="text-white/55">Sua voz.</span></h2>
                  <p className="mt-4 text-sm leading-relaxed text-white/52">A reivindicação entra no sistema AxéCloud de gestão de terreiros. {TRIAL_DAYS} dias grátis; depois {PLAN_PRICE_STANDARD_LABEL}.</p>
                </div>

                <ol className="mt-6 grid grid-cols-3 gap-2 lg:mt-10 lg:grid-cols-1 lg:gap-3">
                  {progress.map(({ number, title, note, icon: Icon }, index) => {
                    const itemStep = index + 1;
                    const completed = activeStep > itemStep;
                    const current = activeStep === itemStep;
                    return (
                      <li key={number} className={`flex min-w-0 items-center gap-3 rounded-xl border px-3 py-3 transition lg:px-4 ${current ? 'border-[#e5ae12]/45 bg-[#e5ae12]/10' : completed ? 'border-emerald-400/20 bg-emerald-400/5' : 'border-white/8 bg-white/[.025]'}`}>
                        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${completed ? 'bg-emerald-500 text-[#07110b]' : current ? 'bg-[#e5ae12] text-[#17130a]' : 'border border-white/12 text-white/32'}`}>{completed ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}</span>
                        <span className="min-w-0"><small className="hidden text-[8px] font-extrabold tracking-[0.16em] text-white/32 lg:block">{number}</small><strong className={`block truncate text-[10px] lg:text-sm ${current || completed ? 'text-white' : 'text-white/38'}`}>{title}</strong><small className="hidden text-[10px] text-white/38 lg:block">{note}</small></span>
                      </li>
                    );
                  })}
                </ol>
                <div className="mt-auto hidden items-center gap-2 pt-7 text-[10px] font-semibold text-white/40 lg:flex"><LockKeyhole className="h-3.5 w-3.5 text-[#d6aa31]" />Dados privados durante a análise.</div>
              </div>
            </aside>

            <div className="relative flex min-h-0 flex-col">
              <button type="button" onClick={closeDialog} className="absolute right-6 top-6 z-10 hidden rounded-full border border-[#d4c7b3] bg-[#fffaf1] p-2.5 text-[#1b1813]/55 transition hover:border-[#b99d65] hover:text-[#1b1813] lg:block" aria-label="Fechar"><X className="h-5 w-5" /></button>
              {requestId ? (
                <div className="flex flex-1 items-center justify-center overflow-y-auto px-6 py-12 sm:px-10 lg:px-14">
                  <div className="w-full max-w-xl text-center">
                    <span className="mx-auto grid h-20 w-20 place-items-center rounded-full border border-emerald-700/20 bg-emerald-700/10 text-emerald-700"><CheckCircle2 className="h-10 w-10" aria-hidden /></span>
                    <p className="mt-7 text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#8d6300]">Solicitação protegida</p>
                    <h2 id="claim-dialog-title" className="mt-2 text-3xl font-extrabold tracking-[-0.045em] sm:text-4xl">A casa está em análise.</h2>
                    <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-[#1b1813]/62">A equipe do AxéCloud vai confirmar as informações. Você pode acompanhar cada etapa pelo mesmo e-mail informado.</p>
                    {requestId !== 'enviada' ? <div className="mx-auto mt-7 max-w-sm rounded-2xl border border-[#cdbfaa] bg-[#fffaf1] px-5 py-4"><small className="block text-[9px] font-extrabold uppercase tracking-[0.18em] text-[#1b1813]/42">Seu protocolo</small><strong className="mt-1 block font-mono text-lg tracking-[0.16em] text-[#8a6200]">{requestId.slice(0, 8).toUpperCase()}</strong></div> : null}
                    <button type="button" onClick={closeDialog} className="mt-8 inline-flex items-center justify-center gap-2 rounded-full bg-[#142119] px-7 py-3.5 text-sm font-extrabold text-white transition hover:bg-[#26372c]">Concluir<Check className="h-4 w-4 text-[#e5ae12]" /></button>
                  </div>
                </div>
              ) : (
                <form ref={formRef} onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
                  <header className="border-b border-[#d6c9b5]/70 px-6 py-6 sm:px-9 lg:px-12 lg:pb-7 lg:pt-10">
                    <p className="text-[9px] font-extrabold uppercase tracking-[0.22em] text-[#986a00]">Etapa {step} de 2 · verificação de responsável</p>
                    <h2 id="claim-dialog-title" className="mt-2 max-w-[22ch] text-2xl font-extrabold leading-tight tracking-[-0.04em] sm:text-3xl">{step === 1 ? 'Quem responde por esta casa?' : 'Como confirmamos o vínculo?'}</h2>
                    <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#1b1813]/55">{step === 1 ? <>Perfil: <strong className="text-[#1b1813]/78">{terreiroNome}</strong></> : 'Uma referência pública ou descrição do documento já ajuda nossa equipe a verificar.'}</p>
                  </header>

                  <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 sm:px-9 lg:px-12 lg:py-8">
                    {step === 1 ? (
                      <div className="grid gap-x-5 gap-y-5 sm:grid-cols-2">
                        <label className="text-xs font-extrabold">Nome completo<input required minLength={3} maxLength={120} autoComplete="name" placeholder="Nome de quem representa a casa" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className={fieldClass} /></label>
                        <label className="text-xs font-extrabold">Função na casa<input required minLength={2} maxLength={120} placeholder="Ex.: dirigente, secretário(a)" value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })} className={fieldClass} /></label>
                        <label className="text-xs font-extrabold">E-mail<input required type="email" maxLength={180} autoComplete="email" placeholder="voce@exemplo.com" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className={fieldClass} /></label>
                        <label className="text-xs font-extrabold">WhatsApp com DDD<input required type="tel" minLength={10} maxLength={20} autoComplete="tel" placeholder="(11) 99999-9999" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} className={fieldClass} /></label>
                        <div className="flex items-start gap-3 rounded-2xl border border-[#cdbfaa]/75 bg-[#e9dfcd]/55 px-4 py-3.5 text-xs leading-relaxed text-[#1b1813]/58 sm:col-span-2"><LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-[#8a6200]" /><span>Seus contatos servem apenas para confirmar a responsabilidade pelo perfil.</span></div>
                      </div>
                    ) : (
                      <div>
                        <label className="block text-xs font-extrabold">Comprovação de vínculo<textarea required minLength={8} maxLength={1000} rows={4} placeholder="Informe o perfil oficial da casa, site, rede social ou descreva o documento que comprova seu vínculo." value={form.evidence} onChange={(event) => setForm({ ...form, evidence: event.target.value })} className={fieldClass} /></label>
                        <label className="mt-5 block text-xs font-extrabold">Informação complementar <span className="font-medium text-[#1b1813]/38">(opcional)</span><textarea maxLength={1500} rows={3} placeholder="Conte algo que ajude nossa equipe na verificação." value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} className={fieldClass} /></label>
                        <label className="sr-only" aria-hidden="true">Website<input tabIndex={-1} autoComplete="off" value={form.website} onChange={(event) => setForm({ ...form, website: event.target.value })} /></label>
                        <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-2xl border border-[#d3c5b0] bg-[#fffaf1] px-4 py-4 text-sm font-semibold leading-relaxed text-[#1b1813]/68"><input required type="checkbox" checked={form.acceptedTerms} onChange={(event) => setForm({ ...form, acceptedTerms: event.target.checked })} className="mt-1 h-4 w-4 shrink-0 accent-[#a87400]" />Confirmo que sou responsável ou autorizado pela casa e que as informações enviadas são verdadeiras.</label>
                      </div>
                    )}
                    {error ? <p className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700" role="alert">{error}</p> : null}
                  </div>

                  <footer className="flex flex-col-reverse gap-3 border-t border-[#d6c9b5]/70 bg-[#eee5d5] px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-9 lg:px-12">
                    {step === 2 ? <button type="button" disabled={submitting} onClick={() => { setError(null); setStep(1); }} className="inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-extrabold text-[#1b1813]/58 transition hover:bg-black/5 disabled:opacity-50"><ArrowLeft className="h-4 w-4" />Voltar</button> : <span className="hidden text-[10px] font-semibold text-[#1b1813]/38 sm:block">Leva menos de 2 minutos.</span>}
                    {step === 1 ? <button type="button" onClick={continueToEvidence} className="inline-flex items-center justify-center gap-2 rounded-full bg-[#142119] px-7 py-3.5 text-sm font-extrabold text-white shadow-[0_12px_28px_rgba(20,33,25,.16)] transition hover:bg-[#26372c]">Continuar<ArrowRight className="h-4 w-4 text-[#e5ae12]" /></button> : <button type="submit" disabled={submitting} className="inline-flex items-center justify-center gap-2 rounded-full bg-[#e5ae12] px-7 py-3.5 text-sm font-extrabold text-[#1b1813] shadow-[0_12px_28px_rgba(229,174,18,.18)] transition hover:bg-[#ffcd38] disabled:opacity-60">{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <BadgeCheck className="h-4 w-4" />}{submitting ? 'Enviando…' : 'Enviar para verificação'}</button>}
                  </footer>
                </form>
              )}
            </div>
          </section>
        </div>
      ), document.body) : null}
    </>
  );
}
