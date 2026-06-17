import type { SupabaseClient } from "@supabase/supabase-js";
import { isConsoleGlobalAdmin } from "./consoleAdmin.js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizeQueryTenantId(raw: unknown): string {
  if (raw == null) return "";
  const s = String(Array.isArray(raw) ? raw[0] : raw).trim();
  if (!s || s === "undefined" || s === "null" || s === "NaN") return "";
  return s;
}

export function isValidUuid(value: string): boolean {
  return UUID_RE.test(String(value || "").trim());
}

/** Resolve perfil_lider.id a partir do id do zelador ou do tenant_id. */
export async function resolveLeaderId(
  supabaseAdmin: SupabaseClient,
  idOrTenantId: string
): Promise<string> {
  const id = String(idOrTenantId || "").trim();
  if (!id || !isValidUuid(id)) return id;
  const { data } = await supabaseAdmin
    .from("perfil_lider")
    .select("id")
    .or(`id.eq.${id},tenant_id.eq.${id}`)
    .maybeSingle();
  return data?.id || id;
}

/** Filho shadow (f_*@axecloud.internal) ou vínculo em filhos_de_santo. */
export function isShadowFilhoAuthEmail(email?: string | null): boolean {
  const e = String(email || "").toLowerCase().trim();
  return e.startsWith("f_") && e.endsWith("@axecloud.internal");
}

