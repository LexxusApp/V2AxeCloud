import { useEffect, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, Check, Clock3, Link2, Loader2, Search, ShieldCheck, X, XCircle } from 'lucide-react';
import { trackConversionEvent } from '../../lib/trackConversion';

type ClaimStatus = 'pending' | 'approved' | 'rejected' | 'linked';
type ClaimStatusPayload = {
  requestId: string;
  protocol: string;
  status: ClaimStatus;
  createdAt: string;
  reviewedAt: string | null;
  terreiro: { nome: string; slug: string };
  nextAction: { label: string; href: string } | null;
};

export const claimStorageKey = (slug: string) => `axecloud:directory-claim:${slug}`;

export function rememberDirectoryClaim(slug: string, email: string, requestId?: string | null) {
  try {
    localStorage.setItem(claimStorageKey(slug), JSON.stringify({ email, requestId: requestId || null }));
  } catch {
    // A consulta manual pelo e-mail continua disponível.
  }
}

function rememberedEmail(slug: string): string {
  try {
    const stored = JSON.parse(localStorage.getItem(claimStorageKey(slug)) || '{}') as { email?: string };
    return String(stored.email || '');
  } catch {
    return '';
  }
}

const statusCopy: Record<ClaimStatus, { eyebrow: string; title: string; text: string; tone: string }> = {
  pending: {
    eyebrow: 'Recebida · em verificação',
    title: 'Sua solicitação está em análise.',
    text: 'Nossa equipe está confirmando o vínculo informado. Você não precisa enviar outra solicitação.',
    tone: 'text-amber-700 bg-amber-100 border-amber-200',
  },
  approved: {
    eyebrow: 'Responsabilidade confirmada',
    title: 'A reivindicação foi aprovada.',
    text: 'Agora falta criar seu acesso com o mesmo e-mail para conectar o perfil ao painel da casa.',
    tone: 'text-emerald-800 bg-emerald-100 border-emerald-200',
  },
  linked: {
    eyebrow: 'Perfil conectado',
    title: 'Esta casa já está ligada ao AxéCloud.',
    text: 'Os dados públicos e os serviços do perfil já podem ser administrados com segurança pelo sistema.',
    tone: 'text-emerald-800 bg-emerald-100 border-emerald-200',
  },
  rejected: {
    eyebrow: 'Verificação não concluída',
    title: 'Não conseguimos confirmar o vínculo.',
    text: 'Revise a comprovação e envie uma nova solicitação. Se precisar, fale com o suporte do AxéCloud.',
    tone: 'text-red-800 bg-red-100 border-red-200',
  },
};

