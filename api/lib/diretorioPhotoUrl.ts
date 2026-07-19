/** Reescreve URL do Google User Content para resolução adequada aos cards (evita w114-h86). */

import { assertSafeImageBuffer } from "./imageUpload.js";

const SIZE_SUFFIX =
  /=(?:w\d+-h\d+(?:-[a-z0-9-]+)?|s\d+(?:-[a-z0-9-]+)?|h\d+(?:-[a-z0-9-]+)?|w\d+-h\d+-p-k-no-in)$/i;

export function stripGooglePhotoSizeSuffix(url: string): string {
  return String(url || "")
    .trim()
    .replace(SIZE_SUFFIX, "");
}

/** URL em ~1200px de largura — bom para cards 16:10 sem estourar banda. */
export function highResGooglePhotoUrl(url: string, width = 1200): string {
  const base = stripGooglePhotoSizeSuffix(url);
  if (!base) return url;
  const height = Math.round(width * 0.75);
  return `${base}=w${width}-h${height}-k-no`;
}

export function googlePhotoUrlCandidates(rawUrl: string): string[] {
  const base = stripGooglePhotoSizeSuffix(rawUrl);
  if (!base) return [rawUrl];

  const urls = [
    `${base}=w1600-h1200-k-no`,
    `${base}=w1200-h900-k-no`,
    `${base}=w800-h600-k-no`,
    `${base}=s1600`,
    `${base}=s800`,
    `${base}=s0`,
    rawUrl.trim(),
  ];

  return [...new Set(urls.filter(Boolean))];
}

export function isAllowedGooglePhotoUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && /(^|\.)googleusercontent\.com$/i.test(u.hostname);
  } catch {
    return false;
  }
}

const FETCH_HEADERS = {
  Referer: "https://www.google.com/",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Accept: "image/*",
};

const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
const MAX_PHOTO_REDIRECTS = 4;

async function fetchAllowedGooglePhoto(url: string): Promise<Response> {
  let current = url;
  for (let hop = 0; hop <= MAX_PHOTO_REDIRECTS; hop += 1) {
    if (!isAllowedGooglePhotoUrl(current)) throw new Error("Host de foto não permitido.");
    const res = await fetch(current, { headers: FETCH_HEADERS, redirect: "manual" });
    if (res.status < 300 || res.status >= 400) return res;
    const location = res.headers.get("location");
    if (!location || hop === MAX_PHOTO_REDIRECTS) throw new Error("Redirecionamento de foto inválido.");
    current = new URL(location, current).toString();
  }
  throw new Error("Redirecionamento de foto inválido.");
}

async function readPhotoWithLimit(res: Response): Promise<Buffer> {
  const declared = Number(res.headers.get("content-length") || 0);
  if (declared > MAX_PHOTO_BYTES) throw new Error("Foto excede o limite permitido.");
  if (!res.body) return Buffer.alloc(0);
  const reader = res.body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_PHOTO_BYTES) throw new Error("Foto excede o limite permitido.");
      chunks.push(Buffer.from(value));
    }
  } finally {
    if (total > MAX_PHOTO_BYTES) await reader.cancel().catch(() => undefined);
  }
  return Buffer.concat(chunks, total);
}

/** Busca a maior variante disponível da foto. */
export async function fetchBestGooglePhoto(
  rawUrl: string,
): Promise<{ buf: Buffer; contentType: string } | null> {
  if (!isAllowedGooglePhotoUrl(rawUrl)) return null;

  let best: { buf: Buffer; contentType: string; size: number } | null = null;

  for (const url of googlePhotoUrlCandidates(rawUrl)) {
    try {
      const res = await fetchAllowedGooglePhoto(url);
      if (!res.ok) continue;

      const contentType = res.headers.get("content-type") || "";

      const buf = await readPhotoWithLimit(res);
      if (buf.length < 8000) continue;
      const verifiedContentType = assertSafeImageBuffer(buf, contentType);

      if (!best || buf.length > best.size) {
        best = { buf, contentType: verifiedContentType, size: buf.length };
      }
      if (buf.length > 80_000) break;
    } catch {
      continue;
    }
  }

  return best ? { buf: best.buf, contentType: best.contentType } : null;
}
