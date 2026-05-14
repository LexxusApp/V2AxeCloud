/**
 * Score global ponderado combinando os blocos da auditoria.
 *
 * Pesos (total = 100):
 *   - Performance (PageSpeed)    30
 *   - Headers de segurança       20
 *   - SEO básico                 20
 *   - SSL/TLS                    10
 *   - PWA + ícones                5
 *   - robots/sitemap              5
 *   - DNS + email auth (SPF/DMARC) 10
 *
 * Se um bloco não tiver dados (ex.: PSI não rodou), o peso dele é redistribuído
 * proporcionalmente nos blocos disponíveis — para que o score continue
 * compreensível em 0–100.
 */

import type { ScanResult } from "./scan.js";
import type { PsiResult } from "./psi.js";
import type { DnsReport } from "./dns.js";

const WEIGHTS = {
  performance: 30,
  security: 20,
  seo: 20,
  ssl: 10,
  pwa: 5,
  crawl: 5,
  dns: 10,
};

type Bucket = { weight: number; pct: number | null; awarded: number };

function calcSeo(scan: ScanResult): number {
  let pts = 0;
  let total = 0;
  const add = (cond: boolean, w: number) => {
    total += w;
    if (cond) pts += w;
  };
  add(!!scan.meta.title && scan.meta.title.length >= 25 && scan.meta.title.length <= 70, 20);
  add(!!scan.meta.description && scan.meta.description.length >= 80 && scan.meta.description.length <= 170, 20);
  add(!!scan.meta.canonical, 10);
  add(!!scan.meta.viewport, 10);
  add(!!scan.meta.lang, 5);
  add(!!scan.openGraph["og:title"], 10);
  add(!!scan.openGraph["og:description"], 5);
  add(!!scan.openGraph["og:image"], 10);
  add(scan.schemaOrg.length > 0, 10);
  return Math.round((pts / total) * 100);
}

function calcSsl(scan: ScanResult): number | null {
  if (scan.url.startsWith("http://")) return 0;
  if (!scan.ssl) return null;
  let pts = 60; // base por ter SSL
  if (scan.ssl.daysUntilExpiry == null) return pts;
  if (scan.ssl.daysUntilExpiry >= 60) pts += 20;
  else if (scan.ssl.daysUntilExpiry >= 30) pts += 10;
  else if (scan.ssl.daysUntilExpiry >= 7) pts += 0;
  else pts -= 30;
  if (scan.ssl.isHttp2) pts += 20;
  return Math.max(0, Math.min(100, pts));
}

function calcPwa(scan: ScanResult): number {
  let pts = 0;
  if (scan.icons.favicons.length > 0) pts += 30;
  if (scan.icons.appleTouchIcons.length > 0) pts += 20;
  if (scan.pwa.manifestUrl) pts += 20;
  if (scan.pwa.manifest) pts += 30;
  return Math.min(100, pts);
}

function calcCrawl(scan: ScanResult): number {
  let pts = 0;
  if (scan.robotsTxt.exists) pts += 40;
  if (scan.sitemap.exists) pts += 40;
  if (scan.robotsTxt.sitemaps.length > 0) pts += 20;
  return Math.min(100, pts);
}

function calcDns(report: DnsReport | null): number | null {
  if (!report) return null;
  let pts = 0;
  if (report.records.a.length > 0 || report.records.aaaa.length > 0) pts += 25;
  if (report.records.ns.length >= 2) pts += 15;
  if (report.email.spf.found) pts += 20;
  if (report.email.spf.valid) pts += 5;
  if (report.email.dmarc.found) pts += 20;
  if (report.email.dmarc.policy === "reject" || report.email.dmarc.policy === "quarantine") pts += 5;
  if (report.email.dkim.length > 0) pts += 10;
  return Math.min(100, pts);
}

export type GlobalScore = {
  total: number;
  grade: "A+" | "A" | "B" | "C" | "D" | "F";
  buckets: Record<keyof typeof WEIGHTS, Bucket>;
};

function gradeFromTotal(total: number): GlobalScore["grade"] {
  if (total >= 90) return "A+";
  if (total >= 80) return "A";
  if (total >= 70) return "B";
  if (total >= 55) return "C";
  if (total >= 40) return "D";
  return "F";
}

export function computeGlobalScore(scan: ScanResult, psi: PsiResult | null, dns: DnsReport | null): GlobalScore {
  const securityPct = Math.round((scan.security.score / scan.security.maxScore) * 100);
  const seoPct = calcSeo(scan);
  const sslPct = calcSsl(scan);
  const pwaPct = calcPwa(scan);
  const crawlPct = calcCrawl(scan);
  const dnsPct = calcDns(dns);
  const perfPct = psi?.scores.performance ?? null;

  const buckets: GlobalScore["buckets"] = {
    performance: { weight: WEIGHTS.performance, pct: perfPct, awarded: 0 },
    security: { weight: WEIGHTS.security, pct: securityPct, awarded: 0 },
    seo: { weight: WEIGHTS.seo, pct: seoPct, awarded: 0 },
    ssl: { weight: WEIGHTS.ssl, pct: sslPct, awarded: 0 },
    pwa: { weight: WEIGHTS.pwa, pct: pwaPct, awarded: 0 },
    crawl: { weight: WEIGHTS.crawl, pct: crawlPct, awarded: 0 },
    dns: { weight: WEIGHTS.dns, pct: dnsPct, awarded: 0 },
  };

  // Redistribui pesos dos buckets sem dados.
  const totalWeight = (Object.values(buckets) as Bucket[]).reduce(
    (acc, b) => acc + (b.pct == null ? 0 : b.weight),
    0
  );
  const scale = totalWeight > 0 ? 100 / totalWeight : 0;

  let total = 0;
  for (const k of Object.keys(buckets) as (keyof typeof WEIGHTS)[]) {
    const b = buckets[k];
    if (b.pct == null) {
      b.awarded = 0;
      continue;
    }
    b.awarded = Math.round(b.weight * scale * (b.pct / 100));
    total += b.awarded;
  }

  total = Math.max(0, Math.min(100, total));
  return { total, grade: gradeFromTotal(total), buckets };
}
