/**
 * Auditoria estática (Fase 1) — sem dependências externas.
 * Faz scan completo de uma URL e devolve um relatório com:
 *   - meta tags / Open Graph / Twitter Card / Schema.org JSON-LD
 *   - favicons / apple-touch-icon / manifest PWA
 *   - cadeia de redirects + tempo total + protocolo final (HTTP/2 detection via ALPN)
 *   - SSL/TLS: versão, issuer, validade, dias até expirar
 *   - headers de segurança com grading A–F
 *   - robots.txt e sitemap.xml (existência + amostra)
 */

import { connect as tlsConnect } from "node:tls";
import { URL } from "node:url";
import { gradeSecurityHeaders, type SecurityGrade } from "./securityHeaders.js";

const UA =
  "AxeCloudAudit/1.0 (+https://axecloud.com.br) Mozilla/5.0";
const REQUEST_TIMEOUT_MS = 8000;
const HARD_TIMEOUT_MS = 25000;
const MAX_HOPS = 8;
const MAX_HTML_BYTES = 2 * 1024 * 1024; // 2 MB

export type RedirectHop = {
  status: number;
  url: string;
  location?: string;
  duration: number;
};

export type SslInfo = {
  protocol: string | null;
  cipher: string | null;
  issuer: string | null;
  subject: string | null;
  validFrom: string | null;
  validTo: string | null;
  daysUntilExpiry: number | null;
  alpnProtocol: string | null;
  isHttp2: boolean;
};

export type ScanResult = {
  url: string;
  finalUrl: string;
  scannedAt: string;
  durationMs: number;
  status: number | null;
  redirects: RedirectHop[];
  http: {
    httpVersion: string | null;
    alpnProtocol: string | null;
    isHttp2: boolean;
    server: string | null;
    poweredBy: string | null;
    contentType: string | null;
    contentLengthBytes: number | null;
    htmlSizeBytes: number;
  };
  ssl: SslInfo | null;
  headers: Record<string, string>;
  security: SecurityGrade;
  meta: {
    title: string | null;
    description: string | null;
    keywords: string | null;
    canonical: string | null;
    robots: string | null;
    viewport: string | null;
    charset: string | null;
    lang: string | null;
    themeColor: string | null;
    generator: string | null;
    author: string | null;
  };
  openGraph: Record<string, string>;
  twitter: Record<string, string>;
  schemaOrg: unknown[];
  hreflang: { lang: string; href: string }[];
  icons: {
    favicons: { rel: string; href: string; sizes?: string; type?: string }[];
    appleTouchIcons: { href: string; sizes?: string }[];
  };
  pwa: {
    manifestUrl: string | null;
    manifest: Record<string, unknown> | null;
    manifestError: string | null;
  };
  robotsTxt: { url: string; exists: boolean; sample: string | null; sitemaps: string[] };
  sitemap: { url: string | null; exists: boolean; urlCount: number | null; sample: string | null };
  techStack: string[];
  issues: { level: "error" | "warn" | "info"; key: string; message: string }[];
};

function normalizeAndValidateUrl(input: string): URL {
  let raw = (input || "").trim();
  if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
  const u = new URL(raw);
  if (!u.hostname || !/\./.test(u.hostname)) {
    throw new Error("URL inválida.");
  }
  return u;
}

function safeRel(base: string, href: string): string {
  try {
    return new URL(href, base).toString();
  } catch {
    return href;
  }
}

