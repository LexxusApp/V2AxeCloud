import { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, CheckCircle2, Clock, Loader2, MapPin, Ticket, XCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { MarketingMockupLayout } from '../../components/marketing/MarketingMockupLayout';
import { landingMockupCardClass, landingMockupShellClass } from '../../components/landing/landingMockupUi';
import { fetchPublicEvento, type PublicEventoDetail } from '../../lib/portalPublic';

function parseEventoPath(): string {
  const parts = window.location.pathname.replace(/\/+$/, '').split('/');
  const idx = parts.indexOf('evento');
  return idx >= 0 ? decodeURIComponent(parts[idx + 1] || '').trim() : '';
}

export default function EventoPublicPage() {
  const token = parseEventoPath();
  const [info, setInfo] = useState<PublicEventoDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [senha, setSenha] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError('Link inválido.');
      setLoading(false);
      return;
    }
    void fetchPublicEvento(token)
      .then(setInfo)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Erro'))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleEmitir(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !nome.trim() || !telefone.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/public/evento/${encodeURIComponent(token)}/emitir-senha`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: nome.trim(), telefone }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erro ao emitir senha');
      setSenha(json.senha);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <MarketingMockupLayout>
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
        </div>
      </MarketingMockupLayout>
    );
  }

  if (error && !info) {
    return (
      <MarketingMockupLayout>
        <main className={cn('py-16 text-center', landingMockupShellClass)}>
          <XCircle className="mx-auto h-10 w-10 text-red-500" />
          <p className="mt-3 text-sm text-red-600">{error}</p>
        </main>
      </MarketingMockupLayout>
    );
  }

  if (!info) return null;

  let dataFmt = info.data;
  try {
    dataFmt = format(parseISO(info.data), "EEEE, d 'de' MMMM", { locale: ptBR });
  } catch {
    /* keep raw */
  }

  if (senha != null) {
    return (
      <MarketingMockupLayout>
        <main className={cn('py-12', landingMockupShellClass, 'max-w-md')}>
          <div className={cn('p-8 text-center', landingMockupCardClass, 'rounded-2xl')}>
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
            <p className="mt-3 text-xs font-bold uppercase tracking-widest text-[#1b1813]/50">
              {info.terreiro.nome}
            </p>
            <p className="text-sm text-[#1b1813]/70">{info.titulo}</p>
            <p className="mt-6 text-6xl font-black tabular-nums text-[#FFC107]">{senha}</p>
            <p className="mt-2 text-lg font-bold text-[#1b1813]">{nome}</p>
            <p className="mt-4 text-sm text-[#1b1813]/65">
              Enviamos sua senha e o link de check-in no WhatsApp. Na portaria, abra o link e aponte para o QR
              Code do terreiro.
            </p>
          </div>
        </main>
      </MarketingMockupLayout>
    );
  }

  return (
    <MarketingMockupLayout>
      <main className={cn('py-10 sm:py-14', landingMockupShellClass, 'max-w-2xl')}>
        <article className={cn('overflow-hidden', landingMockupCardClass, 'rounded-2xl')}>
          {info.bannerUrl ? (
            <div className="aspect-[16/9] w-full bg-[#f3ebe0]">
              <img src={info.bannerUrl} alt={info.titulo} className="h-full w-full object-cover" />
            </div>
          ) : null}
          <div className="p-6 sm:p-8">
            <span className="text-[10px] font-black uppercase tracking-widest text-[#FFC107]">{info.tipo}</span>
            <h1 className="mt-1 text-2xl font-black text-[#1b1813] sm:text-3xl">{info.titulo}</h1>
            <div className="mt-4 space-y-2 text-sm text-[#1b1813]/70">
              <p className="flex items-center gap-2">
                <Calendar className="h-4 w-4 shrink-0" />
                {dataFmt}
              </p>
              <p className="flex items-center gap-2">
                <Clock className="h-4 w-4 shrink-0" />
                {info.hora}
              </p>
              <p className="flex items-center gap-2">
                <MapPin className="h-4 w-4 shrink-0" />
                {info.terreiro.nome}
                {info.terreiro.cidade ? ` — ${info.terreiro.cidade}` : ''}
              </p>
            </div>
            {info.descricao ? (
              <p className="mt-4 text-sm leading-relaxed text-[#1b1813]/75">{info.descricao}</p>
            ) : null}

            {info.senhasAtivas ? (
              <div className="mt-8 border-t border-[#1b1813]/10 pt-6">
                <div className="mb-4 flex items-center gap-2">
                  <Ticket className="h-5 w-5 text-[#FFC107]" />
                  <h2 className="text-lg font-bold text-[#1b1813]">Receber senha</h2>
                </div>
                {info.esgotado ? (
                  <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    Todas as senhas deste evento já foram emitidas.
                  </p>
                ) : (
                  <>
                    {info.senhasMaximas != null ? (
                      <p className="mb-3 text-xs text-[#1b1813]/55">
                        {info.senhasRestantes ?? 0} de {info.senhasMaximas} senhas disponíveis
                      </p>
                    ) : null}
                    {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
                    <form onSubmit={(e) => void handleEmitir(e)} className="space-y-3">
                      <div>
                        <label className="text-[10px] font-bold uppercase text-[#1b1813]/50">Nome completo</label>
                        <input
                          required
                          className="mt-1 w-full rounded-xl border border-[#1b1813]/15 bg-white px-3 py-2.5 text-sm text-[#1b1813]"
                          value={nome}
                          onChange={(e) => setNome(e.target.value)}
                          placeholder="Seu nome"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold uppercase text-[#1b1813]/50">WhatsApp</label>
                        <input
                          required
                          type="tel"
                          className="mt-1 w-full rounded-xl border border-[#1b1813]/15 bg-white px-3 py-2.5 text-sm text-[#1b1813]"
                          value={telefone}
                          onChange={(e) => setTelefone(e.target.value)}
                          placeholder="(00) 00000-0000"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={submitting}
                        className="w-full rounded-xl bg-[#FFC107] py-3 text-sm font-black text-[#1b1813] transition hover:bg-[#e6ac00] disabled:opacity-60"
                      >
                        {submitting ? (
                          <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                        ) : (
                          'Receber senha no WhatsApp'
                        )}
                      </button>
                    </form>
                  </>
                )}
              </div>
            ) : (
              <p className="mt-6 text-sm text-[#1b1813]/60">
                Este evento está divulgado no portal. Confirme horário e endereço diretamente com o terreiro.
              </p>
            )}
          </div>
        </article>
      </main>
    </MarketingMockupLayout>
  );
}
