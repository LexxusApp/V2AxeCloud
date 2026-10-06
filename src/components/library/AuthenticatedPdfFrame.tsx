import { useEffect, useRef, useState } from 'react';
import { FileText, Loader2 } from 'lucide-react';
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

function PdfCanvas({ pdf, pageNumber, title }: { pdf: any; pageNumber: number; title: string }) {
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
        const targetWidth = Math.min(1200, Math.max(640, canvasRef.current.parentElement?.clientWidth || 900));
        const viewport = page.getViewport({ scale: targetWidth / base.width });
        const canvas = canvasRef.current;
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
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
  }, [pdf, pageNumber]);

  if (failed) return <p className="p-6 text-center text-sm font-bold text-[#8A8172]">Não foi possível renderizar a página {pageNumber}.</p>;
  return <canvas ref={canvasRef} className="block h-auto w-full bg-white" aria-label={`${title}, página ${pageNumber}`} />;
}

export function AuthenticatedPdfFrame({ title, url, storagePath, tenantId, className }: Props) {
  const [pdf, setPdf] = useState<any>(null);
  const [error, setError] = useState(false);

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
      <div className={`flex h-full min-h-72 flex-col items-center justify-center gap-3 bg-[#F3F1EC] px-6 text-center ${className || ''}`}>
        <FileText className="h-10 w-10 text-[#8A8172]" aria-hidden />
        <div>
          <p className="font-bold text-[#191B17]">Não foi possível abrir o PDF nesta tela.</p>
          <p className="mt-1 text-sm text-[#665F55]">Use o botão de baixar para acessar o material.</p>
        </div>
      </div>
    );
  }

  if (!pdf) {
    return (
      <div className={`flex h-full min-h-72 items-center justify-center gap-3 bg-[#F3F1EC] text-sm font-bold text-[#665F55] ${className || ''}`} role="status">
        <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden />
        Preparando o PDF…
      </div>
    );
  }

  return (
    <div className={`h-full min-h-72 overflow-y-auto bg-[#DDD8CE] ${className || ''}`} aria-label={title}>
      <div className="mx-auto flex max-w-5xl flex-col gap-3 p-2 sm:p-4">
        {Array.from({ length: pdf.numPages }, (_, index) => (
          <div key={index + 1} className="overflow-hidden rounded-sm bg-white shadow-sm">
            <PdfCanvas pdf={pdf} pageNumber={index + 1} title={title} />
          </div>
        ))}
      </div>
    </div>
  );
}
