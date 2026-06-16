import { useEffect, useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { marketingHref } from '../lib/appHref';
import { ROUTES, terreiroProfilePath } from '../lib/routes';

function slugFromPath(): string {
  const parts = window.location.pathname.replace(/\/+$/, '').split('/');
  const idx = parts.indexOf('consulente');
  return idx >= 0 ? decodeURIComponent(parts[idx + 1] || '') : '';
}

/** Redireciona /consulente/:slug → perfil público ou Espaço do Fiel. */
export default function ConsulentePortalPage() {
  const slug = useMemo(() => slugFromPath(), []);

  useEffect(() => {
    if (!slug) return;

    let cancelled = false;

    void fetch(`/api/v1/public/terreiros/${encodeURIComponent(slug)}`, { cache: 'no-store' })
      .then(async (res) => {
        if (cancelled) return;
        if (res.ok) {
          window.location.replace(marketingHref(terreiroProfilePath(slug)));
          return;
        }
        const target = `${marketingHref(ROUTES.espacoDoFiel)}?casa=${encodeURIComponent(slug)}`;
        window.location.replace(target);
      })
      .catch(() => {
        if (!cancelled) {
          window.location.replace(`${marketingHref(ROUTES.espacoDoFiel)}?casa=${encodeURIComponent(slug)}`);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (!slug) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#0a0a0a] px-4 text-center">
        <p className="text-lg font-bold text-white">Portal não encontrado</p>
        <p className="mt-2 text-sm text-zinc-500">Endereço inválido.</p>
        <a href={marketingHref(ROUTES.espacoDoFiel)} className="mt-6 text-sm font-bold text-primary hover:underline">
          Ir para Pedidos de Reza
        </a>
      </div>
    );
  }

  return (
    <div className="grid min-h-screen place-items-center bg-[#0a0a0a] text-primary">
      <div className="text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin" />
        <p className="mt-4 text-sm text-zinc-400">Abrindo o portal…</p>
      </div>
    </div>
  );
}
