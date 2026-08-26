import { ArrowDown, BadgeCheck, MapPinned, Settings2 } from 'lucide-react';
import { trackConversionEvent } from '../../lib/trackConversion';

export function DirectoryClaimAcquisitionCta({ cidade, total }: { cidade: string; total: number }) {
  return (
    <aside className="relative overflow-hidden rounded-[1.75rem] border border-[#ccb77e] bg-[#eadfbf]/75 p-6 shadow-[0_22px_60px_rgba(63,49,27,.1)] sm:p-8" aria-labelledby="city-claim-title">
      <div className="pointer-events-none absolute -right-24 -top-36 h-80 w-80 rounded-full border border-[#9b6a00]/15" aria-hidden />
      <div className="relative grid gap-7 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-center">
        <div className="flex gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#172018] text-[#e5ae12]"><BadgeCheck className="h-5 w-5" /></span>
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#8a6200]">Para responsáveis por casas de axé</p>
            <h2 id="city-claim-title" className="mt-1.5 max-w-2xl text-2xl font-extrabold tracking-[-0.04em] text-[#1b1813] sm:text-3xl">Sua casa está entre os {total} perfis de {cidade}?</h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#1b1813]/64">Encontre o perfil da casa, abra a página e reivindique a gestão para corrigir dados, publicar serviços e aparecer como perfil verificado.</p>
          </div>
        </div>
        <div className="grid gap-3">
          <a
            href="#bairros-heading"
            onClick={() => void trackConversionEvent('directory_action', { ctaId: 'directory-city-find-claim', ctaLabel: 'Encontrar minha casa', metadata: { cidade } })}
            className="inline-flex items-center justify-between gap-3 rounded-full bg-[#e5ae12] px-6 py-3.5 text-sm font-extrabold text-[#1b1813] transition hover:bg-[#ffcd38]"
          >
            <span className="flex items-center gap-2"><MapPinned className="h-4 w-4" />Encontrar minha casa</span><ArrowDown className="h-4 w-4" />
          </a>
          <div className="flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[#1b1813]/46"><Settings2 className="h-3.5 w-3.5" />Reivindicação gratuita · análise humana</div>
        </div>
      </div>
    </aside>
  );
}