async function fetchOnce(url: string, redirect: "manual" | "follow" = "manual"): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, {
      method: "GET",
      redirect,
      headers: { "user-agent": UA, accept: "text/html,*/*;q=0.5" },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function followRedirects(startUrl: string): Promise<{
  hops: RedirectHop[];
  finalUrl: string;
  finalResponse: Response | null;
  status: number | null;
}> {
  const hops: RedirectHop[] = [];
  let currentUrl = startUrl;
  let response: Response | null = null;
  for (let i = 0; i < MAX_HOPS; i++) {
    const t0 = Date.now();
    try {
      response = await fetchOnce(currentUrl, "manual");
    } catch (e: any) {
      hops.push({ status: 0, url: currentUrl, duration: Date.now() - t0 });
      return { hops, finalUrl: currentUrl, finalResponse: null, status: null };
    }
    const duration = Date.now() - t0;
    const location = response.headers.get("location");
    hops.push({
      status: response.status,
      url: currentUrl,
      location: location || undefined,
      duration,
    });
    if (response.status >= 300 && response.status < 400 && location) {
      currentUrl = safeRel(currentUrl, location);
      continue;
    }
    return { hops, finalUrl: currentUrl, finalResponse: response, status: response.status };
  }
  return { hops, finalUrl: currentUrl, finalResponse: response, status: response?.status ?? null };
}

function inspectSsl(host: string, port = 443): Promise<SslInfo | null> {
  return new Promise((resolve) => {
    const socket = tlsConnect(
      {
        host,
        port,
        servername: host,
        rejectUnauthorized: false,
        ALPNProtocols: ["h2", "http/1.1"],
        timeout: REQUEST_TIMEOUT_MS,
      },
      () => {
        try {
          const cert = socket.getPeerCertificate(true);
          const validFrom = cert?.valid_from ? new Date(cert.valid_from).toISOString() : null;
          const validTo = cert?.valid_to ? new Date(cert.valid_to).toISOString() : null;
          const daysUntilExpiry =
            validTo != null
              ? Math.floor((new Date(validTo).getTime() - Date.now()) / 86_400_000)
              : null;
          const alpn = (socket as any).alpnProtocol || null;
          resolve({
            protocol: (socket as any).getProtocol?.() || null,
            cipher: (socket as any).getCipher?.()?.name || null,
            issuer: cert?.issuer
              ? Object.entries(cert.issuer)
                  .map(([k, v]) => `${k}=${v}`)
                  .join(", ")
              : null,
            subject: cert?.subject
              ? Object.entries(cert.subject)
                  .map(([k, v]) => `${k}=${v}`)
                  .join(", ")
              : null,
            validFrom,
            validTo,
            daysUntilExpiry,
            alpnProtocol: alpn,
            isHttp2: alpn === "h2",
          });
        } catch {
          resolve(null);
        } finally {
          try {
            socket.end();
          } catch {
            /* ignore */
          }
        }
      }
    );
    socket.on("error", () => resolve(null));
    socket.on("timeout", () => {
      try {
        socket.destroy();
      } catch {
        /* ignore */
      }
      resolve(null);
    });
  });
}

async function readHtmlLimited(res: Response): Promise<{ html: string; size: number }> {
  // Lê até MAX_HTML_BYTES bytes para não estourar memória em páginas gigantes.
  const reader = res.body?.getReader();
  if (!reader) {
    const text = await res.text();
    return { html: text.slice(0, MAX_HTML_BYTES), size: text.length };
  }
  const decoder = new TextDecoder();
  let out = "";
  let total = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total <= MAX_HTML_BYTES) {
      out += decoder.decode(value, { stream: true });
    } else {
      const remaining = MAX_HTML_BYTES - (total - value.byteLength);
      if (remaining > 0) out += decoder.decode(value.subarray(0, remaining), { stream: true });
      try {
        await reader.cancel();
      } catch {
        /* ignore */
      }
      break;
    }
  }
  out += decoder.decode();
  return { html: out, size: total };
}

// ------- Parser HTML (regex tolerantes) -------

