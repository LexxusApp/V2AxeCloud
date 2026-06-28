import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, MapPin, Search } from 'lucide-react';
import { DiretorioTerreiroCard } from './DiretorioTerreiroCard';
import type { DiretorioBairroGroup } from '../../lib/diretorioPublic';
import { cn } from '../../lib/utils';

type Props = {
  bairros: DiretorioBairroGroup[];
  className?: string;
};

export function DiretorioCityByBairro({ bairros, className }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedSlug, setSelectedSlug] = useState<string | null>(bairros[0]?.slug ?? null);
  const rootRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return bairros;
    return bairros.filter((b) => b.nome.toLowerCase().includes(q));
  }, [bairros, query]);

  const selected = bairros.find((b) => b.slug === selectedSlug) ?? bairros[0];

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function pickBairro(slug: string) {
    setSelectedSlug(slug);
    setOpen(false);
    setQuery('');
  }

  return (
    <div className={cn('mt-8', className)}>
      <div
        ref={rootRef}
        className="sticky top-2 z-20 rounded-2xl border border-[#ece4d2] bg-white/95 p-3 shadow-sm backdrop-blur-sm"
      >
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-[#1b1813]/50">
            <MapPin className="h-3.5 w-3.5 text-[#FFC107]" aria-hidden />
            Bairros
          </span>

          <div className="relative min-w-[min(100%,16rem)] flex-1 sm:max-w-sm">
            <button
              type="button"
              aria-expanded={open}
              aria-haspopup="listbox"
              onClick={() => setOpen((v) => !v)}
              className="flex w-full items-center justify-between gap-2 rounded-xl border border-[#ece4d2] bg-white px-4 py-2.5 text-left text-sm font-bold text-[#1b1813] transition hover:border-[#FFC107]/50"
            >
              <span className="truncate">
                {selected?.nome ?? 'Selecione um bairro'}
                {selected ? (
                  <span className="ml-1.5 font-normal text-[#1b1813]/45">({selected.total})</span>
                ) : null}
              </span>
              <ChevronDown
                className={cn('h-4 w-4 shrink-0 text-[#1b1813]/45 transition', open && 'rotate-180')}
                aria-hidden
              />
            </button>

            {open ? (
              <div
                role="listbox"
                aria-label="Lista de bairros"
                className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-30 overflow-hidden rounded-xl border border-[#ece4d2] bg-white shadow-lg"
              >
                <div className="border-b border-[#ece4d2]/80 p-2">
                  <label className="relative block">
                    <Search
                      className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#1b1813]/35"
                      aria-hidden
                    />
                    <input
                      type="search"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Buscar bairro…"
                      className="w-full rounded-lg border border-[#ece4d2] bg-[#faf7f2] py-2 pl-9 pr-3 text-sm text-[#1b1813] outline-none ring-[#FFC107]/40 focus:ring-2"
                      autoFocus
                    />
                  </label>
                </div>
                <ul className="max-h-64 overflow-y-auto py-1">
                  {filtered.length === 0 ? (
                    <li className="px-4 py-3 text-sm text-[#1b1813]/50">Nenhum bairro encontrado.</li>
                  ) : (
                    filtered.map((b) => (
                      <li key={b.slug}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={b.slug === selectedSlug}
                          onClick={() => pickBairro(b.slug)}
                          className={cn(
                            'flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-sm transition hover:bg-[#faf7f2]',
                            b.slug === selectedSlug && 'bg-[#FFF8E1] font-bold text-[#1b1813]',
                          )}
                        >
                          <span className="truncate">{b.nome}</span>
                          <span className="shrink-0 text-xs font-normal text-[#1b1813]/45">{b.total}</span>
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            ) : null}
          </div>

          <p className="text-xs text-[#1b1813]/50">
            {bairros.length} bairro{bairros.length === 1 ? '' : 's'} · escolha um para ver os terreiros
          </p>
        </div>
      </div>

      {selected ? (
        <section className="mt-8 scroll-mt-28" id={`bairro-${selected.slug}`}>
          <header className="mb-5 border-b border-[#ece4d2]/80 pb-3">
            <h2 className="font-display text-xl font-black text-[#1b1813] sm:text-2xl">{selected.nome}</h2>
            <p className="mt-1 text-sm text-[#1b1813]/55">
              {selected.total} terreiro{selected.total === 1 ? '' : 's'} neste bairro
            </p>
          </header>
          <ul className="grid items-stretch gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {selected.items.map((t) => (
              <DiretorioTerreiroCard key={t.slug} terreiro={t} />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
