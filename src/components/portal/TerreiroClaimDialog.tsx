import { useEffect, useState, type FormEvent } from 'react';
import { BadgeCheck, CheckCircle2, Loader2, X } from 'lucide-react';

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
  name: '',
  role: '',
  email: '',
  phone: '',
  evidence: '',
  message: '',
  website: '',
  acceptedTerms: false,
};

async function submitClaim(slug: string, form: ClaimForm) {
  const response = await fetch(
    `/api/v1/public/diretorio/terreiro/${encodeURIComponent(slug)}/reivindicar`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    },
  );
  const text = await response.text();
  let payload: { error?: string; requestId?: string; message?: string } = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = {};
  }
  if (!response.ok) throw new Error(payload.error || 'Não foi possível enviar a solicitação.');
  return payload;
}

export function TerreiroClaimDialog({
  slug,
  terreiroNome,
  onTrack,
}: {
  slug: string;
  terreiroNome: string;
  onTrack?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ClaimForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submitting) setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, submitting]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const result = await submitClaim(slug, form);
      setRequestId(result.requestId || 'enviada');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Não foi possível enviar a solicitação.');
    } finally {
      setSubmitting(false);
    }
  }

  const fieldClass =
    'mt-1.5 w-full rounded-xl border border-[#d8cdbb] bg-white px-3.5 py-3 text-sm font-semibold text-[#1b1813] outline-none transition placeholder:text-[#1b1813]/35 focus:border-[#e5ae12] focus:ring-4 focus:ring-[#e5ae12]/15';

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          onTrack?.();
        }}
        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-[#e5ae12] px-6 py-3.5 text-sm font-extrabold text-[#1b1813] transition hover:bg-[#ffcd38]"
      >
        <BadgeCheck className="h-4 w-4" aria-hidden />
        Reivindicar esta casa
      </button>

      {open ? (
        <div className="fixed inset-0 z-[200] grid place-items-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm" role="presentation">
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Fechar formulário"
            onClick={() => !submitting && setOpen(false)}
          />
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="claim-dialog-title"
            className="relative my-6 w-full max-w-2xl overflow-hidden rounded-[1.5rem] border border-[#d8cdbb] bg-[#fffaf1] text-[#1b1813] shadow-2xl"
          >
            <header className="flex items-start justify-between gap-4 border-b border-[#d8cdbb]/70 px-5 py-5 sm:px-7">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#9b6a00]">Verificação de responsável</p>
                <h2 id="claim-dialog-title" className="mt-1 text-xl font-extrabold sm:text-2xl">Reivindicar {terreiroNome}</h2>
                <p className="mt-2 text-sm leading-relaxed text-[#1b1813]/60">Envie seus dados para a equipe do AxéCloud confirmar seu vínculo com a casa.</p>
              </div>
              <button type="button" onClick={() => !submitting && setOpen(false)} className="rounded-full p-2 text-[#1b1813]/55 transition hover:bg-black/5" aria-label="Fechar">
                <X className="h-5 w-5" />
              </button>
            </header>

            {requestId ? (
              <div className="px-6 py-12 text-center sm:px-10">
                <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" aria-hidden />
                <h3 className="mt-4 text-xl font-extrabold">Solicitação recebida</h3>
                <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[#1b1813]/65">Nossa equipe vai analisar as informações. Você receberá o retorno pelos contatos informados.</p>
                {requestId !== 'enviada' ? <p className="mt-4 text-xs font-semibold text-[#1b1813]/45">Protocolo: {requestId.slice(0, 8).toUpperCase()}</p> : null}
                <button type="button" onClick={() => setOpen(false)} className="mt-7 rounded-full bg-[#1b1813] px-6 py-3 text-sm font-extrabold text-white">Concluir</button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="max-h-[calc(100dvh-10rem)] overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="text-xs font-extrabold">Nome completo
                    <input required minLength={3} maxLength={120} autoComplete="name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className={fieldClass} />
                  </label>
                  <label className="text-xs font-extrabold">Função na casa
                    <input required maxLength={120} placeholder="Ex.: dirigente, secretário(a)" value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })} className={fieldClass} />
                  </label>
                  <label className="text-xs font-extrabold">E-mail
                    <input required type="email" maxLength={180} autoComplete="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className={fieldClass} />
                  </label>
                  <label className="text-xs font-extrabold">WhatsApp com DDD
                    <input required type="tel" minLength={10} maxLength={20} autoComplete="tel" placeholder="(11) 99999-9999" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} className={fieldClass} />
                  </label>
                </div>

                <label className="mt-4 block text-xs font-extrabold">Comprovação de vínculo
                  <textarea required minLength={8} maxLength={1000} rows={3} placeholder="Cole o perfil oficial, site ou descreva o documento que comprova seu vínculo." value={form.evidence} onChange={(event) => setForm({ ...form, evidence: event.target.value })} className={fieldClass} />
                </label>
                <label className="mt-4 block text-xs font-extrabold">Observações <span className="font-normal text-[#1b1813]/45">(opcional)</span>
                  <textarea maxLength={1500} rows={3} placeholder="Conte algo que ajude nossa equipe na verificação." value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} className={fieldClass} />
                </label>
                <label className="sr-only" aria-hidden="true">Website
                  <input tabIndex={-1} autoComplete="off" value={form.website} onChange={(event) => setForm({ ...form, website: event.target.value })} />
                </label>
                <label className="mt-5 flex cursor-pointer items-start gap-3 text-sm font-semibold leading-relaxed text-[#1b1813]/70">
                  <input required type="checkbox" checked={form.acceptedTerms} onChange={(event) => setForm({ ...form, acceptedTerms: event.target.checked })} className="mt-1 h-4 w-4 accent-[#a87400]" />
                  Confirmo que sou responsável ou autorizado pela casa e que as informações enviadas são verdadeiras.
                </label>

                {error ? <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700" role="alert">{error}</p> : null}
                <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                  <button type="button" disabled={submitting} onClick={() => setOpen(false)} className="rounded-full border border-[#d8cdbb] px-5 py-3 text-sm font-extrabold disabled:opacity-50">Cancelar</button>
                  <button type="submit" disabled={submitting} className="inline-flex items-center justify-center gap-2 rounded-full bg-[#e5ae12] px-6 py-3 text-sm font-extrabold text-[#1b1813] disabled:opacity-60">
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <BadgeCheck className="h-4 w-4" />}
                    {submitting ? 'Enviando…' : 'Enviar solicitação'}
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>
      ) : null}
    </>
  );
}
