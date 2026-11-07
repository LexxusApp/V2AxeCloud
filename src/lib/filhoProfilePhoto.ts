import { authFetch } from './authenticatedFetch';
import { compressImage } from './imageCompression';

export type FilhoPhotoUploadResult =
  | { ok: true; publicUrl: string }
  | { ok: false; error: string };

export async function uploadFilhoProfilePhoto(file: File): Promise<FilhoPhotoUploadResult> {
  if (!file.type.startsWith('image/')) {
    return { ok: false, error: 'Selecione uma imagem (JPG, PNG ou WebP).' };
  }

  try {
    // Compressão client-side (evita HTTP 413 em fotos pesadas de celulares)
    const compressed = await compressImage(file, {
      maxWidth: 1024,
      maxHeight: 1024,
      quality: 0.82,
    });

    const response = await authFetch('/api/v1/filho/profile-photo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileData: compressed.fileData,
        contentType: compressed.contentType,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { ok: false, error: String(data.error || 'Erro ao enviar foto.') };
    }

    const publicUrl = String(data.publicUrl || '');
    if (!publicUrl) {
      return { ok: false, error: 'Erro ao enviar foto.' };
    }
    return { ok: true, publicUrl };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Falha ao processar e comprimir imagem.' };
  }
}
