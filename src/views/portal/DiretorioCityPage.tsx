import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { DiretorioTerreiroCard } from '../../components/portal/DiretorioTerreiroCard';
import { DiretorioCityByBairro } from '../../components/portal/DiretorioCityByBairro';
import { DiretorioCityTipoTabs } from '../../components/portal/DiretorioCityTipoTabs';
import { MarketingMockupLayout } from '../../components/marketing/MarketingMockupLayout';
import { landingMockupShellClass } from '../../components/landing/landingMockupUi';
import {
  fetchDiretorioCidade,
  type DiretorioEstabelecimentoTipo,
  type DiretorioTerreiro,
} from '../../lib/diretorioPublic';
import { groupItemsByBairro, shouldGroupCityByBairro } from '../../../lib/diretorioBairro';
import { applyCustomPageSeo } from '../../lib/seo';
import { ROUTES } from '../../lib/routes';
import { getCitySeoContent } from '../../lib/diretorioCityContent';
import { cn } from '../../lib/utils';

function parseCityRoute(): { estado: string; cidade: string } {
  const parts = window.location.pathname.replace(/\/+$/, '').split('/');
  const idx = parts.indexOf('terreiros');
  return {
    estado: decodeURIComponent(parts[idx + 1] || ''),
    cidade: decodeURIComponent(parts[idx + 2] || ''),
  };
}

export default function DiretorioCityPage() {
  const { estado, cidade: cidadeSlug } = parseCityRoute();
  const [items, setItems] = useState<DiretorioTerreiro[]>([]);
  const [totals, setTotals] = useState({ total: 0, terreiros: 0, lojas: 0 });
  const [tab, setTab] = useState<DiretorioEstabelecimentoTipo>('terreiro');
  const [meta, setMeta] = useState<{ cidade: string; estado: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!estado || !cidadeSlug) {
      setError('Endereço inválido.');
      setLoading(false);
      return;
    }

    void fetchDiretorioCidade(estado, cidadeSlug)
      .then((res) => {
        setMeta({ cidade: res.cidade, estado: res.estado });
        setItems(res.items);
        setTotals({
          total: res.total,
          terreiros: res.totalTerreiros ?? res.items.filter((i) => i.tipo === 'terreiro').length,
          lojas: res.totalLojas ?? res.items.filter((i) => i.tipo === 'loja').length,
        });
        const uf = res.estado || estado.toUpperCase();
        applyCustomPageSeo({
          title: `Terreiros e lojas de axé em ${res.cidade} - ${uf} | AxéCloud`,
          description: `Encontre ${res.totalTerreiros ?? 0} terreiro${(res.totalTerreiros ?? 0) === 1 ? '' : 's'} e ${res.totalLojas ?? 0} loja${(res.totalLojas ?? 0) === 1 ? '' : 's'} de artigos religiosos em ${res.cidade}, ${uf}. Endereços, telefones e rotas no Google Maps.`,
          canonicalPath: `/terreiros/${estado.toLowerCase()}/${cidadeSlug}`,
        });
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Erro'))
      .finally(() => setLoading(false));
  }, [estado, cidadeSlug]);

  const filteredItems = useMemo(() => items.filter((i) => i.tipo === tab), [items, tab]);

  const bairros = useMemo(() => {
    if (!shouldGroupCityByBairro(cidadeSlug, filteredItems)) return null;
    const groups = groupItemsByBairro(filteredItems);
    return groups.length > 1 ? groups : null;
  }, [cidadeSlug, filteredItems]);

  const citySeo = meta ? getCitySeoContent(meta.cidade, meta.estado, totals.terreiros) : null;

  return (
    <MarketingMockupLayout>
      <main className={cn('relative z-[1] py-10 sm:py-14', landingMockupShellClass, 'max-w-7xl')}>
        <a href={ROUTES.terreiros} className="text-sm font-bold text-[#1b1813]/66 transition hover:text-[#FFC107]">
          ← Diretório
        </a>

        <header className="mt-4 border-b border-[#cfc0a8]/40 pb-6">
          <p className="text-xs font-bold uppercase tracking-widest text-[#FFC107]">Diretório AxéCloud</p>
          <h1 className="mt-2 font-display text-3xl font-black text-[#1b1813] sm:text-4xl">
            Terreiros em {meta?.cidade || cidadeSlug.replace(/-/g, ' ')}
            {meta?.estado ? `, ${meta.estado}` : ''}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#1b1813]/68">
            {meta
              ? `${totals.terreiros} terreiro${totals.terreiros === 1 ? '' : 's'} e ${totals.lojas} loja${totals.lojas === 1 ? '' : 's'} de artigos religiosos — endereço, telefone e foto quando disponível no Google Maps.`
              : 'Carregando estabelecimentos da região…'}
          </p>

          {!loading && !error && totals.total > 0 ? (
            <DiretorioCityTipoTabs
              value={tab}
              onChange={setTab}
              totalTerreiros={totals.terreiros}
              totalLojas={totals.lojas}
            />
          ) : null}
        </header>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-[#FFC107]" />
          </div>
        ) : error ? (
          <p className="py-10 text-red-600">{error}</p>
        ) : filteredItems.length === 0 ? (
          <p className="py-10 text-[#1b1813]/65">
            Nenhum{tab === 'loja' ? 'a loja' : ' terreiro'} encontrad{tab === 'loja' ? 'a' : 'o'} nesta cidade ainda.
          </p>
        ) : (
          <>
            {tab === 'terreiro' && citySeo ? (
              <section className="mt-8 max-w-3xl space-y-6">
                <p className="text-sm leading-relaxed text-[#1b1813]/72">{citySeo.intro}</p>
                <div>
                  <h2 className="text-sm font-black uppercase tracking-widest text-[#1b1813]/55">
                    Perguntas frequentes
                  </h2>
                  <dl className="mt-4 space-y-4">
                    {citySeo.faq.map((item) => (
                      <div key={item.question} className="rounded-xl border border-[#ece4d2] bg-white/60 p-4">
                        <dt className="text-sm font-bold text-[#1b1813]">{item.question}</dt>
                        <dd className="mt-2 text-sm leading-relaxed text-[#1b1813]/68">{item.answer}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </section>
            ) : null}

            {bairros ? (
              <DiretorioCityByBairro bairros={bairros} itemLabel={tabLabel} />
            ) : (
              <ul className="mt-8 grid items-stretch gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {filteredItems.map((t) => (
                  <DiretorioTerreiroCard key={t.slug} terreiro={t} />
                ))}
              </ul>
            )}
          </>
        )}
      </main>
    </MarketingMockupLayout>
  );
}
