import PageLoading from '../shared/PageLoading';
import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { readPdfBytes } from '../../src/lib/pdfSourceReader';

type LoadedPage = { number: number; page: PDFPageProxy; baseWidth: number; baseHeight: number };

async function readPdfSource(source: string | File): Promise<Uint8Array> {
  return readPdfBytes(source);
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
      setWidth((current) => (Math.abs(current - next) < 12 ? current : next));
    };
    measure(element.getBoundingClientRect().width);
    const observer = new ResizeObserver((entries) => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(() => measure(entries[0]?.contentRect.width || 0));
    });
    observer.observe(element);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!pdf) return;
    let cancelled = false;
    async function loadPage() {
      try {
        const target = await pdf!.getPage(page);
        if (!cancelled) {
          const viewport = target.getViewport({ scale: 1 });
          setLoadedPage({ number: page, page: target, baseWidth: viewport.width, baseHeight: viewport.height });
        }
      } catch {
        if (!cancelled) setError('Não foi possível carregar a página solicitada.');
      }
    }
    void loadPage();
    return () => {
      cancelled = true;
    };
  }, [pdf, page]);

  useEffect(() => {
    if (!loadedPage || !canvas.current || !width) return;
    let cancelled = false;
    let renderTask: ReturnType<PDFPageProxy['render']> | undefined;
    setDrawing(true);
    setPageText('');

    async function draw() {
      try {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const displayWidth = Math.max(170, Math.floor(width * zoom));
        const scale = displayWidth / loadedPage!.baseWidth;
        const viewport = loadedPage!.page.getViewport({ scale: scale * dpr });
        const target = canvas.current;
        if (!target) return;
        target.width = Math.floor(viewport.width);
        target.height = Math.floor(viewport.height);
        target.style.width = `${displayWidth}px`;
        target.style.height = `${Math.floor(displayWidth * (loadedPage!.baseHeight / loadedPage!.baseWidth))}px`;

        const context = target.getContext('2d');
        if (!context) throw new Error('CONTEXT_UNAVAILABLE');
        renderTask = loadedPage!.page.render({ canvas: target, canvasContext: context, viewport } as any);
        await renderTask.promise;
        const content = await loadedPage!.page.getTextContent().catch(() => null);
        if (!cancelled) {
          const text = (content?.items || [])
            .map((item: any) => (typeof item?.str === 'string' ? item.str : ''))
            .filter(Boolean)
            .join(' ');
          setPageText(text.slice(0, 1500));
          setDrawing(false);
          setHasRendered(true);
        }
      } catch (reason: any) {
        if (!cancelled && reason?.name !== 'RenderingCancelledException') {
          setDrawing(false);
          setError('Não foi possível renderizar a página deste PDF.');
        }
      }
    }

    void draw();
    return () => {
      cancelled = true;
      if (renderTask) renderTask.cancel();
    };
  }, [loadedPage, width, zoom]);

  const total = pdf?.numPages || 1;

  if (error) {
    return (
      <div className="lb-pdf-error" role="alert">
        <p>{error}</p>
        <button
          className="wf-button secondary"
          onClick={() => {
            setError('');
            setLoading(true);
            setRetry((value) => value + 1);
          }}
        >
          <RefreshCw size={15} />
          Tentar abrir novamente
        </button>
      </div>
    );
  }

  return (
    <div className="lb-pdf-viewer">
      <div className="lb-pdf-toolbar" role="toolbar" aria-label="Controles de leitura do documento">
        <div className="lb-pdf-pager">
          <button
            className="icon-button"
            disabled={page <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            aria-label="Página anterior"
          >
            <ChevronLeft size={18} />
          </button>
          <span>
            {loading ? 'Abrindo PDF' : `Página ${page} de ${total}`}
          </span>
          <button
            className="icon-button"
            disabled={page >= total}
            onClick={() => setPage((current) => Math.min(total, current + 1))}
            aria-label="Próxima página"
          >
            <ChevronRight size={18} />
          </button>
        </div>
        <div className="lb-pdf-zoom">
          <label htmlFor="lb-zoom-select">Zoom</label>
          <select
            id="lb-zoom-select"
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
          >
            <option value={1}>Ajustar</option>
            <option value={1.25}>125%</option>
            <option value={1.5}>150%</option>
          </select>
        </div>
      </div>
      <div className="lb-pdf-canvas-wrap" ref={frame} tabIndex={0} aria-label={`${title}, leitura em tela`}>
        {loading && <PageLoading variant="document" label="Carregando páginas do PDF…" />}
        <canvas
          ref={canvas}
          className="lb-pdf-canvas"
          style={{ display: hasRendered ? 'block' : 'none', opacity: drawing ? 0.6 : 1 }}
          aria-label={`${title}, página ${page}`}
        />
      </div>
      {pageText && (
        <details className="lb-pdf-text-extract">
          <summary>Ler texto extraído desta página</summary>
          <p>{pageText}</p>
        </details>
      )}
    </div>
  );
}
