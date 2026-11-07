import { authFetch } from './authenticatedFetch';
import { beginAppOperation } from './appOperations';
import { showHouseToast } from './houseToast';
import { libraryStoragePath } from '../../lib/libraryStoragePath';
export { libraryStoragePath } from '../../lib/libraryStoragePath';

export async function downloadLibraryDocument(document: { arquivo_url?: string; storage_path?: string; titulo: string }, tenantId?: string): Promise<boolean> {
  const finish = beginAppOperation('DOWNLOAD', '/library/document');
  try {
    const path = document.storage_path || libraryStoragePath(document.arquivo_url || '');
    if (path && !tenantId) throw Error('Não foi possível identificar sua casa. Reabra a biblioteca.');
    const response = path
      ? await authFetch(`/api/v1/library/pdf-proxy?path=${encodeURIComponent(path)}&tenantId=${encodeURIComponent(tenantId!)}`, { cache: 'no-store' })
      : document.arquivo_url ? await fetch(document.arquivo_url, { credentials: 'omit', cache: 'no-store' }) : null;
    if (!response?.ok) throw Error(response?.status === 403 ? 'Você não tem acesso a este PDF.' : 'Não foi possível baixar o PDF. Tente novamente.');
    const blob = await response.blob();
    if (blob.size > 50 * 1024 * 1024 || await blob.slice(0, 5).text() !== '%PDF-') throw Error('O serviço não retornou um PDF válido.');
    const url = URL.createObjectURL(blob);
    const link = window.document.createElement('a');
    link.href = url; link.download = `${document.titulo.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').slice(0, 120)}.pdf`;
    window.document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 15_000);
    return true;
  } catch (error) { showHouseToast(error instanceof Error ? error.message : 'Não foi possível baixar o arquivo.', 'error'); return false; }
  finally { finish(); }
}
