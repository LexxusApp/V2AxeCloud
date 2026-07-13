import { ArrowRight, BookOpen, Building2, CalendarDays, Heart, Sparkles, Sun } from 'lucide-react';
import { LandingMockupHero } from './LandingMockupHero';
import { ROUTES } from '../../lib/routes';
import { cn } from '../../lib/utils';
import { landingMockupCardClass, landingMockupKickerClass, landingMockupShellClass } from './landingMockupUi';

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
    description: 'Veja eventos divulgados pelas casas e consulte o calendário litúrgico.',
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
  {
    id: 'comparativo',
    eyebrow: 'Decisão informada',
    title: 'Por que AxéCloud?',
    description: 'Compare módulos, PWA, WhatsApp Meta e portal público com planilhas e outros sistemas.',
    href: ROUTES.whyAxeCloud,
    icon: Sparkles,
    accent: 'text-[#a87400]',
    iconBg: 'bg-[#FFC107]/18 border-[#FFC107]/35',
    featured: true,
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

export function PortalHomeHubSections() {
  return (
    <section className="relative z-[1] border-b border-[#e8dfd0] bg-[#fdf8f0] py-16 sm:py-20" aria-labelledby="explorar-title">
      <div className={landingMockupShellClass}>
        <div className="mx-auto max-w-2xl text-center">
          <p className={landingMockupKickerClass}>Explorar o portal</p>
          <h2 id="explorar-title" className="mt-5 font-display text-3xl font-black tracking-tight text-[#1b1813] sm:text-4xl">
            Portal público do axé — tudo em um lugar
          </h2>
          <p className="mt-3 text-base text-[#1b1813]/65">
            Diretório com milhares de terreiros mapeados, pedidos de reza, eventos, conteúdo educativo e comparativo de funcionalidades.
          </p>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {EXPLORAR_TILES.map((tile) => (
            <PortalTileCard key={tile.id} tile={tile} />
          ))}
        </div>
      </div>
    </section>
  );
}

export function PortalHomeHub() {
  return (
    <>
      <LandingMockupHero />
      <PortalHomeHubSections />
    </>
  );
}
