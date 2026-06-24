import { useEffect, useState } from 'react';
import { ArrowRight, BookOpen, CalendarDays, Handshake, MapPin, Play, Sun, Users } from 'lucide-react';
import { appHref } from '../../lib/appHref';
import {
  fetchPublicTerreiros,
  terreiroProfilePath,
  tradicaoLabel,
  type PublicTerreiro,
} from '../../lib/portalPublic';
import { landingMockupShellClass } from './landingMockupUi';
import { cn } from '../../lib/utils';
import { ROUTES } from '../../lib/routes';

function AcolhimentoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 18a4.5 4.5 0 010-9 5.5 5.5 0 0110.8-1.5A4 4 0 0120 14a3.5 3.5 0 01-3.5 3.5H7z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="13" y="12" width="6" height="5" rx="1" stroke="currentColor" strokeWidth="1.75" />
      <path d="M16 12v-1.5a1.5 1.5 0 013 0V12" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function OxeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3v18M8 7l4-4 4 4M7 12h10M8 17l4 4 4-4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const FEATURES = [
  {
    icon: Users,
    title: 'Gestão completa',
    desc: 'Organize membros, obrigações, festejos e atividades da casa em um só lugar.',
  },
  {
    icon: CalendarDays,
    title: 'Agenda integrada',
    desc: 'Divulgue eventos, giras e convites para toda a comunidade.',
  },
  {
    icon: AcolhimentoIcon,
    title: 'Acolhimento online',
    desc: 'Receba pedidos de reza e aproxime consulentes da sua casa.',
  },
  {
    icon: BookOpen,
    title: 'Conteúdo e cultura',
    desc: 'Acesse materiais e termos que fortalecem o conhecimento do axé.',
  },
] as const;

function formatTerreiroLocation(terreiro: PublicTerreiro): string | null {
  const parts = [terreiro.cidade, terreiro.estado].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : null;
}

function terreiroCardDescription(terreiro: PublicTerreiro): string {
  if (terreiro.descricao?.trim()) return terreiro.descricao.trim();
  const tradicao = tradicaoLabel(terreiro.tradicao);
  const local = formatTerreiroLocation(terreiro);
  if (local) {
    return `Casa de ${tradicao} em ${local}. Perfil público com eventos, acolhimento e história da casa aberta à comunidade.`;
  }
  return `Casa de ${tradicao} no Portal de Gestão AxéCloud. Perfil público com eventos, acolhimento e história da casa aberta à comunidade.`;
}

