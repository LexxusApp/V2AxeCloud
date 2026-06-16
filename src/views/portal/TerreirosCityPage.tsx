import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { MarketingSubpageTopNav } from '../../components/marketing/MarketingTopNav';
import { TerreiroCard } from '../../components/portal/TerreiroCard';
import { fetchPublicTerreiros, type PublicTerreiro } from '../../lib/portalPublic';
import { ROUTES } from '../../lib/routes';

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
    <div className="min-h-screen bg-[#080A0D] text-[#F1F5F9]">
      <MarketingSubpageTopNav />
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <a href={ROUTES.terreiros} className="text-sm font-bold text-[#FBBC00] hover:underline">
          ← Diretório
        </a>
        <h1 className="mt-4 text-3xl font-black">
          Terreiros em {meta?.cidade || citySlug.replace(/-/g, ' ')}
          {meta?.estado ? `, ${meta.estado}` : ''}
        </h1>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-[#FBBC00]" />
          </div>
        ) : error ? (
          <p className="py-10 text-red-400">{error}</p>
        ) : items.length === 0 ? (
          <p className="py-10 text-[#94A3B8]">Nenhum terreiro público nesta cidade ainda.</p>
        ) : (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((t) => (
              <TerreiroCard key={t.slug} terreiro={t} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
