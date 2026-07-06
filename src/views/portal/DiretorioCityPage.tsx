import { motion } from 'framer-motion';
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2, MapPin, Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { MatrizPageBackground } from '../../components/marketing/MatrizPageBackground';
import { DiretorioTerreiroCard } from '../../components/portal/DiretorioTerreiroCard';
import type { DiretorioBairroGroup } from '../../lib/diretorioPublic';
import { fetchDiretorioCidadeSnapshot, type DiretorioCidadeSnapshot } from '../../lib/diretorioSnapshot';
import { applyCustomPageSeo } from '../../lib/seo';
import { ROUTES } from '../../lib/routes';

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

function BairroTerreirosCarousel({ bairro }: { bairro: DiretorioBairroGroup }) {
  const listRef = useRef<HTMLUListElement>(null);

  const scroll = (direction: -1 | 1) => {
    listRef.current?.scrollBy({ left: direction * 420, behavior: 'smooth' });
  };

  return (
    <motion.section
      key={bairro.slug}
      className="relative mt-8 overflow-hidden rounded-[2rem] border border-[#e8dfd0] bg-white/58 p-5 shadow-xl shadow-black/5 backdrop-blur-sm"
      initial={{ opacity: 0, y: 28, filter: 'blur(8px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
    >
      <motion.div
        className="pointer-events-none absolute inset-x-8 top-0 h-20 rounded-full bg-[#ffc107]/18 blur-3xl"
        animate={{ x: [-28, 28, -28], opacity: [0.45, 0.75, 0.45] }}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
        aria-hidden
      />
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black text-[#1b1813]">{bairro.nome}</h2>
          <p className="mt-1 text-sm text-[#1b1813]/58">
            {bairro.total} terreiro{bairro.total === 1 ? '' : 's'} neste bairro
          </p>
        </div>
        <div className="flex gap-2">
          <motion.button
            type="button"
            onClick={() => scroll(-1)}
            className="grid h-10 w-10 place-items-center rounded-full border border-[#e8dfd0] bg-white text-[#1b1813] shadow-sm transition hover:border-[#ffc107]/60 hover:text-[#a87400]"
            aria-label={`Voltar carrossel de ${bairro.nome}`}
            whileHover={{ scale: 1.08, x: -2 }}
            whileTap={{ scale: 0.94 }}
          >
            <ChevronLeft className="h-4 w-4" />
          </motion.button>
          <motion.button
            type="button"
            onClick={() => scroll(1)}
            className="grid h-10 w-10 place-items-center rounded-full border border-[#e8dfd0] bg-white text-[#1b1813] shadow-sm transition hover:border-[#ffc107]/60 hover:text-[#a87400]"
            aria-label={`Avançar carrossel de ${bairro.nome}`}
            whileHover={{ scale: 1.08, x: 2 }}
            whileTap={{ scale: 0.94 }}
          >
            <ChevronRight className="h-4 w-4" />
          </motion.button>
        </div>
      </div>

      <motion.ul
        ref={listRef}
        className="relative flex snap-x gap-4 overflow-x-auto scroll-smooth pb-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        initial={{ x: 28, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.55, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
      >
        {bairro.items.map((terreiro, index) => (
          <motion.div
            key={terreiro.slug}
            className="w-[min(82vw,20rem)] flex-none snap-start"
            initial={{ opacity: 0, y: 24, filter: 'blur(8px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            whileHover={{ y: -8, scale: 1.018 }}
            whileTap={{ scale: 0.985 }}
            transition={{ delay: Math.min(index * 0.035, 0.24), duration: 0.5 }}
          >
            <DiretorioTerreiroCard terreiro={terreiro} />
          </motion.div>
        ))}
      </motion.ul>
    </motion.section>
  );
}

export default function DiretorioCityPage() {
  const { estado, cidade: cidadeSlug } = parseCityRoute();
  const [cidade, setCidade] = useState<DiretorioCidadeSnapshot | null>(null);
  const [selectedBairroSlug, setSelectedBairroSlug] = useState<string | null>(null);
  const [bairroQuery, setBairroQuery] = useState('');
  const [visibleBairroCount, setVisibleBairroCount] = useState(48);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        const snapshotCity = await fetchDiretorioCidadeSnapshot(estado, cidadeSlug);
        if (cancelled) return;
        if (!snapshotCity) {
          throw new Error('Não foi possível carregar os dados desta cidade. Atualize a página.');
        }
        setCidade(snapshotCity);
        const uf = snapshotCity.estado || estado.toUpperCase();
        applyCustomPageSeo({
          title: `Terreiros em ${snapshotCity.cidade} - ${uf} | AxéCloud`,
          description: `Escolha um bairro para ver terreiros mapeados em ${snapshotCity.cidade}, ${uf}.`,
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

  const bairros = cidade?.bairros || [];

  const filteredBairros = useMemo(() => {
    const term = normalizeSearch(bairroQuery);
    if (!term) return bairros;
    return bairros.filter((bairro) => normalizeSearch(bairro.nome).includes(term));
  }, [bairroQuery, bairros]);

  const selectedBairro = useMemo(
    () => bairros.find((bairro) => bairro.slug === selectedBairroSlug) || null,
    [bairros, selectedBairroSlug],
  );

  const visibleBairros = filteredBairros.slice(0, visibleBairroCount);
  const hiddenBairros = filteredBairros.length - visibleBairros.length;

  useEffect(() => {
    setSelectedBairroSlug(null);
    setBairroQuery('');
    setVisibleBairroCount(48);
  }, [cidadeSlug, estado]);

  useEffect(() => {
    setVisibleBairroCount(bairroQuery.trim() ? 96 : 48);
  }, [bairroQuery]);

  return (
    <div className="landing-v3 landing-mockup-theme relative min-h-dvh overflow-x-clip bg-[#fdf8f0] font-display text-[#1b1813]">
      <MatrizPageBackground />
      <main className="relative z-[1] mx-auto w-full max-w-7xl px-5 pb-24 pt-32 md:px-8 md:pt-36">
        <a href={ROUTES.terreiros} className="inline-flex items-center gap-2 text-sm font-black text-[#1b1813]/62 transition hover:text-[#a87400]">
          <ArrowLeft className="h-4 w-4" />
          Voltar para cidades
        </a>

        <header className="mt-6">
          <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-x-10 lg:items-start">
            <div className="lg:col-start-1 lg:row-start-1">
              <p className="inline-flex rounded-full bg-[#ffc107] px-3.5 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-[#1b1813]">
                Cidade selecionada
              </p>
            </div>
            <h1 className="lg:col-start-1 lg:row-start-2 mt-5 max-w-none text-balance text-4xl font-black tracking-tight text-[#1b1813] md:text-6xl">
              {cidade?.cidade || cidadeSlug.replace(/-/g, ' ')}
              {cidade?.estado ? `, ${cidade.estado}` : ''}
            </h1>
            <p className="lg:col-start-1 lg:row-start-3 mt-4 w-full max-w-none text-base leading-relaxed text-[#1b1813]/64">
              Agora escolha um bairro. Os terreiros só aparecem depois dessa escolha para a página ficar rápida e organizada.
            </p>
            <div className="lg:col-start-2 lg:row-start-1 lg:row-span-3 lg:self-end w-full lg:w-auto lg:min-w-[18rem] lg:max-w-md">
              <div className="rounded-[2rem] border border-[#e8dfd0] bg-white/78 p-5 shadow-xl shadow-black/5 backdrop-blur-sm">
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="rounded-2xl bg-[#ffc107]/14 p-4">
                  <p className="text-2xl font-black text-[#a87400]">{bairros.length}</p>
                  <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-[#1b1813]/45">Bairros</p>
                </div>
                <div className="rounded-2xl bg-[#ffc107]/14 p-4">
                  <p className="text-2xl font-black text-[#a87400]">{cidade?.totalTerreiros || 0}</p>
                  <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-[#1b1813]/45">Terreiros</p>
                </div>
              </div>
              <label className="relative mt-5 block">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#1b1813]/40" />
                <input
                  value={bairroQuery}
                  onChange={(e) => setBairroQuery(e.target.value)}
                  placeholder="Buscar bairro..."
                  className="w-full rounded-full border border-[#e8dfd0] bg-white py-3 pl-11 pr-4 text-sm font-semibold text-[#1b1813] outline-none transition placeholder:text-[#1b1813]/35 focus:border-[#ffc107]/60 focus:ring-4 focus:ring-[#ffc107]/15"
                />
              </label>
              </div>
            </div>
          </section>
        </header>

        <section className="mt-12">
          {loading ? (
            <div className="flex flex-col items-center justify-center rounded-[2rem] border border-[#e8dfd0] bg-white/70 py-20 shadow-sm">
              <Loader2 className="h-8 w-8 animate-spin text-[#a87400]" />
              <p className="mt-4 text-sm font-bold text-[#1b1813]/55">Carregando bairros...</p>
            </div>
          ) : error ? (
            <div className="rounded-[2rem] border border-red-200 bg-white/80 p-8 text-center text-red-600">
              {error}
            </div>
          ) : filteredBairros.length === 0 ? (
            <div className="rounded-[2rem] border border-dashed border-[#e8dfd0] bg-white/70 p-10 text-center">
              <p className="font-bold text-[#1b1813]/70">Nenhum bairro encontrado.</p>
            </div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {visibleBairros.map((bairro, index) => (
                  <motion.button
                    key={bairro.slug}
                    type="button"
                    onClick={() => setSelectedBairroSlug(bairro.slug)}
                    className={`rounded-[1.25rem] border p-4 text-left shadow-sm transition ${
                      selectedBairroSlug === bairro.slug
                        ? 'border-[#ffc107] bg-[#ffc107]/18 shadow-[#ffc107]/15'
                        : 'border-[#e8dfd0] bg-white/78 hover:-translate-y-0.5 hover:border-[#ffc107]/55'
                    }`}
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    whileHover={{ y: -5, scale: 1.015 }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ delay: Math.min(index * 0.02, 0.24), duration: 0.42 }}
                  >
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-[#a87400]">
                      <MapPin className="h-3.5 w-3.5" aria-hidden />
                      Bairro
                    </span>
                    <span className="mt-2 block text-lg font-black text-[#1b1813]">{bairro.nome}</span>
                    <span className="mt-1 block text-sm font-semibold text-[#1b1813]/55">
                      {bairro.total} terreiro{bairro.total === 1 ? '' : 's'}
                    </span>
                  </motion.button>
                ))}
              </div>

              {hiddenBairros > 0 ? (
                <div className="mt-5 text-center">
                  <button
                    type="button"
                    onClick={() => setVisibleBairroCount((count) => count + 48)}
                    className="inline-flex items-center justify-center rounded-full border border-[#e8dfd0] bg-white px-5 py-2.5 text-sm font-black text-[#1b1813] transition hover:border-[#ffc107]/60 hover:text-[#a87400]"
                  >
                    Mostrar mais bairros ({hiddenBairros})
                  </button>
                </div>
              ) : null}

              {selectedBairro ? (
                <BairroTerreirosCarousel key={selectedBairro.slug} bairro={selectedBairro} />
              ) : (
                <div className="mt-8 rounded-[2rem] border border-dashed border-[#e8dfd0] bg-white/68 p-8 text-center">
                  <p className="font-bold text-[#1b1813]/62">Selecione um bairro acima para ver os terreiros.</p>
                </div>
              )}
            </>
          )}
        </section>
      </main>
    </div>
  );
}
