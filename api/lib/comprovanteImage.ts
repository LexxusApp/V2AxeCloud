import sharp, {type Metadata} from 'sharp';
const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

export function normalizeComprovanteMime(contentType: string | undefined): string {
  const ct = String(contentType || "image/jpeg")
    .split(";")[0]
    .trim()
    .toLowerCase();
  return ct;
}

export async function validateComprovanteImage(buffer: Buffer, contentType: string): Promise<string> {
  assertComprovanteImageBuffer(buffer, contentType);
  let metadata: Metadata;
  try { metadata = await sharp(buffer,{limitInputPixels:20_000_000,failOn:'warning'}).metadata(); }
  catch { throw new Error('Imagem inválida ou danificada. Use JPEG, PNG ou WebP.'); }
  const mime = ({jpeg:'image/jpeg',png:'image/png',webp:'image/webp'} as Record<string,string>)[metadata.format||''];
  const declared=normalizeComprovanteMime(contentType).replace('image/jpg','image/jpeg');
  if(!mime||mime!==declared||!metadata.width||!metadata.height||(metadata.pages||1)>1)throw new Error('O conteúdo do arquivo não corresponde a uma imagem JPEG, PNG ou WebP estática.');
  return mime;
}

function assertComprovanteImageBuffer(buffer: Buffer, contentType: string): void {
  if (!buffer.length) throw new Error("Imagem vazia.");
  if (buffer.length > 5 * 1024 * 1024) throw new Error("Imagem maior que 5 MB.");
  const ct = normalizeComprovanteMime(contentType);
  if (!ALLOWED_MIME.has(ct)) {
    throw new Error("Formato de imagem não suportado. Use JPEG, PNG ou WebP.");
  }
}
