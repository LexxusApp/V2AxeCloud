import { MapPin, Phone } from 'lucide-react';
import { landingMockupCardClass } from '../landing/landingMockupUi';
import { formatTelefoneBr, telefoneHref } from '../../lib/formatTelefone';
import { diretorioTerreiroPath } from '../../lib/diretorioSlug';
import type { DiretorioTerreiro } from '../../lib/diretorioPublic';
import { cn } from '../../lib/utils';

type Props = {
  terreiro: DiretorioTerreiro;
};

export function DiretorioTerreiroCard({ terreiro }: Props) {
  const href = diretorioTerreiroPath(terreiro.slug);

  return (
    <li
      className={cn(
        'flex h-full flex-col overflow-hidden rounded-2xl transition hover:-translate-y-0.5 hover:shadow-md',
        landingMockupCardClass,
      )}
    >
      <div className="relative aspect-[16/10] shrink-0 overflow-hidden bg-gradient-to-br from-[#f3ebe0] to-[#e8dcc8]">
        {terreiro.fotoUrl ? (
          <img
            src={terreiro.fotoUrl}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-1 text-[#1b1813]/25">
            <span className="text-4xl" aria-hidden>
              ☀
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider">Terreiro de axé</span>
          </div>
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/25 to-transparent" />
      </div>

      <div className="flex min-h-0 flex-1 flex-col p-4 sm:p-5">
        <h2 className="line-clamp-2 min-h-[2.75rem] text-base font-black leading-snug text-[#1b1813]">
          {terreiro.nome}
        </h2>

        <div className="mt-3 flex flex-1 flex-col gap-2.5">
          {terreiro.endereco ? (
            <p className="line-clamp-2 min-h-[2.5rem] text-sm leading-relaxed text-[#1b1813]/68">
              <span className="flex items-start gap-1.5">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#FFC107]" aria-hidden />
                <span>{terreiro.endereco}</span>
              </span>
            </p>
          ) : (
            <div className="min-h-[2.5rem]" aria-hidden />
          )}

          {terreiro.telefone ? (
            <p className="flex items-center gap-1.5 text-sm text-[#1b1813]/75">
              <Phone className="h-3.5 w-3.5 shrink-0 text-[#FFC107]" aria-hidden />
              <a
                href={telefoneHref(terreiro.telefone)}
                className="font-semibold hover:text-[#FFC107]"
                onClick={(e) => e.stopPropagation()}
              >
                {formatTelefoneBr(terreiro.telefone)}
              </a>
            </p>
          ) : (
            <p className="text-xs text-[#1b1813]/45">Telefone não informado no Maps</p>
          )}
        </div>

        <a
          href={href}
          className="mt-4 inline-flex w-full shrink-0 items-center justify-center rounded-xl bg-[#FFC107] px-4 py-2.5 text-sm font-black text-[#1b1813] transition hover:bg-[#e6ac00]"
        >
          Ver detalhes
        </a>
      </div>
    </li>
  );
}
