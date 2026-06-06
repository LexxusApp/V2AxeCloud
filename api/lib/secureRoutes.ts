import type { SupabaseClient, User } from "@supabase/supabase-js";
import { requireAuthOrRespond } from "./requireAuth.js";
import {
  assertUserCanAccessTenant,
  normalizeQueryTenantId,
  resolveFinanceiroTenantScope,
} from "./tenantAccess.js";

export async function requireTenantReadAccess(
  supabaseAdmin: SupabaseClient,
  req: { headers?: Record<string, string | string[] | undefined>; query?: Record<string, unknown> },
  res: { status: (n: number) => { json: (b: unknown) => unknown } },
  tenantIdRaw: unknown,
  opts?: { allowMissingTenant?: boolean }
): Promise<{ user: User; tenantId: string } | null> {
  const user = await requireAuthOrRespond(supabaseAdmin, req, res);
  if (!user) return null;

  const tid = normalizeQueryTenantId(tenantIdRaw);
  if (!tid) {
    if (opts?.allowMissingTenant) {
      const scope = await resolveFinanceiroTenantScope(supabaseAdmin, user.id, undefined, "");
      if (!scope) {
        res.status(403).json({ error: "Acesso negado" });
        return null;
      }
      return { user, tenantId: scope };
    }
    res.status(400).json({ error: "tenantId required" });
    return null;
  }

  const ok = await assertUserCanAccessTenant(supabaseAdmin, user, tid);
  if (!ok) {
    res.status(403).json({ error: "Acesso negado" });
    return null;
  }
  return { user, tenantId: tid };
}

export async function requireAuthenticatedUser(
  supabaseAdmin: SupabaseClient,
  req: { headers?: Record<string, string | string[] | undefined> },
  res: { status: (n: number) => { json: (b: unknown) => unknown } }
): Promise<User | null> {
  return requireAuthOrRespond(supabaseAdmin, req, res);
}

/** Allowlist de hosts para pdf-proxy (Supabase Storage + R2 público). */
export function isAllowedPdfProxyUrl(rawUrl: string): boolean {
  try {
    const u = new URL(rawUrl);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    const host = u.hostname.toLowerCase();
    const allowHosts = (process.env.PDF_PROXY_ALLOWED_HOSTS || "")
      .split(",")
      .map((h) => h.trim().toLowerCase())
      .filter(Boolean);
    if (allowHosts.includes(host)) return true;
    if (host.endsWith(".supabase.co")) return true;
    if (host.endsWith(".supabase.in")) return true;
    const r2Base = process.env.R2_PUBLIC_BASE_URL || "";
    if (r2Base) {
      try {
        if (new URL(r2Base).hostname.toLowerCase() === host) return true;
      } catch {
        /* ignore */
      }
    }
    return false;
  } catch {
    return false;
  }
}

export function verifyKiwifyWebhook(req: { headers?: Record<string, string | string[] | undefined> }): boolean {
  const secret = process.env.KIWIFY_WEBHOOK_SECRET || "";
  if (!secret) return false;
  const header =
    req.headers?.["x-kiwify-signature"] ||
    req.headers?.["x-webhook-token"] ||
    req.headers?.["authorization"];
  const value = Array.isArray(header) ? header[0] : header;
  return String(value || "").replace(/^Bearer\s+/i, "") === secret;
}

export function verifyWhatsAppWebhook(req: { headers?: Record<string, string | string[] | undefined> }): boolean {
  const secret = process.env.WHATSAPP_WEBHOOK_SECRET || process.env.EVOLUTION_WEBHOOK_SECRET || "";
  if (!secret) return false;
  const header = req.headers?.["x-webhook-secret"] || req.headers?.["apikey"];
  const value = Array.isArray(header) ? header[0] : header;
  return String(value || "") === secret;
}

/** Exige EFI_WEBHOOK_SECRET em produção (header ou ?secret= na URL registrada na EFI). */
export function verifyEfiWebhook(req: {
  headers?: Record<string, string | string[] | undefined>;
  query?: Record<string, string | string[] | undefined>;
}): boolean {
  const secret = process.env.EFI_WEBHOOK_SECRET || "";
  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }
  const header = req.headers?.["x-efi-webhook-secret"] || req.headers?.["authorization"];
  const headerValue = Array.isArray(header) ? header[0] : header;
  const headerToken = String(headerValue || "").replace(/^Bearer\s+/i, "");
  const q = req.query?.secret;
  const querySecret = Array.isArray(q) ? q[0] : q;
  return headerToken === secret || String(querySecret || "") === secret;
}
