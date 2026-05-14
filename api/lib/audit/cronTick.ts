/**
 * Tick agendado pelo Vercel Cron (ou cron externo).
 *
 * Itera por todos os `audit_targets` com `enabled=true` e schedule compatível
 * (no momento ignoramos o schedule e rodamos todos os habilitados — o intervalo
 * é controlado pelo Vercel Cron). Roda em série para não sobrecarregar PSI/CPU.
 *
 * Autorização: header `Authorization: Bearer <CRON_SECRET>` (padrão Vercel)
 * ou query `?secret=<CRON_SECRET>`.
 */

import type { Request, Response } from "express";
import { runFullAudit, type AuditTargetRow } from "./runFull.js";

const HARD_BUDGET_MS = 50_000; // teto p/ serverless de 60s

function unauthorized(res: Response, reason: string) {
  console.warn("[cron/audit-tick] unauthorized:", reason);
  return res.status(401).json({ error: "Unauthorized" });
}

function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET || process.env.AUDIT_CRON_SECRET || "";
  if (!secret) return false;
  const auth = String(req.headers.authorization || "").trim();
  if (auth === `Bearer ${secret}`) return true;
  const q = String((req.query.secret as string) || "").trim();
  if (q && q === secret) return true;
  // Vercel Cron envia tambem header user-agent contendo "vercel-cron"; aceita só se secret bater.
  return false;
}

export async function handleAuditTick(req: Request, res: Response, supabase: any) {
  if (!isAuthorized(req)) return unauthorized(res, "secret_mismatch");

  const startedAt = Date.now();
  let processed = 0;
  let ok = 0;
  let failed = 0;
  let alerts = 0;
  const errors: { id: string; url: string; error: string }[] = [];

  try {
    const { data: targets, error } = await supabase
      .from("audit_targets")
      .select("*")
      .eq("enabled", true)
      .order("last_run_at", { ascending: true, nullsFirst: true });
    if (error) throw error;

    for (const t of (targets || []) as AuditTargetRow[]) {
      if (Date.now() - startedAt > HARD_BUDGET_MS) {
        console.warn("[cron/audit-tick] orçamento atingido, próximos alvos no próximo tick.");
        break;
      }
      processed++;
      try {
        const r = await runFullAudit(supabase, {
          url: t.url,
          source: "cron",
          runBy: null,
          target: t,
        });
        if (r.ok) ok++;
        else failed++;
        if (r.alerted) alerts++;
      } catch (e: any) {
        failed++;
        errors.push({ id: t.id, url: t.url, error: e?.message || String(e) });
      }
    }

    res.json({
      ok: true,
      processed,
      okCount: ok,
      failedCount: failed,
      alerts,
      durationMs: Date.now() - startedAt,
      errors,
    });
  } catch (e: any) {
    console.error("[cron/audit-tick] erro fatal:", e);
    res.status(500).json({ error: e?.message || String(e) });
  }
}
