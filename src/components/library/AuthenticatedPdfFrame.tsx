import { useEffect, useState } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import { authFetch, getAccessToken } from '../../lib/authenticatedFetch';

type Props = {
  title: string;
  url: string;
  storagePath?: string;
  tenantId?: string;
  className?: string;
};

export function AuthenticatedPdfFrame({ title, url, storagePath, tenantId, className }: Props) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let createdUrl: string | null = null;

    async function loadPdf() {
      setObjectUrl(null);
      setError(false);
      try {
        const token = await getAccessToken();
        const response = storagePath && tenantId && token
          ? await authFetch(
              `/api/v1/library/pdf-proxy?path=${encodeURIComponent(storagePath)}&tenantId=${encodeURIComponent(tenantId)}`,
            )
          : await fetch(url, { cache: 'no-store' });

        if (!response.ok) throw new Error(`PDF respondeu ${response.status}`);
        const blob = await response.blob();
        if (!blob.size) throw new Error('PDF vazio');
        createdUrl = URL.createObjectURL(blob.type === 'application/pdf' ? blob : new Blob([blob], { type: 'application/pdf' }));
        if (!cancelled) setObjectUrl(createdUrl);
      } catch (loadError) {
        console.error('[AuthenticatedPdfFrame] Falha ao carregar PDF:', loadError);
        if (!cancelled) setError(true);
      }
    }

    void loadPdf();
    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
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

  if (!objectUrl) {
    return (
      <div className={`flex h-full min-h-72 items-center justify-center gap-3 bg-[#F3F1EC] text-sm font-bold text-[#665F55] ${className || ''}`} role="status">
        <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden />
        Preparando o PDF…
      </div>
    );
  }

  return (
    <iframe
      src={`${objectUrl}#toolbar=0`}
      className={className}
      title={title}
    />
  );
}
