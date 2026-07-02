import { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, CheckCircle2, Clock, Loader2, MapPin, Ticket, XCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { MarketingMockupLayout } from '../../components/marketing/MarketingMockupLayout';
import { fetchPublicEvento, terreiroProfilePath, type PublicEventoDetail } from '../../lib/portalPublic';

function parseEventoPath(): string {
  const parts = window.location.pathname.replace(/\/+$/, '').split('/');
  const idx = parts.indexOf('evento');
  return idx >= 0 ? decodeURIComponent(parts[idx + 1] || '').trim() : '';
}

function formatHora(hora: string): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(hora.trim());
  if (!m) return hora;
  return `${m[1].padStart(2, '0')}:${m[2]}`;
}

function formatData(data: string): string {
  try {
    return format(parseISO(data), "EEEE, d 'de' MMMM", { locale: ptBR });
  } catch {
    return data;
  }
}

function EventoBanner({ url, alt }: { url: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <img
      src={url}
      alt={alt}
      className="h-full w-full object-cover"
      loading="eager"
      onError={() => setFailed(true)}
    />
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <MarketingMockupLayout showFooter={false}>
      <main className="px-4 py-6 sm:py-10">
        <div className="mx-auto w-full max-w-md">{children}</div>
      </main>
    </MarketingMockupLayout>
  );
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
      <PageShell>
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-amber-600" />
        </div>
      </PageShell>
    );
  }

  if (error && !info) {
    return (
      <PageShell>
        <div className="rounded-2xl border border-red-200 bg-white p-6 text-center shadow-sm">
          <XCircle className="mx-auto h-9 w-9 text-red-500" />
          <p className="mt-3 text-sm text-red-600">{error}</p>
        </div>
      </PageShell>
    );
  }

  if (!info) return null;

  const dataFmt = formatData(info.data);
  const horaFmt = formatHora(info.hora);
  const local =
    info.terreiro.cidade != null
      ? `${info.terreiro.nome} · ${info.terreiro.cidade}`
      : info.terreiro.nome;

  if (senha != null) {
    return (
      <PageShell>
        <article className="overflow-hidden rounded-2xl border border-[#1b1813]/8 bg-white shadow-sm">
          <div className="border-b border-[#1b1813]/6 bg-emerald-50 px-5 py-6 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-emerald-800/70">
              Senha confirmada
            </p>
            <p className="mt-4 text-5xl font-black tabular-nums text-[#1b1813]">{senha}</p>
            <p className="mt-2 text-sm font-semibold text-[#1b1813]">{nome}</p>
          </div>
          <div className="space-y-2 px-5 py-4 text-center text-sm leading-relaxed text-[#1b1813]/65">
            <p>Enviamos sua senha e o link de check-in no WhatsApp.</p>
            <p>Na portaria, abra o link e aponte para o QR Code do terreiro.</p>
          </div>
        </article>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <article className="overflow-hidden rounded-2xl border border-[#1b1813]/8 bg-white shadow-sm">
        {info.bannerUrl ? (
          <div className="h-36 w-full overflow-hidden bg-[#f3ebe0] sm:h-40">
            <EventoBanner url={info.bannerUrl} alt={info.titulo} />
          </div>
        ) : null}

        <div className="p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-900">
              {info.tipo}
            </span>
            {info.senhasAtivas && info.senhasMaximas != null ? (
              <span className="text-[11px] text-[#1b1813]/45">
                {info.esgotado ? 'Senhas esgotadas' : `${info.senhasRestantes ?? 0} senhas restantes`}
              </span>
            ) : null}
          </div>

          <h1 className="mt-2 text-xl font-bold leading-snug text-[#1b1813] sm:text-2xl">{info.titulo}</h1>

          <ul className="mt-4 space-y-2.5 text-sm text-[#1b1813]/70">
            <li className="flex items-start gap-2.5">
              <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
              <span className="capitalize">{dataFmt}</span>
            </li>
            <li className="flex items-center gap-2.5">
              <Clock className="h-4 w-4 shrink-0 text-amber-600" aria-hidden />
              <span>{horaFmt}</span>
            </li>
            <li className="flex items-start gap-2.5">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
              <a
                href={terreiroProfilePath(info.terreiro.slug)}
                className="font-medium text-[#1b1813] underline-offset-2 hover:text-amber-700 hover:underline"
              >
                {local}
              </a>
            </li>
          </ul>

          {info.descricao ? (
            <p className="mt-4 text-sm leading-relaxed text-[#1b1813]/60">{info.descricao}</p>
          ) : null}

          {info.senhasAtivas ? (
            <section className="mt-6 rounded-xl border border-[#1b1813]/8 bg-[#fdf8f0]/80 p-4">
              <div className="mb-4 flex items-center gap-2">
                <Ticket className="h-4 w-4 text-amber-600" aria-hidden />
                <h2 className="text-sm font-bold text-[#1b1813]">Receber senha</h2>
              </div>

              {info.esgotado ? (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
                  Todas as senhas deste evento já foram emitidas.
                </p>
              ) : (
                <form onSubmit={(e) => void handleEmitir(e)} className="space-y-3">
                  {error ? <p className="text-sm text-red-600">{error}</p> : null}
                  <div>
                    <label htmlFor="evento-nome" className="text-[11px] font-semibold text-[#1b1813]/55">
                      Nome completo
                    </label>
                    <input
                      id="evento-nome"
                      required
                      autoComplete="name"
                      className="mt-1 w-full rounded-lg border border-[#1b1813]/12 bg-white px-3 py-2.5 text-sm text-[#1b1813] outline-none ring-amber-400/40 focus:border-amber-400 focus:ring-2"
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      placeholder="Seu nome"
                    />
                  </div>
                  <div>
                    <label htmlFor="evento-whatsapp" className="text-[11px] font-semibold text-[#1b1813]/55">
                      WhatsApp
                    </label>
                    <input
                      id="evento-whatsapp"
                      required
                      type="tel"
                      autoComplete="tel"
                      inputMode="tel"
                      className="mt-1 w-full rounded-lg border border-[#1b1813]/12 bg-white px-3 py-2.5 text-sm text-[#1b1813] outline-none ring-amber-400/40 focus:border-amber-400 focus:ring-2"
                      value={telefone}
                      onChange={(e) => setTelefone(e.target.value)}
                      placeholder="(00) 00000-0000"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={submitting}
                    className={cn(
                      'flex w-full items-center justify-center rounded-lg bg-[#1b1813] py-3 text-sm font-bold text-white transition',
                      'hover:bg-[#2d261c] disabled:opacity-60',
                    )}
                  >
                    {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Receber senha no WhatsApp'}
                  </button>
                  <p className="text-center text-[11px] leading-relaxed text-[#1b1813]/45">
                    A senha e o link de check-in serão enviados no seu WhatsApp.
                  </p>
                </form>
              )}
            </section>
          ) : (
            <p className="mt-5 text-sm text-[#1b1813]/55">
              Confirme horário e endereço diretamente com o terreiro.
            </p>
          )}
        </div>
      </article>

      <p className="mt-6 text-center text-[11px] text-[#1b1813]/35">
        Divulgado via{' '}
        <a href="/" className="font-medium hover:text-amber-700">
          AxéCloud
        </a>
      </p>
    </PageShell>
  );
}
