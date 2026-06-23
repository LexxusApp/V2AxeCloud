/**
 * Link checker: extrai todos os <a href> da página alvo, dedup, resolve URLs
 * relativas, e dispara HEAD/GET em paralelo controlado para classificar como
 * ok / redirect / broken (4xx/5xx) / timeout / network.
 *
 * Limites pensados para Vercel Serverless (10s Free, 60s Pro):
 *  - máximo 30 links por chamada (configurável até 60).
 *  - 8 requests concorrentes.
 *  - 6s de timeout por link.
 *
 * `HEAD` é tentado primeiro; se a origem responder 405/501 ou bloquear, faz
 * `GET` com `Range: bytes=0-0` (não baixa o corpo). Se ambos falharem, marca
 * como `network`.
 */

import { assertSafeExternalUrl } from "../ssrfGuard.js";

const HTML_MAX_BYTES = 1_500_000; // 1.5 MB
const LINK_TIMEOUT_MS = 6_000;
const HTML_TIMEOUT_MS = 10_000;
const DEFAULT_LIMIT = 30;
const HARD_LIMIT = 60;
const CONCURRENCY = 8;

const USER_AGENT =
  "AxeCloudAuditBot/1.0 (+https://axecloud.com.br; like Mozilla/5.0)";

export type LinkStatus = "ok" | "redirect" | "broken" | "timeout" | "network";

export type LinkCheck = {
  url: string;
  status: LinkStatus;
  httpStatus: number | null;
  finalUrl: string | null;
  durationMs: number;
  contentType: string | null;
  method: "HEAD" | "GET" | "—";
  internal: boolean;
  anchorText: string | null;
  rel: string | null;
  error?: string;
};

export type LinksReport = {
  source: string;
  totalAnchors: number;
  uniqueLinks: number;
  checked: number;
  limit: number;
  summary: {
    ok: number;
    redirect: number;
    broken: number;
    timeout: number;
    network: number;
  };
  items: LinkCheck[];
  skippedSamples: { url: string; reason: string }[];
};

// ----- HTML fetch -----

