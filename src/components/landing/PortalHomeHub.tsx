import { useEffect, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Building2,
  CalendarDays,
  Heart,
  Loader2,
  MapPin,
  Sparkles,
  Sun,
  Users,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TerreiroCard } from '../portal/TerreiroCard';
import { appHref } from '../../lib/appHref';
import {
  fetchPublicEventos,
  fetchPublicTerreiros,
  terreiroProfilePath,
  type PublicEvento,
  type PublicTerreiro,
} from '../../lib/portalPublic';
import { ROUTES } from '../../lib/routes';
import { FOUNDER_PROGRAM } from '../../constants/founderProgram';
import { cn } from '../../lib/utils';

type PortalTile = {
  id: string;
  title: string;
  description: string;
  href: string;
  icon: typeof Building2;
  accent: string;
  iconBg: string;
  featured?: boolean;
};

const EXPLORAR_TILES: PortalTile[] = [
  {
    id: 'terreiros',
    title: 'Terreiros',
    description: 'Casas de axé com perfil público — tradição, cidade e contacto.',
    href: ROUTES.terreiros,
    icon: Building2,
    accent: 'text-amber-400',
    iconBg: 'bg-amber-500/15 border-amber-500/25',
    featured: true,
  },
  {
    id: 'eventos',
    title: 'Eventos públicos',
    description: 'Giras e festas abertas divulgadas pelas casas no portal.',
    href: ROUTES.eventosPublicos,
    icon: CalendarDays,
    accent: 'text-rose-400',
    iconBg: 'bg-rose-500/15 border-rose-500/25',
    featured: true,
  },
  {
    id: 'reza',
    title: 'Pedir reza',
    description: 'Envie pedidos de reza às casas que activaram atendimento online.',
    href: ROUTES.espacoDoFiel,
    icon: Heart,
    accent: 'text-pink-400',
    iconBg: 'bg-pink-500/15 border-pink-500/25',
  },
  {
    id: 'calendario',
    title: 'Calendário litúrgico',
    description: 'Datas sagradas, festas de orixás e observâncias da tradição.',
    href: ROUTES.liturgicalCalendar,
    icon: Sun,
    accent: 'text-orange-400',
    iconBg: 'bg-orange-500/15 border-orange-500/25',
  },
  {
    id: 'conteudo',
    title: 'Conteúdo e glossário',
    description: 'Artigos, trilhas e termos do axé para filhos e consulentes.',
    href: ROUTES.contentHub,
    icon: BookOpen,
    accent: 'text-sky-400',
    iconBg: 'bg-sky-500/15 border-sky-500/25',
  },
];