async function loadFilhoHouseRefs(
  supabaseAdmin: SupabaseClient,
  user: { id: string; email?: string | null }
): Promise<{ lider_id?: string | null; tenant_id?: string | null } | null> {
  const { data: child } = await supabaseAdmin
    .from("filhos_de_santo")
    .select("lider_id, tenant_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (child) return child;
  if (!isShadowFilhoAuthEmail(user.email)) return null;
  return null;
}

async function filhoCanAccessTenant(
  supabaseAdmin: SupabaseClient,
  child: { lider_id?: string | null; tenant_id?: string | null },
  tid: string
): Promise<boolean> {
  const houseRefs = new Set<string>();
  for (const raw of [child.lider_id, child.tenant_id]) {
    if (!raw) continue;
    const s = String(raw).trim();
    if (!s) continue;
    houseRefs.add(s);
    houseRefs.add(await resolveLeaderId(supabaseAdmin, s));
  }
  const requestedLeader = await resolveLeaderId(supabaseAdmin, tid);
  return houseRefs.has(tid) || houseRefs.has(requestedLeader);
}

export async function resolveTenantAccessForUser(
  supabaseAdmin: SupabaseClient,
  userId: string
): Promise<{ tenantId: string; isGlobalAdmin: boolean; role: "admin" | "filho" }> {
  const { data: child } = await supabaseAdmin
    .from("filhos_de_santo")
    .select("tenant_id, lider_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (child) {
    const childTenant = String(child.tenant_id || child.lider_id || "").trim();
    return { tenantId: childTenant, isGlobalAdmin: false, role: "filho" };
  }

  const { data: profile } = await supabaseAdmin
    .from("perfil_lider")
    .select("id, tenant_id, is_admin_global")
    .eq("id", userId)
    .maybeSingle();

  const profileTenant = String(profile?.tenant_id || profile?.id || "").trim();
  if (profileTenant) {
    return {
      tenantId: profileTenant,
      isGlobalAdmin: !!profile?.is_admin_global,
      role: "admin",
    };
  }

  return { tenantId: "", isGlobalAdmin: false, role: "filho" };
}

export async function assertZeladorTenantAccess(
  supabaseAdmin: SupabaseClient,
  userId: string,
  tenantId: string
): Promise<boolean> {
  const { data: prof } = await supabaseAdmin
    .from("perfil_lider")
    .select("id, tenant_id")
    .eq("id", userId)
    .maybeSingle();
  if (!prof) return false;
  const a = await resolveLeaderId(supabaseAdmin, tenantId);
  const b = await resolveLeaderId(supabaseAdmin, String(prof.tenant_id || prof.id));
  return a === b;
}

export async function assertUserCanAccessTenant(
  supabaseAdmin: SupabaseClient,
  user: { id: string; email?: string | null },
  tenantId: string
): Promise<boolean> {
  const tid = normalizeQueryTenantId(tenantId);
  if (!tid || !isValidUuid(tid)) return false;

  if (await isConsoleGlobalAdmin(supabaseAdmin, user)) return true;

  // Filho tem prioridade — shadow users podem ter perfil_lider fantasma ("Meu Terreiro").
  const child = await loadFilhoHouseRefs(supabaseAdmin, user);
  if (child) {
    return filhoCanAccessTenant(supabaseAdmin, child, tid);
  }

  const { data: profile } = await supabaseAdmin
    .from("perfil_lider")
    .select("id, tenant_id, is_admin_global")
    .eq("id", user.id)
    .maybeSingle();

  if (profile) {
    const requested = await resolveLeaderId(supabaseAdmin, tid);
    const owned = await resolveLeaderId(supabaseAdmin, String(profile.tenant_id || profile.id));
    return requested === owned;
  }

  return false;
}

/**
 * Resolve tenant efetivo para rotas financeiras/children.
 * Nunca confia cegamente em tenantId da query — valida posse via JWT user.
 */
export async function resolveFinanceiroTenantScope(
  supabaseAdmin: SupabaseClient,
  authenticatedUserId: string,
  userRole: string | undefined,
  tenantFromQuery: string
): Promise<string> {
  const q = normalizeQueryTenantId(tenantFromQuery);
  const role = String(userRole || "").toLowerCase();

  let ownTenant = "";

  const { data: child } = await supabaseAdmin
    .from("filhos_de_santo")
    .select("lider_id, tenant_id")
    .eq("user_id", authenticatedUserId)
    .maybeSingle();

  if (child || role === "filho") {
    const ref = String(child?.lider_id || child?.tenant_id || "").trim();
    if (ref) {
      const { data: leader } = await supabaseAdmin
        .from("perfil_lider")
        .select("tenant_id, id")
        .eq("id", ref)
        .maybeSingle();
      ownTenant =
        String(leader?.tenant_id || "").trim() ||
        String(leader?.id || "").trim() ||
        String(child?.tenant_id || "").trim();
    }
  } else {
    const { data: profile } = await supabaseAdmin
      .from("perfil_lider")
      .select("tenant_id, id")
      .eq("id", authenticatedUserId)
      .maybeSingle();

    const fromProfile = String(profile?.tenant_id || "").trim();
    if (fromProfile) {
      ownTenant = fromProfile;
    } else if (profile?.id) {
      ownTenant = String(profile.id).trim();
    }
  }

  if (q) {
    const ok = await assertUserCanAccessTenant(supabaseAdmin, { id: authenticatedUserId }, q);
    return ok ? q : "";
  }

  return ownTenant;
}

/** Campos permitidos em PUT /api/children/:id */
export const ALLOWED_CHILD_UPDATE_FIELDS = new Set([
  "nome",
  "email",
  "whatsapp_phone",
  "cpf",
  "data_nascimento",
  "data_entrada",
  "grau",
  "orixa",
  "cargo",
  "observacoes",
  "foto_url",
  "endereco",
  "cidade",
  "estado",
  "cep",
  "status",
]);

export function pickAllowedChildFields(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body || {})) {
    if (ALLOWED_CHILD_UPDATE_FIELDS.has(k)) out[k] = v;
  }
  return out;
}

const OBRIGACAO_PDF_PATH_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/obrigacoes\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/.+/i;

/** Valida acesso a PDFs privados de obrigação (zelador do tenant ou o próprio filho). */
export async function assertObrigacaoPdfStorageAccess(
  supabaseAdmin: SupabaseClient,
  user: { id: string; email?: string | null },
  tenantId: string,
  normalizedPath: string
): Promise<boolean> {
  const tid = normalizeQueryTenantId(tenantId);
  const path = String(normalizedPath || "").replace(/\\/g, "/");
  if (!tid || !path.startsWith(`${tid}/`) || !OBRIGACAO_PDF_PATH_RE.test(path)) {
    return false;
  }

  const childIdMatch = path.match(/\/obrigacoes\/([^/]+)\//i);
  const pathChildId = childIdMatch?.[1];
  if (!pathChildId || !isValidUuid(pathChildId)) return false;

  if (await assertZeladorTenantAccess(supabaseAdmin, user.id, tid)) return true;

  const { data: filho } = await supabaseAdmin
    .from("filhos_de_santo")
    .select("id, tenant_id, lider_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!filho?.id || String(filho.id) !== pathChildId) return false;

  return filhoCanAccessTenant(supabaseAdmin, filho, tid);
}
