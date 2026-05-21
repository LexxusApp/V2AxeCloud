import type { Request } from "express";
import { verifyUser } from "./verifyUser.js";

export type AuditLogStatus = "success" | "failed";

export type CreateAuditLogDetails = Record<string, unknown> | null | undefined;

let disabled = false;
let lastDisabledReason = "";
let disabledRetryAt = 0;

const MISSING_TABLE_RETRY_MS = 60_000;

export function getAuditLogsDisabled(): { disabled: boolean; reason: string } {
  return { disabled, reason: lastDisabledReason };
}

export function resetAuditLogsState() {
  disabled = false;
  lastDisabledReason = "";
  disabledRetryAt = 0;
}

/** IP real em produção (Vercel/proxy): x-forwarded-for → x-real-ip → req.ip */
export function extractClientIp(req: Request | any): string | null {
  try {
    const xff = req?.headers?.["x-forwarded-for"];
    if (xff) {
      const first = String(xff).split(",")[0]?.trim();
      if (first) return first.slice(0, 64);
    }
    const xri = req?.headers?.["x-real-ip"];
    if (xri) {
      const v = String(xri).trim();
      if (v) return v.slice(0, 64);
    }
    const ip = req?.ip || req?.socket?.remoteAddress || null;
    return ip ? String(ip).replace(/^::ffff:/, "").slice(0, 64) : null;
  } catch {
    return null;
  }
}

export function extractUserAgent(req: Request | any): string | null {
  try {
    const ua = String(req?.headers?.["user-agent"] || "").trim();
    return ua ? ua.slice(0, 500) : null;
  } catch {
    return null;
  }
}

function looksLikeMissingTable(err: { message?: string; details?: string; code?: string } | null): boolean {
  if (!err) return false;
  const m = `${String(err.message || "")} ${String(err.details || "")}`.toLowerCase();
  if (!m.includes("audit_logs")) return false;
  if (String(err.code || "") === "PGRST205") return true;
  return /schema cache|does not exist|could not find|undefined relation|unknown table|not find the table/i.test(m);
}

function sanitizeDetails(details: CreateAuditLogDetails): Record<string, unknown> | null {
  if (!details || typeof details !== "object") return null;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(details)) {
    const key = String(k).slice(0, 80);
    if (/password|senha|token|secret|authorization/i.test(key)) continue;
    if (v == null) {
      out[key] = v;
      continue;
    }
    if (typeof v === "string") out[key] = v.slice(0, 2000);
    else if (typeof v === "number" || typeof v === "boolean") out[key] = v;
    else if (Array.isArray(v)) out[key] = v.slice(0, 50);
    else out[key] = JSON.parse(JSON.stringify(v).slice(0, 4000));
  }
  return Object.keys(out).length ? out : null;
}

/** Resolve tenant/terreiro a partir do utilizador autenticado. */
export async function resolveTerreiroIdForUser(
  supabaseAdmin: { from: (t: string) => any },
  userId: string
): Promise<string | null> {
  if (!userId) return null;
  try {
    const { data: leader } = await supabaseAdmin
      .from("perfil_lider")
      .select("id, tenant_id")
      .eq("id", userId)
      .maybeSingle();
    if (leader) {
      const tid = String((leader as { tenant_id?: string }).tenant_id || "").trim();
      if (tid) return tid;
      return String((leader as { id?: string }).id || "").trim() || null;
    }
    const { data: child } = await supabaseAdmin
      .from("filhos_de_santo")
      .select("tenant_id, lider_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (child) {
      const tid = String((child as { tenant_id?: string }).tenant_id || "").trim();
      if (tid) return tid;
      const lid = String((child as { lider_id?: string }).lider_id || "").trim();
      if (lid) return lid;
    }
    return userId;
  } catch {
    return userId;
  }
}

/**
 * Registra evento em `public.audit_logs`. Nunca lança — use `void createAuditLog(...)`.
 */
export async function createAuditLog(
  supabaseAdmin: { from: (t: string) => any },
  req: Request | any,
  action: string,
  status: AuditLogStatus | string,
  terreiroId?: string | null,
  details?: CreateAuditLogDetails
): Promise<void> {
  if (disabled) {
    if (Date.now() < disabledRetryAt) return;
    disabled = false;
    lastDisabledReason = "";
    disabledRetryAt = 0;
  }
  const act = String(action || "").trim().slice(0, 120);
  if (!act) return;
  const st = status === "success" ? "success" : "failed";

  try {
    const meta = sanitizeDetails(details);
    let userId =
      meta && typeof meta.userId === "string"
        ? meta.userId
        : meta && typeof meta.user_id === "string"
          ? meta.user_id
          : null;
    let userEmail =
      meta && typeof meta.email === "string"
        ? String(meta.email).toLowerCase().slice(0, 200)
        : meta && typeof meta.userEmail === "string"
          ? String(meta.userEmail).toLowerCase().slice(0, 200)
          : meta && typeof meta.user_email === "string"
            ? String(meta.user_email).toLowerCase().slice(0, 200)
            : null;

    if ((!userId || !userEmail) && req) {
      const authHeader = req.headers?.authorization || req.headers?.Authorization;
      const token = authHeader ? String(authHeader).replace(/^Bearer\s+/i, "").trim() : "";
      if (token && token !== "undefined" && token !== "null") {
        try {
          const { user, error: authError } = await verifyUser(supabaseAdmin as any, token);
          if (!authError && user?.id) {
            userId = userId || user.id;
            userEmail = userEmail || (user.email ? String(user.email).toLowerCase().slice(0, 200) : null);
          }
        } catch {
          /* best-effort */
        }
      }
    }

    let tid: string | null = terreiroId != null && String(terreiroId).trim() ? String(terreiroId).trim() : null;
    if (!tid && userId) {
      tid = await resolveTerreiroIdForUser(supabaseAdmin, userId);
    }

    const payload = {
      action: act,
      status: st,
      terreiro_id: tid,
      details: meta,
      ip: extractClientIp(req),
      user_agent: extractUserAgent(req),
      user_id: userId,
      user_email: userEmail,
    };

    const { error } = await supabaseAdmin.from("audit_logs").insert(payload);
    if (error) {
      if (looksLikeMissingTable(error)) {
        disabled = true;
        lastDisabledReason = error.message || "tabela audit_logs ausente";
        disabledRetryAt = Date.now() + MISSING_TABLE_RETRY_MS;
        console.warn(
          "[createAuditLog] Tabela 'audit_logs' ainda não existe — aplique supabase/migrations/20260520120000_audit_logs.sql. Nova tentativa em breve."
        );
        return;
      }
      console.warn("[createAuditLog] insert falhou:", error.message || error);
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("[createAuditLog] exception:", msg);
  }
}