function PortalTileCard({ tile }: { tile: PortalTile }) {
  const Icon = tile.icon;
  return (
    <a
      href={tile.href}
      className={cn(
        'group flex h-full flex-col rounded-2xl border bg-[#0B0D11] p-5 transition sm:p-6',
        tile.featured
          ? 'border-[#FBBC00]/25 hover:border-[#FBBC00]/45 hover:shadow-[0_0_32px_rgba(251,188,0,0.1)]'
          : 'border-[#1E242B] hover:border-[#2F3643] hover:bg-[#0D1015]',
      )}
    >
      <div
        className={cn(
          'mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl border',
          tile.iconBg,
        )}
      >
        <Icon className={cn('h-5 w-5', tile.accent)} aria-hidden />
      </div>
      <h3 className="text-lg font-bold text-[#F1F5F9] group-hover:text-[#FBBC00]">{tile.title}</h3>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-[#94A3B8]">{tile.description}</p>
      <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#FBBC00]">
        Acessar
        <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" aria-hidden />
      </span>
    </a>
  );
}

function formatEventDate(data: string): string {
  try {
    return format(parseISO(data), "d MMM · EEEE", { locale: ptBR });
  } catch {
    return data;
  }
}

function EventPreviewCard({ event }: { event: PublicEvento }) {
  const location = [event.terreiro.cidade, event.terreiro.estado].filter(Boolean).join(' · ');
  return (
    <a
      href={ROUTES.eventosPublicos}
      className="group flex gap-4 rounded-2xl border border-[#1E242B] bg-[#0B0D11] p-4 transition hover:border-[#FBBC00]/30 sm:p-5"
    >
      <div className="hidden h-20 w-28 shrink-0 overflow-hidden rounded-xl bg-[#12161A] sm:block">
        {event.bannerUrl ? (
          <img src={event.bannerUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full items-center justify-center">
            <CalendarDays className="h-8 w-8 text-white/10" aria-hidden />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[#FBBC00]">{event.tipo}</p>
        <h3 className="mt-1 truncate font-bold text-[#F1F5F9] group-hover:text-[#FBBC00]">{event.titulo}</h3>
        <p className="mt-1 text-sm text-[#94A3B8]">{formatEventDate(event.data)}</p>
        {event.hora ? <p className="text-xs text-[#64748B]">{event.hora}</p> : null}
        <p className="mt-2 flex items-center gap-1 text-xs text-[#94A3B8]">
          <MapPin className="h-3 w-3 shrink-0" aria-hidden />
          <span className="truncate">
            {event.terreiro.nome}
            {location ? ` · ${location}` : ''}
          </span>
        </p>
      </div>
    </a>
  );
}

function SectionLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className="inline-flex items-center gap-1.5 text-sm font-bold text-[#FBBC00] transition hover:text-[#FDE047]"
    >
      {label}
      <ArrowRight className="h-4 w-4" aria-hidden />
    </a>
  );
}

function FounderProgramPulseCallout({ className }: { className?: string }) {
  return (
    <a
      href={ROUTES.founderProgram}
      className={cn(
        'portal-founder-callout group relative flex flex-col overflow-hidden rounded-2xl border border-[#FBBC00]/45 bg-gradient-to-br from-[#1a1508] via-[#13171D] to-[#0B0D11] p-4 text-left transition hover:border-[#FBBC00]/70 sm:p-5',
        className,
      )}
      aria-label={`Programa Fundador — ${FOUNDER_PROGRAM.freeMonths} meses gratuitos para terreiros`}
    >
      <span
        className="portal-founder-callout-ring pointer-events-none absolute -inset-px rounded-2xl border-2 border-[#FBBC00]/50"
        aria-hidden
      />
      <span
        className="portal-founder-callout-badge inline-flex w-fit items-center gap-1.5 rounded-full border border-[#FBBC00]/40 bg-[#FBBC00]/15 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-[#FBBC00]"
      >
        <Sparkles className="h-3 w-3 shrink-0" aria-hidden />
        Vagas limitadas
      </span>
      <p className="mt-3 font-display text-lg font-black leading-tight text-[#F1F5F9] group-hover:text-[#FBBC00] sm:text-xl">
        Programa Fundador
      </p>
      <p className="mt-2 text-sm font-semibold leading-snug text-[#FBBC00]">
        {FOUNDER_PROGRAM.freeMonths} meses grátis para a sua casa
      </p>
      <p className="mt-2 text-xs leading-relaxed text-[#94A3B8]">
        Onboarding personalizado e selo de Casa Fundadora no portal público.
      </p>
      <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#FBBC00]">
        Quero participar
        <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" aria-hidden />
      </span>
    </a>
  );
}

export function PortalHomeHub() {
  const [eventos, setEventos] = useState<PublicEvento[]>([]);
  const [terreiros, setTerreiros] = useState<PublicTerreiro[]>([]);
  const [loadingEventos, setLoadingEventos] = useState(true);
  const [loadingTerreiros, setLoadingTerreiros] = useState(true);

  useEffect(() => {
    void fetchPublicEventos()
      .then((items) => setEventos(items.slice(0, 3)))
      .catch(() => setEventos([]))
      .finally(() => setLoadingEventos(false));
  }, []);

  useEffect(() => {
    void fetchPublicTerreiros({ page: 1 })
      .then((res) => setTerreiros(res.items.slice(0, 3)))
      .catch(() => setTerreiros([]))
      .finally(() => setLoadingTerreiros(false));
  }, []);

  return (
    <>
      <section className="relative overflow-hidden pb-10 pt-10 sm:pb-14 sm:pt-14" aria-labelledby="portal-hero-title">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(251,188,0,0.12),transparent)]"
          aria-hidden
        />
        <div className="landing-section-inner mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-8 lg:grid-cols-[minmax(240px,280px)_1fr] lg:gap-10 xl:grid-cols-[280px_minmax(0,1fr)]">
            <FounderProgramPulseCallout className="mx-auto w-full max-w-sm lg:mx-0 lg:max-w-none lg:sticky lg:top-24" />

            <div className="mx-auto max-w-3xl text-center lg:max-w-none">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#FBBC00]/25 bg-[#13171D] px-3 py-1.5">
              <Sparkles className="h-3.5 w-3.5 text-[#FBBC00]" aria-hidden />
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#F1F5F9] md:text-xs">
                Portal da comunidade de terreiros
              </span>
            </div>
            <h1
              id="portal-hero-title"
              className="font-display text-3xl font-black leading-tight tracking-tight text-[#F1F5F9] sm:text-4xl md:text-5xl"
            >
              Encontre casas, veja giras e{' '}
              <span className="bg-gradient-to-r from-[#FBBC00] via-amber-400 to-yellow-300 bg-clip-text text-transparent">
                participe do axé
              </span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-[#94A3B8] md:text-lg">
              O AxéCloud reúne terreiros, eventos públicos, pedidos de reza e conteúdo sobre Umbanda, Candomblé e
              Jurema — escolha abaixo o que quer fazer agora.
            </p>
            </div>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {EXPLORAR_TILES.map((tile) => (
              <PortalTileCard key={tile.id} tile={tile} />
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section landing-section--alt" aria-labelledby="eventos-preview-title">
        <div className="landing-section-inner mx-auto max-w-7xl">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="landing-kicker">Agenda cultural</p>
              <h2 id="eventos-preview-title" className="landing-title text-left">
                Próximos eventos públicos
              </h2>
              <p className="landing-lead mx-0 mt-2 max-w-xl text-left">
                Giras e festas que as casas divulgaram abertamente — confirme horário e endereço com o terreiro.
              </p>
            </div>
            <SectionLink href={ROUTES.eventosPublicos} label="Ver todos os eventos" />
          </div>

          <div className="mt-8">
            {loadingEventos ? (
              <div className="flex justify-center py-12" aria-busy="true">
                <Loader2 className="h-7 w-7 animate-spin text-[#FBBC00]" />
              </div>
            ) : eventos.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#1E242B] px-6 py-10 text-center">
                <CalendarDays className="mx-auto h-10 w-10 text-[#64748B]" aria-hidden />
                <p className="mt-3 text-[#94A3B8]">Ainda não há eventos públicos agendados.</p>
                <p className="mt-1 text-sm text-[#64748B]">
                  Explore os terreiros — quando uma casa publicar uma gira, ela aparece aqui.
                </p>
                <a href={ROUTES.terreiros} className="landing-btn-secondary mt-5 inline-flex text-sm">
                  Ver terreiros
                </a>
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-3">
                {eventos.map((ev) => (
                  <EventPreviewCard key={ev.id} event={ev} />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="landing-section" aria-labelledby="terreiros-preview-title">
        <div className="landing-section-inner mx-auto max-w-7xl">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="landing-kicker">Diretório</p>
              <h2 id="terreiros-preview-title" className="landing-title text-left">
                Casas no portal
              </h2>
              <p className="landing-lead mx-0 mt-2 max-w-xl text-left">
                Perfis públicos de terreiros — tradição, localização e, quando activo, pedidos de reza online.
              </p>
            </div>
            <SectionLink href={ROUTES.terreiros} label="Explorar todas as casas" />
          </div>

          <div className="mt-8">
            {loadingTerreiros ? (
              <div className="flex justify-center py-12" aria-busy="true">
                <Loader2 className="h-7 w-7 animate-spin text-[#FBBC00]" />
              </div>
            ) : terreiros.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#1E242B] px-6 py-10 text-center">
                <Building2 className="mx-auto h-10 w-10 text-[#64748B]" aria-hidden />
                <p className="mt-3 text-[#94A3B8]">As primeiras casas estão a activar o perfil público.</p>
                <a href={ROUTES.founderProgram} className="landing-btn-secondary mt-5 inline-flex text-sm">
                  Programa Fundador
                </a>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {terreiros.map((t) => (
                  <TerreiroCard key={t.slug} terreiro={t} href={terreiroProfilePath(t.slug)} />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="landing-section landing-section--highlight pb-16" aria-labelledby="gestor-strip-title">
        <div className="landing-section-inner mx-auto max-w-7xl">
          <div className="rounded-[2rem] border border-[#1E242B] bg-[#0B0D11] p-6 sm:p-8 md:flex md:items-center md:justify-between md:gap-8">
            <div className="flex items-start gap-4">
              <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-emerald-500/25 bg-emerald-500/10 sm:flex">
                <Users className="h-6 w-6 text-emerald-400" aria-hidden />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-400">Para zeladores e diretoria</p>
                <h2 id="gestor-strip-title" className="mt-2 font-display text-xl font-black text-[#F1F5F9] md:text-2xl">
                  Gerencia o seu terreiro no AxéCloud
                </h2>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#94A3B8]">
                  Painel completo: filhos de santo, calendário, financeiro com Pix, mural, galeria e portal do filho —
                  além de publicar eventos e perfil da casa neste portal.
                </p>
              </div>
            </div>
            <div className="mt-6 flex shrink-0 flex-col gap-3 sm:flex-row md:mt-0">
              <a href={appHref(ROUTES.login)} className="landing-btn-secondary text-center text-sm">
                Entrar no painel
              </a>
              <a href={ROUTES.founderProgram} className="landing-btn-primary text-center text-sm">
                Programa Fundador
              </a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
