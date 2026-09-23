import { useEffect, useId, useState, type ReactNode } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  Clock,
  Compass,
  DollarSign,
  ExternalLink,
  Instagram,
  Loader2,
  MapPin,
  MessageCircle,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { MatrizEditorialLayout } from '../../components/marketing/MatrizEditorialLayout';
import {
  fetchDiretorioTerreiro,
  fetchDiretorioTerreiroServicos,
  trackDiretorioGoogleProfileView,
  trackDiretorioWhatsappClick,
  type DiretorioTerreiro,
  type TerreiroServico,
  type TerreiroServicosPublic,
} from '../../lib/diretorioPublic';
import { applyCustomPageSeo } from '../../lib/seo';
import { getFeaturedTerreiroCopy } from '../../../lib/diretorioSeoShared';
import { ROUTES } from '../../lib/routes';
import { PLAN_PRICE_STANDARD_LABEL, TRIAL_DAYS } from '../../../lib/planPricing';
import { useDiretorioTerreiroJsonLd } from '../../lib/diretorioJsonLd';
import { trackConversionEvent } from '../../lib/trackConversion';
import { VerifiedBadge } from '../../components/portal/VerifiedBadge';
import { TerreiroClaimDialog } from '../../components/portal/TerreiroClaimDialog';
import { TerreiroClaimStatusDialog } from '../../components/portal/TerreiroClaimStatusDialog';
import {
  formatGiraTime,
  getNextGiraScheduleItem,
  GIRA_WEEKDAYS,
  type GiraScheduleItem,
} from '../../../lib/giraSchedule';

function slugFromPath(): string {
  const parts = window.location.pathname.replace(/\/+$/, '').split('/');
  const idx = parts.indexOf('terreiro');
  return decodeURIComponent(parts[idx + 1] || '');
}

function InfoRow({ icon: Icon, label, children }: { icon: typeof MapPin; label: string; children: ReactNode }) {
  return (
    <div className="grid gap-2.5 border-t border-[#cfc1ab]/60 py-4 first:border-t-0 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-6 sm:py-5">
      <p className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.17em] text-[#8a6200]">
        <Icon className="h-4 w-4 shrink-0" aria-hidden />
        {label}
      </p>
      <div className="min-w-0 text-sm font-semibold leading-relaxed text-[#1b1813]/80 sm:text-base">{children}</div>
    </div>
  );
}

