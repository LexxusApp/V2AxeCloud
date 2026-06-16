import { MapPin } from 'lucide-react';
import { tradicaoLabel, type PublicTerreiro } from '../../lib/portalPublic';
import { VerifiedBadge } from './VerifiedBadge';

type Props = {
  terreiro: PublicTerreiro;
  href?: string;
};

export function TerreiroCard({ terreiro, href }: Props) {
  const link = href || terreiro.perfilUrl || '#';
  const location = [terreiro.bairro, terreiro.cidade, terreiro.estado].filter(Boolean).join(' · ');

  return (
    <a
      href={link}
      className="group flex flex-col overflow-hidden rounded-2xl border border-[#1E242B] bg-[#0B0D11] transition hover:border-[#FBBC00]/30 hover:shadow-[0_0_24px_rgba(251,188,0,0.08)]"
    >
      <div className="relative aspect-[16/10] bg-[#12161A]">
        {terreiro.fotoUrl ? (
          <img
            src={terreiro.fotoUrl}
            alt=""
            className="h-full w-full object-cover transition group-hover:scale-[1.02]"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-4xl opacity-20">☀</div>
        )}
        {terreiro.destaque ? (
          <span className="absolute left-3 top-3 rounded-full bg-[#FBBC00] px-2 py-0.5 text-[10px] font-black uppercase text-[#080A0D]">
            Destaque
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-bold leading-snug text-[#F1F5F9] group-hover:text-[#FBBC00]">{terreiro.nome}</h3>
          {terreiro.verificada ? <VerifiedBadge compact /> : null}
        </div>
        <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">{tradicaoLabel(terreiro.tradicao)}</p>
        {location ? (
          <p className="flex items-center gap-1 text-xs text-[#94A3B8]">
            <MapPin className="h-3 w-3 shrink-0" />
            {location}
          </p>
        ) : null}
        {terreiro.descricao ? (
          <p className="line-clamp-2 text-sm text-[#94A3B8]">{terreiro.descricao}</p>
        ) : null}
        {terreiro.pedidosAtivos ? (
          <span className="mt-auto inline-flex w-fit rounded-lg bg-[#e11d48]/15 px-2 py-1 text-[10px] font-bold uppercase text-[#fb7185]">
            Pedidos de reza
          </span>
        ) : null}
      </div>
    </a>
  );
}
