/**
 * Wrapper para a Google PageSpeed Insights API (v5).
 *
 * Documentação: https://developers.google.com/speed/docs/insights/v5/get-started
 *
 * - Funciona SEM chave (rate-limit ~1 req / minuto por IP) ou COM chave
 *   (`PSI_API_KEY` no .env) — 25.000 req/dia grátis.
 * - Devolve scores das 4 categorias (Performance, Accessibility, BestPractices, SEO)
 *   e os Web Vitals laboratoriais (LCP, INP/TBT, CLS, FCP, TTFB) + dados de campo CrUX
 *   quando disponíveis (sites populares).
 * - Strategy "mobile" por padrão; "desktop" como segundo run opcional.
 *
 * PSI demora 8–30 segundos por request; chame em paralelo só quando necessário.
 */

export type WebVital = {
  id: string;
  title: string;
  numericValue: number | null;
  displayValue: string | null;
  score: number | null;
};

export type PsiResult = {
  strategy: "mobile" | "desktop";
  finalUrl: string;
  scores: {
    performance: number | null;
    accessibility: number | null;
    bestPractices: number | null;
    seo: number | null;
    pwa?: number | null;
  };
  metrics: {
    lcp: WebVital | null;
    cls: WebVital | null;
    inp: WebVital | null;
    tbt: WebVital | null;
    fcp: WebVital | null;
    ttfb: WebVital | null;
    si: WebVital | null;
  };
  fieldData: {
    overall: "FAST" | "AVERAGE" | "SLOW" | null;
    lcpMs: number | null;
    inpMs: number | null;
    cls: number | null;
  };
};

const PSI_TIMEOUT_MS = 45_000;

function pickAudit(audits: any, id: string): WebVital | null {
  const a = audits?.[id];
  if (!a) return null;
  return {
    id,
    title: a.title || id,
    numericValue: typeof a.numericValue === "number" ? a.numericValue : null,
    displayValue: a.displayValue || null,
    score: typeof a.score === "number" ? a.score : null,
  };
}

export async function runPsi(targetUrl: string, strategy: "mobile" | "desktop" = "mobile"): Promise<PsiResult> {
  const key = process.env.PSI_API_KEY || process.env.GOOGLE_PAGESPEED_KEY || "";
  const params = new URLSearchParams({
    url: targetUrl,
    strategy,
  });
  // Categorias completas.
  ["performance", "accessibility", "best-practices", "seo"].forEach((c) => params.append("category", c));
  if (key) params.set("key", key);

  const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${params.toString()}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PSI_TIMEOUT_MS);
  let payload: any;
  try {
    const res = await fetch(apiUrl, { signal: controller.signal });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`PSI HTTP ${res.status}: ${txt.slice(0, 200) || res.statusText}`);
    }
    payload = await res.json();
  } finally {
    clearTimeout(timer);
  }

  const lh = payload.lighthouseResult;
  const cats = lh?.categories || {};
  const audits = lh?.audits || {};
  const loadingExperience = payload.loadingExperience?.metrics || {};

  const fieldOverall: string | null = payload.loadingExperience?.overall_category || null;
  const fieldLcp = loadingExperience.LARGEST_CONTENTFUL_PAINT_MS?.percentile ?? null;
  const fieldInp = loadingExperience.INTERACTION_TO_NEXT_PAINT?.percentile ?? null;
  const fieldCls = loadingExperience.CUMULATIVE_LAYOUT_SHIFT_SCORE?.percentile ?? null;

  return {
    strategy,
    finalUrl: lh?.finalUrl || targetUrl,
    scores: {
      performance: typeof cats.performance?.score === "number" ? Math.round(cats.performance.score * 100) : null,
      accessibility:
        typeof cats.accessibility?.score === "number" ? Math.round(cats.accessibility.score * 100) : null,
      bestPractices:
        typeof cats["best-practices"]?.score === "number"
          ? Math.round(cats["best-practices"].score * 100)
          : null,
      seo: typeof cats.seo?.score === "number" ? Math.round(cats.seo.score * 100) : null,
      pwa: typeof cats.pwa?.score === "number" ? Math.round(cats.pwa.score * 100) : undefined,
    },
    metrics: {
      lcp: pickAudit(audits, "largest-contentful-paint"),
      cls: pickAudit(audits, "cumulative-layout-shift"),
      // INP (responsividade) só vem no field; em lab usamos TBT como proxy.
      inp: pickAudit(audits, "experimental-interaction-to-next-paint"),
      tbt: pickAudit(audits, "total-blocking-time"),
      fcp: pickAudit(audits, "first-contentful-paint"),
      ttfb: pickAudit(audits, "server-response-time"),
      si: pickAudit(audits, "speed-index"),
    },
    fieldData: {
      overall: (fieldOverall as any) || null,
      lcpMs: typeof fieldLcp === "number" ? fieldLcp : null,
      inpMs: typeof fieldInp === "number" ? fieldInp : null,
      cls: typeof fieldCls === "number" ? fieldCls / 100 : null,
    },
  };
}
