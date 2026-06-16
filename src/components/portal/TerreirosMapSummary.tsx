import { MapPin } from 'lucide-react';
import { terreirosCityPath, type PublicCidade } from '../../lib/portalPublic';

export function TerreirosMapSummary({ cidades }: { cidades: PublicCidade[] }) {
  if (cidades.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-[#1E242B] px-4 py-8 text-center text-sm text-[#64748B]">
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
          className="flex items-center justify-between rounded-xl border border-[#1E242B] bg-[#0B0D11] px-4 py-3 transition hover:border-[#FBBC00]/30"
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-[#F1F5F9]">
            <MapPin className="h-4 w-4 text-[#FBBC00]" />
            {c.cidade}
            {c.estado ? `, ${c.estado}` : ''}
          </span>
          <span className="rounded-full bg-[#12161A] px-2 py-0.5 text-xs font-bold text-[#94A3B8]">
            {c.count}
          </span>
        </a>
      ))}
    </div>
  );
}
