import { motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, Building2, Search, X } from 'lucide-react';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { MatrizEditorialLayout } from '../../components/marketing/MatrizEditorialLayout';
import { DirectoryClaimAcquisitionCta } from '../../components/portal/DirectoryClaimAcquisitionCta';
import { DiretorioTerreiroCard } from '../../components/portal/DiretorioTerreiroCard';
import { ROUTES } from '../../lib/routes';
import { applyCustomPageSeo } from '../../lib/seo';
import { loadDiretorioCidadeDetail, type DiretorioCidadeSnapshot } from '../../lib/diretorioSnapshot';

const RESULT_PAGE_SIZE = 18;
const ALL_BAIRROS = 'todos';

function parseCityRoute(): { estado: string; cidade: string } {
  const parts = window.location.pathname.replace(/\/+$/, '').split('/');
  const idx = parts.indexOf('terreiros');
  return {
    estado: decodeURIComponent(parts[idx + 1] || ''),
    cidade: decodeURIComponent(parts[idx + 2] || ''),
  };
}

function normalizeSearch(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function DirectoryLoadingState() {
  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3" aria-label="Carregando terreiros">
      {Array.from({ length: 6 }, (_, index) => (
        <div
          key={index}
          className="overflow-hidden rounded-2xl border border-[#ddd4c5] bg-white"
          aria-hidden
        >
          <div className="aspect-[16/10] animate-pulse bg-[#e8e0d3]" />
          <div className="space-y-3 p-5">
            <div className="h-5 w-3/4 animate-pulse rounded bg-[#e8e0d3]" />
            <div className="h-4 w-full animate-pulse rounded bg-[#f0eadf]" />
            <div className="h-4 w-2/3 animate-pulse rounded bg-[#f0eadf]" />
            <div className="mt-5 h-11 animate-pulse rounded-xl bg-[#e8e0d3]" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function DiretorioCityPage() {
  const { estado, cidade: cidadeSlug } = parseCityRoute();
  const reduceMotion = useReducedMotion();
  const [cidade, setCidade] = useState<DiretorioCidadeSnapshot | null>(null);
  const [selectedBairroSlug, setSelectedBairroSlug] = useState(ALL_BAIRROS);
  const [query, setQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(RESULT_PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!estado || !cidadeSlug) {
        setError('Endereço inválido.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const snapshotCity = await loadDiretorioCidadeDetail(estado, cidadeSlug);
        if (cancelled) return;
        if (!snapshotCity) {
          throw new Error('Não foi possível carregar os dados desta cidade. Atualize a página.');
        }
        setCidade(snapshotCity);
        const uf = snapshotCity.estado || estado.toUpperCase();
        applyCustomPageSeo({
          title: `Terreiros em ${snapshotCity.cidade} - ${uf} | AxéCloud`,
          description: `Encontre terreiros e casas de axé em ${snapshotCity.cidade}, ${uf}. Pesquise por nome, bairro ou endereço e acesse o perfil da casa.`,
          canonicalPath: `/terreiros/${estado.toLowerCase()}/${cidadeSlug}`,
        });
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Erro ao carregar cidade');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [cidadeSlug, estado]);

  useEffect(() => {
    setSelectedBairroSlug(ALL_BAIRROS);
    setQuery('');
    setVisibleCount(RESULT_PAGE_SIZE);
  }, [cidadeSlug, estado]);

  useEffect(() => {
    setVisibleCount(RESULT_PAGE_SIZE);
  }, [deferredQuery, selectedBairroSlug]);

  const bairros = cidade?.bairros || [];
  const bairroOptions = useMemo(
    () => bairros.filter((bairro) => bairro.slug !== ALL_BAIRROS),
    [bairros],
  );

  const allTerreiros = useMemo(() => {
    const seen = new Set<string>();
    const items = bairros.flatMap((bairro) => bairro.items);
    return items.filter((terreiro) => {
      if (seen.has(terreiro.slug)) return false;
      seen.add(terreiro.slug);
      return true;
    });
  }, [bairros]);

  const selectedBairro = useMemo(
    () => bairros.find((bairro) => bairro.slug === selectedBairroSlug) || null,
    [bairros, selectedBairroSlug],
  );

  const filteredTerreiros = useMemo(() => {
    const base = selectedBairroSlug === ALL_BAIRROS || !selectedBairro
      ? allTerreiros
      : selectedBairro.items;
    const term = normalizeSearch(deferredQuery);
    if (!term) return base;
    return base.filter((terreiro) =>
      [terreiro.nome, terreiro.bairro, terreiro.endereco]
        .filter(Boolean)
        .some((value) => normalizeSearch(String(value)).includes(term)),
    );
  }, [allTerreiros, deferredQuery, selectedBairro, selectedBairroSlug]);

  const visibleTerreiros = filteredTerreiros.slice(0, visibleCount);
  const remainingResults = Math.max(filteredTerreiros.length - visibleTerreiros.length, 0);
  const cityName = cidade?.cidade || cidadeSlug.replace(/-/g, ' ');
  const stateName = cidade?.estado || estado.toUpperCase();
  const totalTerreiros = cidade?.totalTerreiros || allTerreiros.length;
  const bairroLabel = selectedBairroSlug === ALL_BAIRROS ? 'toda a cidade' : selectedBairro?.nome || 'toda a cidade';

  const clearFilters = () => {
    setQuery('');
    setSelectedBairroSlug(ALL_BAIRROS);
  };

  return (
    <MatrizEditorialLayout>
      <main className="relative z-[1] mx-auto w-full max-w-7xl px-4 pb-24 pt-28 sm:px-6 md:px-8 md:pt-32">
        <a
          href={ROUTES.terreiros}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg px-1 text-sm font-extrabold text-[#243127]/65 transition-colors duration-200 hover:text-[#8d6800] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c99400] focus-visible:ring-offset-4"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Voltar ao mapa de terreiros
        </a>

        <motion.header
          className="relative mt-4 overflow-hidden rounded-2xl bg-[#102117] text-[#f8f4e9] shadow-[0_24px_70px_rgba(16,33,23,.18)]"
          initial={reduceMotion ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.42, ease: [0.23, 1, 0.32, 1] }}
        >
          <div className="grid lg:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="px-6 pb-8 pt-8 sm:px-9 sm:pb-10 sm:pt-10 lg:px-12 lg:py-12">
              <h1 className="max-w-4xl text-balance text-[clamp(2.5rem,6.5vw,5rem)] font-extrabold leading-[0.96] tracking-[-0.04em]">
                Terreiros em <span className="text-[#efba18]">{cityName}</span>
                <span className="text-white/45">, {stateName}</span>
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-[#f8f4e9]/72 sm:text-lg">
                Pesquise por nome, bairro ou endereço e encontre uma casa de axé perto de você.
              </p>
            </div>

            <div className="flex border-t border-white/10 lg:border-l lg:border-t-0">
              <div className="grid w-full grid-cols-2 lg:grid-cols-1">
                <div className="flex min-h-28 flex-col justify-center border-r border-white/10 px-6 lg:border-b lg:border-r-0">
                  <strong className="text-3xl font-extrabold tabular-nums text-[#efba18]">{totalTerreiros}</strong>
                  <span className="mt-1 text-sm font-semibold text-white/58">casas mapeadas</span>
                </div>
                <div className="flex min-h-28 flex-col justify-center px-6">
                  <strong className="text-2xl font-extrabold text-[#efba18]">
                    {bairroOptions.length > 0 ? bairroOptions.length : 'Busca direta'}
                  </strong>
                  <span className="mt-1 text-sm font-semibold text-white/58">
                    {bairroOptions.length > 0
                      ? bairroOptions.length === 1 ? 'bairro identificado' : 'bairros identificados'
                      : 'por nome e endereço'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-white/10 bg-black/15 p-4 sm:p-6 lg:px-12">
            <label htmlFor="city-directory-search" className="sr-only">
              Buscar terreiro, bairro ou endereço
            </label>
            <div className="relative max-w-3xl">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#243127]/46" aria-hidden />
              <input
                id="city-directory-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Nome, bairro ou endereço"
                className="min-h-14 w-full rounded-xl border border-transparent bg-[#fffdf7] py-3 pl-12 pr-12 text-base font-semibold text-[#172019] shadow-[0_8px_28px_rgba(0,0,0,.14)] outline-none transition-[border-color,box-shadow] duration-200 placeholder:font-medium placeholder:text-[#243127]/48 focus:border-[#efba18] focus:ring-4 focus:ring-[#efba18]/18"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="absolute right-2 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-lg text-[#243127]/58 transition-colors duration-200 hover:bg-[#243127]/8 hover:text-[#172019] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c99400]"
                  aria-label="Limpar busca"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              ) : null}
            </div>
          </div>
        </motion.header>

        <div className="mt-10 grid gap-8 lg:grid-cols-[16rem_minmax(0,1fr)] lg:items-start xl:gap-12">
          <aside
            className="lg:sticky lg:top-28"
            aria-labelledby={bairroOptions.length > 0 ? 'city-neighborhoods-title' : undefined}
            aria-label={bairroOptions.length > 0 ? undefined : 'Reivindicação do perfil da casa'}
          >
            {bairroOptions.length > 0 ? (
              <div className="rounded-2xl border border-[#dcd2c2] bg-[#fffdf7] p-4 shadow-[0_12px_36px_rgba(61,48,25,.07)] sm:p-5">
                <div className="flex items-center justify-between gap-3">
                  <h2 id="city-neighborhoods-title" className="text-xl font-extrabold tracking-[-0.025em] text-[#172019]">
                    Filtrar por bairro
                  </h2>
                  {selectedBairroSlug !== ALL_BAIRROS ? (
                    <button
                      type="button"
                      onClick={() => setSelectedBairroSlug(ALL_BAIRROS)}
                      className="text-xs font-extrabold text-[#8d6800] underline decoration-[#c99400]/45 underline-offset-4 hover:text-[#604700] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c99400]"
                    >
                      Limpar
                    </button>
                  ) : null}
                </div>

                <div className="mt-4 flex gap-2 overflow-x-auto pb-2 lg:max-h-[28rem] lg:flex-col lg:overflow-y-auto lg:pr-1" role="group" aria-label="Bairros de terreiros">
                  <button
                    type="button"
                    onClick={() => setSelectedBairroSlug(ALL_BAIRROS)}
                    className={`flex min-h-12 shrink-0 items-center justify-between gap-4 rounded-xl px-4 py-3 text-left text-sm font-extrabold transition-[background-color,color,transform] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c99400] ${
                      selectedBairroSlug === ALL_BAIRROS
                        ? 'bg-[#172019] text-white'
                        : 'bg-[#f3ede2] text-[#243127] hover:bg-[#eae1d3] active:scale-[0.98]'
                    }`}
                    aria-pressed={selectedBairroSlug === ALL_BAIRROS}
                  >
                    <span>Todos</span>
                    <span className={selectedBairroSlug === ALL_BAIRROS ? 'text-[#efba18]' : 'text-[#243127]/52'}>{totalTerreiros}</span>
                  </button>

                  {bairroOptions.map((bairro) => (
                    <button
                      key={bairro.slug}
                      type="button"
                      onClick={() => setSelectedBairroSlug(bairro.slug)}
                      className={`flex min-h-12 shrink-0 items-center justify-between gap-4 rounded-xl px-4 py-3 text-left text-sm font-bold transition-[background-color,color,transform] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c99400] ${
                        selectedBairroSlug === bairro.slug
                          ? 'bg-[#172019] text-white'
                          : 'bg-transparent text-[#243127]/78 hover:bg-[#f3ede2] active:scale-[0.98]'
                      }`}
                      aria-pressed={selectedBairroSlug === bairro.slug}
                    >
                      <span>{bairro.nome}</span>
                      <span className={selectedBairroSlug === bairro.slug ? 'text-[#efba18]' : 'text-[#243127]/42'}>{bairro.total}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className={`${bairroOptions.length > 0 ? 'mt-5' : ''} hidden lg:block`}>
              <DirectoryClaimAcquisitionCta cidade={cityName} total={totalTerreiros} />
            </div>
          </aside>

          <section id="city-results" aria-labelledby="city-results-title">
            <div className="flex flex-col gap-3 border-b border-[#dcd2c2] pb-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 id="city-results-title" className="text-3xl font-extrabold tracking-[-0.035em] text-[#172019] sm:text-4xl">
                  Casas em {bairroLabel}
                </h2>
                <p className="mt-2 text-sm font-semibold text-[#243127]/58" aria-live="polite">
                  {loading ? 'Carregando casas...' : `${filteredTerreiros.length} ${filteredTerreiros.length === 1 ? 'terreiro encontrado' : 'terreiros encontrados'}`}
                </p>
              </div>
              {(query || selectedBairroSlug !== ALL_BAIRROS) ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex min-h-11 items-center gap-2 self-start rounded-xl border border-[#d0c4b1] bg-[#fffdf7] px-4 text-sm font-extrabold text-[#243127] transition-[background-color,border-color,transform] duration-200 hover:border-[#c99400] hover:bg-[#fff8df] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c99400]"
                >
                  <X className="h-4 w-4" aria-hidden />
                  Limpar filtros
                </button>
              ) : null}
            </div>

            <div className="mt-6">
              {loading ? (
                <DirectoryLoadingState />
              ) : error ? (
                <div className="rounded-2xl border border-[#d99c92] bg-[#fff8f6] p-8 text-center">
                  <p className="font-bold text-[#8b2d20]">{error}</p>
                  <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="mt-5 min-h-11 rounded-xl bg-[#172019] px-5 text-sm font-extrabold text-white transition-transform duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c99400] focus-visible:ring-offset-4"
                  >
                    Tentar novamente
                  </button>
                </div>
              ) : filteredTerreiros.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#cfc4b4] bg-[#fffdf7] px-6 py-14 text-center">
                  <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-[#f0e8da] text-[#8d6800]">
                    <Search className="h-5 w-5" aria-hidden />
                  </span>
                  <h3 className="mt-5 text-xl font-extrabold text-[#172019]">Nenhuma casa encontrada</h3>
                  <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#243127]/62">
                    Tente outro nome ou endereço, ou volte a visualizar todos os bairros da cidade.
                  </p>
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="mt-5 min-h-11 rounded-xl bg-[#efba18] px-5 text-sm font-extrabold text-[#172019] transition-[background-color,transform] duration-150 hover:bg-[#ffd04b] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8d6800] focus-visible:ring-offset-4"
                  >
                    Ver todos os terreiros
                  </button>
                </div>
              ) : (
                <motion.div
                  key={selectedBairroSlug}
                  initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.24, ease: [0.23, 1, 0.32, 1] }}
                >
                  <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                    {visibleTerreiros.map((terreiro) => (
                      <DiretorioTerreiroCard key={terreiro.slug} terreiro={terreiro} />
                    ))}
                  </ul>

                  {remainingResults > 0 ? (
                    <div className="mt-8 flex justify-center">
                      <button
                        type="button"
                        onClick={() => setVisibleCount((count) => count + RESULT_PAGE_SIZE)}
                        className="inline-flex min-h-12 items-center justify-center rounded-xl border border-[#172019] bg-[#172019] px-6 text-sm font-extrabold text-white transition-[background-color,color,transform] duration-200 hover:bg-[#efba18] hover:text-[#172019] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c99400] focus-visible:ring-offset-4"
                      >
                        Mostrar mais {Math.min(remainingResults, RESULT_PAGE_SIZE)} casas
                      </button>
                    </div>
                  ) : null}
                </motion.div>
              )}
            </div>
          </section>
        </div>

        <div className="mt-10 lg:hidden">
          <DirectoryClaimAcquisitionCta cidade={cityName} total={totalTerreiros} />
        </div>

        <section className="mt-14 border-t border-[#dcd2c2] pt-8" aria-labelledby="city-directory-help-title">
          <div className="grid gap-5 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-start">
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-[#172019] text-[#efba18]">
              <Building2 className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <h2 id="city-directory-help-title" className="text-2xl font-extrabold tracking-[-0.025em] text-[#172019]">
                Antes de visitar uma casa
              </h2>
              <p className="mt-2 max-w-3xl text-base leading-7 text-[#243127]/68">
                Consulte o perfil, confirme horários e atendimentos diretamente com o terreiro. O diretório organiza dados públicos para facilitar o primeiro contato com respeito.
              </p>
            </div>
          </div>
        </section>
      </main>
    </MatrizEditorialLayout>
  );
}
