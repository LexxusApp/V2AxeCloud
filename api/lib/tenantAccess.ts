import type { SupabaseClient } from "@supabase/supabase-js";
import { isConsoleGlobalAdmin } from "./consoleAdmin.js";
import { resolveFilhoRowIdForFinance } from "./resolveFilhoRowIdForFinance.js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type FilhoHouseRefs = {
  id?: string | null;
  user_id?: string | null;
  lider_id?: string | null;
  tenant_id?: string | null;
};

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
  return (
    (e.startsWith("f_") && e.endsWith("@axecloud.internal")) ||
    (e.startsWith("filho_") && e.endsWith("@axecloud.com"))
  );
}

const SHADOW_EMAIL_F = /^f_([0-9a-f-]{36})@axecloud\.internal$/i;
const SHADOW_EMAIL_FILHO = /^filho_([0-9a-f-]+)@axecloud\.com$/i;

async function filhoHouseRefsById(
  supabaseAdmin: SupabaseClient,
  filhoId: string
): Promise<FilhoHouseRefs | null> {
  const id = String(filhoId || "").trim();
  if (!id) return null;
  const { data: exact } = await supabaseAdmin
    .from("filhos_de_santo")
    .select("id, user_id, lider_id, tenant_id")
    .eq("id", id)
    .maybeSingle();
  if (exact) return exact;
  if (id.length >= 8 && id.length < 36) {
    const { data: rows } = await supabaseAdmin
      .from("filhos_de_santo")
      .select("id, user_id, lider_id, tenant_id")
      .ilike("id", `${id}%`)
      .limit(2);
    if (rows?.length === 1) return rows[0] as FilhoHouseRefs;
  }
  return null;
}

