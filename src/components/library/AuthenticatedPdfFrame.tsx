import PdfReader from './PdfReader';
import { libraryStoragePath } from '../../lib/libraryDownload';

type Props = { title: string; url: string; storagePath?: string; tenantId?: string; className?: string };
export function extractLibraryStoragePath(rawUrl: string): string | null {
  return libraryStoragePath(rawUrl);
}

export function AuthenticatedPdfFrame({ title, url, storagePath, tenantId, className = '' }: Props) {
  const path = storagePath || extractLibraryStoragePath(url) || undefined;
  if (path && !tenantId) return <div role="alert" className="ac-pdf-frame">Reabra a biblioteca para identificar sua casa.</div>;
  const proxy = path && tenantId ? `/api/v1/library/pdf-proxy?path=${encodeURIComponent(path)}&tenantId=${encodeURIComponent(tenantId)}` : '';
  const source = url?.startsWith('/api/') ? url : proxy || url;
  return <div className={`ac-pdf-frame ${className}`}><PdfReader source={source} title={title} storagePath={path} tenantId={tenantId}/></div>;
}
