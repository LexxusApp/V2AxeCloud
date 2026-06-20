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
    accent: 'text-emerald-600',
    iconBg: 'bg-emerald-50 border-emerald-200',
    featured: true,
  },
  {
    id: 'eventos',
    eyebrow: 'Agenda aberta',
    title: 'Eventos públicos',
    description: 'Veja giras, festas e encontros divulgados pelas casas.',
    href: ROUTES.eventosPublicos,
    icon: CalendarDays,
    accent: 'text-emerald-600',
    iconBg: 'bg-emerald-50 border-emerald-200',
    featured: true,
  },
  {
    id: 'reza',
    eyebrow: 'Atendimento online',
    title: 'Pedir reza',
    description: 'Envie seu pedido às casas que ativaram o acolhimento online.',
    href: ROUTES.espacoDoFiel,
    icon: Heart,
    accent: 'text-emerald-600',
    iconBg: 'bg-emerald-50 border-emerald-200',
  },
  {
    id: 'calendario',
    eyebrow: 'Cultura & tradição',
    title: 'Calendário litúrgico',
    description: 'Consulte datas sagradas, festas de orixás e observâncias.',
    href: ROUTES.liturgicalCalendar,
    icon: Sun,
    accent: 'text-emerald-600',
    iconBg: 'bg-emerald-50 border-emerald-200',
  },
  {
    id: 'conteudo',
    eyebrow: 'Conhecimento',
    title: 'Conteúdo e glossário',
    description: 'Artigos, trilhas e termos do axé para filhos e consulentes.',
    href: ROUTES.contentHub,
    icon: BookOpen,
    accent: 'text-emerald-600',
    iconBg: 'bg-emerald-50 border-emerald-200',
  },
];

function PortalTileCard({ tile }: { tile: PortalTile }) {
  const Icon = tile.icon;
  return (
    <a
      href={tile.href}
      className="group relative flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-6 transition duration-200 hover:-translate-y-1 hover:border-emerald-200 hover:shadow-xl hover:shadow-slate-200/60"
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

      <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold text-emerald-600 transition-all group-hover:gap-2.5">
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
      className="group flex gap-4 rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-emerald-500/30 sm:p-5 shadow-sm"
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
        <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">{event.tipo}</p>
        <h3 className="mt-1 truncate font-bold text-slate-900 group-hover:text-emerald-600">{event.titulo}</h3>
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
      className="inline-flex items-center gap-1.5 text-sm font-bold text-emerald-600 transition hover:text-emerald-500"
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
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">
            Casa em destaque
          </span>
          <span className="text-xs font-bold text-slate-500">{totalLabel}</span>
        </div>
        <TerreiroCard terreiro={principal} href={terreiroProfilePath(principal.slug)} />
      </div>

      <div className="flex min-w-0 flex-col justify-between rounded-[1.75rem] border border-slate-200 bg-slate-50 p-6 sm:p-7">
        <div>
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-200 bg-white">
            <Building2 className="h-6 w-6 text-emerald-600" aria-hidden />
          </div>
          <p className="mt-5 text-[10px] font-black uppercase tracking-[0.24em] text-emerald-600">
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
            className="group rounded-2xl border border-emerald-500/30 bg-emerald-600 p-4 text-white transition hover:bg-emerald-700"
          >
            <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-100">Cadastre sua casa</p>
            <span className="mt-2 inline-flex items-center gap-1 text-sm font-bold text-white">
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
          <div className="mt-6 rounded-2xl border border-dashed border-emerald-300 bg-emerald-50/60 p-4">
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

  return (
    <>
      <section className="relative overflow-hidden" aria-labelledby="portal-hero-title">
        <div
          className="pointer-events-none absolute -left-32 -top-24 -z-10 h-[28rem] w-[28rem] rounded-full bg-emerald-200/40 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -right-24 top-40 -z-10 h-[22rem] w-[22rem] rounded-full bg-emerald-100/50 blur-3xl"
          aria-hidden
        />

        <div className="landing-section-inner mx-auto max-w-7xl px-4 pb-14 pt-12 sm:px-6 sm:pb-20 sm:pt-16 lg:px-8">
          <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-3 py-1.5 shadow-sm">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-700 md:text-xs">
                Portal da comunidade de terreiros
              </span>
            </div>

            <h1
              id="portal-hero-title"
              className="mt-6 font-display text-4xl font-black leading-[1.05] tracking-tight text-slate-900 sm:text-5xl lg:text-6xl"
            >
              A casa de axé,{' '}
              <span className="relative whitespace-nowrap text-emerald-600">
                organizada
                <svg
                  className="absolute -bottom-1 left-0 h-2.5 w-full text-emerald-300"
                  viewBox="0 0 100 8"
                  preserveAspectRatio="none"
                  aria-hidden
                >
                  <path d="M0 6 Q 25 0 50 4 T 100 3" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" />
                </svg>
              </span>
              <br />
              e conectada à comunidade.
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-600">
              Encontre terreiros, acompanhe giras e peça reza — e, se você zela por uma casa, gerencie tudo num só
              lugar. Umbanda, Candomblé e Jurema com respeito e tecnologia.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href={ROUTES.terreiros}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-700 hover:shadow-emerald-600/30"
              >
                Explorar terreiros
                <ArrowRight className="h-4 w-4" aria-hidden />
              </a>
              <a
                href={appHref(ROUTES.login)}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-6 py-3.5 text-sm font-bold text-slate-700 transition hover:border-emerald-300 hover:text-emerald-700"
              >
                <Users className="h-4 w-4" aria-hidden />
                Sou zelador(a)
              </a>
            </div>

            <dl className="mt-10 grid w-full max-w-lg grid-cols-3 gap-4 border-t border-slate-200 pt-6">
              {[
                { icon: Building2, label: 'Casas no portal' },
                { icon: CalendarDays, label: 'Giras e eventos' },
                { icon: Heart, label: 'Pedidos de reza' },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="flex flex-col items-center gap-1.5">
                  <Icon className="h-5 w-5 text-emerald-600" aria-hidden />
                  <dt className="text-xs font-semibold leading-tight text-slate-600">{label}</dt>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white" aria-labelledby="explorar-title">
        <div className="landing-section-inner mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-emerald-600">Explorar o portal</p>
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
                <Loader2 className="h-7 w-7 animate-spin text-emerald-500" />
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
                <Loader2 className="h-7 w-7 animate-spin text-emerald-500" />
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
