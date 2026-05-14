/**
 * Validação de hreflang.
 *
 * Regras conferidas (segundo Google docs):
 *  1. Cada `lang` tem que seguir BCP-47 (`pt`, `pt-BR`, `x-default`...).
 *  2. URLs devem ser absolutas.
 *  3. Sem duplicatas (mesmo `lang` apontando para URLs diferentes).
 *  4. Reciprocidade: se A→B, B precisa apontar para A.
 *  5. `x-default` é opcional, mas recomendado.
 *
 * A reciprocidade exige fetch das URLs apontadas (limitado a 5 para ficar
 * dentro do timeout do Vercel).
 */

export type Alternate = { lang: string; href: string };

const HREFLANG_RE = /^([a-z]{2,3})(-[A-Za-z]{2,4})?$|^x-default$/i;
const FETCH_TIMEOUT_MS = 6_000;
const MAX_RECIPROCAL_FETCHES = 5;
const USER_AGENT =
  "AxeCloudAuditBot/1.0 (+https://axecloud.com.br; like Mozilla/5.0)";

export type HreflangIssue = {
  level: "error" | "warn" | "info";
  message: string;
  details?: string;
};

export type ReciprocityResult = {
  url: string;
  lang: string;
  reciprocates: boolean | null;
  reason?: string;
};

export type HreflangReport = {
  count: number;
  entries: Alternate[];
  issues: HreflangIssue[];
  reciprocity: ReciprocityResult[];
  hasXDefault: boolean;
};

function extractHreflangTags(html: string, baseUrl: string): Alternate[] {
  const out: Alternate[] = [];
  const re = /<link\b([^>]*)>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const attrs = m[1] || "";
    if (!/\brel\s*=\s*("alternate"|'alternate'|alternate)/i.test(attrs)) continue;
    const langM = /\bhreflang\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attrs);
    if (!langM) continue;
    const lang = (langM[2] || langM[3] || langM[4] || "").trim();
    const hrefM = /\bhref\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attrs);
    if (!hrefM) continue;
    const hrefRaw = (hrefM[2] || hrefM[3] || hrefM[4] || "").trim();
    let resolved: string;
    try {
      resolved = new URL(hrefRaw, baseUrl).toString();
    } catch {
      continue;
    }
    out.push({ lang, href: resolved });
  }
  return out;
}

async function fetchHtmlSlim(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": USER_AGENT,
        accept: "text/html,*/*;q=0.5",
      },
    });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("text") && !ct.includes("xml") && !ct.includes("html")) return null;
    // só os primeiros 256KB são suficientes para o <head>
    const reader = res.body?.getReader();
    if (!reader) return null;
    const chunks: Uint8Array[] = [];
    let total = 0;
    const max = 256 * 1024;
    while (total < max) {
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
    return new TextDecoder("utf-8", { fatal: false }).decode(
      Buffer.concat(chunks.map((c) => Buffer.from(c)))
    );
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function normalize(u: string): string {
  try {
    const x = new URL(u);
    x.hash = "";
    return x.toString().replace(/\/$/, "");
  } catch {
    return u.replace(/\/$/, "");
  }
}

export async function validateHreflang(
  pageUrl: string,
  alternates: Alternate[]
): Promise<HreflangReport> {
  const issues: HreflangIssue[] = [];
  const hasXDefault = alternates.some((a) => a.lang.toLowerCase() === "x-default");

  // 1) lang inválidos
  for (const a of alternates) {
    if (!HREFLANG_RE.test(a.lang)) {
      issues.push({
        level: "error",
        message: `hreflang inválido: "${a.lang}"`,
        details: a.href,
      });
    }
  }

  // 2) URLs absolutas (já são, mas verificar protocolo)
  for (const a of alternates) {
    if (!/^https?:\/\//i.test(a.href)) {
      issues.push({
        level: "error",
        message: `URL não-absoluta em hreflang "${a.lang}"`,
        details: a.href,
      });
    }
  }

  // 3) duplicatas: mesmo lang apontando para URLs diferentes
  const byLang = new Map<string, Set<string>>();
  for (const a of alternates) {
    const key = a.lang.toLowerCase();
    if (!byLang.has(key)) byLang.set(key, new Set());
    byLang.get(key)!.add(normalize(a.href));
  }
  for (const [lang, set] of byLang.entries()) {
    if (set.size > 1) {
      issues.push({
        level: "warn",
        message: `hreflang duplicado "${lang}" aponta para múltiplas URLs`,
        details: Array.from(set).join(" | "),
      });
    }
  }

  if (!hasXDefault && alternates.length > 0) {
    issues.push({
      level: "info",
      message: "Falta hreflang x-default (recomendado).",
    });
  }

  // 4) Reciprocidade — pega até 5 URLs distintas e verifica
  const pageNorm = normalize(pageUrl);
  const distinctTargets = Array.from(
    new Map(
      alternates
        .filter((a) => normalize(a.href) !== pageNorm)
        .map((a) => [normalize(a.href), a] as const)
    ).values()
  ).slice(0, MAX_RECIPROCAL_FETCHES);

  const reciprocity = await Promise.all(
    distinctTargets.map(async (alt): Promise<ReciprocityResult> => {
      const html = await fetchHtmlSlim(alt.href);
      if (!html) {
        return { url: alt.href, lang: alt.lang, reciprocates: null, reason: "Não foi possível buscar a página." };
      }
      const theirAlternates = extractHreflangTags(html, alt.href);
      const reciprocates = theirAlternates.some(
        (t) => normalize(t.href) === pageNorm
      );
      return {
        url: alt.href,
        lang: alt.lang,
        reciprocates,
        reason: reciprocates ? undefined : "A página alvo não retorna um hreflang apontando de volta para a origem.",
      };
    })
  );

  for (const r of reciprocity) {
    if (r.reciprocates === false) {
      issues.push({
        level: "warn",
        message: `Sem reciprocidade de "${r.lang}" — ${r.url}`,
        details: r.reason,
      });
    }
  }

  return {
    count: alternates.length,
    entries: alternates,
    issues,
    reciprocity,
    hasXDefault,
  };
}
