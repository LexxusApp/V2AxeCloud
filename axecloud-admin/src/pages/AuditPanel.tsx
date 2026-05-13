import { useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Globe,
  Info,
  Loader2,
  Lock,
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

const PRESETS = [
  { label: "axecloud-app", url: "https://axecloud-app.vercel.app" },
  { label: "axecloud-admin", url: "https://axecloud-admin.vercel.app" },
  { label: "landing", url: "https://axecloud.com.br" },
];

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

  async function runScan() {
    if (!url.trim()) return;
    setBusy(true);
    setError(null);
    setResult(null);
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

  const og = result?.openGraph || {};
  const tw = result?.twitter || {};

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
            className="inline-flex items-center gap-2 rounded-md bg-cyan-500/20 px-4 py-2 text-sm font-medium text-cyan-200 ring-1 ring-cyan-400/30 hover:bg-cyan-500/30 disabled:cursor-not-allowed disabled:opacity-50"
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
          {/* Resumo */}
          <div className="grid gap-3 md:grid-cols-4">
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
            <SummaryCard
              icon={<ScrollText className="h-4 w-4 text-violet-300" />}
              label="Diagnóstico"
              big={String(result.issues.length)}
              hint={`${result.issues.filter((i) => i.level === "error").length} erros · ${result.issues.filter((i) => i.level === "warn").length} avisos`}
            />
          </div>

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
              <thead className="border-b border-white/[0.06] bg-black/25 text-[10px] font-black uppercase tracking-widest text-slate-500">
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