export function TerreiroClaimStatusDialog({ slug, terreiroNome }: { slug: string; terreiroNome: string }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(() => rememberedEmail(slug));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ClaimStatusPayload | null>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape' && !loading) setOpen(false); };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [loading, open]);

  async function lookup(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch('/api/v1/public/diretorio/reivindicacao/acompanhar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, email: email.trim() }),
      });
      const payload = await response.json().catch(() => ({})) as ClaimStatusPayload & { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Não foi possível consultar a solicitação.');
      rememberDirectoryClaim(slug, email.trim(), payload.requestId);
      setResult(payload);
      void trackConversionEvent('directory_action', {
        ctaId: 'directory-claim-status-result',
        ctaLabel: 'Acompanhar reivindicação',
        metadata: { slug, claimStatus: payload.status },
      });
    } catch (lookupError) {
      setError(lookupError instanceof Error ? lookupError.message : 'Não foi possível consultar a solicitação.');
    } finally {
      setLoading(false);
    }
  }

  const copy = result ? statusCopy[result.status] : null;
  const stages = result ? [
    { label: 'Solicitação recebida', complete: true, active: result.status === 'pending' },
    { label: 'Vínculo analisado', complete: result.status !== 'pending', active: result.status === 'approved' || result.status === 'rejected' },
    { label: 'Perfil conectado', complete: result.status === 'linked', active: result.status === 'linked' },
  ] : [];

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setEmail(rememberedEmail(slug));
          setError(null);
          setResult(null);
          void trackConversionEvent('directory_action', { ctaId: 'directory-claim-status-open', ctaLabel: 'Já enviei uma solicitação', metadata: { slug } });
        }}
        className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 px-5 py-3 text-sm font-extrabold text-white transition hover:border-[#e5ae12]/70 hover:bg-white/5"
      >
        <Search className="h-4 w-4 text-[#e5ae12]" /> Já enviei · acompanhar
      </button>

      {open && typeof document !== 'undefined' ? createPortal(
        <div className="fixed inset-0 z-[210] grid place-items-center overflow-y-auto bg-[#070906]/82 p-4 backdrop-blur-md">
          <button type="button" className="absolute inset-0" onClick={() => !loading && setOpen(false)} aria-label="Fechar acompanhamento" />
          <section role="dialog" aria-modal="true" aria-labelledby="claim-status-title" className="relative my-auto w-full max-w-2xl overflow-hidden rounded-[2rem] border border-[#d6c8af] bg-[#f7f0e3] text-[#1b1813] shadow-[0_35px_120px_rgba(0,0,0,.55)]">
            <header className="relative overflow-hidden bg-[#0c120e] px-6 py-7 text-white sm:px-9">
              <div className="pointer-events-none absolute inset-0 opacity-25 [background-image:linear-gradient(rgba(229,174,18,.14)_1px,transparent_1px),linear-gradient(90deg,rgba(229,174,18,.14)_1px,transparent_1px)] [background-size:58px_58px]" />
              <div className="relative flex items-start justify-between gap-5">
                <div>
                  <p className="text-[9px] font-extrabold uppercase tracking-[0.22em] text-[#e5ae12]">Acompanhamento protegido</p>
                  <h2 id="claim-status-title" className="mt-2 text-2xl font-extrabold tracking-[-0.04em] sm:text-3xl">Veja em que etapa está sua casa.</h2>
                  <p className="mt-2 text-sm text-white/55">Perfil: {terreiroNome}</p>
                </div>
                <button type="button" onClick={() => setOpen(false)} className="rounded-full border border-white/15 p-2.5 text-white/65 hover:text-white" aria-label="Fechar"><X className="h-5 w-5" /></button>
              </div>
            </header>

            <div className="px-6 py-7 sm:px-9 sm:py-9">
              {!result ? (
                <form onSubmit={lookup}>
                  <label className="text-xs font-extrabold">E-mail usado na reivindicação
                    <input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="voce@exemplo.com" className="mt-2 w-full rounded-xl border border-[#d8cdbb] bg-[#fffdf8] px-4 py-3.5 text-sm font-semibold outline-none focus:border-[#c58e08] focus:ring-4 focus:ring-[#e5ae12]/15" />
                  </label>
                  <p className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-[#1b1813]/55"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#8a6200]" />Por segurança, mostramos o andamento somente para o e-mail informado no pedido.</p>
                  {error ? <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</p> : null}
                  <button type="submit" disabled={loading} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#e5ae12] px-6 py-3.5 text-sm font-extrabold text-[#1b1813] hover:bg-[#ffcd38] disabled:opacity-60">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}{loading ? 'Consultando…' : 'Consultar andamento'}</button>
                </form>
              ) : (
                <div>
                  <div className={`rounded-2xl border px-5 py-5 ${copy?.tone}`}>
                    <p className="text-[9px] font-extrabold uppercase tracking-[0.2em]">{copy?.eyebrow}</p>
                    <h3 className="mt-1.5 text-2xl font-extrabold tracking-[-0.035em]">{copy?.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed opacity-75">{copy?.text}</p>
                    <p className="mt-4 font-mono text-xs font-bold tracking-[0.14em] opacity-60">PROTOCOLO {result.protocol}</p>
                  </div>
                  <ol className="mt-6 grid gap-3 sm:grid-cols-3">
                    {stages.map((stage, index) => (
                      <li key={stage.label} className={`rounded-xl border px-4 py-4 ${stage.active ? 'border-[#d3a21a] bg-[#fff7da]' : 'border-[#dbcfbd] bg-[#fffaf1]'}`}>
                        <span className={`grid h-8 w-8 place-items-center rounded-full ${stage.complete ? 'bg-[#173d2d] text-white' : 'border border-[#d1c4b0] text-[#8a7e6c]'}`}>{stage.complete ? <Check className="h-4 w-4" /> : index === 1 ? <Clock3 className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}</span>
                        <strong className="mt-3 block text-xs">{stage.label}</strong>
                      </li>
                    ))}
                  </ol>
                  {result.nextAction ? <a href={result.nextAction.href} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#173d2d] px-6 py-3.5 text-sm font-extrabold text-white hover:bg-[#245540]">{result.nextAction.label}<ArrowRight className="h-4 w-4 text-[#e5ae12]" /></a> : null}
                  {result.status === 'rejected' ? <button type="button" onClick={() => setOpen(false)} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full border border-[#d8cdbb] px-6 py-3 text-sm font-extrabold"><XCircle className="h-4 w-4" />Fechar e revisar o pedido</button> : null}
                  <button type="button" onClick={() => setResult(null)} className="mx-auto mt-4 block text-xs font-bold text-[#1b1813]/50 underline underline-offset-4">Consultar outro e-mail</button>
                </div>
              )}
            </div>
          </section>
        </div>,
        document.body,
      ) : null}
    </>
  );
}
