import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { DiretorioTerreiroCard } from '../../components/portal/DiretorioTerreiroCard';
import { DiretorioCityByBairro } from '../../components/portal/DiretorioCityByBairro';
import { MarketingMockupLayout } from '../../components/marketing/MarketingMockupLayout';
import { landingMockupShellClass } from '../../components/landing/landingMockupUi';
import { fetchDiretorioCidade, type DiretorioBairroGroup, type DiretorioTerreiro } from '../../lib/diretorioPublic';
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
  const [bairros, setBairros] = useState<DiretorioBairroGroup[] | null>(null);
  const [meta, setMeta] = useState<{ cidade: string; estado: string | null; total: number } | null>(null);
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
        setMeta({ cidade: res.cidade, estado: res.estado, total: res.total });
        setItems(res.items);
        setBairros(res.bairros && res.bairros.length > 1 ? res.bairros : null);
        const uf = res.estado || estado.toUpperCase();
        applyCustomPageSeo({
          title: `Terreiros de Umbanda e Candomblé em ${res.cidade} - ${uf} | AxéCloud`,
          description: `Encontre ${res.total} terreiro${res.total === 1 ? '' : 's'} de Umbanda, Candomblé e tradições afro-brasileiras em ${res.cidade}, ${uf}. Endereços, telefones e rotas no Google Maps.`,
          canonicalPath: `/terreiros/${estado.toLowerCase()}/${cidadeSlug}`,
        });
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Erro'))
      .finally(() => setLoading(false));
  }, [estado, cidadeSlug]);

  const citySeo = meta ? getCitySeoContent(meta.cidade, meta.estado, meta.total) : null;

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
              ? bairros
                ? `${meta.total} casas de axé em ${bairros.length} bairros — navegue pelos bairros abaixo ou use o índice no topo.`
                : `${meta.total} casa${meta.total === 1 ? '' : 's'} de axé com endereço, telefone e foto quando disponível no Google Maps.`
              : 'Carregando terreiros da região…'}
          </p>
        </header>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-[#FFC107]" />
          </div>
        ) : error ? (
          <p className="py-10 text-red-600">{error}</p>
        ) : items.length === 0 ? (
          <p className="py-10 text-[#1b1813]/65">Nenhum terreiro encontrado nesta cidade ainda.</p>
        ) : (
          <>
            {citySeo ? (
              <section className="mt-8 max-w-3xl space-y-6">
                <p className="text-sm leading-relaxed text-[#1b1813]/72">
                  {citySeo.intro}
                </p>
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
              <DiretorioCityByBairro bairros={bairros} />
            ) : (
              <ul className="mt-8 grid items-stretch gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((t) => (
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