async function loadFilhoHouseRefs(
  supabaseAdmin: SupabaseClient,
  user: { id: string; email?: string | null }
): Promise<FilhoHouseRefs | null> {
  const { data: child } = await supabaseAdmin
    .from("filhos_de_santo")
    .select("id, user_id, lider_id, tenant_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (child) return child;

  const email = String(user.email || "").trim().toLowerCase();
  const shadowF = email.match(SHADOW_EMAIL_F);
  if (shadowF?.[1]) {
    const byShadow = await filhoHouseRefsById(supabaseAdmin, shadowF[1]);
    if (byShadow) return byShadow;
  }
  const shadowFilho = email.match(SHADOW_EMAIL_FILHO);
  if (shadowFilho?.[1]) {
    const byShadow = await filhoHouseRefsById(supabaseAdmin, shadowFilho[1]);
    if (byShadow) return byShadow;
  }

  if (email && !SHADOW_EMAIL_F.test(email) && !SHADOW_EMAIL_FILHO.test(email)) {
    const { data: byEmail } = await supabaseAdmin
      .from("filhos_de_santo")
      .select("lider_id, tenant_id")
      .eq("email", email)
      .maybeSingle();
    if (byEmail) return byEmail;
  }

  return null;
}

/** Resolve vínculo do filho (user_id, e-mail real ou sombra) com fallback ao Auth Admin. */
async function resolveFilhoHouseRefs(
  supabaseAdmin: SupabaseClient,
  user: { id: string; email?: string | null }
): Promise<FilhoHouseRefs | null> {
  let refs = await loadFilhoHouseRefs(supabaseAdmin, user);
  if (refs || user.email) return refs;
  try {
    const { data } = await supabaseAdmin.auth.admin.getUserById(user.id);
    const email = data?.user?.email;
    if (!email) return null;
    return loadFilhoHouseRefs(supabaseAdmin, { id: user.id, email });
  } catch {
    return null;
  }
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
  userId: string,
  userEmail?: string | null
): Promise<{ tenantId: string; isGlobalAdmin: boolean; role: "admin" | "filho" }> {
  const child = await resolveFilhoHouseRefs(supabaseAdmin, { id: userId, email: userEmail });
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

/** Zelador do tenant ou admin global (filhos retornam false). */
export async function assertZeladorOrGlobalAdmin(
  supabaseAdmin: SupabaseClient,
  user: { id: string; email?: string | null },
  tenantId: string
): Promise<boolean> {
  if (await isConsoleGlobalAdmin(supabaseAdmin, user)) return true;
  return assertZeladorTenantAccess(supabaseAdmin, user.id, tenantId);
}

/** Retorna o registro filhos_de_santo do usuário autenticado, se for filho. */
export async function resolveAuthenticatedFilho(
  supabaseAdmin: SupabaseClient,
  userId: string
): Promise<{ id: string; user_id?: string | null; tenant_id?: string | null; lider_id?: string | null } | null> {
  const filho = await resolveFilhoHouseRefs(supabaseAdmin, { id: userId });
  if (!filho?.id) return null;
  return { ...filho, id: String(filho.id) };
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
  const child = await resolveFilhoHouseRefs(supabaseAdmin, user);
  if (child) {
    // Cache legado do login às vezes grava o auth user id do filho como tenantId.
    if (tid === String(user.id || "").trim()) {
      const houseId = String(child.lider_id || child.tenant_id || "").trim();
      if (houseId) return filhoCanAccessTenant(supabaseAdmin, child, houseId);
    }
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

/** Corrige tenantId da query quando filho envia o próprio auth user id por cache legado. */
export async function normalizeFilhoRequestTenantId(
  supabaseAdmin: SupabaseClient,
  user: { id: string; email?: string | null },
  tenantId: string
): Promise<string> {
  const tid = normalizeQueryTenantId(tenantId);
  if (!tid) return "";
  if (tid !== String(user.id || "").trim()) return tid;
  const child = await resolveFilhoHouseRefs(supabaseAdmin, user);
  if (!child) return tid;
  return String(child.lider_id || child.tenant_id || "").trim() || tid;
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

  const child = await resolveFilhoHouseRefs(supabaseAdmin, { id: authenticatedUserId });

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

/** Campos persistíveis em filhos_de_santo (POST/PUT /api/children). */
export const ALLOWED_CHILD_UPDATE_FIELDS = new Set([
  "nome",
  "email",
  "whatsapp_phone",
  "cpf",
  "data_nascimento",
  "data_entrada",
  "data_feitura",
  "orixa_frente",
  "cargo",
  "foto_url",
  "endereco",
  "adjunto",
  "status",
  "quizilas",
  "notas_sigilosas",
]);

const CHILD_DATE_FIELDS = new Set(["data_nascimento", "data_entrada", "data_feitura"]);

/** Normaliza payload do prontuário (aliases da UI + tipos para Postgres). */
export function normalizeChildPayload(body: Record<string, unknown>): Record<string, unknown> {
  const raw: Record<string, unknown> = { ...(body || {}) };

  if (raw.contato != null && raw.whatsapp_phone == null) {
    raw.whatsapp_phone = raw.contato;
  }
  if (raw.orixa != null && raw.orixa_frente == null) {
    raw.orixa_frente = raw.orixa;
  }

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!ALLOWED_CHILD_UPDATE_FIELDS.has(key)) continue;

    if (CHILD_DATE_FIELDS.has(key)) {
      out[key] = value === "" || value == null ? null : value;
      continue;
    }

    if (key === "quizilas") {
      if (Array.isArray(value)) {
        out[key] = value.map((q) => String(q).trim()).filter(Boolean);
      } else if (typeof value === "string") {
        out[key] = value
          .split(",")
          .map((q) => q.trim())
          .filter(Boolean);
      } else if (value == null) {
        out[key] = null;
      }
      continue;
    }

    if (key === "whatsapp_phone" && typeof value === "string") {
      const digits = value.replace(/\D/g, "");
      out[key] = digits.length > 0 ? digits : null;
      continue;
    }

    out[key] = value;
  }

  return out;
}

/** @deprecated Use normalizeChildPayload */
export function pickAllowedChildFields(body: Record<string, unknown>): Record<string, unknown> {
  return normalizeChildPayload(body);
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

  const filhoId = await resolveFilhoRowIdForFinance(supabaseAdmin, {
    jwtUserId: user.id,
    jwtEmail: user.email,
  });
  if (!filhoId || filhoId !== pathChildId) return false;

  const filhoRefs = await resolveFilhoHouseRefs(supabaseAdmin, user);
  if (!filhoRefs) return false;
  return filhoCanAccessTenant(supabaseAdmin, filhoRefs, tid);
}
