import type { Express, Request, Response } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdminConsoleRouteDeps } from "./adminConsoleDeps.js";
import { isMissingOrUnknownTable } from "./adminConsoleAuth.js";
import { safeErrorMessage } from "./safeError.js";

type RequireAdmin = (req: Request, res: Response) => Promise<{ user: any } | null>;
export type PaymentEventRow = {
  id: string; tenant_id: string | null; provider: string; external_id: string;
  event_type: string; status: string; payment_method: string; amount_cents: number | null;
  billing_cycle: string | null; charge_id: string | null; error_code: string | null;
  message: string | null; payload: Record<string, unknown> | null;
  occurred_at: string; processed_at: string | null;
};

const PAYMENT_SELECT = ["id", "tenant_id", "provider", "external_id", "event_type", "status",
  "payment_method", "amount_cents", "billing_cycle", "charge_id", "error_code", "message",
  "payload", "occurred_at", "processed_at"].join(",");

function startOfWindow(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function paymentIdentity(row: PaymentEventRow): string {
  if (row.charge_id) return `charge:${row.charge_id.replace(/^pix:/, "")}`;
  const cleaned = row.external_id.replace(/:(created|requested|status:[^:]+|paid|failed)$/i, "");
  return `${row.provider}:${cleaned}`;
}

async function fetchRecentEvents(supabaseAdmin: SupabaseClient, since: string): Promise<PaymentEventRow[]> {
  const rows: PaymentEventRow[] = [];
  const pageSize = 1000;
  for (let from = 0; from < 20_000; from += pageSize) {
    const { data, error } = await supabaseAdmin.from("payment_webhook_events")
      .select(PAYMENT_SELECT).gte("occurred_at", since)
      .order("occurred_at", { ascending: false }).range(from, from + pageSize - 1);
    if (error) throw error;
    const page = (data || []) as unknown as PaymentEventRow[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

export function summarizePaymentEvents(rows: PaymentEventRow[]) {
  const byPayment = new Map<string, PaymentEventRow[]>();
  for (const row of rows) {
    const key = paymentIdentity(row);
    const group = byPayment.get(key) || [];
    group.push(row);
    byPayment.set(key, group);
  }
  let generated = 0, paid = 0, pending = 0, failed = 0, expired = 0, cancelled = 0, revenueCents = 0;
  for (const events of byPayment.values()) {
    const latest = [...events].sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())[0];
    const amount = events.find((row) => row.amount_cents != null)?.amount_cents || 0;
    if (events.some((row) => row.event_type === "pix_created" || row.event_type === "card_created")) generated += 1;
    if (events.some((row) => row.status === "paid")) { paid += 1; revenueCents += amount; }
    else if (latest?.status === "failed") failed += 1;
    else if (latest?.status === "expired") expired += 1;
    else if (latest?.status === "cancelled") cancelled += 1;
    else if (latest && ["pending", "processing", "processed"].includes(latest.status)) pending += 1;
  }
  const conversionBase = generated || paid + pending + failed + expired + cancelled;
  return { windowDays: 30, generated, paid, pending, failed, expired, cancelled, revenueCents,
    conversionRate: conversionBase ? Math.round((paid / conversionBase) * 1000) / 10 : 0,
    events: rows.length, lastEventAt: rows[0]?.occurred_at || null };
}

async function enrichTenants(supabaseAdmin: SupabaseClient, rows: PaymentEventRow[]) {
  const tenantIds = [...new Set(rows.map((row) => row.tenant_id).filter(Boolean))] as string[];
  const profiles = new Map<string, { nome_terreiro: string | null; email: string | null; cargo: string | null }>();
  for (let start = 0; start < tenantIds.length; start += 200) {
    const { data, error } = await supabaseAdmin.from("perfil_lider")
      .select("id,nome_terreiro,email,cargo").in("id", tenantIds.slice(start, start + 200));
    if (error) throw error;
    for (const profile of data || []) profiles.set(String(profile.id), profile);
  }
  return rows.map((row) => ({ ...row, tenant: row.tenant_id ? profiles.get(row.tenant_id) || null : null }));
}

export function registerAdminPaymentRoutes(app: Express, deps: AdminConsoleRouteDeps, requireAdmin: RequireAdmin) {
  app.get("/api/admin-console/payments", async (req, res) => {
    const ctx = await requireAdmin(req, res);
    if (!ctx) return;
    const status = String(req.query.status || "").trim().toLowerCase();
    const method = String(req.query.method || "").trim().toLowerCase();
    const search = String(req.query.q || "").trim().toLowerCase();
    const limit = Math.min(250, Math.max(20, Number(req.query.limit || 100)));
    try {
      const summaryRows = await fetchRecentEvents(deps.supabaseAdmin, startOfWindow(30));
      let listQuery = deps.supabaseAdmin.from("payment_webhook_events").select(PAYMENT_SELECT)
        .order("occurred_at", { ascending: false }).limit(Math.min(500, Math.max(limit, search ? 250 : limit)));
      if (status) listQuery = listQuery.eq("status", status);
      if (method) listQuery = listQuery.eq("payment_method", method);
      const { data, error } = await listQuery;
      if (error) throw error;
      let rows = await enrichTenants(deps.supabaseAdmin, (data || []) as unknown as PaymentEventRow[]);
      if (search) rows = rows.filter((row) => [row.external_id, row.charge_id, row.message, row.tenant_id,
        row.tenant?.nome_terreiro, row.tenant?.email, row.tenant?.cargo]
        .filter(Boolean).join(" ").toLowerCase().includes(search));
      res.setHeader("Cache-Control", "private, no-store");
      res.json({ available: true, rows: rows.slice(0, limit), summary: summarizePaymentEvents(summaryRows),
        checkedAt: new Date().toISOString() });
    } catch (error) {
      if (isMissingOrUnknownTable(error as any, "payment_webhook_events")) {
        return res.json({ available: false, rows: [], summary: summarizePaymentEvents([]),
          message: "A trilha financeira ainda não está disponível no banco de dados." });
      }
      console.error("[admin-console/payments]", error);
      res.status(500).json({ error: safeErrorMessage(error, "Erro ao carregar pagamentos.") });
    }
  });
}
