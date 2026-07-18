import { ArrowRight, LayoutDashboard } from 'lucide-react';
import { trackConversionEvent } from '../../lib/trackConversion';

const MANAGEMENT_GUIDE_PATH = '/conteudo/gestao-de-terreiros';

export function DirectoryManagementCta({ source }: { source: string }) {
  return (
    <aside className="overflow-hidden rounded-[1.75rem] border border-[#e4b000]/35 bg-gradient-to-br from-[#fff9e6] via-white to-[#fff3bf]/55 p-5 shadow-lg shadow-[#ffc107]/10 sm:p-6" aria-labelledby={`directory-management-${source}`}>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#1b1813] text-[#ffc107]">
            <LayoutDashboard className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#9a6a00]">Para dirigentes e zeladores</p>
            <h2 id={`directory-management-${source}`} className="mt-1 text-xl font-black text-[#1b1813]">
              Você administra um terreiro?
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#1b1813]/65">
              Conheça a plataforma de gestão para terreiros com financeiro Pix, filhos de santo, giras, comunicação e 100 GB para a memória da casa.
            </p>
          </div>
        </div>
        <a
          href={MANAGEMENT_GUIDE_PATH}
          onClick={() => void trackConversionEvent('cta_click', {
            ctaId: `directory-management-${source}`,
            ctaLabel: 'Conhecer gestão de terreiros',
          })}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-[#ffc107] px-5 py-3 text-sm font-black text-[#1b1813] transition hover:bg-[#ffcd38]"
        >
          Gestão de terreiros
          <ArrowRight className="h-4 w-4" aria-hidden />
        </a>
      </div>
    </aside>
  );
}
