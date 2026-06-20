import { MapPin } from 'lucide-react';
import { cn } from '../../lib/utils';
import { landingMockupCardClass } from '../landing/landingMockupUi';
import { terreirosCityPath, type PublicCidade } from '../../lib/portalPublic';

export function TerreirosMapSummary({ cidades }: { cidades: PublicCidade[] }) {
  if (cidades.length === 0) {
    return (
      <p className={cn('px-4 py-8 text-center text-sm text-[#1b1813]/65', landingMockupCardClass, 'rounded-2xl border-dashed')}>
        Ainda não há cidades com terreiros no diretório. As primeiras casas do Programa Fundador aparecem aqui em breve.
      </p>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {cidades.slice(0, 12).map((c) => (
        <a
          key={c.slug}
          href={terreirosCityPath(c.slug)}
          className={cn(
            'flex items-center justify-between px-4 py-3 transition hover:-translate-y-0.5 hover:border-[#FFC107]/45',
            landingMockupCardClass,
            'rounded-xl',
          )}
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-[#1b1813]">
            <MapPin className="h-4 w-4 text-[#FFC107]" />
            {c.cidade}
            {c.estado ? `, ${c.estado}` : ''}
          </span>
          <span className="rounded-full bg-[#FFC107]/15 px-2 py-0.5 text-xs font-bold text-[#1b1813]">
            {c.count}
          </span>
        </a>
      ))}
    </div>
  );
}
