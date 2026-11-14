import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Maximize2, Minimize2, RotateCw, Search, X, ZoomIn, ZoomOut, RefreshCw } from 'lucide-react';
import type { PDFDocumentLoadingTask } from 'pdfjs-dist';
import type { EventBus, PDFViewer } from 'pdfjs-dist/web/pdf_viewer.mjs';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { readPdfBytes } from '../../lib/pdfSourceReader';
import 'pdfjs-dist/web/pdf_viewer.css';
import './pdfReader.css';

type Props = { source: string | File; title: string; storagePath?: string; tenantId?: string; className?: string };

function openingError(reason: unknown) {
  const error = reason instanceof Error ? reason : new Error();
  if (error.name === 'PasswordException') return 'Este PDF pede uma senha. Envie uma cópia sem senha para permitir a leitura.';
  if (/HTTP_(401|403)/.test(error.message)) return 'Não foi possível autorizar a leitura. Atualize a página e tente novamente.';
  if (error.message === 'HTTP_404') return 'O arquivo não foi encontrado. Substitua o PDF no cadastro.';
  if (error.message === 'MISSING_SOURCE') return 'Este material está sem um arquivo vinculado. Substitua o PDF no cadastro.';
  if (error.message === 'INVALID_PDF') return 'O arquivo recebido não é um PDF válido. Tente novamente ou substitua o arquivo.';
  return 'Não foi possível abrir este PDF. Tente novamente ou substitua o arquivo no cadastro.';
}

