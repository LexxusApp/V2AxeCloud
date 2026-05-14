/**
 * Orquestrador da auditoria completa (Fase 4 / monitoramento).
 *
 * Executa:
 *   - scanUrl()                          (sempre)
 *   - dnsReport() em paralelo            (se runDns)
 *   - runPsi(strategy: mobile) opcional  (se runPsi — demora ~10-30s)
 *
 * Calcula o score global ponderado, persiste em `audit_runs`, atualiza o
 * `audit_targets.last_*`, e — se threshold de alerta for cruzado — envia
 * o webhook do alvo (e marca `alerted=true`).
 *
 * Não lança exceções para o caller: em caso de erro fatal, cria uma run com
 * status='error' e mensagem.
 */

import { scanUrl, type ScanResult } from "./scan.js";
import { dnsReport, type DnsReport } from "./dns.js";
import { runPsi, type PsiResult } from "./psi.js";
import { computeGlobalScore } from "./scoring.js";
import { sendAuditWebhook } from "./webhook.js";

export type AuditRunSource = "manual" | "cron" | "webhook";

export type AuditTargetRow = {
  id: string;
  url: string;
  label: string | null;
  enabled: boolean;
  run_dns: boolean;
  run_psi: boolean;
  alert_webhook: string | null;
  alert_threshold: number;
  alert_grade: string | null;
  schedule: string;
};

export type AuditRunOpts = {
  url: string;
  source?: AuditRunSource;
  runBy?: string | null;
  runDns?: boolean;
  runPsi?: boolean;
  target?: AuditTargetRow | null;
};

export type AuditRunResult = {
  ok: boolean;
  runId: string | null;
  status: "ok" | "error";
  scoreTotal: number | null;
  scoreGrade: string | null;
  deltaTotal: number | null;
  alerted: boolean;
  error?: string;
  scan?: ScanResult;
  dns?: DnsReport | null;
  psi?: PsiResult | null;
};

type SupabaseLike = {
  from: (t: string) => any;
};

async function fetchPrevious(supabase: SupabaseLike, url: string, targetId: string | null) {
  try {
    let q = supabase.from("audit_runs").select("score_total, score_grade").eq("status", "ok").order("created_at", { ascending: false }).limit(1);
    q = targetId ? q.eq("target_id", targetId) : q.eq("url", url);
    const { data } = await q;
    if (data && data.length > 0) return data[0] as { score_total: number | null; score_grade: string | null };
  } catch {
    /* ignore */
  }
  return null;
}

