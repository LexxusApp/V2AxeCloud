import { useEffect, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Building2,
  CalendarDays,
  Heart,
  Loader2,
  MapPin,
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
import { cn } from '../../lib/utils';

type PortalTile = {
  id: string;
  eyebrow: string;
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
    eyebrow: 'Diretório público',
    title: 'Terreiros',
    description: 'Encontre casas de axé por tradição, cidade e perfil público.',
    href: ROUTES.terreiros,
    icon: Building2,
    accent: 'text-amber-600',
    iconBg: 'bg-amber-50 border-amber-200',
    featured: true,
  },
  {
    id: 'eventos',
    eyebrow: 'Agenda aberta',
    title: 'Eventos públicos',
    description: 'Veja giras, festas e encontros divulgados pelas casas.',
    href: ROUTES.eventosPublicos,
    icon: CalendarDays,
    accent: 'text-amber-600',
    iconBg: 'bg-amber-50 border-amber-200',
    featured: true,
  },
  {
    id: 'reza',
    eyebrow: 'Atendimento online',
    title: 'Pedir reza',
    description: 'Envie seu pedido às casas que ativaram o acolhimento online.',
    href: ROUTES.espacoDoFiel,
    icon: Heart,
    accent: 'text-amber-600',
    iconBg: 'bg-amber-50 border-amber-200',
  },
  {
    id: 'calendario',
    eyebrow: 'Cultura & tradição',
    title: 'Calendário litúrgico',
    description: 'Consulte datas sagradas, festas de orixás e observâncias.',
    href: ROUTES.liturgicalCalendar,
    icon: Sun,
    accent: 'text-amber-600',
    iconBg: 'bg-amber-50 border-amber-200',
  },
  {
    id: 'conteudo',
    eyebrow: 'Conhecimento',
    title: 'Conteúdo e glossário',
    description: 'Artigos, trilhas e termos do axé para filhos e consulentes.',
    href: ROUTES.contentHub,
    icon: BookOpen,
    accent: 'text-amber-600',
    iconBg: 'bg-amber-50 border-amber-200',
  },
];

function AfroPattern({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 60 240" fill="none" preserveAspectRatio="xMidYMid meet" aria-hidden>
      <g stroke="currentColor" strokeWidth="2.5">
        <path d="M6 12 L30 32 L54 12" />
        <path d="M6 26 L30 46 L54 26" />
        <path d="M30 70 l16 16 l-16 16 l-16 -16 z" />
        <path d="M30 78 l8 8 l-8 8 l-8 -8 z" />
        <path d="M6 140 L30 160 L54 140" />
        <path d="M6 154 L30 174 L54 154" />
      </g>
      <g fill="currentColor">
        <circle cx="14" cy="206" r="3" />
        <circle cx="30" cy="206" r="3" />
        <circle cx="46" cy="206" r="3" />
        <circle cx="22" cy="220" r="3" />
        <circle cx="38" cy="220" r="3" />
        <circle cx="30" cy="234" r="3" />
      </g>
    </svg>
  );
}

