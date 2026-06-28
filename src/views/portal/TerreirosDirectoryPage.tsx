import { useEffect, useMemo, useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import { TerreiroCard } from '../../components/portal/TerreiroCard';
import { TerreirosMapSummary } from '../../components/portal/TerreirosMapSummary';
import { DiretorioCityGrid } from '../../components/portal/DiretorioCityGrid';
import { PortalNewsletterForm } from '../../components/portal/PortalNewsletterForm';
import { MarketingMockupLayout } from '../../components/marketing/MarketingMockupLayout';
import { MarketingMockupPageHeader } from '../../components/marketing/MarketingMockupPageHeader';
import { landingMockupCardClass, landingMockupShellClass } from '../../components/landing/landingMockupUi';
import { fetchPublicCidades, fetchPublicTerreiros, type PublicTerreiro } from '../../lib/portalPublic';
import { fetchDiretorioCidades, type DiretorioCidade } from '../../lib/diretorioPublic';
import { appHref } from '../../lib/appHref';
import { ROUTES } from '../../lib/routes';
import { cn } from '../../lib/utils';
import { TRIAL_DAYS } from '../../../lib/planPricing';

export default function TerreirosDirectoryPage() {
  const [items, setItems] = useState<PublicTerreiro[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [tradicao, setTradicao] = useState('todas');
  const [cidades, setCidades] = useState<Awaited<ReturnType<typeof fetchPublicCidades>>>([]);
  const [diretorioCidades, setDiretorioCidades] = useState<DiretorioCidade[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetchPublicCidades()
      .then(setCidades)
      .catch(() => undefined);
    void fetchDiretorioCidades()
      .then(setDiretorioCidades)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    setLoading(true);
    void fetchPublicTerreiros({ q: q || undefined, tradicao: tradicao !== 'todas' ? tradicao : undefined })
      .then((res) => setItems(res.items))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Erro'))
      .finally(() => setLoading(false));
  }, [q, tradicao]);

  const totalLabel = useMemo(() => `${items.length} casa${items.length === 1 ? '' : 's'}`, [items.length]);

  return (
    <MarketingMockupLayout>
      <main className={cn('relative z-[1] py-10 sm:py-14', landingMockupShellClass, 'max-w-7xl')}>
        <MarketingMockupPageHeader
          kicker="Portal de Gestão AxéCloud"
          title="Diretório de terreiros"
          summary="Casas de Umbanda, Candomblé e tradições afins que optaram por perfil público — com respeito, privacidade e moderação."
        />

        <section className="mt-12">
          <h2 className="text-lg font-bold text-[#1b1813]">Terreiros por cidade (mapa)</h2>
          <p className="mt-1 text-sm text-[#1b1813]/65">
            Casas de axé com endereço e rota no Google Maps — ideal para quem busca um terreiro na região.
          </p>
          <div className="mt-4">
            <DiretorioCityGrid cidades={diretorioCidades} />
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-lg font-bold text-[#1b1813]">Casas parceiras AxéCloud</h2>
          <p className="mt-1 text-sm text-[#1b1813]/65">Terreiros com perfil verificado no portal.</p>
          <div className="mt-4">
            <TerreirosMapSummary cidades={cidades} />
          </div>
        </section>

        <section className="mt-12">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-bold text-[#1b1813]">{totalLabel}</h2>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#1b1813]/62" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Buscar por nome ou cidade…"
                  className="w-full rounded-xl border border-[var(--mockup-card-border,#cfc0a8)] bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:border-[#FFC107]/50 sm:w-64"
                />
              </div>
              <select
                value={tradicao}
                onChange={(e) => setTradicao(e.target.value)}
                className="rounded-xl border border-[var(--mockup-card-border,#cfc0a8)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#FFC107]/50"
              >
                <option value="todas">Todas as tradições</option>
                <option value="umbanda">Umbanda</option>
                <option value="candomble">Candomblé</option>
                <option value="jurema">Jurema</option>
                <option value="mista">Mista</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-[#FFC107]" />
            </div>
          ) : error ? (
            <p className="py-10 text-center text-red-600">{error}</p>
          ) : items.length === 0 ? (
            <div className={cn('mt-8 px-6 py-12 text-center', landingMockupCardClass, 'rounded-2xl border-dashed')}>
              <p className="text-[#1b1813]/70">Nenhum terreiro encontrado com estes filtros.</p>
              <a href={appHref(ROUTES.register)} className="mt-4 inline-block text-sm font-bold text-[#1b1813] hover:text-[#FFC107]">
                Cadastrar meu terreiro — {TRIAL_DAYS} dias grátis
              </a>
            </div>
          ) : (
            <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((t) => (
                <TerreiroCard key={t.slug} terreiro={t} />
              ))}
            </div>
          )}
        </section>

        <section className={cn('mt-16 p-6 sm:p-8', landingMockupCardClass, 'rounded-2xl')}>
          <h2 className="text-lg font-bold text-[#1b1813]">Agenda da semana por e-mail</h2>
          <p className="mt-2 text-sm text-[#1b1813]/65">Giras e festas públicas na sua região — sem spam, só o essencial.</p>
          <div className="mt-4">
            <PortalNewsletterForm />
          </div>
        </section>

        <p className="mt-10 text-center text-xs text-[#1b1813]/66">
          <a href={ROUTES.eventosPublicos} className="font-semibold text-[#1b1813] hover:text-[#FFC107]">
            Ver agenda de eventos públicos
          </a>
        </p>
      </main>
    </MarketingMockupLayout>
  );
}