function HeroTerreiroCardBody({
  loading,
  terreiro,
  location,
  profileHref,
}: {
  loading: boolean;
  terreiro: PublicTerreiro | null;
  location: string | null;
  profileHref: string;
}) {
  return (
    <div className="relative min-h-[11.5rem] p-4 sm:min-h-[12rem] sm:p-5">
      {loading ? (
        <div className="flex items-start gap-4" aria-busy="true">
          <div className="min-w-0 flex-1 space-y-3">
            <div className="h-7 w-2/3 animate-pulse rounded-full bg-[#1b1813]/10" />
            <div className="h-5 w-1/2 animate-pulse rounded-full bg-[#1b1813]/8" />
            <div className="h-[2.75rem] animate-pulse rounded-2xl bg-[#1b1813]/6" />
            <div className="h-5 w-40 animate-pulse rounded-full bg-[#1b1813]/8" />
          </div>
          <div className="h-11 w-11 shrink-0 animate-pulse rounded-full bg-[#1b1813]/8" aria-hidden />
        </div>
      ) : terreiro ? (
        <>
          <div className="flex items-start gap-4">
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-lg font-black text-[#1b1813] sm:text-xl">{terreiro.nome}</h2>
              <p
                className={cn(
                  'mt-1 flex min-h-[1.25rem] items-center gap-1.5 text-sm font-medium text-[#1b1813]',
                  !location && 'invisible',
                )}
                aria-hidden={!location}
              >
                <MapPin className="h-3.5 w-3.5 shrink-0 text-[#FFC107]" aria-hidden />
                {location ?? '—'}
              </p>
              <p className="mt-2.5 line-clamp-2 min-h-[2.75rem] text-[13px] leading-relaxed text-[#1b1813]/88 sm:text-sm">
                {terreiroCardDescription(terreiro)}
              </p>
            </div>
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FFC107] text-[#1b1813] sm:h-11 sm:w-11"
              aria-hidden
            >
              <OxeIcon className="h-5 w-5" />
            </div>
          </div>

          <a
            href={profileHref}
            className="mt-4 inline-flex min-h-[1.25rem] items-center gap-1.5 text-sm font-bold text-[#1b1813] transition hover:gap-2.5"
          >
            Ver perfil do terreiro
            <ArrowRight className="h-4 w-4" aria-hidden />
          </a>
        </>
      ) : (
        <>
          <div className="flex items-start gap-4">
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-xl font-black text-[#1b1813]">Sua casa de axé aqui</h2>
              <p className="mt-1 min-h-[1.25rem]" aria-hidden />
              <p className="mt-2.5 min-h-[2.75rem] text-sm leading-relaxed text-[#1b1813]">
                As primeiras casas estão a activar o perfil público no portal. Cadastre a sua e apareça em destaque.
              </p>
            </div>
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FFC107] text-[#1b1813] sm:h-11 sm:w-11"
              aria-hidden
            >
              <OxeIcon className="h-5 w-5" />
            </div>
          </div>
          <a
            href={appHref(ROUTES.register)}
            className="mt-4 inline-flex min-h-[1.25rem] items-center gap-1.5 text-sm font-bold text-[#1b1813] transition hover:gap-2.5"
          >
            Cadastre sua casa
            <ArrowRight className="h-4 w-4" aria-hidden />
          </a>
        </>
      )}
    </div>
  );
}

function HeroTerreiroCard() {
  const [terreiro, setTerreiro] = useState<PublicTerreiro | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetchPublicTerreiros({ page: 1 })
      .then((res) => setTerreiro(res.items[0] ?? null))
      .catch(() => setTerreiro(null))
      .finally(() => setLoading(false));
  }, []);

  const location = terreiro ? formatTerreiroLocation(terreiro) : null;
  const profileHref = terreiro ? terreiroProfilePath(terreiro.slug) : ROUTES.terreiros;

  return (
    <article className="landing-mockup-hero__card min-h-[22.5rem] overflow-hidden sm:min-h-[23rem]">
      <div className="landing-mockup-hero__card-media relative aspect-[16/10] overflow-hidden bg-[#1b1813]">
        {loading ? (
          <div className="h-full animate-pulse bg-[#2a241c]" aria-busy="true" aria-hidden />
        ) : terreiro?.fotoUrl ? (
          <img
            src={terreiro.fotoUrl}
            alt={terreiro.nome}
            width={304}
            height={190}
            className="h-full w-full object-cover"
            loading="eager"
            fetchPriority="high"
            decoding="async"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-[#2a241c] to-[#1b1813]">
            <Sun className="h-16 w-16 text-[#FFC107]/35" aria-hidden />
          </div>
        )}
        <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-[#FFC107] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-[#1b1813]">
          <Sun className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
          Destaque
        </span>
      </div>

      <HeroTerreiroCardBody
        loading={loading}
        terreiro={terreiro}
        location={location}
        profileHref={profileHref}
      />
    </article>
  );
}

export function LandingMockupHero() {
  return (
    <>
      <section className="landing-mockup-hero relative overflow-visible" aria-labelledby="portal-hero-title">
        <div className="landing-mockup-hero__watermark pointer-events-none absolute z-0 hidden lg:block" aria-hidden>
          <svg width="280" height="280" viewBox="0 0 280 280" fill="none">
            <circle cx="140" cy="140" r="120" stroke="#1b1813" strokeOpacity="0.04" strokeWidth="28" />
            <path
              d="M140 40 L180 120 L260 120 L196 170 L220 250 L140 200 L60 250 L84 170 L20 120 L100 120 Z"
              stroke="#1b1813"
              strokeOpacity="0.035"
              strokeWidth="8"
              fill="none"
            />
          </svg>
        </div>

        <div className={`landing-mockup-hero__inner relative z-[2] ${landingMockupShellClass} pb-16 pt-8 sm:pb-20 sm:pt-10`}>
          <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 xl:gap-20">
            <div className="max-w-xl">
              <span className="landing-mockup-hero__badge inline-flex items-center gap-2 rounded-full bg-[#FFC107] px-3.5 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-[#1b1813] md:text-[11px]">
                <Sun className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} aria-hidden />
                Plataforma para terreiros
              </span>

              <h1
                id="portal-hero-title"
                className="landing-mockup-hero__title mt-6 font-display text-[2.35rem] font-black uppercase leading-[1.02] tracking-tight text-[#1b1813] sm:text-5xl lg:text-[3.35rem]"
              >
                Gestão, conexão
                <br />e força para o
                <br />
                seu <span className="text-[#FFC107]">terreiro</span>
              </h1>

              <p className="landing-mockup-hero__lead mt-6 max-w-lg text-[15px] font-medium leading-relaxed text-[#1b1813] sm:text-base">
                AxéCloud é a plataforma completa para terreiros organizarem a casa, cuidarem da comunidade e
                manterem viva a cultura — Umbanda, Candomblé e Jurema com respeito e tecnologia.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <a
                  href={appHref(ROUTES.register)}
                  className="landing-mockup-hero__btn-primary inline-flex items-center justify-center rounded-xl bg-[#FFC107] px-7 py-3.5 text-sm font-bold text-[#1b1813] shadow-[0_8px_24px_rgba(255,193,7,0.35)] transition hover:bg-[#ffcd38]"
                >
                  Comece agora
                </a>
                <a
                  href="#demonstracao"
                  className="landing-mockup-hero__btn-secondary inline-flex items-center justify-center gap-2 rounded-xl border border-[#1b1813] bg-white px-7 py-3.5 text-sm font-bold text-[#1b1813] transition hover:bg-[#1b1813] hover:text-white"
                >
                  <Play className="h-4 w-4 fill-current" aria-hidden />
                  Ver como funciona
                </a>
              </div>
            </div>

            <div className="relative mx-auto w-full min-h-[22.5rem] max-w-[17.5rem] overflow-visible sm:min-h-[23rem] sm:max-w-[18.5rem] lg:ml-auto lg:mr-7 lg:max-w-[19rem] xl:mr-10">
              <HeroTerreiroCard />
            </div>
          </div>
        </div>
      </section>

      <section className="landing-mockup-features relative overflow-hidden bg-black" aria-label="Destaques da plataforma">
        <div className={`relative z-[2] ${landingMockupShellClass} py-12 sm:py-14`}>
          <div className="landing-mockup-features__grid grid gap-y-12 sm:grid-cols-2 lg:grid-cols-4 lg:gap-y-0">
            {FEATURES.map(({ icon: Icon, title, desc }, index) => (
              <div
                key={title}
                className={`landing-mockup-features__col px-4 text-center sm:text-left lg:px-8 ${
                  index > 0 ? 'landing-mockup-features__col--divider' : ''
                }`}
              >
                <div className="landing-mockup-features__icon mx-auto inline-flex h-16 w-16 items-center justify-center sm:mx-0 sm:h-[4.5rem] sm:w-[4.5rem]">
                  <Icon className="h-9 w-9 text-[#FFC107] sm:h-10 sm:w-10" aria-hidden />
                </div>
                <h3 className="landing-mockup-features__title mt-5 font-display text-lg font-black text-[#FFC107] sm:text-xl lg:text-[1.35rem]">
                  {title}
                </h3>
                <p className="landing-mockup-features__desc mt-3 text-base leading-relaxed text-white/80 sm:text-[17px]">
                  {desc}
                </p>
              </div>
            ))}
          </div>

          <div className="landing-mockup-features__badge mx-auto mt-14 flex max-w-max items-center gap-3 rounded-full border border-white/15 bg-black px-7 py-3 text-base font-semibold text-white sm:text-[17px]">
            <Handshake className="h-5 w-5 shrink-0 text-[#FFC107]" aria-hidden />
            <span>
              Feito para terreiros. Feito com axé. Feito por nós.{' '}
              <span className="font-bold text-[#FFC107]">AxéCloud</span>
            </span>
          </div>
        </div>
      </section>
    </>
  );
}
