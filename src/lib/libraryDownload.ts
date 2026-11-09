import { readPdfBytes } from './pdfSourceReader';
import { beginAppOperation } from './appOperations';
import { showHouseToast } from './houseToast';
import { libraryStoragePath } from '../../lib/libraryStoragePath';
export { libraryStoragePath } from '../../lib/libraryStoragePath';

export async function downloadLibraryDocument(
  document: { arquivo_url?: string; storage_path?: string; titulo: string },
  tenantId?: string
): Promise<boolean> {
  const finish = beginAppOperation('DOWNLOAD', '/library/document');
  try {
    const path = document.storage_path || libraryStoragePath(document.arquivo_url || '');
    if (path && !tenantId) throw Error('Não foi possível identificar sua casa. Reabra a biblioteca.');

    const proxyUrl = path && tenantId
      ? `/api/v1/library/pdf-proxy?path=${encodeURIComponent(path)}&tenantId=${encodeURIComponent(tenantId)}`
      : '';
    const source = (document.arquivo_url && document.arquivo_url.startsWith('/api/'))
      ? document.arquivo_url
      : (proxyUrl || document.arquivo_url || '');

    if (!source) throw Error('Não foi possível localizar o endereço deste PDF.');

    const bytes = await readPdfBytes(source, { storagePath: path, tenantId });
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = window.document.createElement('a');
    link.href = url;
    link.download = `${document.titulo.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').slice(0, 120)}.pdf`;
    window.document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 15_000);
    return true;
  } catch (error) {
    showHouseToast(error instanceof Error ? error.message : 'Não foi possível baixar o arquivo.', 'error');
    return false;
  } finally {
    finish();
  }
}
