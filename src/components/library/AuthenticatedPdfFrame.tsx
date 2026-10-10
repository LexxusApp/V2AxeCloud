import { useEffect, useRef, useState, useCallback } from 'react';
import {
  FileText,
  Loader2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  ChevronLeft,
  ChevronRight,
  Download,
  X,
  BookOpen,
} from 'lucide-react';
import { authFetch } from '../../lib/authenticatedFetch';

type Props = {
  title: string;
  url: string;
  storagePath?: string;
  tenantId?: string;
  className?: string;
};

export function extractLibraryStoragePath(rawUrl: string): string | null {
  const value = String(rawUrl || '').trim();
  if (!value) return null;
  try {
    const parsed = new URL(value, window.location.origin);
    if (parsed.pathname === '/api/v1/library/pdf-proxy') {
      return parsed.searchParams.get('path');
    }
    const marker = '/storage/v1/object/public/biblioteca_estudos/';
    const index = parsed.pathname.indexOf(marker);
    return index >= 0 ? decodeURIComponent(parsed.pathname.slice(index + marker.length)) : null;
  } catch {
    return null;
  }
}

function PdfCanvas({
  pdf,
  pageNumber,
  title,
  zoom,
  containerWidth,
}: {
  pdf: any;
  pageNumber: number;
  title: string;
  zoom: number;
  containerWidth: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let renderTask: { cancel: () => void; promise: Promise<unknown> } | null = null;
    void (async () => {
      try {
        const page = await pdf.getPage(pageNumber);
        if (cancelled || !canvasRef.current) return;
        const base = page.getViewport({ scale: 1 });
        const dpr = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 2.5);
        const safeWidth = Math.max(300, (containerWidth || 800) - 24);
        const displayWidth = Math.max(280, Math.floor(safeWidth * zoom));
        const renderWidth = Math.max(displayWidth, Math.floor(displayWidth * dpr));
        const viewport = page.getViewport({ scale: renderWidth / base.width });
        const canvas = canvasRef.current;
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.width = `${displayWidth}px`;
        canvas.style.height = 'auto';

        const context = canvas.getContext('2d');
        if (!context) throw new Error('Canvas indisponível');
        context.fillStyle = '#fff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        renderTask = page.render({ canvas, canvasContext: context, viewport });
        await renderTask.promise;
      } catch (renderError) {
        if (!cancelled && String(renderError).toLowerCase().includes('cancel') === false) {
          console.error('[AuthenticatedPdfFrame] Falha ao renderizar página:', renderError);
          setFailed(true);
        }
      }
    })();
    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [pdf, pageNumber, zoom, containerWidth]);

  if (failed) {
    return (
      <div className="p-6 text-center text-sm font-bold text-[#8A8172] bg-white rounded-lg">
        Não foi possível renderizar a página {pageNumber}.
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      className="block bg-white shadow-md rounded-sm transition-all"
      aria-label={`${title}, página ${pageNumber}`}
    />
  );
}

