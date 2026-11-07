import PageLoading from '../shared/PageLoading';
import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { authFetch } from '../../src/lib/authenticatedFetch';

type LoadedPage = { number: number; page: PDFPageProxy; baseWidth: number; baseHeight: number };

async function readPdfSource(source: string | File): Promise<Uint8Array> {
  if (source instanceof File) return new Uint8Array(await source.arrayBuffer());
  if (!source) throw new Error('MISSING_SOURCE');

  const load = () => source.startsWith('/api/') ? authFetch(source) : fetch(source);
  let response = await load();
  if ([502, 503, 504].includes(response.status)) {
    await response.body?.cancel().catch(() => {});
    response = await load();
  }
  if (!response.ok) throw new Error(`HTTP_${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength < 5 || new TextDecoder().decode(bytes.slice(0, 5)) !== '%PDF-') {
    throw new Error('INVALID_PDF');
  }
  return bytes;
}

function openingError(reason: unknown) {
  if (reason instanceof Error && reason.name === 'PasswordException') {
    return 'Este PDF pede uma senha. Envie uma cópia sem senha para permitir a leitura.';
  }
  if (reason instanceof Error && reason.message === 'MISSING_SOURCE') {
    return 'Este material está sem um arquivo vinculado. Substitua o PDF no cadastro.';
  }
  if (reason instanceof Error && /^HTTP_(401|403)$/.test(reason.message)) {
    return 'Sua sessão não conseguiu autorizar este PDF. Atualize a página e tente novamente.';
  }
  if (reason instanceof Error && reason.message === 'HTTP_404') {
    return 'O arquivo deste material não foi encontrado. Substitua o PDF no cadastro.';
  }
  if (reason instanceof Error && reason.message === 'INVALID_PDF') {
    return 'O servidor não entregou um PDF válido. Tente novamente ou substitua o arquivo.';
  }
  return 'Não foi possível abrir este PDF. Tente novamente ou substitua o arquivo no cadastro.';
}

export default function LibraryPdf({ source, title }: { source: string | File; title: string }) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [loadedPage, setLoadedPage] = useState<LoadedPage | null>(null);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [width, setWidth] = useState(0);
  const [retry, setRetry] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [drawing, setDrawing] = useState(false);
  const [hasRendered, setHasRendered] = useState(false);
  const [pageText, setPageText] = useState('');
  const frame = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    let task: import('pdfjs-dist').PDFDocumentLoadingTask | undefined;
    setPdf(null);
    setLoadedPage(null);
    setError('');
    setLoading(true);
    setDrawing(false);
    setHasRendered(false);
    setPageText('');
    setPage(1);

    async function open() {
      try {
        const engine = await import('pdfjs-dist');
        engine.GlobalWorkerOptions.workerSrc = workerUrl;
        const data = await readPdfSource(source);
        if (cancelled) return;
        task = engine.getDocument({ data, enableXfa: false, isEvalSupported: false } as Parameters<typeof engine.getDocument>[0]);
        const loaded = await task.promise;
        const first = await loaded.getPage(1);
        if (!cancelled) {
          const viewport = first.getViewport({ scale: 1 });
          setPdf(loaded);
          setLoadedPage({ number: 1, page: first, baseWidth: viewport.width, baseHeight: viewport.height });
          setLoading(false);
        }
      } catch (reason) {
        if (!cancelled) {
          setLoading(false);
          setDrawing(false);
          setError(openingError(reason));
        }
      }
    }

    void open();
    return () => {
      cancelled = true;
      if (task) void task.destroy().catch(() => {});
    };
  }, [source, retry]);

  useEffect(() => {
    const element = frame.current;
    if (!element) return;
    let animationFrame = 0;
    const measure = (measured: number) => {
      const next = Math.max(170, Math.floor(measured - 28));
      cancelAnimationFrame(animationFrame);
      animationFrame = requestAnimationFrame(() => {
        setWidth(current => Math.abs(current - next) < 12 ? current : next);
      });
    };
    measure(element.getBoundingClientRect().width);
    const observer = new ResizeObserver(entries => {
      measure(entries[0]?.contentRect.width || element.getBoundingClientRect().width);
    });
    observer.observe(element);
    return () => {
      cancelAnimationFrame(animationFrame);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!pdf || loadedPage?.number === page) return;
    let cancelled = false;
    setDrawing(true);
    void pdf.getPage(page).then(nextPage => {
      if (cancelled) return;
      const viewport = nextPage.getViewport({ scale: 1 });
      setLoadedPage({ number: page, page: nextPage, baseWidth: viewport.width, baseHeight: viewport.height });
    }).catch(reason => {
      if (!cancelled) {
        setDrawing(false);
        setError(openingError(reason));
      }
    });
    return () => { cancelled = true; };
  }, [loadedPage?.number, page, pdf]);

  useEffect(() => {
    if (!pdf || !loadedPage || loadedPage.number !== page || width <= 0) return;
    let cancelled = false;
    let renderTask: import('pdfjs-dist').RenderTask | undefined;
    setDrawing(true);
    setPageText('');

    async function draw() {
      try {
        const scale = width / loadedPage!.baseWidth * zoom;
        const viewport = loadedPage!.page.getViewport({ scale });
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        const buffer = document.createElement('canvas');
        buffer.width = Math.ceil(viewport.width * ratio);
        buffer.height = Math.ceil(viewport.height * ratio);
        const context = buffer.getContext('2d');
        if (!context) throw new Error('Canvas indisponível');
        renderTask = loadedPage!.page.render({
          canvas: buffer,
          canvasContext: context,
          viewport,
          transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0],
        });
        await renderTask.promise;
        if (cancelled || !canvas.current) return;
        const element = canvas.current;
        element.width = buffer.width;
        element.height = buffer.height;
        element.style.width = `${viewport.width}px`;
        element.style.height = `${viewport.height}px`;
        const visible = element.getContext('2d');
        if (!visible) throw new Error('Canvas indisponível');
        visible.clearRect(0, 0, element.width, element.height);
        visible.drawImage(buffer, 0, 0);
        setHasRendered(true);
        setDrawing(false);
        setError('');
        try {
          const content = await loadedPage!.page.getTextContent();
          if (!cancelled) setPageText(content.items.map(item => 'str' in item ? item.str : '').join(' '));
        } catch {
          if (!cancelled) setPageText('');
        }
      } catch (reason) {
        if (!cancelled && !(reason instanceof Error && reason.name === 'RenderingCancelledException')) {
          setDrawing(false);
          setError('Não foi possível exibir esta página. Tente abrir o arquivo novamente.');
        }
      }
    }

    void draw();
    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [loadedPage, page, pdf, width, zoom]);

  const displayWidth = loadedPage && width > 0 ? width * zoom : 0;
  const displayHeight = loadedPage && displayWidth > 0 ? displayWidth * loadedPage.baseHeight / loadedPage.baseWidth : 0;
  const changePage = (next: number) => {
    setDrawing(true);
    setPage(next);
  };

  return <div className="lb-pdf">
    <div className="lb-pdf-toolbar">
      <div>
        <button aria-label="Página anterior" disabled={!pdf || page <= 1 || drawing} onClick={() => changePage(page - 1)}><ChevronLeft size={18} /></button>
        <span aria-live="polite">{pdf ? `Página ${page} de ${pdf.numPages}` : 'Abrindo PDF'}</span>
        <button aria-label="Próxima página" disabled={!pdf || page >= pdf.numPages || drawing} onClick={() => changePage(page + 1)}><ChevronRight size={18} /></button>
      </div>
      <label>Zoom
        <select aria-label="Zoom do PDF" value={zoom} onChange={event => { setDrawing(true); setZoom(Number(event.target.value)); }}>
          <option value={0.75}>75%</option><option value={1}>Ajustar</option><option value={1.25}>125%</option><option value={1.5}>150%</option><option value={2}>200%</option><option value={3}>300%</option>
        </select>
      </label>
    </div>
    <div className="lb-pdf-frame" ref={frame} tabIndex={0} aria-label={`Leitura do PDF: ${title}`} aria-busy={loading || drawing}>
      {error ? <div className="lb-pdf-error" role="alert"><p>{error}</p><button className="wf-button secondary" onClick={() => setRetry(value => value + 1)}><RefreshCw size={16} />Tentar abrir novamente</button></div> : <>
        {loading && <PageLoading variant="document" label="Abrindo documento…"/>}
        {drawing && hasRendered && <span className="lb-pdf-page-progress" role="status">Preparando página {page}…</span>}
        <canvas ref={canvas} role="img" aria-label={`${title}, página ${page}`} style={{ width: displayWidth > 0 ? `${displayWidth}px` : undefined, height: displayHeight > 0 ? `${displayHeight}px` : undefined, visibility: hasRendered ? 'visible' : 'hidden' }} />
      </>}
    </div>
    <details className="lb-pdf-text"><summary>Ler texto extraído desta página</summary><p>{pageText || 'Sem texto extraído nesta página. O documento pode conter apenas imagens; use seu leitor de PDF para outros recursos.'}</p></details>
    <p className="lb-pdf-access">A visualização mostra a página do arquivo. Para usar seu leitor de PDF, baixe o documento.</p>
  </div>;
}