function PortalTileCard({ tile }: { tile: PortalTile }) {
  const Icon = tile.icon;
  return (
    <a
      href={tile.href}
      className="group relative flex h-full flex-col rounded-2xl border border-[#ece4d2] bg-white p-6 transition duration-200 hover:-translate-y-1 hover:border-amber-300 hover:shadow-xl hover:shadow-amber-900/10"
    >
      <div
        className={cn(
          'inline-flex h-12 w-12 items-center justify-center rounded-xl border transition group-hover:scale-105',
          tile.iconBg,
        )}
      >
        <Icon className={cn('h-5 w-5', tile.accent)} aria-hidden />
      </div>

      <p className="mt-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{tile.eyebrow}</p>
      <h3 className="mt-1.5 font-display text-xl font-black tracking-tight text-slate-900">{tile.title}</h3>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">{tile.description}</p>

      <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold text-amber-600 transition-all group-hover:gap-2.5">
        Acessar
        <ArrowRight className="h-4 w-4" aria-hidden />
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
      className="group flex gap-4 rounded-2xl border border-[#ece4d2] bg-white p-4 transition hover:border-amber-400/40 sm:p-5 shadow-sm"
    >
      <div className="hidden h-20 w-28 shrink-0 overflow-hidden rounded-xl bg-slate-100 sm:block">
        {event.bannerUrl ? (
          <img src={event.bannerUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full items-center justify-center">
            <CalendarDays className="h-8 w-8 text-slate-300" aria-hidden />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600">{event.tipo}</p>
        <h3 className="mt-1 truncate font-bold text-slate-900 group-hover:text-amber-600">{event.titulo}</h3>
        <p className="mt-1 text-sm text-slate-600">{formatEventDate(event.data)}</p>
        {event.hora ? <p className="text-xs text-slate-500">{event.hora}</p> : null}
        <p className="mt-2 flex items-center gap-1 text-xs text-slate-500">
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
      className="inline-flex items-center gap-1.5 text-sm font-bold text-amber-600 transition hover:text-amber-500"
    >
      {label}
      <ArrowRight className="h-4 w-4" aria-hidden />
    </a>
  );
}

function PortalTerreirosShowcase({
  terreiros,
}: {
  terreiros: PublicTerreiro[];
}) {
  const [principal, ...outros] = terreiros;
  const totalLabel = terreiros.length === 1 ? '1 casa publicada' : `${terreiros.length} casas publicadas`;

  return (
    <div className="grid gap-6 lg:grid-cols-[22rem_minmax(0,1fr)] lg:items-start">
      <div className="mx-auto w-full max-w-sm min-w-0 lg:mx-0">
        <div className="mb-4 flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-amber-700">
            Casa em destaque
          </span>
          <span className="text-xs font-bold text-slate-500">{totalLabel}</span>
        </div>
        <TerreiroCard terreiro={principal} href={terreiroProfilePath(principal.slug)} />
      </div>

      <div className="flex min-w-0 flex-col justify-between rounded-[1.75rem] border border-slate-200 bg-slate-50 p-6 sm:p-7">
        <div>
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-200 bg-white">
            <Building2 className="h-6 w-6 text-amber-600" aria-hidden />
          </div>
          <p className="mt-5 text-[10px] font-black uppercase tracking-[0.24em] text-amber-600">
            Diretório em expansão
          </p>
          <h3 className="mt-3 font-display text-2xl font-black leading-tight text-slate-900 sm:text-3xl">
            Casas de axé ganhando presença pública com mais cuidado.
          </h3>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-600">
            Cada perfil reúne tradição, localização e recursos ativados pela casa. O portal está crescendo com as
            primeiras casas fundadoras e novos cadastros entram em destaque.
          </p>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-2xl font-black text-slate-900">{terreiros.length}</p>
            <p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">no portal</p>
          </div>
          <a
            href={ROUTES.founderProgram}
            className="group rounded-2xl border border-amber-400/40 bg-amber-400 p-4 text-neutral-900 transition hover:bg-amber-300"
          >
            <p className="text-xs font-black uppercase tracking-[0.16em] text-neutral-900/70">Cadastre sua casa</p>
            <span className="mt-2 inline-flex items-center gap-1 text-sm font-bold text-neutral-900">
              Programa Fundador
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden />
            </span>
          </a>
        </div>

        {outros.length > 0 ? (
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {outros.map((t) => (
              <TerreiroCard key={t.slug} terreiro={t} href={terreiroProfilePath(t.slug)} />
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-dashed border-amber-300 bg-amber-50/60 p-4">
            <p className="text-sm font-bold text-slate-900">Sua casa pode aparecer aqui.</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              O Programa Fundador libera o AxéCloud por 12 meses e prioriza o perfil público da casa no portal.
            </p>
          </div>
        )}
      </div>
    </div>
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

  const heroTerreiro = terreiros[0];
  const heroLocal = heroTerreiro
    ? [heroTerreiro.cidade, heroTerreiro.estado].filter(Boolean).join(' · ') || 'Brasil'
    : null;

  return (
    <>
      <section className="relative overflow-hidden border-b border-[#ece4d2]" aria-labelledby="portal-hero-title">
        <AfroPattern className="pointer-events-none absolute -left-10 top-4 hidden h-64 w-40 text-amber-400/30 lg:block" />
        <AfroPattern className="pointer-events-none absolute -right-10 bottom-4 hidden h-64 w-40 rotate-180 text-amber-400/25 lg:block" />
        <div
          className="pointer-events-none absolute -right-24 -top-24 -z-10 h-[26rem] w-[26rem] rounded-full bg-amber-300/20 blur-3xl"
          aria-hidden
        />

        <div className="landing-section-inner mx-auto max-w-7xl px-4 pb-14 pt-12 sm:px-6 sm:pb-20 sm:pt-16 lg:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
            <div className="max-w-xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-amber-700 md:text-xs">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                Plataforma para terreiros
              </span>

              <h1
                id="portal-hero-title"
                className="mt-6 font-display text-4xl font-black uppercase leading-[1.02] tracking-tight text-[#1b1813] sm:text-5xl lg:text-6xl"
              >
                Gestão, conexão
                <br />
                e força para o
                <br />
                seu <span className="text-amber-500">terreiro</span>
              </h1>

              <p className="mt-6 max-w-lg text-lg leading-relaxed text-neutral-600">
                AxéCloud é a plataforma completa para terreiros organizarem a casa, cuidarem da comunidade e manterem
                viva a cultura — Umbanda, Candomblé e Jurema com respeito e tecnologia.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a
                  href={ROUTES.terreiros}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-400 px-6 py-3.5 text-sm font-bold text-neutral-900 shadow-lg shadow-amber-500/25 transition hover:bg-amber-300"
                >
                  Explorar terreiros
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </a>
                <a
                  href={appHref(ROUTES.login)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-neutral-900 px-6 py-3.5 text-sm font-bold text-neutral-900 transition hover:bg-neutral-900 hover:text-white"
                >
                  <Users className="h-4 w-4" aria-hidden />
                  Sou zelador(a)
                </a>
              </div>

              <dl className="mt-10 grid w-full max-w-lg grid-cols-3 gap-4 border-t border-[#e4dcc7] pt-6">
                {[
                  { icon: Building2, label: 'Casas no portal' },
                  { icon: CalendarDays, label: 'Giras e eventos' },
                  { icon: Heart, label: 'Pedidos de reza' },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="flex flex-col gap-1.5">
                    <Icon className="h-5 w-5 text-amber-600" aria-hidden />
                    <dt className="text-xs font-semibold leading-tight text-neutral-600">{label}</dt>
                  </div>
                ))}
              </dl>
            </div>

            <div className="relative mx-auto w-full max-w-md lg:max-w-none">
              <div className="overflow-hidden rounded-[1.75rem] border border-[#ece4d2] bg-white shadow-2xl shadow-amber-900/10">
                <div className="relative aspect-[16/10] overflow-hidden bg-neutral-900">
                  {heroTerreiro?.fotoUrl ? (
                    <img src={heroTerreiro.fotoUrl} alt="" className="h-full w-full object-cover" loading="eager" />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <Sun className="h-16 w-16 text-amber-400/40" aria-hidden />
                    </div>
                  )}
                  <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-amber-400 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-neutral-900">
                    <Sun className="h-3 w-3" aria-hidden />
                    Destaque
                  </span>
                </div>
                <div className="flex items-start gap-4 p-5">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-neutral-900 text-amber-400">
                    <Building2 className="h-6 w-6" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate font-display text-lg font-black text-[#1b1813]">
                      {heroTerreiro?.nome ?? 'Sua casa de axé aqui'}
                    </h2>
                    {heroLocal ? (
                      <p className="mt-0.5 flex items-center gap-1.5 text-sm text-neutral-500">
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-amber-600" aria-hidden />
                        {heroLocal}
                      </p>
                    ) : (
                      <p className="mt-0.5 text-sm text-neutral-500">Publique o perfil público da sua casa</p>
                    )}
                    <a
                      href={heroTerreiro ? terreiroProfilePath(heroTerreiro.slug) : ROUTES.terreiros}
                      className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-amber-700 transition hover:gap-2.5"
                    >
                      Ver perfil do terreiro
                      <ArrowRight className="h-4 w-4" aria-hidden />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-[#161310]" aria-label="Destaques da plataforma">
        <AfroPattern className="pointer-events-none absolute left-0 top-1/2 hidden h-48 w-28 -translate-y-1/2 text-amber-400/20 md:block" />
        <AfroPattern className="pointer-events-none absolute right-0 top-1/2 hidden h-48 w-28 -translate-y-1/2 rotate-180 text-amber-400/20 md:block" />
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: Users, title: 'Gestão completa', desc: 'Organize membros, obrigações, festejos e atividades da casa em um só lugar.' },
              { icon: CalendarDays, title: 'Agenda integrada', desc: 'Divulgue eventos, giras e convites para toda a comunidade.' },
              { icon: Heart, title: 'Acolhimento online', desc: 'Receba pedidos de reza e aproxime consulentes da sua casa.' },
              { icon: BookOpen, title: 'Conteúdo e cultura', desc: 'Acesse materiais e termos que fortalecem o conhecimento do axé.' },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="text-center sm:text-left">
                <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-400/15 text-amber-400 sm:mx-0">
                  <Icon className="h-6 w-6" aria-hidden />
                </div>
                <h3 className="mt-4 font-display text-base font-black text-white">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-neutral-400">{desc}</p>
              </div>
            ))}
          </div>
          <div className="mx-auto mt-12 flex max-w-max items-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-bold text-neutral-200">
            <Heart className="h-4 w-4 text-amber-400" aria-hidden />
            Feito para terreiros. Feito com axé. <span className="text-amber-400">AxéCloud</span>
          </div>
        </div>
      </section>

      <section className="border-b border-[#ece4d2] bg-white" aria-labelledby="explorar-title">
        <div className="landing-section-inner mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-amber-600">Explorar o portal</p>
            <h2 id="explorar-title" className="mt-3 font-display text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
              O que você quer fazer agora?
            </h2>
            <p className="mt-3 text-base text-slate-600">
              Tudo o que a comunidade do axé precisa, reunido e fácil de acessar.
            </p>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                <Loader2 className="h-7 w-7 animate-spin text-amber-500" />
              </div>
            ) : eventos.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 px-6 py-10 text-center">
                <CalendarDays className="mx-auto h-10 w-10 text-slate-400" aria-hidden />
                <p className="mt-3 text-slate-600">Ainda não há eventos públicos agendados.</p>
                <p className="mt-1 text-sm text-slate-500">
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
                <Loader2 className="h-7 w-7 animate-spin text-amber-500" />
              </div>
            ) : terreiros.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 px-6 py-10 text-center">
                <Building2 className="mx-auto h-10 w-10 text-slate-400" aria-hidden />
                <p className="mt-3 text-slate-600">As primeiras casas estão a activar o perfil público.</p>
                <a href={ROUTES.founderProgram} className="landing-btn-secondary mt-5 inline-flex text-sm">
                  Programa Fundador
                </a>
              </div>
            ) : (
              <PortalTerreirosShowcase terreiros={terreiros} />
            )}
          </div>
        </div>
      </section>
    </>
  );
}