export function AuthenticatedPdfFrame({ title, url, storagePath, tenantId, className }: Props) {
  const [pdf, setPdf] = useState<any>(null);
  const [error, setError] = useState(false);
  const [zoom, setZoom] = useState<number>(1.0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [containerWidth, setContainerWidth] = useState<number>(800);

  const containerRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // Observa largura do container para redimensionamento responsivo
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const updateWidth = () => {
      if (el) setContainerWidth(el.clientWidth);
    };
    updateWidth();
    const observer = new ResizeObserver(() => updateWidth());
    observer.observe(el);
    return () => observer.disconnect();
  }, [isFullscreen]);

  // Tecla ESC para sair da tela cheia
  useEffect(() => {
    if (!isFullscreen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFullscreen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFullscreen]);

  // Detecção de página atual durante o scroll
  const handleScroll = useCallback(() => {
    const scrollEl = scrollAreaRef.current;
    if (!scrollEl || !pdf) return;
    const scrollMiddle = scrollEl.scrollTop + scrollEl.clientHeight / 3;

    for (let i = 1; i <= pdf.numPages; i++) {
      const pageEl = pageRefs.current.get(i);
      if (pageEl) {
        const top = pageEl.offsetTop;
        const bottom = top + pageEl.offsetHeight;
        if (scrollMiddle >= top && scrollMiddle <= bottom) {
          setCurrentPage(i);
          break;
        }
      }
    }
  }, [pdf]);

  const scrollToPage = useCallback((targetPage: number) => {
    if (!pdf) return;
    const page = Math.max(1, Math.min(targetPage, pdf.numPages));
    const pageEl = pageRefs.current.get(page);
    if (pageEl && scrollAreaRef.current) {
      pageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setCurrentPage(page);
    }
  }, [pdf]);

  const handleZoomIn = () => setZoom((z) => Math.min(Number((z + 0.25).toFixed(2)), 2.5));
  const handleZoomOut = () => setZoom((z) => Math.max(Number((z - 0.25).toFixed(2)), 0.75));
  const handleResetZoom = () => setZoom(1.0);

  useEffect(() => {
    let cancelled = false;
    let loadingTask: { destroy: () => Promise<void>; promise: Promise<any> } | null = null;
    let document: { destroy: () => Promise<void> } | null = null;

    void (async () => {
      setPdf(null);
      setError(false);
      try {
        const path = storagePath || extractLibraryStoragePath(url);
        const response = path && tenantId
          ? await authFetch(`/api/v1/library/pdf-proxy?path=${encodeURIComponent(path)}&tenantId=${encodeURIComponent(tenantId)}`)
          : await fetch(url, { cache: 'no-store' });
        if (!response.ok) throw new Error(`PDF respondeu ${response.status}`);
        const data = new Uint8Array(await response.arrayBuffer());
        if (!data.byteLength) throw new Error('PDF vazio');

        const pdfjs = await import('pdfjs-dist');
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
        loadingTask = pdfjs.getDocument({ data, disableRange: true, disableStream: true });
        document = await loadingTask.promise;
        if (!cancelled) setPdf(document);
      } catch (loadError) {
        if (!cancelled) {
          console.error('[AuthenticatedPdfFrame] Falha ao carregar PDF:', loadError);
          setError(true);
        }
      }
    })();

    return () => {
      cancelled = true;
      setPdf(null);
      void loadingTask?.destroy().catch(() => undefined);
      void document?.destroy().catch(() => undefined);
    };
  }, [storagePath, tenantId, url]);

  if (error) {
    return (
      <div className={`flex h-full min-h-72 flex-col items-center justify-center gap-3 bg-[#191D24] px-6 text-center text-[#E2E8F0] ${className || ''}`}>
        <FileText className="h-10 w-10 text-primary" aria-hidden />
        <div>
          <p className="font-bold text-[#F8FAFC]">Não foi possível abrir o PDF nesta tela.</p>
          <p className="mt-1 text-sm text-[#94A3B8]">Use o botão de baixar para acessar o material.</p>
        </div>
      </div>
    );
  }

  if (!pdf) {
    return (
      <div className={`flex h-full min-h-72 items-center justify-center gap-3 bg-[#191D24] text-sm font-bold text-[#94A3B8] ${className || ''}`} role="status">
        <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden />
        Preparando o PDF com qualidade máxima…
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`relative flex flex-col w-full h-full min-h-0 bg-[#14181F] ${
        isFullscreen ? 'fixed inset-0 z-[9999] w-screen h-screen' : className || ''
      }`}
      aria-label={title}
    >
      {/* Barra de Ferramentas / Toolbar */}
      <div className="shrink-0 flex items-center justify-between gap-2 border-b border-[#252C37] bg-[#0E1217]/95 px-3 py-2 text-white backdrop-blur-md">
        {/* Esquerda: Título / Indicador */}
        <div className="flex items-center gap-2 min-w-0">
          <BookOpen className="h-4 w-4 text-primary shrink-0" aria-hidden />
          <span className="text-xs font-bold text-[#F1F5F9] truncate max-w-[120px] sm:max-w-xs" title={title}>
            {title}
          </span>
          <span className="hidden md:inline-flex rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary">
            Modo de estudo
          </span>
        </div>

        {/* Centro: Navegação de Páginas */}
        <div className="flex items-center gap-1.5 shrink-0 bg-[#1A202A] rounded-lg px-2 py-1 border border-[#2B3442]">
          <button
            type="button"
            onClick={() => scrollToPage(currentPage - 1)}
            disabled={currentPage <= 1}
            className="p-1 rounded text-[#94A3B8] hover:text-white hover:bg-[#252E3C] disabled:opacity-30 disabled:hover:bg-transparent"
            title="Página anterior"
            aria-label="Página anterior"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <span className="text-xs font-semibold text-[#CBD5E1] whitespace-nowrap min-w-[55px] text-center">
            {currentPage} / {pdf.numPages}
          </span>
          <button
            type="button"
            onClick={() => scrollToPage(currentPage + 1)}
            disabled={currentPage >= pdf.numPages}
            className="p-1 rounded text-[#94A3B8] hover:text-white hover:bg-[#252E3C] disabled:opacity-30 disabled:hover:bg-transparent"
            title="Próxima página"
            aria-label="Próxima página"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Direita: Controles de Zoom, Tela Cheia e Baixar */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Zoom Desktop */}
          <div className="hidden sm:flex items-center gap-1 bg-[#1A202A] rounded-lg p-0.5 border border-[#2B3442]">
            <button
              type="button"
              onClick={handleZoomOut}
              disabled={zoom <= 0.75}
              className="p-1 rounded text-[#94A3B8] hover:text-white hover:bg-[#252E3C] disabled:opacity-30"
              title="Diminuir zoom"
              aria-label="Diminuir zoom"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={handleResetZoom}
              className="px-1.5 py-0.5 text-[11px] font-bold text-[#E2E8F0] hover:text-primary"
              title="Redefinir zoom para 100%"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              type="button"
              onClick={handleZoomIn}
              disabled={zoom >= 2.5}
              className="p-1 rounded text-[#94A3B8] hover:text-white hover:bg-[#252E3C] disabled:opacity-30"
              title="Aumentar zoom"
              aria-label="Aumentar zoom"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Botão de Zoom simplificado para mobile */}
          <button
            type="button"
            onClick={zoom >= 1.5 ? handleResetZoom : handleZoomIn}
            className="sm:hidden flex items-center gap-1 rounded-lg border border-[#2B3442] bg-[#1A202A] px-2 py-1 text-xs font-bold text-primary"
            title="Ampliar documento"
          >
            <ZoomIn className="h-3.5 w-3.5" />
            <span>{Math.round(zoom * 100)}%</span>
          </button>

          {/* Botão de Tela Cheia */}
          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 hover:bg-primary/20 px-2.5 py-1 text-xs font-bold text-primary transition"
            title={isFullscreen ? 'Sair da tela cheia' : 'Abrir em tela cheia'}
          >
            {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">{isFullscreen ? 'Sair' : 'Tela cheia'}</span>
          </button>

          {/* Fechar Tela Cheia (se ativo) */}
          {isFullscreen && (
            <button
              type="button"
              onClick={() => setIsFullscreen(false)}
              className="p-1.5 rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/30 border border-red-500/30 transition"
              title="Fechar tela cheia"
              aria-label="Fechar tela cheia"
            >
              <X className="h-4 w-4" />
            </button>
          )}

          {/* Abrir original / Baixar */}
          {url && !isFullscreen && (
            <button
              type="button"
              onClick={() => window.open(url, '_blank')}
              className="hidden md:inline-flex p-1.5 rounded-lg text-[#94A3B8] hover:text-white hover:bg-[#1A202A] border border-transparent hover:border-[#2B3442] transition"
              title="Abrir arquivo em nova aba"
              aria-label="Abrir arquivo em nova aba"
            >
              <Download className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Área de Visualização e Scroll do PDF */}
      <div
        ref={scrollAreaRef}
        onScroll={handleScroll}
        className="flex-1 min-h-0 overflow-auto bg-[#181C23] p-3 sm:p-5 touch-pan-x touch-pan-y"
      >
        <div
          className="mx-auto flex flex-col items-center gap-4 transition-all duration-150"
          style={{ width: zoom > 1 ? `${Math.round(zoom * 100)}%` : '100%', minWidth: 'min-content' }}
        >
          {Array.from({ length: pdf.numPages }, (_, index) => {
            const pageNum = index + 1;
            return (
              <div
                key={pageNum}
                ref={(el) => {
                  if (el) pageRefs.current.set(pageNum, el);
                  else pageRefs.current.delete(pageNum);
                }}
                className="group relative overflow-hidden rounded-md bg-white shadow-2xl border border-[#29303D]"
              >
                <PdfCanvas
                  pdf={pdf}
                  pageNumber={pageNum}
                  title={title}
                  zoom={zoom}
                  containerWidth={containerWidth}
                />
                <div className="absolute bottom-2 right-2 rounded bg-black/60 px-2 py-0.5 text-[9px] font-bold text-white opacity-40 group-hover:opacity-100 transition-opacity pointer-events-none">
                  {pageNum}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
