/** Reescreve URL do Google User Content para resolução adequada aos cards (evita w114-h86). */

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

/** Busca a maior variante disponível da foto. */
export async function fetchBestGooglePhoto(
  rawUrl: string,
): Promise<{ buf: Buffer; contentType: string } | null> {
  if (!isAllowedGooglePhotoUrl(rawUrl)) return null;

  let best: { buf: Buffer; contentType: string; size: number } | null = null;

  for (const url of googlePhotoUrlCandidates(rawUrl)) {
    try {
      const res = await fetch(url, { headers: FETCH_HEADERS, redirect: "follow" });
      if (!res.ok) continue;

      const contentType = res.headers.get("content-type") || "";
      if (!contentType.startsWith("image/")) continue;

      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 8000) continue;

      if (!best || buf.length > best.size) {
        best = { buf, contentType, size: buf.length };
      }
      if (buf.length > 80_000) break;
    } catch {
      continue;
    }
  }

  return best ? { buf: best.buf, contentType: best.contentType } : null;
}
