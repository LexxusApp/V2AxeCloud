import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Calendar,
  CalendarDays,
  CheckCircle2,
  Clock,
  Info,
  Loader2,
  MapPin,
  Ticket,
  XCircle,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { MatrizPageBackground } from '../../components/marketing/MatrizPageBackground';
import { fetchPublicEvento, terreiroProfilePath, type PublicEventoDetail } from '../../lib/portalPublic';
import { applyCustomPageSeo } from '../../lib/seo';
import { cn } from '../../lib/utils';

function MatrizKicker({ children }: { children: ReactNode }) {
  return (
    <span className="matriz-kicker-pulse inline-flex rounded-full bg-[#ffc107] px-3.5 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-[#1b1813]">
      {children}
    </span>
  );
}

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

function EventoThumb({ url, alt }: { url: string | null; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (!url || failed) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#ffc107]/10 to-[#f3ebe0]">
        <CalendarDays className="h-10 w-10 text-[#1b1813]/15" aria-hidden />
      </div>
    );
  }
  return (
    <img
      src={url}
      alt={alt}
      className="h-full w-full object-cover object-center"
      loading="eager"
      onError={() => setFailed(true)}
    />
  );
}

function PageWrapper({ children }: { children: ReactNode }) {
  return (
    <div className="landing-v3 landing-mockup-theme relative min-h-dvh overflow-x-clip bg-[#fdf8f0] font-display text-[#1b1813]">
      <MatrizPageBackground />
      <main className="relative z-[1] mx-auto w-full max-w-lg px-5 pb-24 pt-32 md:px-8 md:pt-36">
        {children}
      </main>
    </div>
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

  useEffect(() => {
    if (!info) return;
    applyCustomPageSeo({
      title: `${info.titulo} | Evento`,
      description: info.descricao || `${info.tipo} em ${info.terreiro.nome}.`,
      canonicalPath: window.location.pathname,
      robots: 'noindex, follow',
    });
  }, [info]);

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
      <PageWrapper>
        <div className="flex flex-col items-center justify-center rounded-[2rem] border border-[#e8dfd0] bg-white/70 py-20 shadow-sm">
          <Loader2 className="h-8 w-8 animate-spin text-[#a87400]" />
          <p className="mt-4 text-sm font-bold text-[#1b1813]/55">Carregando evento...</p>
        </div>
      </PageWrapper>
    );
  }

  if (error && !info) {
    return (
      <PageWrapper>
        <div className="rounded-[2rem] border border-red-200 bg-white/80 p-8 text-center">
          <XCircle className="mx-auto h-10 w-10 text-red-500" />
          <p className="mt-3 text-sm font-semibold text-red-600">{error}</p>
        </div>
      </PageWrapper>
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
      <PageWrapper>
        <motion.article
          initial={{ opacity: 0, y: 24, filter: 'blur(8px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="overflow-hidden rounded-[2rem] border border-[#e8dfd0] bg-white/90 shadow-xl shadow-black/5 backdrop-blur-sm"
        >
          <div className="border-b border-[#e8dfd0] bg-[#ffc107]/10 px-6 py-8 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-[#a87400]" />
            <p className="mt-3 text-[10px] font-black uppercase tracking-[0.2em] text-[#a87400]">
              Senha confirmada
            </p>
            <p className="mt-4 text-5xl font-black tabular-nums text-[#a87400]">{senha}</p>
            <p className="mt-2 text-base font-bold text-[#1b1813]">{nome}</p>
          </div>
          <div className="space-y-2 px-6 py-5 text-center text-sm leading-relaxed text-[#1b1813]/65">
            <p>Enviamos sua senha e o link de check-in no WhatsApp.</p>
            <p>Na portaria, abra o link e aponte para o QR Code do terreiro.</p>
          </div>
        </motion.article>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      <motion.article
        initial={{ opacity: 0, y: 24, filter: 'blur(8px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="overflow-hidden rounded-[2rem] border border-[#e8dfd0] bg-white/90 shadow-xl shadow-black/5 backdrop-blur-sm"
      >
        {info.bannerUrl ? (
          <div className="aspect-[16/9] w-full overflow-hidden bg-[#f3ebe0]">
            <EventoThumb url={info.bannerUrl} alt={info.titulo} />
          </div>
        ) : null}

        <div className="p-5 sm:p-6">
          <MatrizKicker>{info.tipo}</MatrizKicker>

          {info.senhasAtivas && info.senhasMaximas != null ? (
            <p
              className={cn(
                'mt-4 inline-flex rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest',
                info.esgotado
                  ? 'bg-red-100 text-red-700'
                  : 'bg-[#ffc107]/14 text-[#a87400]',
              )}
            >
              {info.esgotado ? 'Senhas esgotadas' : `${info.senhasRestantes ?? 0} senhas restantes`}
            </p>
          ) : null}

          <h1 className="mt-4 text-2xl font-black leading-tight text-[#1b1813] sm:text-3xl">{info.titulo}</h1>

          <ul className="mt-5 space-y-2.5 text-sm text-[#1b1813]/70">
            <li className="flex items-center gap-2">
              <Calendar className="h-4 w-4 shrink-0 text-[#a87400]" aria-hidden />
              <span className="capitalize font-semibold">{dataFmt}</span>
            </li>
            <li className="flex items-center gap-2">
              <Clock className="h-4 w-4 shrink-0 text-[#a87400]" aria-hidden />
              <span className="font-semibold">{horaFmt}</span>
            </li>
            <li className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#a87400]" aria-hidden />
              <a
                href={terreiroProfilePath(info.terreiro.slug)}
                className="font-semibold text-[#1b1813] underline-offset-2 hover:text-[#a87400] hover:underline"
              >
                {local}
              </a>
            </li>
          </ul>

          {info.descricao ? (
            <p className="mt-4 text-sm leading-relaxed text-[#1b1813]/60">{info.descricao}</p>
          ) : null}
        </div>

        {info.senhasAtivas ? (
          <section className="border-t border-[#e8dfd0] px-5 py-5 sm:px-6 sm:py-6">
            <div className="mb-4 flex items-center gap-2">
              <Ticket className="h-4 w-4 text-[#a87400]" aria-hidden />
              <h2 className="text-sm font-black text-[#1b1813]">Receber senha</h2>
            </div>

            <div className="mb-5 flex gap-3 rounded-2xl border border-[#e8dfd0] bg-[#ffc107]/8 p-4">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#a87400]" aria-hidden />
              <p className="text-xs leading-relaxed text-[#1b1813]/70 sm:text-sm">
                Informe nome e WhatsApp. O sistema gera sua senha numérica e envia no WhatsApp com link
                de presença.
              </p>
            </div>

            {info.esgotado ? (
              <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm font-semibold text-amber-900">
                Todas as senhas deste evento já foram emitidas.
              </p>
            ) : (
              <form onSubmit={(e) => void handleEmitir(e)} className="space-y-4">
                {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}
                <div>
                  <label htmlFor="evento-nome" className="text-[10px] font-black uppercase tracking-widest text-[#1b1813]/45">
                    Nome completo
                  </label>
                  <input
                    id="evento-nome"
                    required
                    autoComplete="name"
                    className="mt-1.5 w-full rounded-2xl border border-[#e8dfd0] bg-white px-4 py-3 text-sm font-semibold text-[#1b1813] outline-none transition focus:border-[#ffc107]/60 focus:ring-4 focus:ring-[#ffc107]/15"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Seu nome"
                  />
                </div>
                <div>
                  <label
                    htmlFor="evento-whatsapp"
                    className="text-[10px] font-black uppercase tracking-widest text-[#1b1813]/45"
                  >
                    WhatsApp
                  </label>
                  <input
                    id="evento-whatsapp"
                    required
                    type="tel"
                    autoComplete="tel"
                    inputMode="tel"
                    className="mt-1.5 w-full rounded-2xl border border-[#e8dfd0] bg-white px-4 py-3 text-sm font-semibold text-[#1b1813] outline-none transition focus:border-[#ffc107]/60 focus:ring-4 focus:ring-[#ffc107]/15"
                    value={telefone}
                    onChange={(e) => setTelefone(e.target.value)}
                    placeholder="(00) 00000-0000"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex w-full items-center justify-center rounded-full bg-[#ffc107] py-3.5 text-sm font-black text-[#1b1813] shadow-md shadow-[#ffc107]/15 transition hover:bg-[#ffcd38] disabled:opacity-60"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Receber senha no WhatsApp'}
                </button>
                <p className="text-center text-[10px] font-semibold text-[#1b1813]/40">
                  A senha e o link de check-in serão enviados no seu WhatsApp.
                </p>
              </form>
            )}
          </section>
        ) : (
          <div className="border-t border-[#e8dfd0] px-5 py-5 sm:px-6">
            <p className="text-center text-sm text-[#1b1813]/55">
              Confirme horário e endereço diretamente com o terreiro.
            </p>
          </div>
        )}
      </motion.article>

      <p className="mt-6 text-center text-[10px] text-[#1b1813]/35">
        Divulgado via{' '}
        <a href="/" className="font-semibold hover:text-[#a87400]">
          AxéCloud
        </a>
      </p>
    </PageWrapper>
  );
}