function WhatsAppIcon({ className = 'h-5 w-5' }: { className?: string }) {
  const gradId = `wa_${useId().replace(/:/g, '')}`;
  return (
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden className={`${className} shrink-0`}>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M16 31C23.732 31 30 24.732 30 17C30 9.26801 23.732 3 16 3C8.26801 3 2 9.26801 2 17C2 19.5109 2.661 21.8674 3.81847 23.905L2 31L9.31486 29.3038C11.3014 30.3854 13.5789 31 16 31ZM16 28.8462C22.5425 28.8462 27.8462 23.5425 27.8462 17C27.8462 10.4576 22.5425 5.15385 16 5.15385C9.45755 5.15385 4.15385 10.4576 4.15385 17C4.15385 19.5261 4.9445 21.8675 6.29184 23.7902L5.23077 27.7692L9.27993 26.7569C11.1894 28.0746 13.5046 28.8462 16 28.8462Z"
        fill="#BFC8D0"
      />
      <path
        d="M28 16C28 22.6274 22.6274 28 16 28C13.4722 28 11.1269 27.2184 9.19266 25.8837L5.09091 26.9091L6.16576 22.8784C4.80092 20.9307 4 18.5589 4 16C4 9.37258 9.37258 4 16 4C22.6274 4 28 9.37258 28 16Z"
        fill={`url(#${gradId})`}
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M16 30C23.732 30 30 23.732 30 16C30 8.26801 23.732 2 16 2C8.26801 2 2 8.26801 2 16C2 18.5109 2.661 20.8674 3.81847 22.905L2 30L9.31486 28.3038C11.3014 29.3854 13.5789 30 16 30ZM16 27.8462C22.5425 27.8462 27.8462 22.5425 27.8462 16C27.8462 9.45755 22.5425 4.15385 16 4.15385C9.45755 4.15385 4.15385 9.45755 4.15385 16C4.15385 18.5261 4.9445 20.8675 6.29184 22.7902L5.23077 26.7692L9.27993 25.7569C11.1894 27.0746 13.5046 27.8462 16 27.8462Z"
        fill="white"
      />
      <path
        d="M12.5 9.49989C12.1672 8.83131 11.6565 8.8905 11.1407 8.8905C10.2188 8.8905 8.78125 9.99478 8.78125 12.05C8.78125 13.7343 9.52345 15.578 12.0244 18.3361C14.438 20.9979 17.6094 22.3748 20.2422 22.3279C22.875 22.2811 23.4167 20.0154 23.4167 19.2503C23.4167 18.9112 23.2062 18.742 23.0613 18.696C22.1641 18.2654 20.5093 17.4631 20.1328 17.3124C19.7563 17.1617 19.5597 17.3656 19.4375 17.4765C19.0961 17.8018 18.4193 18.7608 18.1875 18.9765C17.9558 19.1922 17.6103 19.083 17.4665 19.0015C16.9374 18.7892 15.5029 18.1511 14.3595 17.0426C12.9453 15.6718 12.8623 15.2001 12.5959 14.7803C12.3828 14.4444 12.5392 14.2384 12.6172 14.1483C12.9219 13.7968 13.3426 13.254 13.5313 12.9843C13.7199 12.7145 13.5702 12.305 13.4803 12.05C13.0938 10.953 12.7663 10.0347 12.5 9.49989Z"
        fill="white"
      />
      <defs>
        <linearGradient id={gradId} x1="26.5" y1="7" x2="4" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="#5BD066" />
          <stop offset="1" stopColor="#27B43E" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function TerreiroPortrait({ fotoUrl, nome }: { fotoUrl: string | null; nome: string }) {
  const [fotoFalhou, setFotoFalhou] = useState(false);
  const mostrarFoto = Boolean(fotoUrl) && !fotoFalhou;

  return (
    <div className="relative min-h-[18rem] overflow-hidden bg-[#102117] min-[900px]:min-h-full">
      {mostrarFoto ? (
        <img
          src={fotoUrl!}
          alt={`Fachada ou imagem pública de ${nome}`}
          className="absolute inset-0 h-full w-full object-cover object-center"
          loading="eager"
          onError={() => setFotoFalhou(true)}
        />
      ) : (
        <div className="absolute inset-0 grid place-items-center overflow-hidden">
          <div className="absolute inset-0 opacity-50 [background-image:linear-gradient(rgba(229,174,18,.13)_1px,transparent_1px),linear-gradient(90deg,rgba(229,174,18,.13)_1px,transparent_1px)] [background-size:54px_54px]" />
          <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full border border-[#e5ae12]/25" />
          <div className="absolute -right-10 -top-10 h-52 w-52 rounded-full border border-[#e5ae12]/20" />
          <div className="relative flex max-w-sm flex-col items-center px-8 text-center">
            <img src="/axecloud-trident.png" alt="" className="h-28 w-20 object-contain" />
            <span className="mt-5 text-[11px] font-extrabold uppercase tracking-[0.24em] text-white/50">Casa presente no diretório AxéCloud</span>
          </div>
        </div>
      )}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#07110b]/85 via-transparent to-black/15" aria-hidden />
      <div className="absolute bottom-5 left-5 right-5 flex items-center justify-between gap-4 text-[10px] font-extrabold uppercase tracking-[0.18em] text-white/62 sm:bottom-7 sm:left-7 sm:right-7">
        <span>Perfil público</span><span className="h-px flex-1 bg-white/25" aria-hidden /><span>AxéCloud</span>
      </div>
    </div>
  );
}

function GiraScheduleSection({ horarios }: { horarios: GiraScheduleItem[] }) {
  const next = getNextGiraScheduleItem(horarios);
  if (horarios.length === 0) return null;
  const nextWhen = next
    ? next.daysUntil === 0
      ? `Hoje, às ${formatGiraTime(next.item.horario)}`
      : next.daysUntil === 1
        ? `Amanhã, às ${formatGiraTime(next.item.horario)}`
        : `${GIRA_WEEKDAYS[next.item.diaSemana]}, às ${formatGiraTime(next.item.horario)}`
    : '';

  return (
    <section className="mt-5 overflow-hidden rounded-2xl border border-[#2b382f]/30 bg-[#102117] px-5 py-6 text-white shadow-[0_18px_48px_rgba(22,36,27,.14)] sm:px-7 sm:py-7" aria-labelledby="gira-schedule-heading">
      <div className="grid gap-6 min-[900px]:grid-cols-[minmax(0,1fr)_18rem] min-[900px]:items-start">
        <div>
          <p className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#e5ae12]">
            <CalendarDays className="h-4 w-4" /> Horários habituais
          </p>
          <h2 id="gira-schedule-heading" className="mt-1.5 text-2xl font-extrabold tracking-[-0.04em] sm:text-3xl">Dias de gira.</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {horarios.map((horario, index) => (
              <div key={`${horario.diaSemana}-${horario.horario}-${index}`} className="rounded-xl border border-white/12 bg-white/[.055] p-4">
                <div className="flex items-center justify-between gap-3">
                  <strong className="text-sm text-white">{GIRA_WEEKDAYS[horario.diaSemana]}</strong>
                  <span className="rounded-full bg-[#e5ae12] px-3 py-1 text-xs font-black text-[#11150f]">{formatGiraTime(horario.horario)}</span>
                </div>
                {horario.titulo ? <p className="mt-3 text-sm font-bold text-[#f4e3aa]">{horario.titulo}</p> : null}
                {horario.observacao ? <p className="mt-1.5 text-xs leading-relaxed text-white/55">{horario.observacao}</p> : null}
              </div>
            ))}
          </div>
        </div>

        {next ? (
          <aside className="rounded-xl border border-[#e5ae12]/35 bg-[#e5ae12]/10 p-5">
            <p className="text-[9px] font-extrabold uppercase tracking-[0.2em] text-[#e5ae12]">Próxima gira prevista</p>
            <p className="mt-2 text-xl font-extrabold leading-tight text-white">{nextWhen}</p>
            {next.item.titulo ? <p className="mt-2 text-sm font-semibold text-white/70">{next.item.titulo}</p> : null}
            <p className="mt-5 border-t border-white/10 pt-4 text-[11px] leading-relaxed text-white/48">A programação pode mudar. Confirme diretamente com a casa antes de visitar.</p>
          </aside>
        ) : null}
      </div>
    </section>
  );
}

function formatValorServico(min: number | null, max: number | null): string {
  if (min == null && max == null) return 'Sob consulta';
  if (min != null && max != null && min !== max) {
    return `R$ ${min.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} – R$ ${max.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  }
  const val = min ?? max ?? 0;
  return `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
}

function ServicoCard({ servico }: { servico: TerreiroServico }) {
  return (
    <div className="flex flex-col justify-between gap-3 rounded-xl border border-[#d0c4ae] bg-[#fffaf1] p-4 shadow-sm">
      <div>
        <div className="flex items-start gap-3">
          <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#172018] text-[#e5ae12]">
            <Sparkles className="h-4 w-4" aria-hidden />
          </span>
          <div>
            <h4 className="font-extrabold text-[#1b1813]">{servico.nome}</h4>
            {servico.descricao ? (
              <p className="mt-1 text-sm leading-relaxed text-[#1b1813]/60">{servico.descricao}</p>
            ) : null}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
        <span className="flex items-center gap-1.5 font-extrabold text-[#8a6200]">
          <DollarSign className="h-4 w-4 shrink-0" aria-hidden />
          {formatValorServico(servico.valor_min, servico.valor_max)}
        </span>
        {servico.duracao_minutos ? (
          <span className="flex items-center gap-1.5 text-[#1b1813]/50">
            <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {servico.duracao_minutos} min
          </span>
        ) : null}
      </div>
    </div>
  );
}

function ServicosSection({
  servicos,
  whatsappAtendimento,
  terreiroNome,
  terreiroSlug,
  verificada,
}: {
  servicos: TerreiroServico[];
  whatsappAtendimento: string | null;
  terreiroNome: string;
  terreiroSlug: string;
  verificada: boolean;
}) {
  const rawWa = (whatsappAtendimento || '').replace(/\D/g, '');
  const waHref = rawWa.length >= 10
    ? `https://wa.me/55${rawWa}?text=${encodeURIComponent(`Olá! Vi os atendimentos de ${terreiroNome} no AxéCloud e gostaria de saber mais.`)}`
    : null;

  if (servicos.length === 0) {
    if (!verificada) return null;
    return (
      <section
        className="mt-5 overflow-hidden rounded-2xl border border-[#c9b990] bg-[#eadfbf]/60 px-5 py-6 sm:px-7 sm:py-7"
        aria-labelledby="servicos-cta-title"
      >
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-4">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#172018] text-[#e5ae12]">
              <MessageCircle className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#8a6200]">
                Atendimentos espirituais
              </p>
              <h2 id="servicos-cta-title" className="mt-1.5 text-xl font-extrabold tracking-[-0.03em] text-[#1b1813] sm:text-2xl">
                Esta casa ainda não publicou seus atendimentos.
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-[#1b1813]/60">
                Se você é o zelador, acesse o painel AxéCloud e cadastre seus serviços para aparecerem aqui.
              </p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      className="mt-5 overflow-hidden rounded-2xl border border-[#d8cbb5] bg-[#fffaf1]/92 px-5 py-6 shadow-[0_18px_48px_rgba(63,49,27,.07)] sm:px-7 sm:py-7"
      aria-labelledby="servicos-heading"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#9b6a00]">
            Atendimentos espirituais
          </p>
          <h2 id="servicos-heading" className="mt-1 text-2xl font-extrabold tracking-[-0.04em] text-[#1b1813] sm:text-3xl">
            O que esta casa oferece.
          </h2>
        </div>
        {waHref ? (
          <a
            href={waHref}
            onClick={() => trackDiretorioWhatsappClick(terreiroSlug)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[#e5ae12] px-5 py-3 text-sm font-extrabold text-[#11150f] shadow-[0_10px_30px_rgba(181,132,0,.18)] transition hover:bg-[#efb91e]"
          >
            <WhatsAppIcon className="h-5 w-5" />
            Agendar via WhatsApp
          </a>
        ) : null}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {servicos.map((s) => (
          <ServicoCard key={s.id} servico={s} />
        ))}
      </div>

    </section>
  );
}

export default function DiretorioTerreiroPage() {
  const slug = slugFromPath();
  const [terreiro, setTerreiro] = useState<DiretorioTerreiro | null>(null);
  const [servicosData, setServicosData] = useState<TerreiroServicosPublic>({ servicos: [], whatsappAtendimento: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) {
      setError('Endereço inválido.');
      setLoading(false);
      return;
    }

    void Promise.all([
      fetchDiretorioTerreiro(slug),
      fetchDiretorioTerreiroServicos(slug),
    ])
      .then(([t, sData]) => {
        setTerreiro(t);
        setServicosData(sData);
        trackDiretorioGoogleProfileView(t.slug);
        const loc = [t.cidade, t.estado].filter(Boolean).join(', ');
        const featured = getFeaturedTerreiroCopy(t.slug);
        applyCustomPageSeo({
          title: featured?.title || `${t.nome}${loc ? ` — ${loc}` : ''} | Diretório AxéCloud`,
          description:
            featured?.description ||
            `Informações de ${t.nome}${loc ? ` em ${loc}` : ''}: endereço${t.whatsapp ? ', contato via WhatsApp' : ''} e como chegar pelo Google Maps.`,
          canonicalPath: `/terreiro/${t.slug}`,
          robots: t.indexable === false ? 'noindex, follow' : 'index, follow',
        });
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Não encontrado'))
      .finally(() => setLoading(false));
  }, [slug]);

  useDiretorioTerreiroJsonLd(terreiro);

  if (loading) {
    return (
      <MatrizEditorialLayout showFooter={false}>
        <div className="relative z-[1] grid min-h-dvh place-items-center pt-24">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-[#b98500]" />
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#1b1813]/45">Abrindo o perfil da casa</p>
          </div>
        </div>
      </MatrizEditorialLayout>
    );
  }

  if (error || !terreiro) {
    return (
      <MatrizEditorialLayout>
        <main className="relative z-[1] mx-auto grid min-h-[72vh] w-full max-w-[1180px] place-items-center px-5 pb-24 pt-36 text-center sm:px-7 lg:px-8">
          <div className="max-w-xl rounded-[2rem] border border-[#d9ccb7] bg-[#fffaf1]/90 p-8 shadow-[0_25px_80px_rgba(54,42,24,.12)] sm:p-12">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#9b6a00]">Diretório AxéCloud</p>
            <h1 className="mt-3 text-3xl font-extrabold tracking-[-0.04em] text-[#1b1813]">{error || 'Terreiro não encontrado'}</h1>
            <a href={ROUTES.terreiros} className="mt-7 inline-flex items-center gap-2 rounded-full bg-[#172018] px-6 py-3 text-sm font-extrabold text-white">
              <ArrowLeft className="h-4 w-4" aria-hidden />Voltar ao diretório
            </a>
          </div>
        </main>
      </MatrizEditorialLayout>
    );
  }

  const mapHref = ROUTES.terreiros;
  const localidade = [terreiro.cidade, terreiro.estado].filter(Boolean).join(' · ');
  const instagramUrl = (terreiro as DiretorioTerreiro & { instagramUrl?: string | null }).instagramUrl;
  const whatsappHref = terreiro.whatsapp
    ? `https://wa.me/${terreiro.whatsapp}?text=${encodeURIComponent(`Olá! Conheci o ${terreiro.nome} através do AxéCloud Gestão de Terreiros e gostaria de receber mais informações sobre giras e atendimentos.`)}`
    : null;

  return (
    <MatrizEditorialLayout>
      <main className="relative z-[1] mx-auto w-full max-w-[1180px] px-3 pb-20 pt-28 sm:px-6 sm:pt-28 lg:px-7">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 px-1">
          <a href={mapHref} className="inline-flex items-center gap-2 text-sm font-extrabold text-[#1b1813]/58 transition hover:text-[#8a6200]">
            <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
            Voltar para o Mapa
          </a>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#1b1813]/38">Informações públicas · confira antes de visitar</p>
        </div>

        <article className="overflow-hidden rounded-2xl border border-[#2a342c]/25 bg-[#f8efe1] shadow-[0_24px_72px_rgba(45,37,25,.14)]">
          <div className="grid min-[900px]:min-h-[24.5rem] min-[900px]:grid-cols-[1.08fr_.92fr]">
            <header className="relative flex flex-col justify-between overflow-hidden px-5 py-7 sm:px-8 sm:py-8">
              <div className="pointer-events-none absolute inset-0 opacity-45 [background-image:linear-gradient(rgba(83,65,34,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(83,65,34,.08)_1px,transparent_1px)] [background-size:72px_72px]" aria-hidden />
              <div className="pointer-events-none absolute -bottom-40 -left-40 h-[32rem] w-[32rem] rounded-full border border-[#b98500]/15" aria-hidden />
              <div className="relative">
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.23em] text-[#8a6200]">Diretório AxéCloud · casa mapeada</p>
                  {terreiro.verificada ? <VerifiedBadge /> : null}
                </div>
                <h1 className="mt-3.5 max-w-[16ch] text-balance text-[clamp(2.05rem,4.1vw,3.35rem)] font-extrabold leading-[0.98] tracking-[-0.04em] text-[#181a16]">{terreiro.nome}</h1>
                {localidade ? <p className="mt-5 flex items-center gap-2 text-sm font-bold text-[#1b1813]/58"><MapPin className="h-4 w-4 shrink-0 text-[#a67300]" aria-hidden />{localidade}</p> : null}
                {!terreiro.verificada ? (
                  <a
                    href="#reivindicar-perfil"
                    onClick={() => void trackConversionEvent('directory_action', { ctaId: 'directory-profile-hero-claim', ctaLabel: 'Sou responsável por esta casa', metadata: { slug: terreiro.slug } })}
                    className="mt-5 inline-flex items-center gap-2 rounded-xl border border-[#b98500]/35 bg-[#fffaf1]/75 px-4 py-2.5 text-xs font-extrabold text-[#6f5000] transition hover:border-[#b98500] hover:bg-[#fffaf1]"
                  >
                    <BadgeCheck className="h-4 w-4" /> Sou responsável por esta casa <ArrowRight className="h-3.5 w-3.5" />
                  </a>
                ) : null}
              </div>

              <div className="relative mt-7 grid grid-cols-2 border-t border-[#cbbb9f]/65 sm:grid-cols-3">
                <div className="pt-3.5 pr-3"><span className="block text-[8px] font-extrabold uppercase tracking-[0.16em] text-[#1b1813]/38">Tipo de página</span><strong className="mt-1 block text-xs text-[#1b1813] sm:text-sm">Perfil público</strong></div>
                <div className="border-l border-[#cbbb9f]/65 px-3 pt-3.5"><span className="block text-[8px] font-extrabold uppercase tracking-[0.16em] text-[#1b1813]/38">Localidade</span><strong className="mt-1 block truncate text-xs text-[#1b1813] sm:text-sm">{terreiro.estado || 'Brasil'}</strong></div>
                <div className="col-span-2 mt-3 border-t border-[#cbbb9f]/65 pt-3.5 sm:col-span-1 sm:mt-0 sm:border-l sm:border-t-0 sm:px-3"><span className="block text-[8px] font-extrabold uppercase tracking-[0.16em] text-[#1b1813]/38">Situação</span><strong className="mt-1 flex items-center gap-1.5 text-xs text-[#1b1813] sm:text-sm"><span className="h-2 w-2 rounded-full bg-emerald-600" />Listado</strong></div>
              </div>
            </header>

            <TerreiroPortrait fotoUrl={terreiro.fotoUrl} nome={terreiro.nome} />
          </div>
        </article>

        <section className="mt-5 rounded-2xl border border-[#d8cbb5] bg-[#fffaf1]/92 px-5 py-6 shadow-[0_18px_48px_rgba(63,49,27,.07)] sm:px-7 sm:py-7" aria-labelledby="visit-heading">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#9b6a00]">Dados disponíveis</p>
            <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
              <h2 id="visit-heading" className="text-2xl font-extrabold tracking-[-0.04em] text-[#1b1813] sm:text-3xl">Planeje sua visita.</h2>
              <span className="text-xs font-semibold text-[#1b1813]/42">Confirme diretamente com a casa</span>
            </div>

            <div className="mt-5 border-y border-[#cfc1ab]/60">
              <InfoRow icon={MapPin} label="Endereço">{terreiro.endereco || <span className="font-medium text-[#1b1813]/45">Endereço não informado</span>}</InfoRow>
              <InfoRow icon={MessageCircle} label="WhatsApp">
                {whatsappHref ? (
                  <a
                    href={whatsappHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Conversar com ${terreiro.nome} pelo WhatsApp`}
                    title="Conversar pelo WhatsApp"
                    onClick={() => {
                      trackDiretorioWhatsappClick(terreiro.slug);
                      void trackConversionEvent('cta_click', { ctaId: 'directory-profile-whatsapp', ctaLabel: 'Conversar pelo WhatsApp', metadata: { slug: terreiro.slug } });
                    }}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-full transition hover:-translate-y-0.5 hover:scale-105 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#25d366]/35"
                  >
                    <WhatsAppIcon className="h-11 w-11 drop-shadow-[0_8px_18px_rgba(39,180,62,.3)]" />
                    <span className="sr-only">Conversar pelo WhatsApp</span>
                  </a>
                ) : <span className="font-medium text-[#1b1813]/45">WhatsApp não disponível</span>}
              </InfoRow>
              {instagramUrl ? (
                <InfoRow icon={Instagram} label="Instagram">
                  <a
                    href={instagramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => void trackConversionEvent('cta_click', { ctaId: 'directory-profile-instagram', ctaLabel: 'Abrir Instagram da casa', metadata: { slug: terreiro.slug } })}
                    className="inline-flex items-center gap-2 underline decoration-[#b98500]/35 underline-offset-4 transition hover:text-[#8a6200]"
                  >
                    Abrir Instagram da casa
                    <ExternalLink className="h-4 w-4 shrink-0" aria-hidden />
                  </a>
                </InfoRow>
              ) : null}
            </div>

            {terreiro.linkMaps ? (
              <a
                href={terreiro.linkMaps}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => void trackConversionEvent('cta_click', { ctaId: 'directory-profile-map', ctaLabel: 'Traçar rota no Google Maps', metadata: { slug: terreiro.slug } })}
                className="mt-5 inline-flex w-full items-center justify-between gap-3 rounded-xl bg-[#e5ae12] px-5 py-3.5 text-sm font-extrabold text-[#11150f] shadow-[0_12px_28px_rgba(181,132,0,.16)] transition hover:bg-[#efb91e] sm:w-auto sm:min-w-72"
              >
                <span className="flex items-center gap-2"><Compass className="h-4 w-4" aria-hidden />Traçar rota no Google Maps</span><ExternalLink className="h-4 w-4 shrink-0" aria-hidden />
              </a>
            ) : null}
          </section>

        <GiraScheduleSection horarios={terreiro.horariosGira || []} />

        <ServicosSection
          servicos={servicosData.servicos}
          whatsappAtendimento={servicosData.whatsappAtendimento}
          terreiroNome={terreiro.nome}
          terreiroSlug={terreiro.slug}
          verificada={terreiro.verificada}
        />

        <section id="reivindicar-perfil" className="relative mt-5 scroll-mt-28 overflow-hidden rounded-2xl border border-[#2b251d] bg-[#0c120e] p-5 text-white shadow-[0_20px_56px_rgba(20,25,18,.16)] sm:p-7" aria-labelledby="claim-house-title">
          <div className="pointer-events-none absolute inset-0 opacity-25 [background-image:linear-gradient(rgba(229,174,18,.14)_1px,transparent_1px),linear-gradient(90deg,rgba(229,174,18,.14)_1px,transparent_1px)] [background-size:64px_64px]" aria-hidden />
          <div className="relative grid gap-6 min-[900px]:grid-cols-[minmax(0,1fr)_20rem] min-[900px]:items-center">
            <div>
              <div className="flex gap-4">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#e5ae12] text-[#1b1813]"><BadgeCheck className="h-5 w-5" aria-hidden /></span>
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#e5ae12]">Sistema AxéCloud de gestão de terreiros</p>
                  <h2 id="claim-house-title" className="mt-1 max-w-2xl text-xl font-extrabold tracking-[-0.03em] sm:text-2xl">Transforme este perfil na voz oficial da sua casa.</h2>
                  <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/62">
                    A reivindicação entra no sistema AxéCloud de gestão de terreiros: você assume os dados públicos e passa a administrar a casa no painel — financeiro, filhos de santo, giras e comunicação.
                    Teste {TRIAL_DAYS} dias grátis; depois, {PLAN_PRICE_STANDARD_LABEL}.
                  </p>
                </div>
              </div>
              <ul className="mt-5 grid gap-3 text-xs font-bold text-white/72 sm:grid-cols-3">
                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400" /> Gestão da casa no AxéCloud</li>
                <li className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-[#e5ae12]" /> {TRIAL_DAYS} dias de teste grátis</li>
                <li className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-400" /> Depois {PLAN_PRICE_STANDARD_LABEL}</li>
              </ul>
              <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/38">{TRIAL_DAYS} dias grátis · depois {PLAN_PRICE_STANDARD_LABEL}</p>
            </div>
            <div className="flex flex-col gap-3 min-[900px]:items-stretch">
            {terreiro.verificada ? (
              <>
                <span className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-emerald-400/35 bg-emerald-400/10 px-6 py-3.5 text-sm font-extrabold text-emerald-200"><BadgeCheck className="h-4 w-4" aria-hidden />Perfil verificado</span>
                <TerreiroClaimStatusDialog slug={terreiro.slug} terreiroNome={terreiro.nome} />
              </>
            ) : (
              <>
                <TerreiroClaimDialog
                  slug={terreiro.slug}
                  terreiroNome={terreiro.nome}
                  onTrack={() => void trackConversionEvent('claim_started', { ctaId: 'directory-profile-claim', ctaLabel: 'Assumir a gestão deste perfil', metadata: { slug: terreiro.slug } })}
                />
                <TerreiroClaimStatusDialog slug={terreiro.slug} terreiroNome={terreiro.nome} />
              </>
            )}
            </div>
          </div>
        </section>
      </main>
    </MatrizEditorialLayout>
  );
}
