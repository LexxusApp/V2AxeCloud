import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Award,
  CheckCircle2,
  ExternalLink,
  Gauge,
  Globe,
  Info,
  Languages,
  Link2,
  Link2Off,
  Loader2,
  Lock,
  Mail,
  Network,
  Search,
  Shield,
  ShieldAlert,
  Sparkles,
  XCircle,
  Cpu,
  Image as ImageIcon,
  Smartphone,
  ScrollText,
} from "lucide-react";
import { apiJson } from "@/lib/api";
import { cn } from "@/lib/cn";

type RedirectHop = {
  status: number;
  url: string;
  location?: string;
  duration: number;
};

type SecurityCheck = {
  key: string;
  present: boolean;
  value: string | null;
  weight: number;
  awarded: number;
  note: string;
};

type ScanResult = {
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
  ssl: {
    protocol: string | null;
    cipher: string | null;
    issuer: string | null;
    subject: string | null;
    validFrom: string | null;
    validTo: string | null;
    daysUntilExpiry: number | null;
    alpnProtocol: string | null;
    isHttp2: boolean;
  } | null;
  headers: Record<string, string>;
  security: {
    score: number;
    maxScore: number;
    grade: "A+" | "A" | "B" | "C" | "D" | "F";
    checks: SecurityCheck[];
  };
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

type DnsReport = {
  domain: string;
  records: {
    a: string[];
    aaaa: string[];
    cname: string[];
    mx: { exchange: string; priority: number }[];
    ns: string[];
    txt: string[];
  };
  email: {
    spf: { found: boolean; record: string | null; valid: boolean; notes: string[] };
    dmarc: { found: boolean; record: string | null; policy: string | null; notes: string[] };
    dkim: { selector: string; record: string }[];
  };
  whois: {
    registrar: string | null;
    createdAt: string | null;
    updatedAt: string | null;
    expiresAt: string | null;
    daysUntilExpiry: number | null;
    status: string[] | null;
    nameservers: string[] | null;
  } | null;
};

type WebVital = {
  id: string;
  title: string;
  numericValue: number | null;
  displayValue: string | null;
  score: number | null;
};

type PsiResult = {
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

type LinkStatus = "ok" | "redirect" | "broken" | "timeout" | "network";

type LinkCheck = {
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

type LinksReport = {
  source: string;
  totalAnchors: number;
  uniqueLinks: number;
  checked: number;
  limit: number;
  summary: { ok: number; redirect: number; broken: number; timeout: number; network: number };
  items: LinkCheck[];
  skippedSamples: { url: string; reason: string }[];
};

type HreflangIssue = { level: "error" | "warn" | "info"; message: string; details?: string };
type ReciprocityResult = { url: string; lang: string; reciprocates: boolean | null; reason?: string };
type HreflangReport = {
  count: number;
  entries: { lang: string; href: string }[];
  issues: HreflangIssue[];
  reciprocity: ReciprocityResult[];
  hasXDefault: boolean;
};

const PRESETS = [
  { label: "axecloud-app", url: "https://axecloud-app.vercel.app" },
  { label: "axecloud-admin", url: "https://axecloud-admin.vercel.app" },
  { label: "landing", url: "https://axecloud.com.br" },
];

// ------- Score global ponderado (mesma lógica do backend) -------

const SCORE_WEIGHTS = {
  performance: 30,
  security: 20,
  seo: 20,
  ssl: 10,
  pwa: 5,
  crawl: 5,
  dns: 10,
} as const;

type Bucket = { weight: number; pct: number | null; awarded: number };
type GlobalScore = {
  total: number;
  grade: "A+" | "A" | "B" | "C" | "D" | "F";
  buckets: Record<keyof typeof SCORE_WEIGHTS, Bucket>;
};

function calcSeoPct(scan: ScanResult): number {
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

function calcSslPct(scan: ScanResult): number | null {
  if (scan.url.startsWith("http://")) return 0;
  if (!scan.ssl) return null;
  let pts = 60;
  if (scan.ssl.daysUntilExpiry == null) return pts;
  if (scan.ssl.daysUntilExpiry >= 60) pts += 20;
  else if (scan.ssl.daysUntilExpiry >= 30) pts += 10;
  else if (scan.ssl.daysUntilExpiry < 7) pts -= 30;
  if (scan.ssl.isHttp2) pts += 20;
  return Math.max(0, Math.min(100, pts));
}

function calcPwaPct(scan: ScanResult): number {
  let pts = 0;
  if (scan.icons.favicons.length > 0) pts += 30;
  if (scan.icons.appleTouchIcons.length > 0) pts += 20;
  if (scan.pwa.manifestUrl) pts += 20;
  if (scan.pwa.manifest) pts += 30;
  return Math.min(100, pts);
}

function calcCrawlPct(scan: ScanResult): number {
  let pts = 0;
  if (scan.robotsTxt.exists) pts += 40;
  if (scan.sitemap.exists) pts += 40;
  if (scan.robotsTxt.sitemaps.length > 0) pts += 20;
  return Math.min(100, pts);
}

function calcDnsPct(dns: DnsReport | null): number | null {
  if (!dns) return null;
  let pts = 0;
  if (dns.records.a.length > 0 || dns.records.aaaa.length > 0) pts += 25;
  if (dns.records.ns.length >= 2) pts += 15;
  if (dns.email.spf.found) pts += 20;
  if (dns.email.spf.valid) pts += 5;
  if (dns.email.dmarc.found) pts += 20;
  if (dns.email.dmarc.policy === "reject" || dns.email.dmarc.policy === "quarantine") pts += 5;
  if (dns.email.dkim.length > 0) pts += 10;
  return Math.min(100, pts);
}

function computeGlobalScore(scan: ScanResult, psi: PsiResult | null, dns: DnsReport | null): GlobalScore {
  const buckets: GlobalScore["buckets"] = {
    performance: { weight: SCORE_WEIGHTS.performance, pct: psi?.scores.performance ?? null, awarded: 0 },
    security: {
      weight: SCORE_WEIGHTS.security,
      pct: Math.round((scan.security.score / scan.security.maxScore) * 100),
      awarded: 0,
    },
    seo: { weight: SCORE_WEIGHTS.seo, pct: calcSeoPct(scan), awarded: 0 },
    ssl: { weight: SCORE_WEIGHTS.ssl, pct: calcSslPct(scan), awarded: 0 },
    pwa: { weight: SCORE_WEIGHTS.pwa, pct: calcPwaPct(scan), awarded: 0 },
    crawl: { weight: SCORE_WEIGHTS.crawl, pct: calcCrawlPct(scan), awarded: 0 },
    dns: { weight: SCORE_WEIGHTS.dns, pct: calcDnsPct(dns), awarded: 0 },
  };
  const totalWeight = (Object.values(buckets) as Bucket[]).reduce(
    (acc, b) => acc + (b.pct == null ? 0 : b.weight),
    0
  );
  const scale = totalWeight > 0 ? 100 / totalWeight : 0;
  let total = 0;
  for (const b of Object.values(buckets) as Bucket[]) {
    if (b.pct == null) continue;
    b.awarded = Math.round(b.weight * scale * (b.pct / 100));
    total += b.awarded;
  }
  total = Math.max(0, Math.min(100, total));
  let grade: GlobalScore["grade"] = "F";
  if (total >= 90) grade = "A+";
  else if (total >= 80) grade = "A";
  else if (total >= 70) grade = "B";
  else if (total >= 55) grade = "C";
  else if (total >= 40) grade = "D";
  return { total, grade, buckets };
}

function gradeTone(grade: string): string {
  switch (grade) {
    case "A+":
    case "A":
      return "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/40";
    case "B":
      return "bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-400/40";
    case "C":
      return "bg-amber-500/20 text-amber-300 ring-1 ring-amber-400/40";
    case "D":
      return "bg-orange-500/20 text-orange-300 ring-1 ring-orange-400/40";
    default:
      return "bg-red-500/20 text-red-300 ring-1 ring-red-400/40";
  }
}

function issueIcon(level: string) {
  if (level === "error") return <XCircle className="h-4 w-4 text-red-400" />;
  if (level === "warn") return <AlertTriangle className="h-4 w-4 text-amber-400" />;
  return <Info className="h-4 w-4 text-cyan-400" />;
}

function fmtBytes(b: number | null | undefined): string {
  if (b == null) return "—";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(2)} MB`;
}

export function AuditPanel() {
  const [url, setUrl] = useState("https://axecloud-app.vercel.app");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [dns, setDns] = useState<DnsReport | null>(null);
  const [dnsBusy, setDnsBusy] = useState(false);
  const [dnsError, setDnsError] = useState<string | null>(null);
  const [psi, setPsi] = useState<PsiResult | null>(null);
  const [psiBusy, setPsiBusy] = useState(false);
  const [psiError, setPsiError] = useState<string | null>(null);
  const [psiStrategy, setPsiStrategy] = useState<"mobile" | "desktop">("mobile");
  const [links, setLinks] = useState<LinksReport | null>(null);
  const [linksBusy, setLinksBusy] = useState(false);
  const [linksError, setLinksError] = useState<string | null>(null);
  const [hreflang, setHreflang] = useState<HreflangReport | null>(null);
  const [linkLimit, setLinkLimit] = useState<number>(30);

  async function runScan() {
    if (!url.trim()) return;
    setBusy(true);
    setError(null);
    setResult(null);
    setDns(null);
    setDnsError(null);
    setPsi(null);
    setPsiError(null);
    setLinks(null);
    setLinksError(null);
    setHreflang(null);
    try {
      const j = await apiJson<{ ok: boolean; result: ScanResult }>("/api/admin-console/audit/scan", {
        method: "POST",
        body: JSON.stringify({ url: url.trim() }),
      });
      setResult(j.result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao auditar.");
    } finally {
      setBusy(false);
    }
  }

  async function runDns(target: string) {
    setDnsBusy(true);
    setDnsError(null);
    try {
      const j = await apiJson<{ ok: boolean; report: DnsReport }>("/api/admin-console/audit/dns", {
        method: "POST",
        body: JSON.stringify({ url: target }),
      });
      setDns(j.report);
    } catch (e) {
      setDnsError(e instanceof Error ? e.message : "Falha no DNS/WHOIS.");
    } finally {
      setDnsBusy(false);
    }
  }

  async function runPsi(strategy: "mobile" | "desktop" = psiStrategy) {
    if (!result) return;
    setPsiStrategy(strategy);
    setPsiBusy(true);
    setPsiError(null);
    try {
      const j = await apiJson<{ ok: boolean; result: PsiResult }>("/api/admin-console/audit/psi", {
        method: "POST",
        body: JSON.stringify({ url: result.finalUrl, strategy }),
      });
      setPsi(j.result);
    } catch (e) {
      setPsiError(e instanceof Error ? e.message : "Falha no PageSpeed Insights.");
    } finally {
      setPsiBusy(false);
    }
  }

  async function runLinks(limit = linkLimit) {
    if (!result) return;
    setLinksBusy(true);
    setLinksError(null);
    try {
      const j = await apiJson<{ ok: boolean; links: LinksReport; hreflang: HreflangReport | null }>(
        "/api/admin-console/audit/links",
        {
          method: "POST",
          body: JSON.stringify({
            url: result.finalUrl,
            limit,
            alternates: result.hreflang || [],
          }),
        }
      );
      setLinks(j.links);
      setHreflang(j.hreflang);
    } catch (e) {
      setLinksError(e instanceof Error ? e.message : "Falha ao verificar links.");
    } finally {
      setLinksBusy(false);
    }
  }

  // Dispara DNS automaticamente assim que o scan chega.
  useEffect(() => {
    if (result && !dns && !dnsBusy) {
      void runDns(result.finalUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result?.finalUrl]);

  const og = result?.openGraph || {};
  const tw = result?.twitter || {};
  const globalScore = useMemo(
    () => (result ? computeGlobalScore(result, psi, dns) : null),
    [result, psi, dns]
  );

  return (
    <div className="space-y-4">
      {/* Header com input */}
      <div className="rounded-md border border-white/[0.08] bg-[#0c121f]/60 p-4 shadow-xl ring-1 ring-white/[0.04]">
        <div className="flex flex-wrap items-center gap-2">
          <Globe className="h-4 w-4 text-cyan-300" />
          <span className="text-xs font-medium uppercase tracking-widest text-slate-400">
            Auditoria de URL
          </span>
          <div className="ml-auto flex flex-wrap gap-1">
            {PRESETS.map((p) => (
              <button
                key={p.url}
                onClick={() => setUrl(p.url)}
                className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium text-slate-300 hover:bg-white/[0.08]"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void runScan()}
            placeholder="https://exemplo.com"
            className="flex-1 rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-slate-200 outline-none focus:border-cyan-400/40"
          />
          <button
            onClick={() => void runScan()}
            disabled={busy || !url.trim()}
            className="inline-flex items-center gap-2 rounded-md bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            {busy ? "Analisando…" : "Inspecionar"}
          </button>
        </div>
        {error && (
          <p className="mt-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {error}
          </p>
        )}
      </div>

      {!result && !busy && (
        <div className="rounded-md border border-white/[0.08] bg-[#0c121f]/60 px-6 py-16 text-center shadow-xl ring-1 ring-white/[0.04]">
          <Sparkles className="mx-auto h-10 w-10 text-cyan-400/40" />
          <p className="mt-3 text-sm font-medium text-slate-300">Audite qualquer URL pública</p>
          <p className="mt-1 text-xs text-slate-500">
            Veja meta tags, Open Graph, headers de segurança, SSL e mais — em segundos.
          </p>
        </div>
      )}

      {result && (
        <>
          {/* Score global ponderado + resumo */}
          {globalScore && (
            <div className="grid gap-3 md:grid-cols-5">
              <div className={cn(
                  "col-span-2 rounded-md border p-4 shadow-xl ring-1",
                  globalScore.grade === "A+" || globalScore.grade === "A"
                    ? "border-emerald-400/30 bg-emerald-500/[0.06] ring-emerald-400/20"
                    : globalScore.grade === "B"
                      ? "border-cyan-400/30 bg-cyan-500/[0.06] ring-cyan-400/20"
                      : globalScore.grade === "C"
                        ? "border-amber-400/30 bg-amber-500/[0.06] ring-amber-400/20"
                        : "border-red-400/30 bg-red-500/[0.06] ring-red-400/20"
                )}>
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  <Award className="h-4 w-4" />
                  Score global ponderado
                </div>
                <div className="mt-3 flex items-end gap-4">
                  <div className={cn("text-5xl font-semibold tracking-tight", gradeTone(globalScore.grade).split(" ")[1])}>
                    {globalScore.grade}
                  </div>
                  <div className="text-2xl font-mono-data text-slate-300">{globalScore.total}<span className="text-sm text-slate-500">/100</span></div>
                </div>
                <div className="mt-3 space-y-1.5">
                  {(Object.entries(globalScore.buckets) as [keyof typeof SCORE_WEIGHTS, Bucket][]).map(([k, b]) => (
                    <div key={k} className="flex items-center gap-2 text-[11px]">
                      <span className="w-24 shrink-0 capitalize text-slate-400">{k}</span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
                        <div
                          className={cn(
                            "h-full transition-all",
                            b.pct == null
                              ? "bg-slate-700"
                              : b.pct >= 80
                                ? "bg-emerald-400"
                                : b.pct >= 55
                                  ? "bg-cyan-400"
                                  : b.pct >= 40
                                    ? "bg-amber-400"
                                    : "bg-red-400"
                          )}
                          style={{ width: b.pct == null ? "0%" : `${b.pct}%` }}
                        />
                      </div>
                      <span className="w-14 text-right font-mono-data text-slate-500">
                        {b.pct == null ? "n/d" : `${b.pct}%`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <SummaryCard
                icon={<Shield className="h-4 w-4 text-emerald-300" />}
                label="Segurança"
                big={result.security.grade}
                hint={`${result.security.score}/${result.security.maxScore} pts`}
                tone={gradeTone(result.security.grade)}
              />
              <SummaryCard
                icon={<Cpu className="h-4 w-4 text-cyan-300" />}
                label="Protocolo"
                big={result.http.httpVersion || "?"}
                hint={result.http.isHttp2 ? "HTTP/2 ✓" : result.http.alpnProtocol || "HTTP/1.1"}
              />
              <SummaryCard
                icon={<Lock className="h-4 w-4 text-emerald-300" />}
                label="SSL"
                big={result.ssl?.protocol || (result.url.startsWith("https") ? "—" : "n/a")}
                hint={
                  result.ssl?.daysUntilExpiry != null
                    ? `expira em ${result.ssl.daysUntilExpiry}d`
                    : "—"
                }
              />
            </div>
          )}

          {/* Performance / PageSpeed Insights */}
          <Section
            icon={<Gauge className="h-4 w-4 text-amber-300" />}
            title={`Performance — Google PageSpeed Insights${psi ? ` (${psi.strategy})` : ""}`}
          >
            <div className="space-y-3 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => void runPsi("mobile")}
                  disabled={psiBusy}
                  className="inline-flex items-center gap-2 rounded-md bg-amber-500/20 px-3 py-1.5 text-xs font-medium text-amber-200 ring-1 ring-amber-400/30 hover:bg-amber-500/30 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {psiBusy && psiStrategy === "mobile" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Gauge className="h-3.5 w-3.5" />
                  )}
                  Rodar PSI (mobile)
                </button>
                <button
                  onClick={() => void runPsi("desktop")}
                  disabled={psiBusy}
                  className="inline-flex items-center gap-2 rounded-md bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-100 ring-1 ring-amber-400/20 hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {psiBusy && psiStrategy === "desktop" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Gauge className="h-3.5 w-3.5" />
                  )}
                  Desktop
                </button>
                <span className="text-[11px] text-slate-500">demora 15–30s</span>
                {psiError && (
                  <span className="text-[11px] text-red-300">{psiError}</span>
                )}
              </div>
              {psi && (
                <>
                  <div className="grid gap-2 md:grid-cols-4">
                    <PsiScoreCard label="Performance" value={psi.scores.performance} />
                    <PsiScoreCard label="Acessibilidade" value={psi.scores.accessibility} />
                    <PsiScoreCard label="Best Practices" value={psi.scores.bestPractices} />
                    <PsiScoreCard label="SEO" value={psi.scores.seo} />
                  </div>
                  <div className="grid gap-2 md:grid-cols-3 lg:grid-cols-6">
                    <VitalChip vital={psi.metrics.lcp} label="LCP" />
                    <VitalChip vital={psi.metrics.cls} label="CLS" />
                    <VitalChip vital={psi.metrics.tbt} label="TBT" />
                    <VitalChip vital={psi.metrics.fcp} label="FCP" />
                    <VitalChip vital={psi.metrics.ttfb} label="TTFB" />
                    <VitalChip vital={psi.metrics.si} label="SI" />
                  </div>
                  {psi.fieldData.overall && (
                    <div className="rounded-md border border-cyan-400/20 bg-cyan-500/[0.05] px-3 py-2 text-[11px] text-cyan-100">
                      <strong>Dados de campo (CrUX):</strong> {psi.fieldData.overall} ·{" "}
                      LCP {psi.fieldData.lcpMs ? `${(psi.fieldData.lcpMs / 1000).toFixed(2)}s` : "n/d"} ·{" "}
                      INP {psi.fieldData.inpMs != null ? `${psi.fieldData.inpMs}ms` : "n/d"} ·{" "}
                      CLS {psi.fieldData.cls != null ? psi.fieldData.cls.toFixed(2) : "n/d"}
                    </div>
                  )}
                </>
              )}
            </div>
          </Section>

          {/* DNS / WHOIS / Email Auth */}
          <Section
            icon={<Network className="h-4 w-4 text-cyan-300" />}
            title={`DNS & WHOIS${dns ? ` · ${dns.domain}` : ""}`}
          >
            <div className="p-4">
              {dnsBusy && !dns && (
                <p className="flex items-center gap-2 text-xs text-slate-400">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Consultando DNS, SPF/DMARC/DKIM e WHOIS…
                </p>
              )}
              {dnsError && (
                <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                  {dnsError}
                </p>
              )}
              {dns && (
                <div className="space-y-3">
                  <div className="grid gap-2 md:grid-cols-2">
                    <RecordList label="A (IPv4)" items={dns.records.a} />
                    <RecordList label="AAAA (IPv6)" items={dns.records.aaaa} />
                    <RecordList label="CNAME" items={dns.records.cname} />
                    <RecordList label="NS" items={dns.records.ns} />
                    <RecordList
                      label="MX"
                      items={dns.records.mx.map((m) => `${m.priority} ${m.exchange}`)}
                    />
                    <RecordList label="TXT" items={dns.records.txt.slice(0, 6)} truncate />
                  </div>

                  <div className="rounded-md border border-white/10 bg-black/30 p-3">
                    <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-slate-400">
                      <Mail className="h-3.5 w-3.5" /> Autenticação de email
                    </div>
                    <div className="mt-2 grid gap-2 md:grid-cols-3 text-xs">
                      <EmailAuthChip
                        label="SPF"
                        ok={dns.email.spf.found}
                        valid={dns.email.spf.valid}
                        notes={dns.email.spf.notes}
                        record={dns.email.spf.record}
                      />
                      <EmailAuthChip
                        label="DMARC"
                        ok={dns.email.dmarc.found}
                        valid={dns.email.dmarc.policy === "reject" || dns.email.dmarc.policy === "quarantine"}
                        notes={dns.email.dmarc.notes}
                        record={dns.email.dmarc.record}
                        extra={dns.email.dmarc.policy ? `policy=${dns.email.dmarc.policy}` : null}
                      />
                      <div className="rounded-md border border-white/10 bg-black/30 p-2">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                          DKIM ({dns.email.dkim.length} selector{dns.email.dkim.length === 1 ? "" : "s"})
                        </p>
                        {dns.email.dkim.length === 0 ? (
                          <p className="mt-1 text-[11px] text-slate-500">
                            Nenhum dos selectors comuns encontrados.
                          </p>
                        ) : (
                          <ul className="mt-1 space-y-0.5 text-[11px] text-slate-300">
                            {dns.email.dkim.map((d) => (
                              <li key={d.selector} className="font-mono-data">
                                <span className="text-emerald-300">{d.selector}</span>
                                <span className="text-slate-500"> → ok</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  </div>

                  {dns.whois && (
                    <div className="rounded-md border border-white/10 bg-black/30 p-3">
                      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-slate-400">
                        <Globe className="h-3.5 w-3.5" /> WHOIS
                      </div>
                      <div className="mt-2 grid gap-1 md:grid-cols-2">
                        <Kv k="Registrar" v={dns.whois.registrar} />
                        <Kv k="Criado em" v={dns.whois.createdAt} />
                        <Kv k="Atualizado em" v={dns.whois.updatedAt} />
                        <Kv
                          k="Expira em"
                          v={
                            dns.whois.expiresAt && dns.whois.daysUntilExpiry != null
                              ? `${dns.whois.expiresAt.split("T")[0]} (${dns.whois.daysUntilExpiry} dias)`
                              : dns.whois.expiresAt
                          }
                        />
                        {dns.whois.nameservers && dns.whois.nameservers.length > 0 && (
                          <Kv k="Nameservers" v={dns.whois.nameservers.join(", ")} mono />
                        )}
                        {dns.whois.status && dns.whois.status.length > 0 && (
                          <Kv k="Status" v={dns.whois.status.slice(0, 3).join(" · ")} mono />
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </Section>

          {/* Links & hreflang (Fase 3) */}
          <Section
            icon={<Link2 className="h-4 w-4 text-violet-300" />}
            title={`Links & hreflang${links ? ` · ${links.checked}/${links.totalAnchors} verificados` : ""}`}
          >
            <div className="space-y-3 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => void runLinks(linkLimit)}
                  disabled={linksBusy}
                  className="inline-flex items-center gap-2 rounded-md bg-violet-500/20 px-3 py-1.5 text-xs font-medium text-violet-200 ring-1 ring-violet-400/30 hover:bg-violet-500/30 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {linksBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
                  Verificar links
                </button>
                <label className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  Limite:
                  <select
                    value={linkLimit}
                    onChange={(e) => setLinkLimit(Number(e.target.value))}
                    disabled={linksBusy}
                    className="rounded-md border border-white/10 bg-black/40 px-2 py-0.5 text-[11px] text-slate-200 focus:outline-none focus:ring-1 focus:ring-violet-400/40"
                  >
                    {[15, 30, 45, 60].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
                <span className="text-[11px] text-slate-500">~ {Math.max(2, Math.round(linkLimit / 8) * 2)}s</span>
                {linksError && <span className="text-[11px] text-red-300">{linksError}</span>}
              </div>

              {links && (
                <>
                  <div className="grid gap-2 md:grid-cols-5">
                    <LinkStatChip label="OK" value={links.summary.ok} tone="text-emerald-300 bg-emerald-500/15 ring-emerald-400/30" />
                    <LinkStatChip label="Redirect" value={links.summary.redirect} tone="text-cyan-300 bg-cyan-500/15 ring-cyan-400/30" />
                    <LinkStatChip label="Quebrados" value={links.summary.broken} tone="text-red-300 bg-red-500/15 ring-red-400/30" />
                    <LinkStatChip label="Timeout" value={links.summary.timeout} tone="text-amber-300 bg-amber-500/15 ring-amber-400/30" />
                    <LinkStatChip label="Erro de rede" value={links.summary.network} tone="text-slate-300 bg-white/[0.06] ring-white/10" />
                  </div>

                  {/* Lista priorizando problemas */}
                  <div className="overflow-hidden rounded-md border border-white/10">
                    <table className="w-full text-[11px]">
                      <thead className="bg-white/[0.04] text-slate-400">
                        <tr>
                          <th className="px-2 py-1.5 text-left">Status</th>
                          <th className="px-2 py-1.5 text-left">URL</th>
                          <th className="px-2 py-1.5 text-left">Texto âncora</th>
                          <th className="px-2 py-1.5 text-right">Tempo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...links.items]
                          .sort((a, b) => statusRank(a.status) - statusRank(b.status))
                          .slice(0, 60)
                          .map((it, i) => (
                            <tr key={i} className="border-t border-white/5 hover:bg-white/[0.02]">
                              <td className="px-2 py-1.5">
                                <LinkStatusPill check={it} />
                              </td>
                              <td className="px-2 py-1.5">
                                <a
                                  href={it.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex max-w-[420px] items-center gap-1 truncate font-mono-data text-slate-300 hover:text-cyan-300"
                                >
                                  <span className="truncate">{it.url}</span>
                                  <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
                                </a>
                                {it.internal && (
                                  <span className="ml-1 rounded bg-cyan-500/15 px-1 py-0.5 text-[9px] text-cyan-200">interno</span>
                                )}
                                {it.rel?.includes("nofollow") && (
                                  <span className="ml-1 rounded bg-white/[0.06] px-1 py-0.5 text-[9px] text-slate-400">nofollow</span>
                                )}
                              </td>
                              <td className="px-2 py-1.5 max-w-[260px] truncate text-slate-400">
                                {it.anchorText || <span className="italic opacity-50">sem texto</span>}
                              </td>
                              <td className="px-2 py-1.5 text-right font-mono-data text-slate-500">
                                {it.durationMs}ms
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>

                  {links.skippedSamples.length > 0 && (
                    <p className="text-[10px] text-slate-500">
                      + {links.totalAnchors - links.checked} link(s) acima do limite. Aumente o limite para verificar mais.
                    </p>
                  )}
                </>
              )}

              {/* hreflang */}
              {(hreflang || (result?.hreflang?.length || 0) > 0) && (
                <div className="mt-2 rounded-md border border-white/10 bg-black/30 p-3">
                  <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-slate-400">
                    <Languages className="h-3.5 w-3.5" /> hreflang ({hreflang?.count ?? result?.hreflang?.length ?? 0})
                    {hreflang?.hasXDefault && (
                      <span className="ml-1 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[9px] text-emerald-200">
                        x-default ✓
                      </span>
                    )}
                  </div>

                  {!hreflang && (
                    <p className="mt-1 text-[11px] text-slate-500">
                      Clique em "Verificar links" para validar reciprocidade dos hreflangs.
                    </p>
                  )}

                  {hreflang && hreflang.entries.length > 0 && (
                    <ul className="mt-2 flex flex-wrap gap-1.5">
                      {hreflang.entries.map((e, i) => (
                        <li
                          key={i}
                          className="inline-flex items-center gap-1 rounded-md bg-white/[0.04] px-2 py-0.5 font-mono-data text-[10px] text-slate-300 ring-1 ring-white/10"
                          title={e.href}
                        >
                          <span className="text-violet-300">{e.lang}</span>
                          <span className="opacity-50 truncate max-w-[160px]">{e.href.replace(/^https?:\/\//, "")}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {hreflang && hreflang.issues.length > 0 && (
                    <ul className="mt-2 space-y-1 text-[11px]">
                      {hreflang.issues.map((iss, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          {issueIcon(iss.level)}
                          <span className={iss.level === "error" ? "text-red-200" : iss.level === "warn" ? "text-amber-200" : "text-slate-300"}>
                            {iss.message}
                            {iss.details && (
                              <span className="ml-1 opacity-60 font-mono-data">{iss.details}</span>
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {hreflang && hreflang.reciprocity.length > 0 && (
                    <div className="mt-2">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Reciprocidade</p>
                      <ul className="mt-1 space-y-0.5 text-[11px]">
                        {hreflang.reciprocity.map((r, i) => (
                          <li key={i} className="flex items-center gap-2">
                            {r.reciprocates ? (
                              <CheckCircle2 className="h-3 w-3 text-emerald-300" />
                            ) : r.reciprocates === false ? (
                              <Link2Off className="h-3 w-3 text-red-300" />
                            ) : (
                              <Info className="h-3 w-3 text-slate-400" />
                            )}
                            <span className="text-slate-400 font-mono-data">{r.lang}</span>
                            <span className="truncate text-slate-300">{r.url}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {hreflang && hreflang.issues.length === 0 && hreflang.reciprocity.every((r) => r.reciprocates) && (
                    <p className="mt-2 inline-flex items-center gap-1 text-[11px] text-emerald-300">
                      <CheckCircle2 className="h-3 w-3" /> Sem problemas detectados.
                    </p>
                  )}
                </div>
              )}
            </div>
          </Section>

          {/* Issues */}
          {result.issues.length > 0 && (
            <Section
              icon={<ShieldAlert className="h-4 w-4 text-amber-300" />}
              title={`Diagnóstico (${result.issues.length})`}
            >
              <ul className="divide-y divide-white/[0.05]">
                {result.issues.map((it, i) => (
                  <li key={i} className="flex items-start gap-3 px-4 py-2.5 text-sm">
                    {issueIcon(it.level)}
                    <span className="text-slate-200">{it.message}</span>
                    <span className="ml-auto text-[10px] uppercase tracking-widest text-slate-500">
                      {it.key}
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* Meta tags / SEO */}
          <Section icon={<ScrollText className="h-4 w-4 text-cyan-300" />} title="SEO básico">
            <Kv k="Title" v={result.meta.title} mono />
            <Kv k="Description" v={result.meta.description} />
            <Kv k="Canonical" v={result.meta.canonical} mono />
            <Kv k="Robots meta" v={result.meta.robots} mono />
            <Kv k="Viewport" v={result.meta.viewport} mono />
            <Kv k="Lang / Charset" v={`${result.meta.lang || "—"} / ${result.meta.charset || "—"}`} mono />
            <Kv k="Theme color" v={result.meta.themeColor} mono />
            <Kv k="Author / Generator" v={`${result.meta.author || "—"} / ${result.meta.generator || "—"}`} mono />
          </Section>

          {/* Previews */}
          <Section icon={<ImageIcon className="h-4 w-4 text-violet-300" />} title="Como aparece nas redes">
            <div className="grid gap-3 p-4 lg:grid-cols-3">
              <WhatsAppPreview og={og} fallbackTitle={result.meta.title} fallbackDesc={result.meta.description} hostname={new URL(result.finalUrl).hostname} />
              <FacebookPreview og={og} fallbackTitle={result.meta.title} fallbackDesc={result.meta.description} hostname={new URL(result.finalUrl).hostname} />
              <TwitterPreview tw={tw} og={og} fallbackTitle={result.meta.title} fallbackDesc={result.meta.description} hostname={new URL(result.finalUrl).hostname} />
            </div>
          </Section>

          {/* Headers de segurança */}
          <Section icon={<Shield className="h-4 w-4 text-emerald-300" />} title="Headers de segurança">
            <table className="min-w-full text-left text-xs">
              <thead className="border-b border-white/[0.06] bg-black/25 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                <tr>
                  <th className="px-4 py-2">Header</th>
                  <th className="px-4 py-2">Pontos</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Observação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {result.security.checks.map((c) => (
                  <tr key={c.key} className="text-slate-300 hover:bg-white/[0.02]">
                    <td className="px-4 py-2 font-mono-data">{c.key}</td>
                    <td className="px-4 py-2 font-mono-data text-slate-400">
                      {c.awarded}/{c.weight}
                    </td>
                    <td className="px-4 py-2">
                      {c.present ? (
                        <span className="inline-flex items-center gap-1 text-emerald-300">
                          <CheckCircle2 className="h-3 w-3" /> presente
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-red-300">
                          <XCircle className="h-3 w-3" /> ausente
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-slate-400">{c.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          {/* SSL */}
          {result.ssl && (
            <Section icon={<Lock className="h-4 w-4 text-emerald-300" />} title="SSL / TLS">
              <Kv k="Protocolo" v={result.ssl.protocol} mono />
              <Kv k="Cifra" v={result.ssl.cipher} mono />
              <Kv k="ALPN" v={result.ssl.alpnProtocol} mono />
              <Kv k="Issuer" v={result.ssl.issuer} mono />
              <Kv k="Subject" v={result.ssl.subject} mono />
              <Kv k="Válido de" v={result.ssl.validFrom} mono />
              <Kv k="Válido até" v={result.ssl.validTo} mono />
              <Kv k="Dias até expirar" v={result.ssl.daysUntilExpiry?.toString() || null} mono />
            </Section>
          )}

          {/* Redirects */}
          <Section icon={<ArrowRight className="h-4 w-4 text-amber-300" />} title={`Redirects (${result.redirects.length} hop${result.redirects.length === 1 ? "" : "s"})`}>
            <ol className="space-y-1 p-4 text-xs">
              {result.redirects.map((r, i) => (
                <li key={i} className="flex items-center gap-3 rounded-md bg-black/30 px-3 py-2 ring-1 ring-white/5">
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 font-mono-data text-[10px]",
                      r.status >= 300 && r.status < 400
                        ? "bg-amber-500/20 text-amber-300"
                        : r.status >= 200 && r.status < 300
                          ? "bg-emerald-500/20 text-emerald-300"
                          : "bg-red-500/20 text-red-300"
                    )}
                  >
                    {r.status || "ERR"}
                  </span>
                  <span className="truncate font-mono-data text-slate-300">{r.url}</span>
                  <span className="ml-auto text-[10px] text-slate-500">{r.duration}ms</span>
                </li>
              ))}
            </ol>
          </Section>

          {/* PWA / Icons */}
          <Section icon={<Smartphone className="h-4 w-4 text-cyan-300" />} title="PWA & ícones">
            <Kv k="Manifest URL" v={result.pwa.manifestUrl} mono />
            <Kv k="Manifest erro" v={result.pwa.manifestError} />
            <Kv k="Favicons" v={String(result.icons.favicons.length)} mono />
            <Kv k="Apple touch icons" v={String(result.icons.appleTouchIcons.length)} mono />
            {result.pwa.manifest && (
              <Kv
                k="Manifest name"
                v={
                  (result.pwa.manifest as any).name ||
                  (result.pwa.manifest as any).short_name ||
                  "—"
                }
              />
            )}
          </Section>

          {/* Robots / Sitemap */}
          <Section icon={<Search className="h-4 w-4 text-violet-300" />} title="robots.txt & sitemap">
            <Kv k="robots.txt" v={result.robotsTxt.exists ? result.robotsTxt.url : "ausente"} mono />
            {result.robotsTxt.exists && result.robotsTxt.sample && (
              <pre className="mx-4 mb-3 overflow-x-auto rounded-md bg-black/40 p-3 text-[11px] text-slate-300 ring-1 ring-white/5">
                {result.robotsTxt.sample}
              </pre>
            )}
            <Kv k="sitemap" v={result.sitemap.exists ? result.sitemap.url : "ausente"} mono />
            {result.sitemap.urlCount != null && (
              <Kv k="URLs no sitemap (amostra)" v={String(result.sitemap.urlCount)} mono />
            )}
          </Section>

          {/* HTTP / Tech */}
          <Section icon={<Cpu className="h-4 w-4 text-slate-300" />} title="Servidor & stack">
            <Kv k="Server" v={result.http.server} mono />
            <Kv k="X-Powered-By" v={result.http.poweredBy} mono />
            <Kv k="Content-Type" v={result.http.contentType} mono />
            <Kv k="Tamanho HTML" v={fmtBytes(result.http.htmlSizeBytes)} mono />
            <Kv k="Tech detectada" v={result.techStack.join(", ") || "—"} />
          </Section>

          {/* Schema.org */}
          {result.schemaOrg.length > 0 && (
            <Section icon={<ScrollText className="h-4 w-4 text-cyan-300" />} title={`Schema.org (${result.schemaOrg.length})`}>
              <pre className="overflow-x-auto p-4 text-[11px] text-slate-300">
                {JSON.stringify(result.schemaOrg, null, 2)}
              </pre>
            </Section>
          )}
        </>
      )}
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  big,
  hint,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  big: string;
  hint?: string;
  tone?: string;
}) {
  return (
    <div className="rounded-md border border-white/[0.08] bg-[#0c121f]/60 p-4 shadow-xl ring-1 ring-white/[0.04]">
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
        {icon}
        {label}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span
          className={cn(
            "rounded-md px-2 py-0.5 text-lg font-bold",
            tone || "text-slate-200"
          )}
        >
          {big}
        </span>
      </div>
      {hint && <p className="mt-1 text-[11px] text-slate-500">{hint}</p>}
    </div>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-md border border-white/[0.08] bg-[#0c121f]/60 shadow-xl ring-1 ring-white/[0.04]">
      <div className="flex items-center gap-2 border-b border-white/[0.06] bg-black/25 px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-slate-300">
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}

function Kv({ k, v, mono }: { k: string; v: string | null | undefined; mono?: boolean }) {
  return (
    <div className="flex items-baseline gap-3 border-b border-white/[0.04] px-4 py-2 text-xs last:border-0">
      <span className="w-40 shrink-0 text-[10px] uppercase tracking-widest text-slate-500">{k}</span>
      <span className={cn("min-w-0 flex-1 break-words text-slate-200", mono && "font-mono-data text-slate-300")}>
        {v || <span className="text-slate-600">—</span>}
      </span>
    </div>
  );
}

// ============================== PREVIEWS ===================================

function WhatsAppPreview({
  og,
  fallbackTitle,
  fallbackDesc,
  hostname,
}: {
  og: Record<string, string>;
  fallbackTitle: string | null;
  fallbackDesc: string | null;
  hostname: string;
}) {
  const title = og["og:title"] || fallbackTitle || "(sem título)";
  const desc = og["og:description"] || fallbackDesc || "";
  const img = og["og:image"];
  return (
    <div>
      <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-emerald-400">WhatsApp</p>
      <div className="overflow-hidden rounded-lg bg-[#202c33] ring-1 ring-emerald-500/20">
        {img ? (
          <img src={img} alt="" className="h-32 w-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <div className="flex h-20 items-center justify-center bg-black/30 text-[10px] text-slate-500">
            sem og:image
          </div>
        )}
        <div className="p-2.5">
          <p className="line-clamp-2 text-xs font-semibold text-slate-100">{title}</p>
          <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-400">{desc || hostname}</p>
          <p className="mt-1 text-[10px] uppercase text-slate-500">{hostname}</p>
        </div>
      </div>
    </div>
  );
}

function FacebookPreview({
  og,
  fallbackTitle,
  fallbackDesc,
  hostname,
}: {
  og: Record<string, string>;
  fallbackTitle: string | null;
  fallbackDesc: string | null;
  hostname: string;
}) {
  const title = og["og:title"] || fallbackTitle || "(sem título)";
  const desc = og["og:description"] || fallbackDesc || "";
  const img = og["og:image"];
  return (
    <div>
      <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-sky-400">Facebook</p>
      <div className="overflow-hidden rounded-lg bg-[#1c1e21] ring-1 ring-sky-500/20">
        {img ? (
          <img src={img} alt="" className="h-32 w-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <div className="flex h-20 items-center justify-center bg-black/30 text-[10px] text-slate-500">
            sem og:image
          </div>
        )}
        <div className="border-t border-white/5 bg-[#3a3b3c] p-2.5">
          <p className="text-[9px] uppercase text-slate-400">{hostname}</p>
          <p className="mt-0.5 line-clamp-2 text-xs font-semibold text-slate-100">{title}</p>
          <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-400">{desc}</p>
        </div>
      </div>
    </div>
  );
}

function statusRank(s: LinkStatus): number {
  switch (s) {
    case "broken":
      return 0;
    case "timeout":
      return 1;
    case "network":
      return 2;
    case "redirect":
      return 3;
    case "ok":
      return 4;
    default:
      return 5;
  }
}

function LinkStatChip({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className={cn("rounded-md p-2 ring-1", tone)}>
      <p className="text-[10px] font-bold uppercase tracking-widest opacity-80">{label}</p>
      <p className="mt-0.5 font-mono-data text-2xl font-semibold">{value}</p>
    </div>
  );
}

function LinkStatusPill({ check }: { check: LinkCheck }) {
  const httpLabel = check.httpStatus ? `${check.httpStatus}` : check.status;
  const tone =
    check.status === "ok"
      ? "bg-emerald-500/20 text-emerald-200 ring-emerald-400/30"
      : check.status === "redirect"
        ? "bg-cyan-500/20 text-cyan-200 ring-cyan-400/30"
        : check.status === "broken"
          ? "bg-red-500/20 text-red-200 ring-red-400/30"
          : check.status === "timeout"
            ? "bg-amber-500/20 text-amber-200 ring-amber-400/30"
            : "bg-white/[0.06] text-slate-300 ring-white/10";
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono-data text-[10px] font-bold ring-1", tone)}>
      {check.status === "broken" && <XCircle className="h-3 w-3" />}
      {check.status === "ok" && <CheckCircle2 className="h-3 w-3" />}
      {check.status === "redirect" && <ArrowRight className="h-3 w-3" />}
      {check.status === "timeout" && <AlertTriangle className="h-3 w-3" />}
      {check.status === "network" && <Info className="h-3 w-3" />}
      {httpLabel}
    </span>
  );
}

function PsiScoreCard({ label, value }: { label: string; value: number | null | undefined }) {
  const v = value == null ? null : Math.max(0, Math.min(100, value));
  const tone =
    v == null
      ? "text-slate-500 bg-white/[0.04]"
      : v >= 90
        ? "text-emerald-300 bg-emerald-500/15 ring-emerald-400/30"
        : v >= 50
          ? "text-amber-300 bg-amber-500/15 ring-amber-400/30"
          : "text-red-300 bg-red-500/15 ring-red-400/30";
  return (
    <div className={cn("rounded-md p-3 ring-1 ring-white/10", tone)}>
      <p className="text-[10px] font-bold uppercase tracking-widest opacity-80">{label}</p>
      <p className="mt-1 font-mono-data text-3xl font-semibold">{v == null ? "—" : v}</p>
    </div>
  );
}

function VitalChip({ vital, label }: { vital: WebVital | null; label: string }) {
  const tone =
    vital?.score == null
      ? "text-slate-500"
      : vital.score >= 0.9
        ? "text-emerald-300"
        : vital.score >= 0.5
          ? "text-amber-300"
          : "text-red-300";
  return (
    <div className="rounded-md border border-white/10 bg-black/30 px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</p>
      <p className={cn("mt-0.5 font-mono-data text-sm font-bold", tone)}>
        {vital?.displayValue || "—"}
      </p>
    </div>
  );
}

function RecordList({ label, items, truncate }: { label: string; items: string[]; truncate?: boolean }) {
  return (
    <div className="rounded-md border border-white/10 bg-black/30 p-2">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
        {label} ({items.length})
      </p>
      {items.length === 0 ? (
        <p className="mt-1 text-[11px] text-slate-500">—</p>
      ) : (
        <ul className="mt-1 space-y-0.5 font-mono-data text-[11px] text-slate-300">
          {items.map((it, i) => (
            <li key={i} className={truncate ? "truncate" : "break-all"}>
              {it}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EmailAuthChip({
  label,
  ok,
  valid,
  notes,
  record,
  extra,
}: {
  label: string;
  ok: boolean;
  valid: boolean;
  notes: string[];
  record: string | null;
  extra?: string | null;
}) {
  return (
    <div
      className={cn(
        "rounded-md border p-2",
        ok && valid
          ? "border-emerald-400/30 bg-emerald-500/[0.06]"
          : ok
            ? "border-amber-400/30 bg-amber-500/[0.06]"
            : "border-red-400/30 bg-red-500/[0.06]"
      )}
    >
      <div className="flex items-center gap-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-300">{label}</p>
        {ok ? (
          valid ? (
            <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] text-emerald-200">OK</span>
          ) : (
            <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] text-amber-200">avisos</span>
          )
        ) : (
          <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] text-red-200">ausente</span>
        )}
        {extra && <span className="ml-auto text-[10px] text-slate-400 font-mono-data">{extra}</span>}
      </div>
      {record && <p className="mt-1 break-all font-mono-data text-[10px] text-slate-400">{record.slice(0, 200)}</p>}
      {notes.length > 0 && (
        <ul className="mt-1 list-disc pl-4 text-[10px] text-slate-400">
          {notes.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TwitterPreview({
  tw,
  og,
  fallbackTitle,
  fallbackDesc,
  hostname,
}: {
  tw: Record<string, string>;
  og: Record<string, string>;
  fallbackTitle: string | null;
  fallbackDesc: string | null;
  hostname: string;
}) {
  const title = tw["twitter:title"] || og["og:title"] || fallbackTitle || "(sem título)";
  const desc = tw["twitter:description"] || og["og:description"] || fallbackDesc || "";
  const img = tw["twitter:image"] || og["og:image"];
  const card = tw["twitter:card"] || "summary_large_image";
  return (
    <div>
      <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-violet-400">X / Twitter ({card})</p>
      <div className="overflow-hidden rounded-2xl bg-[#000] ring-1 ring-violet-500/20">
        {img ? (
          <img src={img} alt="" className="h-32 w-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <div className="flex h-20 items-center justify-center bg-black/30 text-[10px] text-slate-500">
            sem twitter:image
          </div>
        )}
        <div className="p-2.5">
          <p className="text-[9px] uppercase text-slate-500">{hostname}</p>
          <p className="mt-0.5 line-clamp-2 text-xs font-semibold text-slate-100">{title}</p>
          <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-400">{desc}</p>
        </div>
      </div>
    </div>
  );
}