export async function runFullAudit(
  supabase: SupabaseLike,
  opts: AuditRunOpts
): Promise<AuditRunResult> {
  const t0 = Date.now();
  const source: AuditRunSource = opts.source || "manual";
  const target = opts.target || null;
  const runDns = opts.runDns ?? (target ? target.run_dns : true);
  const runPsiFlag = opts.runPsi ?? (target ? target.run_psi : false);

  let scan: ScanResult | undefined;
  let dnsR: DnsReport | null = null;
  let psiR: PsiResult | null = null;

  try {
    const [scanRes, dnsRes] = await Promise.all([
      scanUrl(opts.url),
      runDns ? dnsReport(opts.url).catch(() => null) : Promise.resolve(null),
    ]);
    scan = scanRes;
    dnsR = dnsRes;

    if (runPsiFlag) {
      psiR = await runPsi(scan.finalUrl, "mobile").catch(() => null);
    }
  } catch (e: any) {
    const insert = await supabase
      .from("audit_runs")
      .insert({
        target_id: target?.id || null,
        url: opts.url,
        source,
        run_by: opts.runBy || null,
        status: "error",
        error: e?.message || String(e),
        duration_ms: Date.now() - t0,
      })
      .select("id")
      .single();
    return {
      ok: false,
      runId: insert?.data?.id || null,
      status: "error",
      scoreTotal: null,
      scoreGrade: null,
      deltaTotal: null,
      alerted: false,
      error: e?.message || String(e),
    };
  }

  if (!scan) {
    return {
      ok: false,
      runId: null,
      status: "error",
      scoreTotal: null,
      scoreGrade: null,
      deltaTotal: null,
      alerted: false,
      error: "scan vazio",
    };
  }

  const global = computeGlobalScore(scan, psiR, dnsR);
  const previous = await fetchPrevious(supabase, opts.url, target?.id || null);
  const deltaTotal =
    previous?.score_total != null && global.total != null
      ? global.total - previous.score_total
      : null;

  const issuesCount = scan.issues.length;
  const errors = scan.issues.filter((i) => i.level === "error").length;
  const warns = scan.issues.filter((i) => i.level === "warn").length;

  const sslExpiresAt = scan.ssl?.validTo ? new Date(scan.ssl.validTo).toISOString() : null;
  const domainExpires = dnsR?.whois?.expiresAt || null;

  // Insere a run
  const { data: inserted } = await supabase
    .from("audit_runs")
    .insert({
      target_id: target?.id || null,
      url: scan.finalUrl,
      source,
      run_by: opts.runBy || null,
      status: "ok",
      score_total: global.total,
      score_grade: global.grade,
      security_grade: scan.security.grade,
      security_score: scan.security.score,
      security_max: scan.security.maxScore,
      performance_score: psiR?.scores.performance ?? null,
      accessibility_score: psiR?.scores.accessibility ?? null,
      best_practices_score: psiR?.scores.bestPractices ?? null,
      seo_score: psiR?.scores.seo ?? null,
      http_status: scan.status,
      is_http2: scan.http.isHttp2 ?? null,
      issues_count: issuesCount,
      issues_errors: errors,
      issues_warns: warns,
      dns_ok: dnsR ? dnsR.records.a.length > 0 || dnsR.records.aaaa.length > 0 : null,
      has_spf: dnsR?.email.spf.found ?? null,
      has_dmarc: dnsR?.email.dmarc.found ?? null,
      dkim_selectors: dnsR?.email.dkim.length ?? null,
      domain_expires_at: domainExpires,
      ssl_expires_at: sslExpiresAt,
      ran_dns: !!runDns,
      ran_psi: !!runPsiFlag,
      duration_ms: Date.now() - t0,
      delta_total: deltaTotal,
      result: { scan, dns: dnsR, psi: psiR, score: global },
    })
    .select("id")
    .single();

  const runId = (inserted as any)?.id || null;

  // Atualiza last_* no alvo
  if (target?.id) {
    await supabase
      .from("audit_targets")
      .update({
        last_run_at: new Date().toISOString(),
        last_score: global.total,
        last_grade: global.grade,
      })
      .eq("id", target.id);
  }

  // Alerta via webhook
  let alerted = false;
  if (target?.alert_webhook && global.total != null) {
    const belowThreshold = global.total < (target.alert_threshold ?? 60);
    const belowGrade = target.alert_grade ? gradeWorseThan(global.grade, target.alert_grade) : false;
    const droppedSignificantly = deltaTotal != null && deltaTotal <= -10;

    if (belowThreshold || belowGrade || droppedSignificantly) {
      const reason = belowThreshold
        ? `Score abaixo do limite (${global.total} < ${target.alert_threshold}).`
        : droppedSignificantly
          ? `Score caiu ${deltaTotal} pontos em relação à última execução.`
          : `Nota piorou para ${global.grade}.`;
      try {
        const r = await sendAuditWebhook(target.alert_webhook, {
          url: scan.finalUrl,
          label: target.label,
          total: global.total,
          grade: global.grade,
          previousTotal: previous?.score_total ?? null,
          delta: deltaTotal ?? null,
          threshold: target.alert_threshold,
          reason,
          issues: issuesCount,
        });
        alerted = r.ok;
      } catch {
        alerted = false;
      }
      if (alerted && runId) {
        await supabase.from("audit_runs").update({ alerted: true }).eq("id", runId);
      }
    }
  }

  return {
    ok: true,
    runId,
    status: "ok",
    scoreTotal: global.total,
    scoreGrade: global.grade,
    deltaTotal,
    alerted,
    scan,
    dns: dnsR,
    psi: psiR,
  };
}

const GRADE_RANK: Record<string, number> = { "A+": 0, A: 1, B: 2, C: 3, D: 4, F: 5 };
function gradeWorseThan(current: string, threshold: string): boolean {
  const c = GRADE_RANK[current?.toUpperCase()] ?? 99;
  const t = GRADE_RANK[threshold?.toUpperCase()] ?? 99;
  return c > t;
}
