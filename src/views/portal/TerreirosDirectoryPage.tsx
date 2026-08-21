import { motion } from 'framer-motion';
import { BadgeCheck, MapPin, MessageCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import {
  loadDiretorioCidadesResumo,
  readEmbeddedDiretorioCidadesResumo,
  type DiretorioCidadeResumo,
} from '../../lib/diretorioSnapshot';
import { fetchDiretorioMapPoints, type DiretorioMapPoint } from '../../lib/diretorioMap';
import { MatrizPageBackground } from '../../components/marketing/MatrizPageBackground';
import { commercialWhatsAppUrl } from '../../constants/commercialContact';
import { monitorDirectoryPerformance } from '../../lib/directoryPerformance';

const DirectoryCoverageMap = lazy(() =>
  import('../../components/portal/DirectoryCoverageMap').then((module) => ({
    default: module.DirectoryCoverageMap,
  })),
);

function MatrizKicker({ children }: { children: ReactNode }) {
  return (
    <span className="matriz-kicker-pulse inline-flex rounded-full bg-[#ffc107] px-3.5 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-[#1b1813]">
      {children}
    </span>
  );
}

function DirectoryMapPlaceholder({ label }: { label: string }) {
  return (
    <div className="grid min-h-[280px] place-items-center rounded-[2rem] border border-[#ded4c5] bg-white/75 px-6 text-center shadow-sm">
      <div>
        <MapPin className="mx-auto h-7 w-7 text-[#a87400]" aria-hidden />
        <p className="mt-3 text-sm font-bold text-[#1b1813]/65">{label}</p>
      </div>
    </div>
  );
}

function DeferredDirectoryCoverageMap() {
  const sentinelRef = useRef<HTMLElement | null>(null);
  const [requested, setRequested] = useState(false);
  const [points, setPoints] = useState<DiretorioMapPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    const target = sentinelRef.current;
    if (!target || requested) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setRequested(true);
        observer.disconnect();
      },
      { rootMargin: '500px 0px' },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [requested]);

  useEffect(() => {
    if (!requested) return;
    const controller = new AbortController();
    setLoading(true);
    void fetchDiretorioMapPoints(controller.signal)
      .then((mapPoints) => setPoints(mapPoints))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setPoints([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [requested, loadAttempt]);

  return (
    <section ref={sentinelRef} className="mt-10 min-h-[280px]" aria-label="Mapa dos terreiros">
      {requested ? (
        <Suspense fallback={<DirectoryMapPlaceholder label="Preparando mapa interativo…" />}>
          <DirectoryCoverageMap
            points={points}
            loading={loading}
            onRetry={() => setLoadAttempt((value) => value + 1)}
          />
        </Suspense>
      ) : (
        <DirectoryMapPlaceholder label="O mapa será carregado quando você chegar a esta seção." />
      )}
    </section>
  );
}


export default function TerreirosDirectoryPage() {
  const embeddedCidades = useMemo(() => readEmbeddedDiretorioCidadesResumo(), []);
  const [cidades, setCidades] = useState<DiretorioCidadeResumo[]>(embeddedCidades);

  useEffect(() => {
    let cancelled = false;
    const startedAt = performance.now();
    const performanceMonitor = monitorDirectoryPerformance();

    async function load() {
      try {
        const snapshot = await loadDiretorioCidadesResumo();
        if (cancelled) return;
        if (!snapshot?.length) {
          throw new Error('Não foi possível carregar o diretório de cidades. Atualize a página.');
        }
        setCidades(snapshot);
        performanceMonitor.recordSummary({
          durationMs: performance.now() - startedAt,
          cityCount: snapshot.length,
          totalTerreiros: snapshot.reduce((sum, cidade) => sum + cidade.totalTerreiros, 0),
        });
      } catch (e) {
        if (!cancelled) console.warn(e instanceof Error ? e.message : 'Erro ao carregar cidades');
      }
    }

    void load();
    return () => {
      cancelled = true;
      performanceMonitor.stop();
    };
  }, [embeddedCidades.length]);

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
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.72, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="lg:col-start-1 lg:row-start-1">
              <MatrizKicker>Diretório de terreiros</MatrizKicker>
            </div>
            <h1 className="lg:col-start-1 lg:row-start-2 mt-6 max-w-none text-balance text-3xl font-black leading-[1.05] tracking-tight text-[#1b1813] sm:text-4xl md:text-6xl">
              Encontre uma casa de axé perto de você
            </h1>
            <p className="lg:col-start-1 lg:row-start-3 mt-4 w-full max-w-none text-base leading-relaxed text-[#1b1813]/66 md:text-lg">
              Pesquise pelo nome ou pela cidade, explore o mapa e abra o perfil da casa para conhecer seus dados públicos e atendimentos.
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
              </div>
            </div>
          </motion.div>
        </section>

        <DeferredDirectoryCoverageMap />

        <section className="mt-16 grid gap-6 overflow-hidden rounded-[2rem] border border-[#e8dfd0] bg-white/82 p-7 shadow-xl shadow-black/5 md:grid-cols-[1fr_auto] md:items-center md:p-9" aria-labelledby="claim-profile-title">
          <div className="flex gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-emerald-100 text-emerald-700">
              <BadgeCheck className="h-6 w-6" aria-hidden />
            </span>
            <div>
              <h2 id="claim-profile-title" className="text-xl font-black text-[#1b1813]">Sua casa já aparece no diretório?</h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#1b1813]/62">
                Fale com o AxéCloud para corrigir informações, identificar sua casa e conhecer o perfil público com eventos e contato oficial.
              </p>
            </div>
          </div>
          <a
            href={commercialWhatsAppUrl('Olá! Encontrei minha casa no diretório do AxéCloud e quero reivindicar ou atualizar o perfil.')}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[#1b1813] px-6 py-3.5 text-sm font-black text-white transition hover:bg-[#a87400]"
          >
            <MessageCircle className="h-4 w-4 text-[#ffc107]" aria-hidden />
            Reivindicar perfil
          </a>
        </section>
      </main>
    </div>
  );
}
