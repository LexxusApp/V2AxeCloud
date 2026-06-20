import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { fetchPublicTerreiro, type PublicTerreiro } from '../../lib/portalPublic';
import { ROUTES } from '../../lib/routes';
import { marketingHref } from '../../lib/appHref';

function slugFromPath(): string {
  const parts = window.location.pathname.replace(/\/+$/, '').split('/');
  const idx = parts.indexOf('widget');
  return idx >= 0 ? decodeURIComponent(parts[idx + 1] || '') : '';
}

/** Widget embebível (iframe) — perfil compacto + link para pedidos. */
export default function PortalWidgetPage() {
  const slug = slugFromPath();
  const [terreiro, setTerreiro] = useState<PublicTerreiro | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) {
      setLoading(false);
      return;
    }
    void fetchPublicTerreiro(slug)
      .then(setTerreiro)
      .catch(() => setTerreiro(null))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center bg-[#f6f1e6]">
        <Loader2 className="h-6 w-6 animate-spin text-amber-600" />
      </div>
    );
  }

  if (!terreiro) {
    return (
      <div className="bg-[#f6f1e6] p-4 text-center text-sm text-neutral-600">
        Terreiro não encontrado.
      </div>
    );
  }

  return (
    <div className="border border-[#ece4d2] bg-[#f6f1e6] p-4 font-sans text-[#1b1813]">
      <div className="flex gap-3">
        {terreiro.fotoUrl ? (
          <img src={terreiro.fotoUrl} alt="" className="h-14 w-14 rounded-xl object-cover ring-1 ring-[#ece4d2]" />
        ) : null}
        <div>
          <p className="font-bold">{terreiro.nome}</p>
          <p className="text-xs text-neutral-500">
            {[terreiro.cidade, terreiro.estado].filter(Boolean).join(' — ')}
          </p>
        </div>
      </div>
      {terreiro.descricao ? (
        <p className="mt-3 line-clamp-3 text-sm text-neutral-600">{terreiro.descricao}</p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <a
          href={marketingHref(terreiro.perfilUrl || ROUTES.terreiros)}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-black text-neutral-900 transition hover:bg-amber-300"
        >
          Ver perfil
        </a>
        {terreiro.pedidosUrl ? (
          <a
            href={marketingHref(terreiro.pedidosUrl)}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-neutral-900 bg-neutral-900 px-3 py-1.5 text-xs font-black text-amber-400 transition hover:bg-neutral-800"
          >
            Pedir reza
          </a>
        ) : null}
      </div>
      <p className="mt-3 text-[10px] text-neutral-500">
        via{' '}
        <a href={marketingHref(ROUTES.home)} target="_blank" rel="noreferrer" className="font-bold text-amber-700">
          AxéCloud
        </a>
      </p>
    </div>
  );
}