function getAttr(tag: string, attr: string): string | null {
  const re = new RegExp(`${attr}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i");
  const m = tag.match(re);
  return m ? (m[2] ?? m[3] ?? m[4] ?? null) : null;
}

function matchAllTags(html: string, name: string): string[] {
  const re = new RegExp(`<${name}\\b[^>]*>`, "gi");
  return html.match(re) || [];
}

function parseHead(html: string, baseUrl: string) {
  const headMatch = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i);
  const head = headMatch ? headMatch[1] : html;

  // <title>
  const titleMatch = head.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].replace(/\s+/g, " ").trim() : null;

  // <html lang="..">
  const htmlTag = html.match(/<html\b[^>]*>/i)?.[0] || "";
  const lang = getAttr(htmlTag, "lang");

  // <meta charset>
  const charsetTag = head.match(/<meta\b[^>]*charset[^>]*>/i)?.[0] || "";
  const charset = charsetTag ? getAttr(charsetTag, "charset") : null;

  // metas (name / property / http-equiv)
  const metas = matchAllTags(head, "meta");
  const metaByName: Record<string, string> = {};
  const og: Record<string, string> = {};
  const twitter: Record<string, string> = {};
  for (const m of metas) {
    const name = getAttr(m, "name")?.toLowerCase();
    const property = getAttr(m, "property")?.toLowerCase();
    const content = getAttr(m, "content") || "";
    if (name) metaByName[name] = content;
    if (property?.startsWith("og:")) og[property] = content;
    if (property?.startsWith("twitter:")) twitter[property] = content;
    if (name?.startsWith("twitter:")) twitter[name] = content;
  }

  // <link rel="canonical|icon|apple-touch-icon|manifest|alternate">
  const links = matchAllTags(head, "link");
  let canonical: string | null = null;
  let manifestUrl: string | null = null;
  const favicons: ScanResult["icons"]["favicons"] = [];
  const appleTouchIcons: ScanResult["icons"]["appleTouchIcons"] = [];
  const hreflang: ScanResult["hreflang"] = [];
  for (const l of links) {
    const rel = getAttr(l, "rel")?.toLowerCase() || "";
    const href = getAttr(l, "href");
    if (!href) continue;
    const abs = safeRel(baseUrl, href);
    if (rel.includes("canonical")) canonical = abs;
    if (rel === "manifest") manifestUrl = abs;
    if (rel.includes("icon") && !rel.includes("apple")) {
      favicons.push({
        rel,
        href: abs,
        sizes: getAttr(l, "sizes") || undefined,
        type: getAttr(l, "type") || undefined,
      });
    }
    if (rel.includes("apple-touch-icon")) {
      appleTouchIcons.push({ href: abs, sizes: getAttr(l, "sizes") || undefined });
    }
    if (rel === "alternate") {
      const hl = getAttr(l, "hreflang");
      if (hl) hreflang.push({ lang: hl, href: abs });
    }
  }

  // Schema.org JSON-LD
  const schemaOrg: unknown[] = [];
  const ldRe = /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let lm: RegExpExecArray | null;
  while ((lm = ldRe.exec(html)) !== null) {
    try {
      schemaOrg.push(JSON.parse(lm[1].trim()));
    } catch {
      /* JSON inválido, ignora */
    }
  }

  // Detecção de stack (heurística simples)
  const techStack: string[] = [];
  if (/<meta[^>]+name=["']generator["'][^>]+content=["']([^"']+)["']/i.test(head)) {
    techStack.push("generator:" + RegExp.$1);
  }
  if (/wp-content|wp-includes/i.test(html)) techStack.push("WordPress");
  if (/_next\/static|__NEXT_DATA__/i.test(html)) techStack.push("Next.js");
  if (/\/_nuxt\//i.test(html)) techStack.push("Nuxt");
  if (/cdn\.shopify\.com/i.test(html)) techStack.push("Shopify");
  if (/<script[^>]+src=["'][^"']*\/static\/js\/main\./i.test(html)) techStack.push("Create React App (provável)");
  if (/data-vite-dev/i.test(html) || /\/@vite\//i.test(html)) techStack.push("Vite");

  return {
    title,
    lang,
    charset,
    metaByName,
    og,
    twitter,
    canonical,
    manifestUrl,
    favicons,
    appleTouchIcons,
    hreflang,
    schemaOrg,
    techStack,
  };
}

// ------- Sub-recursos -------

async function loadManifest(manifestUrl: string | null): Promise<{
  data: Record<string, unknown> | null;
  error: string | null;
}> {
  if (!manifestUrl) return { data: null, error: null };
  try {
    const r = await fetchOnce(manifestUrl, "follow");
    if (!r.ok) return { data: null, error: `HTTP ${r.status}` };
    const text = await r.text();
    try {
      return { data: JSON.parse(text), error: null };
    } catch {
      return { data: null, error: "Manifest não é JSON válido" };
    }
  } catch (e: any) {
    return { data: null, error: e?.message || "Falha ao buscar manifest" };
  }
}

async function loadRobotsTxt(origin: string): Promise<ScanResult["robotsTxt"]> {
  const url = `${origin}/robots.txt`;
  try {
    const r = await fetchOnce(url, "follow");
    if (!r.ok) return { url, exists: false, sample: null, sitemaps: [] };
    const text = (await r.text()).slice(0, 8 * 1024);
    const sitemaps = [...text.matchAll(/^sitemap:\s*(.+)$/gim)].map((m) => m[1].trim());
    return { url, exists: true, sample: text.slice(0, 400), sitemaps };
  } catch {
    return { url, exists: false, sample: null, sitemaps: [] };
  }
}

async function loadSitemap(origin: string, fromRobots: string[]): Promise<ScanResult["sitemap"]> {
  const candidate = fromRobots[0] || `${origin}/sitemap.xml`;
  try {
    const r = await fetchOnce(candidate, "follow");
    if (!r.ok) return { url: candidate, exists: false, urlCount: null, sample: null };
    const text = (await r.text()).slice(0, 64 * 1024);
    const urlCount = (text.match(/<loc>/g) || []).length || null;
    return { url: candidate, exists: true, urlCount, sample: text.slice(0, 400) };
  } catch {
    return { url: candidate, exists: false, urlCount: null, sample: null };
  }
}

function headersToObject(h: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  h.forEach((value, key) => {
    out[key.toLowerCase()] = value;
  });
  return out;
}

function detectHttpVersion(headersObj: Record<string, string>, alpn: string | null): string | null {
  if (alpn === "h2") return "HTTP/2";
  if (alpn === "h3" || headersObj["alt-svc"]?.includes("h3=")) return "HTTP/3 (advertised)";
  if (alpn === "http/1.1") return "HTTP/1.1";
  return null;
}

function collectIssues(result: ScanResult): ScanResult["issues"] {
  const issues: ScanResult["issues"] = [];
  if (!result.meta.title) issues.push({ level: "error", key: "title", message: "Página sem <title>." });
  else if (result.meta.title.length < 25)
    issues.push({ level: "warn", key: "title-short", message: "Título muito curto (<25 caracteres)." });
  else if (result.meta.title.length > 70)
    issues.push({ level: "warn", key: "title-long", message: "Título excede 70 caracteres (pode ser cortado no Google)." });

  if (!result.meta.description)
    issues.push({ level: "error", key: "description", message: "Falta meta description." });
  else if (result.meta.description.length < 80)
    issues.push({ level: "warn", key: "description-short", message: "Description curta (<80 caracteres)." });
  else if (result.meta.description.length > 170)
    issues.push({ level: "warn", key: "description-long", message: "Description acima de 170 caracteres." });

  if (!result.meta.viewport)
    issues.push({ level: "warn", key: "viewport", message: "Sem meta viewport (mobile pode quebrar)." });
  if (!result.meta.canonical)
    issues.push({ level: "info", key: "canonical", message: "Sem link rel=canonical." });
  if (!result.openGraph["og:image"])
    issues.push({ level: "warn", key: "og-image", message: "Sem og:image (compartilhamentos sem prévia)." });
  if (!result.openGraph["og:title"])
    issues.push({ level: "warn", key: "og-title", message: "Sem og:title." });
  if (!result.icons.favicons.length && !result.icons.appleTouchIcons.length)
    issues.push({ level: "warn", key: "favicons", message: "Sem favicon/apple-touch-icon." });
  if (!result.pwa.manifestUrl)
    issues.push({ level: "info", key: "manifest", message: "Sem manifest PWA." });
  if (result.ssl?.daysUntilExpiry != null && result.ssl.daysUntilExpiry < 30)
    issues.push({
      level: "warn",
      key: "ssl-expiry",
      message: `Certificado SSL expira em ${result.ssl.daysUntilExpiry} dia(s).`,
    });
  if (result.redirects.length > 1) {
    issues.push({
      level: "info",
      key: "redirects",
      message: `${result.redirects.length} redirecionamento(s) até a página final.`,
    });
  }
  if (result.security.grade === "F" || result.security.grade === "D")
    issues.push({
      level: "warn",
      key: "security-headers",
      message: `Headers de segurança fracos (nota ${result.security.grade}).`,
    });
  if (!result.robotsTxt.exists)
    issues.push({ level: "info", key: "robots", message: "robots.txt ausente." });
  if (!result.sitemap.exists)
    issues.push({ level: "info", key: "sitemap", message: "sitemap.xml ausente." });

  return issues;
}

// ------- Entry point -------

export async function scanUrl(input: string): Promise<ScanResult> {
  const startedAt = Date.now();
  const u = normalizeAndValidateUrl(input);
  const origin = `${u.protocol}//${u.host}`;

  const hardTimer = setTimeout(() => {
    /* hard guard: client tem timeout próprio na request, isto só evita travar testes */
  }, HARD_TIMEOUT_MS);

  try {
    const [chain, ssl] = await Promise.all([
      followRedirects(u.toString()),
      u.protocol === "https:" ? inspectSsl(u.hostname, Number(u.port) || 443) : Promise.resolve(null),
    ]);

    const finalRes = chain.finalResponse;
    let html = "";
    let htmlSize = 0;
    if (finalRes) {
      try {
        const r = await readHtmlLimited(finalRes);
        html = r.html;
        htmlSize = r.size;
      } catch {
        /* ignore */
      }
    }

    const headersObj = finalRes ? headersToObject(finalRes.headers) : {};
    const head = parseHead(html, chain.finalUrl);

    const [manifest, robots] = await Promise.all([
      loadManifest(head.manifestUrl),
      loadRobotsTxt(origin),
    ]);
    const sitemap = await loadSitemap(origin, robots.sitemaps);

    const security = gradeSecurityHeaders(headersObj);

    const result: ScanResult = {
      url: u.toString(),
      finalUrl: chain.finalUrl,
      scannedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
      status: chain.status,
      redirects: chain.hops,
      http: {
        httpVersion: detectHttpVersion(headersObj, ssl?.alpnProtocol ?? null),
        alpnProtocol: ssl?.alpnProtocol ?? null,
        isHttp2: ssl?.isHttp2 ?? false,
        server: headersObj["server"] || null,
        poweredBy: headersObj["x-powered-by"] || null,
        contentType: headersObj["content-type"] || null,
        contentLengthBytes: headersObj["content-length"] ? Number(headersObj["content-length"]) : null,
        htmlSizeBytes: htmlSize,
      },
      ssl,
      headers: headersObj,
      security,
      meta: {
        title: head.title,
        description: head.metaByName["description"] || null,
        keywords: head.metaByName["keywords"] || null,
        canonical: head.canonical,
        robots: head.metaByName["robots"] || null,
        viewport: head.metaByName["viewport"] || null,
        charset: head.charset,
        lang: head.lang,
        themeColor: head.metaByName["theme-color"] || null,
        generator: head.metaByName["generator"] || null,
        author: head.metaByName["author"] || null,
      },
      openGraph: head.og,
      twitter: head.twitter,
      schemaOrg: head.schemaOrg,
      hreflang: head.hreflang,
      icons: { favicons: head.favicons, appleTouchIcons: head.appleTouchIcons },
      pwa: { manifestUrl: head.manifestUrl, manifest: manifest.data, manifestError: manifest.error },
      robotsTxt: robots,
      sitemap,
      techStack: head.techStack,
      issues: [],
    };
    result.issues = collectIssues(result);
    return result;
  } finally {
    clearTimeout(hardTimer);
  }
}
