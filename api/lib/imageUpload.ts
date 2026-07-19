type Signature = { mime: string; aliases?: string[]; test: (buffer: Buffer) => boolean };

const SIGNATURES: Signature[] = [
  { mime: "image/jpeg", aliases: ["image/jpg"], test: (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: "image/png", test: (b) => b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) },
  { mime: "image/webp", test: (b) => b.length >= 12 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP" },
  { mime: "image/gif", test: (b) => b.length >= 6 && /GIF8[79]a/.test(b.toString("ascii", 0, 6)) },
  { mime: "image/heic", aliases: ["image/heif"], test: (b) => b.length >= 12 && /^ftyp(?:heic|heix|hevc|hevx|mif1|msf1)$/.test(b.toString("ascii", 4, 12)) },
];

export const SAFE_IMAGE_MIME_TYPES = new Set(
  SIGNATURES.flatMap((entry) => [entry.mime, ...(entry.aliases || [])])
);

export function assertSafeImageBuffer(buffer: Buffer, claimedMime?: string): string {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) throw new Error("Arquivo de imagem vazio ou inválido.");
  const signature = SIGNATURES.find((entry) => entry.test(buffer));
  if (!signature) throw new Error("O conteúdo enviado não é uma imagem suportada válida.");
  const claimed = String(claimedMime || signature.mime).split(";", 1)[0].trim().toLowerCase();
  const accepted = new Set([signature.mime, ...(signature.aliases || [])]);
  if (!accepted.has(claimed)) throw new Error("O tipo informado não corresponde ao conteúdo da imagem.");
  return signature.mime;
}
