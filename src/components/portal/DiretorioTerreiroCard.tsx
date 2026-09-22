import { useState } from 'react';
import { BadgeCheck, Landmark, MapPin, Phone } from 'lucide-react';
import { landingMockupCardClass } from '../landing/landingMockupUi';
import { formatTelefoneBr, telefoneHref } from '../../lib/formatTelefone';
import { diretorioTerreiroPath } from '../../lib/diretorioSlug';
import { trackDiretorioProfileClick, type DiretorioTerreiro } from '../../lib/diretorioPublic';
import { cn } from '../../lib/utils';

type Props = {
  terreiro: DiretorioTerreiro;
};

export function DiretorioTerreiroCard({ terreiro }: Props) {
  const href = diretorioTerreiroPath(terreiro.slug);
  const [fotoFalhou, setFotoFalhou] = useState(false);
  const mostrarFoto = Boolean(terreiro.fotoUrl) && !fotoFalhou;

  return (
    <li
      className={cn(
        'group flex h-full flex-col overflow-hidden rounded-2xl transition duration-300 hover:-translate-y-1 hover:border-[#ffc107]/45 hover:shadow-xl hover:shadow-[#ffc107]/10 motion-reduce:transform-none motion-reduce:transition-none',
        landingMockupCardClass,
      )}
    >
      <div className="relative aspect-[16/9] shrink-0 overflow-hidden bg-gradient-to-br from-[#f3ebe0] to-[#e8dcc8]">
        {mostrarFoto ? (
          <img
            src={terreiro.fotoUrl!}
            alt=""
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.045] motion-reduce:transform-none motion-reduce:transition-none"
            loading="lazy"
            onError={() => setFotoFalhou(true)}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-[#1b1813]/28">
            <span className="grid h-14 w-14 place-items-center rounded-2xl border border-[#b79c5a]/28 bg-[#fffaf0]/55" aria-hidden>
              <Landmark className="h-7 w-7" strokeWidth={1.6} />
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider">Terreiro de axé</span>
          </div>
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/25 to-transparent" />
        <div className="pointer-events-none absolute inset-0 opacity-0 transition duration-300 group-hover:opacity-100 bg-[radial-gradient(circle_at_50%_0%,rgba(255,193,7,0.2),transparent_48%)]" />
        {terreiro.verificada ? (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-[#102117]/92 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.08em] text-white shadow-lg backdrop-blur-sm">
            <BadgeCheck className="h-3.5 w-3.5 text-[#efba18]" aria-hidden />
            Perfil verificado
          </span>
        ) : null}
      </div>

      <div className="flex min-h-0 flex-1 flex-col p-4">
        {terreiro.tipo === 'loja' ? (
          <span className="mb-2 inline-flex w-fit rounded-full bg-[#1b1813]/8 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#1b1813]/55">
            Loja
          </span>
        ) : null}
        <h3 className="line-clamp-2 min-h-[2.75rem] text-base font-black leading-snug text-[#1b1813]">
          {terreiro.nome}
        </h3>

        <div className="mt-2.5 flex flex-1 flex-col gap-2">
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
                className="rounded-sm font-semibold hover:text-[#8d6800] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8d6800] focus-visible:ring-offset-2"
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
          onClick={() => trackDiretorioProfileClick(terreiro.slug)}
          className="mt-3 inline-flex min-h-11 w-full shrink-0 items-center justify-center rounded-xl bg-[#FFC107] px-4 py-2.5 text-sm font-black text-[#1b1813] transition group-hover:bg-[#ffcd38] hover:bg-[#e6ac00] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8d6800] focus-visible:ring-offset-4 motion-reduce:transition-none"
        >
          {terreiro.verificada ? 'Abrir perfil verificado' : 'Conhecer esta casa'}
        </a>
      </div>
    </li>
  );
}
