import { MapPin } from 'lucide-react';
import { cn } from '../../lib/utils';
import { landingMockupCardClass } from '../landing/landingMockupUi';
import { diretorioCityPath } from '../../lib/diretorioSlug';
import type { DiretorioCidade } from '../../lib/diretorioPublic';

export function DiretorioCityGrid({ cidades }: { cidades: DiretorioCidade[] }) {
  if (cidades.length === 0) {
    return (
      <p className={cn('px-4 py-8 text-center text-sm text-[#1b1813]/65', landingMockupCardClass, 'rounded-2xl border-dashed')}>
        Em breve, novas cidades no mapa do axé.
      </p>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {cidades.map((c) => (
        <a
          key={`${c.estado || 'br'}-${c.cidadeSlug}`}
          href={diretorioCityPath(c.estado, c.cidadeSlug)}
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