/** Mozilla's virtualized viewer owns page rendering, text selection and search. */
export default function PdfReader({ source, title, storagePath, tenantId, className = '' }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const pages = useRef<HTMLDivElement>(null);
  const engine = useRef<{ viewer: PDFViewer; bus: EventBus } | null>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const [page, setPage] = useState(1);
  const [pageInput, setPageInput] = useState('1');
  const [total, setTotal] = useState(0);
  const [scale, setScale] = useState('page-fit');
  const [percent, setPercent] = useState(100);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState('');

  useEffect(() => {
    const abort = new AbortController();
    let task: PDFDocumentLoadingTask | undefined;
    let viewer: PDFViewer | undefined;
    let observer: ResizeObserver | undefined;
    let resizeFrame = 0;
    const host = container.current!;
    const pageHost = pages.current!;
    setLoading(true); setError(''); setTotal(0); setPage(1); setPageInput('1');
    setQuery(''); setMatches(''); setScale('page-fit');
    void (async () => {
      try {
        // The viewer reads globalThis.pdfjsLib, installed by the core import.
        const pdfjs = await import('pdfjs-dist');
        const { PDFViewer, EventBus, PDFLinkService, PDFFindController } = await import('pdfjs-dist/web/pdf_viewer.mjs');
        if (abort.signal.aborted) return;
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
        const bus = new EventBus();
        const links = new PDFLinkService({ eventBus: bus, externalLinkTarget: 2, externalLinkRel: 'noopener noreferrer' });
        const find = new PDFFindController({ eventBus: bus, linkService: links });
        viewer = new PDFViewer({ container: host, viewer: pageHost, eventBus: bus, linkService: links,
          findController: find, textLayerMode: 1, annotationMode: 1, maxCanvasPixels: 8_388_608 });
        links.setViewer(viewer);
        engine.current = { viewer, bus };
        bus.on('pagesinit', () => {
          if (abort.signal.aborted) return;
          viewer!.currentScaleValue = host.clientWidth < 600 ? 'page-width' : 'page-fit';
          setTotal(viewer!.pagesCount);
        });
        bus.on('pagerendered', ({ error: renderError }: { error?: Error }) => {
          if (abort.signal.aborted) return;
          setLoading(false);
          if (renderError) setError('Não foi possível desenhar esta página. Tente abrir o PDF novamente.');
        });
        bus.on('pagechanging', ({ pageNumber }: { pageNumber: number }) => {
          if (!abort.signal.aborted) { setPage(pageNumber); setPageInput(String(pageNumber)); }
        });
        bus.on('scalechanging', ({ scale: value, presetValue }: { scale: number; presetValue?: string }) => {
          if (!abort.signal.aborted) { setScale(presetValue || String(value)); setPercent(Math.round(value * 100)); }
        });
        const updateMatches = ({ matchesCount, state }: { matchesCount?: { current: number; total: number }; state?: number }) => {
          if (abort.signal.aborted) return;
          setMatches(state === 3 ? 'Buscando…' : matchesCount?.total ? `${matchesCount.current} de ${matchesCount.total}` : 'Nenhum resultado');
        };
        bus.on('updatefindmatchescount', updateMatches);
        bus.on('updatefindcontrolstate', updateMatches);
        const data = await readPdfBytes(source, { signal: abort.signal, storagePath, tenantId });
        if (abort.signal.aborted) return;
        const resources = `${import.meta.env.BASE_URL}pdfjs/`;
        task = pdfjs.getDocument({ data, enableXfa: false, useSystemFonts: true,
          cMapUrl: `${resources}cmaps/`, cMapPacked: true, standardFontDataUrl: `${resources}standard_fonts/`, wasmUrl: `${resources}wasm/` });
        const doc = await task.promise;
        if (abort.signal.aborted) return;
        links.setDocument(doc);
        viewer.setDocument(doc);
        observer = new ResizeObserver(() => {
          cancelAnimationFrame(resizeFrame);
          resizeFrame = requestAnimationFrame(() => {
            if (!viewer?.pdfDocument || abort.signal.aborted) return;
            const current = viewer.currentScaleValue;
            if (current === 'page-fit' || current === 'page-width') viewer.currentScaleValue = current;
            viewer.update();
          });
        });
        observer.observe(host);
      } catch (reason) {
        if (!abort.signal.aborted) { setError(openingError(reason)); setLoading(false); }
      }
    })();
    return () => {
      abort.abort(); observer?.disconnect(); cancelAnimationFrame(resizeFrame);
      engine.current = null;
      viewer?.setDocument(null!);
      if (task) void task.destroy().catch(() => {});
      pageHost.replaceChildren();
    };
  }, [source, storagePath, tenantId, retry]);

  useEffect(() => { if (searchOpen) searchInput.current?.focus(); }, [searchOpen]);
  useEffect(() => {
    if (!total) return;
    const timer = window.setTimeout(() => {
      engine.current?.bus.dispatch('find', { source: root.current, type: '', query, phraseSearch: true,
        caseSensitive: false, entireWord: false, highlightAll: true, findPrevious: false, matchDiacritics: false });
      if (!query) setMatches('');
    }, 200);
    return () => clearTimeout(timer);
  }, [query, total]);

  const goTo = (value: number) => {
    if (!engine.current || !total) return;
    const target = Number.isFinite(value) ? Math.max(1, Math.min(total, Math.trunc(value))) : page;
    engine.current.viewer.currentPageNumber = target;
    setPageInput(String(target));
  };
  const zoom = (factor: number) => {
    if (engine.current) engine.current.viewer.currentScaleValue = String(Math.max(0.25, Math.min(4, engine.current.viewer.currentScale * factor)));
  };
  const findNext = (previous = false) => engine.current?.bus.dispatch('find', {
    source: root.current, type: 'again', query, phraseSearch: true, caseSensitive: false,
    entireWord: false, highlightAll: true, findPrevious: previous, matchDiacritics: false,
  });
  const presets = ['page-fit', 'page-width', '0.5', '0.75', '1', '1.25', '1.5', '2', '3', '4'];

  return <div className={`ac-pdf-reader ${className}`} ref={root} data-expanded={expanded} data-search-open={searchOpen} onKeyDownCapture={(event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
      event.preventDefault(); event.stopPropagation(); setSearchOpen(true); searchInput.current?.focus();
    }
    if (event.key === 'Escape' && (searchOpen || expanded)) {
      event.preventDefault(); event.stopPropagation();
      if (searchOpen) { setSearchOpen(false); setQuery(''); } else setExpanded(false);
    }
  }}>
    <div className="ac-pdf-toolbar" role="toolbar" aria-label="Controles de leitura">
      <div className="ac-pdf-controls">
        <button type="button" aria-label="Página anterior" title="Página anterior" disabled={!total || page <= 1} onClick={() => goTo(page - 1)}><ChevronLeft size={18}/></button>
        <form onSubmit={(event) => { event.preventDefault(); goTo(Number(pageInput)); }}>
          <label>Página <input aria-label="Número da página" inputMode="numeric" value={pageInput} disabled={!total}
            onChange={(event) => setPageInput(event.target.value)} onBlur={() => goTo(Number(pageInput))}/></label>
          <span>de {total || '—'}</span>
        </form>
        <button type="button" aria-label="Próxima página" title="Próxima página" disabled={!total || page >= total} onClick={() => goTo(page + 1)}><ChevronRight size={18}/></button>
      </div>
      <div className="ac-pdf-controls ac-pdf-zoom">
        <button type="button" aria-label="Diminuir zoom" title="Diminuir zoom" disabled={!total || percent <= 25} onClick={() => zoom(1 / 1.25)}><ZoomOut size={18}/></button>
        <select aria-label="Ajuste de zoom" value={scale} disabled={!total} onChange={(event) => { if (engine.current) engine.current.viewer.currentScaleValue = event.target.value; }}>
          <option value="page-fit">Página inteira</option><option value="page-width">Largura da página</option>
          {presets.slice(2).map((value) => <option value={value} key={value}>{Number(value) * 100}%</option>)}
          {!presets.includes(scale) && <option value={scale}>{percent}%</option>}
        </select>
        <button type="button" aria-label="Aumentar zoom" title="Aumentar zoom" disabled={!total || percent >= 400} onClick={() => zoom(1.25)}><ZoomIn size={18}/></button>
      </div>
      <div className="ac-pdf-controls ac-pdf-actions">
        <button type="button" aria-label="Buscar no documento" title="Buscar no documento (Ctrl+F)" aria-pressed={searchOpen} disabled={!total} onClick={() => { setSearchOpen(!searchOpen); if(searchOpen) setQuery(''); }}><Search size={18}/></button>
        <button type="button" aria-label="Girar página" title="Girar página" disabled={!total} onClick={() => { if (engine.current) engine.current.viewer.pagesRotation = (engine.current.viewer.pagesRotation + 90) % 360; }}><RotateCw size={18}/></button>
        <button type="button" aria-label={expanded ? 'Reduzir leitor' : 'Ampliar leitor'} title={expanded ? 'Reduzir leitor' : 'Ampliar leitor'} aria-pressed={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? <Minimize2 size={18}/> : <Maximize2 size={18}/>}</button>
      </div>
    </div>
    {searchOpen && <div className="ac-pdf-search" role="search" aria-label="Busca no PDF">
      <Search size={17}/><input ref={searchInput} aria-label="Texto para buscar" placeholder="Buscar no documento…" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); findNext(event.shiftKey); } }}/>
      <span role="status">{query && matches}</span>
      <button type="button" aria-label="Resultado anterior" disabled={!query} onClick={() => findNext(true)}><ChevronLeft size={18}/></button>
      <button type="button" aria-label="Próximo resultado" disabled={!query} onClick={() => findNext()}><ChevronRight size={18}/></button>
      <button type="button" aria-label="Fechar busca" onClick={() => { setSearchOpen(false); setQuery(''); }}><X size={18}/></button>
    </div>}
    <div className="ac-pdf-stage">
      <div className="ac-pdf-scroll" ref={container} tabIndex={0} aria-label={`${title}, páginas do documento`}><div className="pdfViewer" ref={pages}/></div>
      {loading && !error && <div className="ac-pdf-state" role="status"><div className="ac-pdf-loading-sheet"/><p>Abrindo documento…</p></div>}
      {error && <div className="ac-pdf-state" role="alert"><p>{error}</p><button type="button" onClick={() => setRetry(value => value + 1)}><RefreshCw size={16}/>Tentar novamente</button></div>}
    </div>
    <div className="ac-pdf-status"><span>{total ? `Página ${page} de ${total}` : 'Leitor de documentos'}</span><span>Rolagem contínua{total ? ` · ${percent}%` : ''}</span></div>
  </div>;
}
