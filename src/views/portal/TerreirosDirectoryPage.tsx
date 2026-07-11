import { motion } from 'framer-motion';
import { ArrowRight, Loader2, MapPin, Search } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { diretorioCityPath } from '../../lib/diretorioSlug';
import {
  loadDiretorioCidadesResumo,
  type DiretorioCidadeResumo,
} from '../../lib/diretorioSnapshot';
import { MatrizPageBackground } from '../../components/marketing/MatrizPageBackground';

function normalizeSearch(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function MatrizKicker({ children }: { children: ReactNode }) {
  return (
    <span className="matriz-kicker-pulse inline-flex rounded-full bg-[#ffc107] px-3.5 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-[#1b1813]">
      {children}
    </span>
  );
}


export default function TerreirosDirectoryPage() {
  const [cidades, setCidades] = useState<DiretorioCidadeResumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const snapshot = await loadDiretorioCidadesResumo();
        if (cancelled) return;
        if (!snapshot?.length) {
          throw new Error('Não foi possível carregar o diretório de cidades. Atualize a página.');
        }
        setCidades(snapshot);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Erro ao carregar cidades');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredCidades = useMemo(() => {
    const term = normalizeSearch(q);
    if (!term) return cidades;
    return cidades.filter((cidade) =>
      normalizeSearch(`${cidade.cidade} ${cidade.estado || ''}`).includes(term),
    );
  }, [cidades, q]);

  const totalTerreiros = useMemo(
    () => cidades.reduce((sum, cidade) => sum + cidade.totalTerreiros, 0),
    [cidades],
  );

  const totalBairros = useMemo(
    () => cidades.reduce((sum, cidade) => sum + cidade.totalBairros, 0),
    [cidades],
  );

  return (
    <div className="landing-v3 landing-mockup-theme relative min-h-dvh overflow-x-clip bg-[#fdf8f0] font-display text-[#1b1813]">
      <MatrizPageBackground />
      <main className="relative z-[1] mx-auto w-full max-w-7xl px-5 pb-24 pt-32 md:px-8 md:pt-36">
        <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-x-10 lg:items-start">
          <motion.div
            className="contents"
            initial={{ opacity: 0, y: 34, filter: 'blur(8px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.72, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="lg:col-start-1 lg:row-start-1">
              <MatrizKicker>Diretório de terreiros</MatrizKicker>
            </div>
            <h1 className="lg:col-start-1 lg:row-start-2 mt-6 max-w-none text-balance text-3xl font-black leading-[1.05] tracking-tight text-[#1b1813] sm:text-4xl md:text-6xl">
              Primeiro escolha uma cidade
            </h1>
            <p className="lg:col-start-1 lg:row-start-3 mt-4 w-full max-w-none text-base leading-relaxed text-[#1b1813]/66 md:text-lg">
              Mais de 2 mil terreiros mapeados por cidade e bairro. Escolha uma cidade para ver a lista completa.
            </p>
            <div className="lg:col-start-2 lg:row-start-1 lg:row-span-3 lg:self-end w-full lg:w-auto lg:min-w-[18rem] lg:max-w-md">
              <div className="rounded-[2rem] border border-[#e8dfd0] bg-white/78 p-5 shadow-xl shadow-black/5 backdrop-blur-sm">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-2xl bg-[#ffc107]/14 p-4">
                  <p className="text-2xl font-black text-[#a87400]">{cidades.length}</p>
                  <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-[#1b1813]/45">Cidades</p>
                </div>
                <div className="rounded-2xl bg-[#ffc107]/14 p-4">
                  <p className="text-2xl font-black text-[#a87400]">
                    {totalBairros > 0 ? totalBairros : '—'}
                  </p>
                  <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-[#1b1813]/45">Bairros</p>
                </div>
                <div className="rounded-2xl bg-[#ffc107]/14 p-4">
                  <p className="text-2xl font-black text-[#a87400]">{totalTerreiros}</p>
                  <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-[#1b1813]/45">Terreiros</p>
                </div>
              </div>
              <label className="relative mt-5 block">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#1b1813]/40" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Buscar cidade..."
                  className="w-full rounded-full border border-[#e8dfd0] bg-white py-3 pl-11 pr-4 text-sm font-semibold text-[#1b1813] outline-none transition placeholder:text-[#1b1813]/35 focus:border-[#ffc107]/60 focus:ring-4 focus:ring-[#ffc107]/15"
                />
              </label>
              </div>
            </div>
          </motion.div>
        </section>

        <section className="mt-14">
          {loading ? (
            <div className="flex flex-col items-center justify-center rounded-[2rem] border border-[#e8dfd0] bg-white/70 py-20 shadow-sm">
              <Loader2 className="h-8 w-8 animate-spin text-[#a87400]" />
              <p className="mt-4 text-sm font-bold text-[#1b1813]/55">Carregando cidades mapeadas...</p>
            </div>
          ) : error ? (
            <div className="rounded-[2rem] border border-red-200 bg-white/80 p-8 text-center text-red-600">
              {error}
            </div>
          ) : filteredCidades.length === 0 ? (
            <div className="rounded-[2rem] border border-dashed border-[#e8dfd0] bg-white/70 p-10 text-center">
              <p className="font-bold text-[#1b1813]/70">Nenhuma cidade encontrada para essa busca.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredCidades.map((cidade, index) => (
                <motion.a
                  key={`${cidade.estado || 'br'}-${cidade.cidadeSlug}`}
                  href={diretorioCityPath(cidade.estado, cidade.cidadeSlug)}
                  className="group relative overflow-hidden rounded-[1.5rem] border border-[#e8dfd0] bg-white/80 p-5 shadow-sm shadow-black/5 backdrop-blur-sm transition hover:-translate-y-1 hover:border-[#ffc107]/50 hover:shadow-xl hover:shadow-[#ffc107]/10"
                  initial={{ opacity: 0, y: 24, filter: 'blur(8px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  whileHover={{ y: -8, scale: 1.018 }}
                  whileTap={{ scale: 0.985 }}
                  transition={{ delay: Math.min(index * 0.025, 0.28), duration: 0.5 }}
                >
                  <div className="pointer-events-none absolute right-0 top-0 h-24 w-24 rounded-full bg-[#ffc107]/14 blur-2xl" />
                  <motion.div
                    className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#ffc107]/70 to-transparent"
                    animate={{ x: ['-100%', '100%'] }}
                    transition={{ duration: 3.2, repeat: Infinity, delay: index * 0.08, ease: 'easeInOut' }}
                    aria-hidden
                  />
                  <div className="relative flex items-start justify-between gap-4">
                    <div>
                      <p className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-[#a87400]">
                        <MapPin className="h-3.5 w-3.5" aria-hidden />
                        Cidade
                      </p>
                      <h2 className="mt-2 text-xl font-black text-[#1b1813]">
                        {cidade.cidade}
                        {cidade.estado ? `, ${cidade.estado}` : ''}
                      </h2>
                      <p className="mt-2 text-sm text-[#1b1813]/58">
                        {cidade.totalTerreiros} terreiro{cidade.totalTerreiros === 1 ? '' : 's'}
                        {cidade.totalBairros > 0
                          ? ` em ${cidade.totalBairros} bairro${cidade.totalBairros === 1 ? '' : 's'}.`
                          : '.'}
                      </p>
                    </div>
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#ffc107] text-[#1b1813] transition group-hover:translate-x-1">
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  </div>
                </motion.a>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
