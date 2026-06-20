import { useEffect, useState } from 'react';
import { ArrowRight, BookOpen, Building2, CalendarDays, Heart, Loader2, MapPin, Sun } from 'lucide-react';
import { LandingMockupHero } from './LandingMockupHero';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TerreiroCard } from '../portal/TerreiroCard';
import {
  fetchPublicEventos,
  fetchPublicTerreiros,
  terreiroProfilePath,
  type PublicEvento,
  type PublicTerreiro,
} from '../../lib/portalPublic';
import { ROUTES } from '../../lib/routes';
import { cn } from '../../lib/utils';
import { landingMockupCardClass, landingMockupInsetCardClass, landingMockupKickerClass, landingMockupLinkClass, landingMockupShellClass } from './landingMockupUi';

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
    accent: 'text-[#a87400]',
    iconBg: 'bg-[#FFC107]/18 border-[#FFC107]/35',
    featured: true,
  },
  {
    id: 'eventos',
    eyebrow: 'Agenda aberta',
    title: 'Eventos públicos',
    description: 'Veja giras, festas e encontros divulgados pelas casas.',
    href: ROUTES.eventosPublicos,
    icon: CalendarDays,
    accent: 'text-[#2563eb]',
    iconBg: 'bg-[#2563eb]/12 border-[#2563eb]/25',
    featured: true,
  },
  {
    id: 'reza',
    eyebrow: 'Atendimento online',
    title: 'Pedir reza',
    description: 'Envie seu pedido às casas que ativaram o acolhimento online.',
    href: ROUTES.espacoDoFiel,
    icon: Heart,
    accent: 'text-[#dc2626]',
    iconBg: 'bg-[#dc2626]/12 border-[#dc2626]/25',
  },
  {
    id: 'calendario',
    eyebrow: 'Cultura & tradição',
    title: 'Calendário litúrgico',
    description: 'Consulte datas sagradas, festas de orixás e observâncias.',
    href: ROUTES.liturgicalCalendar,
    icon: Sun,
    accent: 'text-[#16a34a]',
    iconBg: 'bg-[#16a34a]/12 border-[#16a34a]/25',
  },
  {
    id: 'conteudo',
    eyebrow: 'Conhecimento',
    title: 'Conteúdo e glossário',
    description: 'Artigos, trilhas e termos do axé para filhos e consulentes.',
    href: ROUTES.contentHub,
    icon: BookOpen,
    accent: 'text-[#7c3aed]',
    iconBg: 'bg-[#7c3aed]/12 border-[#7c3aed]/25',
  },
];

function PortalTileCard({ tile }: { tile: PortalTile }) {
  const Icon = tile.icon;
  return (
    <a
      href={tile.href}
      className={cn('group relative flex h-full flex-col p-6 transition duration-200 hover:-translate-y-1 hover:border-[#FFC107]/50 hover:shadow-[0_20px_50px_rgba(27,24,19,0.12)]', landingMockupCardClass, 'rounded-[1.75rem]')}
    >
      <div
        className={cn(
          'inline-flex h-12 w-12 items-center justify-center rounded-xl border transition group-hover:scale-105',
          tile.iconBg,
        )}
      >
        <Icon className={cn('h-5 w-5', tile.accent)} aria-hidden />
      </div>

      <p className="mt-5 text-[10px] font-black uppercase tracking-[0.2em] text-[#1b1813]/62">{tile.eyebrow}</p>
      <h3 className="mt-1.5 font-display text-xl font-black tracking-tight text-[#1b1813]">{tile.title}</h3>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-[#1b1813]/65">{tile.description}</p>

      <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold text-[#1b1813] transition-all group-hover:gap-2.5 group-hover:text-[#FFC107]">
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
      className={cn('group flex gap-4 p-4 transition hover:border-[#FFC107]/40 sm:p-5', landingMockupCardClass, 'rounded-[1.75rem]')}
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
        <p className="text-[10px] font-black uppercase tracking-widest text-[#FFC107]">{event.tipo}</p>
        <h3 className="mt-1 truncate font-bold text-[#1b1813] group-hover:text-[#FFC107]">{event.titulo}</h3>
        <p className="mt-1 text-sm text-[#1b1813]/65">{formatEventDate(event.data)}</p>
        {event.hora ? <p className="text-xs text-[#1b1813]/66">{event.hora}</p> : null}
        <p className="mt-2 flex items-center gap-1 text-xs text-[#1b1813]/66">
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
      className={landingMockupLinkClass}
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
          <span className={landingMockupKickerClass}>Casa em destaque</span>
          <span className="text-xs font-bold text-slate-500">{totalLabel}</span>
        </div>
        <TerreiroCard terreiro={principal} href={terreiroProfilePath(principal.slug)} />
      </div>

      <div className={cn('flex min-w-0 flex-col justify-between p-6 sm:p-7', landingMockupCardClass, 'rounded-[1.75rem]')}>
        <div>
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-[#FFC107]/35 bg-white">
            <Building2 className="h-6 w-6 text-[#FFC107]" aria-hidden />
          </div>
          <p className="mt-5 text-[10px] font-black uppercase tracking-[0.24em] text-[#FFC107]">
            Diretório em expansão
          </p>
          <h3 className="mt-3 font-display text-2xl font-black leading-tight text-[#1b1813] sm:text-3xl">
            Casas de axé ganhando presença pública com mais cuidado.
          </h3>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-[#1b1813]/65">
            Cada perfil reúne tradição, localização e recursos ativados pela casa. O portal está crescendo com as
            primeiras casas fundadoras e novos cadastros entram em destaque.
          </p>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <div className={cn('p-4', landingMockupInsetCardClass, 'rounded-2xl')}>
            <p className="text-2xl font-black text-[#1b1813]">{terreiros.length}</p>
            <p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-[#1b1813]/62">no portal</p>
          </div>
          <a
            href={ROUTES.founderProgram}
            className="group rounded-2xl border border-[#FFC107]/40 bg-[#FFC107] p-4 text-[#1b1813] transition hover:bg-[#ffcd38]"
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
              O Programa Fundador libera o Ilê Asé por 12 meses e prioriza o perfil público da casa no portal.
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
      <LandingMockupHero />

      <section className="border-b border-[#e0d4c0] bg-[#fdf8f0] py-16 sm:py-20" aria-labelledby="explorar-title">
        <div className={landingMockupShellClass}>
          <div className="mx-auto max-w-2xl text-center">
            <p className={landingMockupKickerClass}>Explorar o portal</p>
            <h2 id="explorar-title" className="mt-5 font-display text-3xl font-black tracking-tight text-[#1b1813] sm:text-4xl">
              O que você quer fazer agora?
            </h2>
            <p className="mt-3 text-base text-[#1b1813]/65">
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