async function fetchHtml(url: string): Promise<{ html: string; finalUrl: string; contentType: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HTML_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": USER_AGENT,
        accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5",
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ao buscar HTML.`);
    const reader = res.body?.getReader();
    if (!reader) throw new Error("Sem body de resposta.");
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (total < HTML_MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      total += value.byteLength;
    }
    try {
      await reader.cancel();
    } catch {
      /* ignore */
    }
    const html = new TextDecoder("utf-8", { fatal: false }).decode(Buffer.concat(chunks.map((c) => Buffer.from(c))));
    return {
      html,
      finalUrl: res.url || url,
      contentType: res.headers.get("content-type") || "text/html",
    };
  } finally {
    clearTimeout(timer);
  }
}

// ----- Anchor extraction -----

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

export type ExtractedAnchor = {
  href: string;
  text: string | null;
  rel: string | null;
};

export function extractAnchors(html: string, baseUrl: string): ExtractedAnchor[] {
  const out: ExtractedAnchor[] = [];
  const seen = new Set<string>();
  const re = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const attrs = m[1] || "";
    const inner = m[2] || "";
    const hrefM = /\bhref\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attrs);
    if (!hrefM) continue;
    const rawHref = decodeHtmlEntities((hrefM[2] || hrefM[3] || hrefM[4] || "").trim());
    if (!rawHref) continue;
    if (/^(javascript:|mailto:|tel:|data:|#|sms:|whatsapp:)/i.test(rawHref)) continue;
    let resolved: string;
    try {
      resolved = new URL(rawHref, baseUrl).toString();
    } catch {
      continue;
    }
    // remove fragment para deduplicar
    const noHash = resolved.split("#")[0];
    if (seen.has(noHash)) continue;
    seen.add(noHash);
    const relM = /\brel\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attrs);
    const rel = relM ? (relM[2] || relM[3] || relM[4] || null) : null;
    const text = stripTags(inner).slice(0, 120) || null;
    out.push({ href: noHash, text, rel });
  }
  return out;
}

// ----- Link check -----

async function fetchWithMethod(
  url: string,
  method: "HEAD" | "GET"
): Promise<{ res: Response; aborted: boolean }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LINK_TIMEOUT_MS);
  try {
    const headers: Record<string, string> = {
      "user-agent": USER_AGENT,
      accept: "*/*",
    };
    if (method === "GET") headers["range"] = "bytes=0-0";
    const res = await fetch(url, {
      method,
      redirect: "follow",
      signal: controller.signal,
      headers,
    });
    return { res, aborted: false };
  } finally {
    clearTimeout(timer);
  }
}

async function checkSingleLink(anchor: ExtractedAnchor, baseHost: string): Promise<LinkCheck> {
  const t0 = Date.now();
  try {
    await assertSafeExternalUrl(anchor.href);
  } catch {
    return {
      url: anchor.href,
      status: "network",
      httpStatus: null,
      finalUrl: null,
      durationMs: Date.now() - t0,
      contentType: null,
      method: "—",
      internal: false,
      anchorText: anchor.text,
      rel: anchor.rel,
      error: "URL bloqueada",
    };
  }
  const internal = (() => {
    try {
      return new URL(anchor.href).host === baseHost;
    } catch {
      return false;
    }
  })();
  try {
    let used: "HEAD" | "GET" = "HEAD";
    let res: Response;
    try {
      ({ res } = await fetchWithMethod(anchor.href, "HEAD"));
      if (res.status === 405 || res.status === 501 || res.status === 403) {
        used = "GET";
        ({ res } = await fetchWithMethod(anchor.href, "GET"));
      }
    } catch (e: any) {
      if (e?.name === "AbortError") {
        return {
          url: anchor.href,
          status: "timeout",
          httpStatus: null,
          finalUrl: null,
          durationMs: Date.now() - t0,
          contentType: null,
          method: "HEAD",
          internal,
          anchorText: anchor.text,
          rel: anchor.rel,
        };
      }
      // tenta GET como fallback
      try {
        used = "GET";
        ({ res } = await fetchWithMethod(anchor.href, "GET"));
      } catch (e2: any) {
        const isAbort = e2?.name === "AbortError";
        return {
          url: anchor.href,
          status: isAbort ? "timeout" : "network",
          httpStatus: null,
          finalUrl: null,
          durationMs: Date.now() - t0,
          contentType: null,
          method: used,
          internal,
          anchorText: anchor.text,
          rel: anchor.rel,
          error: e2?.message || String(e2),
        };
      }
    }
    // tenta drenar headers só
    try {
      await res.body?.cancel();
    } catch {
      /* ignore */
    }
    const final = res.url || anchor.href;
    const redirected = final !== anchor.href;
    const status: LinkStatus =
      res.status >= 400 ? "broken" : redirected ? "redirect" : "ok";
    return {
      url: anchor.href,
      status,
      httpStatus: res.status,
      finalUrl: final,
      durationMs: Date.now() - t0,
      contentType: res.headers.get("content-type"),
      method: used,
      internal,
      anchorText: anchor.text,
      rel: anchor.rel,
    };
  } catch (e: any) {
    return {
      url: anchor.href,
      status: e?.name === "AbortError" ? "timeout" : "network",
      httpStatus: null,
      finalUrl: null,
      durationMs: Date.now() - t0,
      contentType: null,
      method: "—",
      internal,
      anchorText: anchor.text,
      rel: anchor.rel,
      error: e?.message || String(e),
    };
  }
}

// ----- Worker pool simples -----

async function runPool<T, R>(items: T[], concurrency: number, worker: (it: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  async function next() {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      out[i] = await worker(items[i]);
    }
  }
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, () => next());
  await Promise.all(runners);
  return out;
}

// ----- Public API -----

export async function checkLinks(targetUrl: string, opts: { limit?: number } = {}): Promise<LinksReport> {
  const limit = Math.max(1, Math.min(HARD_LIMIT, opts.limit ?? DEFAULT_LIMIT));
  await assertSafeExternalUrl(targetUrl);
  const { html, finalUrl } = await fetchHtml(targetUrl);
  const baseHost = new URL(finalUrl).host;
  const anchors = extractAnchors(html, finalUrl);
  // priorizar internos para captar problemas próprios primeiro
  anchors.sort((a, b) => {
    const ai = safeHost(a.href) === baseHost ? 0 : 1;
    const bi = safeHost(b.href) === baseHost ? 0 : 1;
    return ai - bi;
  });
  const subset = anchors.slice(0, limit);
  const skippedSamples = anchors.slice(limit, limit + 5).map((a) => ({
    url: a.href,
    reason: "Acima do limite desta auditoria.",
  }));

  const items = await runPool(subset, CONCURRENCY, (a) => checkSingleLink(a, baseHost));

  const summary = items.reduce(
    (acc, it) => {
      acc[it.status] = (acc[it.status] || 0) + 1;
      return acc;
    },
    { ok: 0, redirect: 0, broken: 0, timeout: 0, network: 0 } as LinksReport["summary"]
  );

  return {
    source: finalUrl,
    totalAnchors: anchors.length,
    uniqueLinks: anchors.length,
    checked: items.length,
    limit,
    summary,
    items,
    skippedSamples,
  };
}

function safeHost(u: string): string {
  try {
    return new URL(u).host;
  } catch {
    return "";
  }
}
