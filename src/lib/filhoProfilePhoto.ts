import { authFetch } from './authenticatedFetch';

export type FilhoPhotoUploadResult =
  | { ok: true; publicUrl: string }
  | { ok: false; error: string };

export async function uploadFilhoProfilePhoto(file: File): Promise<FilhoPhotoUploadResult> {
  if (!file.type.startsWith('image/')) {
    return { ok: false, error: 'Selecione uma imagem (JPG, PNG ou WebP).' };
  }
  if (file.size > 5 * 1024 * 1024) {
    return { ok: false, error: 'A imagem deve ter no máximo 5 MB.' };
  }

  const base64Data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const encoded = result.split(',')[1];
      if (!encoded) reject(new Error('Falha ao ler a imagem.'));
      else resolve(encoded);
    };
    reader.onerror = () => reject(new Error('Erro ao processar a imagem.'));
    reader.readAsDataURL(file);
  });

  const response = await authFetch('/api/v1/filho/profile-photo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileData: base64Data,
      contentType: file.type,
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
}
