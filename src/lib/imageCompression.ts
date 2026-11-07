/**
 * Utilitário de compressão de imagens no cliente (navegador).
 * Evita erros HTTP 413 (Payload Too Large) ao redimensionar fotos pesadas de celulares
 * diretamente via Canvas antes do upload em Base64 ou FormData.
 */

export interface CompressImageOptions {
  /** Largura máxima permitida (default: 1200) */
  maxWidth?: number;
  /** Altura máxima permitida (default: 1200) */
  maxHeight?: number;
  /** Qualidade de compressão entre 0.1 e 1.0 (default: 0.82) */
  quality?: number;
  /** Forçar tipo mime de saída ('image/webp' ou 'image/jpeg') */
  preferredMimeType?: 'image/webp' | 'image/jpeg';
}

export interface CompressedImage {
  /** Dados em Base64 puro (sem o prefixo 'data:image/...;base64,') */
  fileData: string;
  /** Data URL completa para exibição imediata em tags <img> */
  dataUrl: string;
  /** Tipo mime resultante ('image/webp' ou 'image/jpeg') */
  contentType: string;
  /** Extensão sugerida ('webp' ou 'jpg') */
  extension: 'webp' | 'jpg';
  /** Tamanho final aproximado em bytes */
  sizeBytes: number;
  /** Largura final em pixels */
  width: number;
  /** Altura final em pixels */
  height: number;
}

export async function compressImage(
  file: File | Blob,
  options: CompressImageOptions = {}
): Promise<CompressedImage> {
  const {
    maxWidth = 1200,
    maxHeight = 1200,
    quality = 0.82,
    preferredMimeType = 'image/webp',
  } = options;

  // Validação de tipo de arquivo
  const inputType = file.type || '';
  if (inputType && !inputType.startsWith('image/')) {
    throw new Error('O arquivo selecionado não é uma imagem válida (JPG, PNG ou WebP).');
  }

  // Se não estiver no ambiente de navegador com suporte a Canvas/Image
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('Compressão de imagem disponível apenas no navegador.');
  }

  const objectUrl = URL.createObjectURL(file);

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () =>
        reject(
          new Error(
            'Não foi possível decodificar a imagem. O arquivo pode estar corrompido.'
          )
        );
      image.src = objectUrl;
    });

    const origWidth = img.naturalWidth || img.width;
    const origHeight = img.naturalHeight || img.height;

    if (!origWidth || !origHeight) {
      throw new Error('Dimensões da imagem inválidas.');
    }

    // Calcula novas dimensões mantendo a proporção exata
    let targetWidth = origWidth;
    let targetHeight = origHeight;

    if (targetWidth > maxWidth || targetHeight > maxHeight) {
      const ratio = Math.min(maxWidth / targetWidth, maxHeight / targetHeight);
      targetWidth = Math.round(targetWidth * ratio);
      targetHeight = Math.round(targetHeight * ratio);
    }

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Não foi possível inicializar o processador gráfico da imagem.');
    }

    // Alta qualidade de interpolação
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Se for JPEG, pintar fundo branco para preservar transparência caso converta PNG para JPEG
    if (preferredMimeType === 'image/jpeg') {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, targetWidth, targetHeight);
    }

    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

    // Tentar exportar no formato preferido (WebP)
    let finalMime = preferredMimeType;
    let dataUrl = canvas.toDataURL(finalMime, quality);

    // Se o navegador não suportar exportação WebP (ex: Safari antigo), ele retorna image/png. Nesses casos, fallback para JPEG
    if (finalMime === 'image/webp' && !dataUrl.startsWith('data:image/webp')) {
      finalMime = 'image/jpeg';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, targetWidth, targetHeight);
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
      dataUrl = canvas.toDataURL('image/jpeg', quality);
    }

    const extension: 'webp' | 'jpg' = finalMime === 'image/webp' ? 'webp' : 'jpg';
    const parts = dataUrl.split(',');
    const fileData = parts[1] || '';

    // Estimar tamanho em bytes a partir da string base64
    const sizeBytes = Math.round((fileData.length * 3) / 4);

    // Limpar memória do canvas
    canvas.width = 0;
    canvas.height = 0;

    return {
      fileData,
      dataUrl,
      contentType: finalMime,
      extension,
      sizeBytes,
      width: targetWidth,
      height: targetHeight,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
