import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { TerreiroCard } from '../../components/portal/TerreiroCard';
import { MarketingMockupLayout } from '../../components/marketing/MarketingMockupLayout';
import { landingMockupShellClass } from '../../components/landing/landingMockupUi';
import { fetchPublicTerreiros, type PublicTerreiro } from '../../lib/portalPublic';
import { ROUTES } from '../../lib/routes';
import { cn } from '../../lib/utils';

function citySlugFromPath(): string {
  const parts = window.location.pathname.replace(/\/+$/, '').split('/');
  const idx = parts.indexOf('cidade');
  return idx >= 0 ? decodeURIComponent(parts[idx + 1] || '') : '';
}

export default function TerreirosCityPage() {
  const citySlug = citySlugFromPath();
  const [items, setItems] = useState<PublicTerreiro[]>([]);
  const [meta, setMeta] = useState<{ cidade: string; estado: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!citySlug) {
      setError('Cidade inválida.');
      setLoading(false);
      return;
    }
    void fetch(`/api/v1/public/terreiros/cidade/${encodeURIComponent(citySlug)}`, { cache: 'no-store' })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Erro');
        setMeta({ cidade: json.cidade, estado: json.estado });
        setItems(json.items || []);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Erro'))
      .finally(() => setLoading(false));
  }, [citySlug]);

  return (
    <MarketingMockupLayout>
      <main className={cn('relative z-[1] py-10 sm:py-14', landingMockupShellClass, 'max-w-7xl')}>
        <a href={ROUTES.terreiros} className="text-sm font-bold text-[#1b1813]/66 transition hover:text-[#FFC107]">
          ← Diretório
        </a>
        <h1 className="mt-4 font-display text-3xl font-black text-[#1b1813] sm:text-4xl">
          Terreiros em {meta?.cidade || citySlug.replace(/-/g, ' ')}
          {meta?.estado ? `, ${meta.estado}` : ''}
        </h1>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-[#FFC107]" />
          </div>
        ) : error ? (
          <p className="py-10 text-red-600">{error}</p>
        ) : items.length === 0 ? (
          <p className="py-10 text-[#1b1813]/65">Nenhum terreiro público nesta cidade ainda.</p>
        ) : (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((t) => (
              <TerreiroCard key={t.slug} terreiro={t} />
            ))}
          </div>
        )}
      </main>
    </MarketingMockupLayout>
  );
}
