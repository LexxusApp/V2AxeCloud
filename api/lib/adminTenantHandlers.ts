import { ListObjectsV2Command, type S3Client } from "@aws-sdk/client-s3";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { logEvent } from "./auditLog.js";
import { generateSecureAccessPassword } from "./accessPassword.js";
import {
  dispatchZeladorWelcomeWhatsApp,
  loadWelcomeMessageConfig,
  normalizeBrazilMsisdn,
  renderWelcomeMessage,
} from "./welcomeMessage.js";

type R2Ctx = { client: S3Client; bucket: string } | null;

async function bestEffort<T>(request: PromiseLike<T>): Promise<T | null> {
  try {
    return await request;
  } catch {
    return null;
  }
}

function pickWhatsappCandidate(...candidates: unknown[]): string {
  for (const raw of candidates) {
    const s = String(raw ?? "").trim();
    if (!s) continue;
    const digits = s.replace(/\D/g, "");
    if (digits.length >= 8) return s;
  }
  return "";
}

function metaWhatsapp(meta: Record<string, unknown> | null | undefined): string {
  if (!meta || typeof meta !== "object") return "";
  return pickWhatsappCandidate(
    meta.whatsapp,
    meta.telefone,
    meta.phone,
    meta.celular,
    meta.whatsapp_publico,
    meta.whatsappPublico
  );
}

export async function runTenantDetail(
  supabaseAdmin: SupabaseClient,
  r2: R2Ctx,
  tenantId: string
): Promise<Record<string, unknown>> {
  const id = String(tenantId || "").trim();
  if (!id) throw new Error("id obrigatório");

  const profileSelectFull =
    "id, tenant_id, email, nome_terreiro, cargo, role, is_admin_global, is_blocked, deleted_at, foto_url, updated_at, whatsapp_publico, zelador";
  const profileSelectBase =
    "id, tenant_id, email, nome_terreiro, cargo, role, is_admin_global, is_blocked, deleted_at, foto_url, updated_at";

  let profileRes = await supabaseAdmin
    .from("perfil_lider")
    .select(profileSelectFull)
    .eq("id", id)
    .maybeSingle();
  if (profileRes.error) {
    const msg = String(profileRes.error.message || "").toLowerCase();
    if (msg.includes("whatsapp_publico") || msg.includes("zelador") || msg.includes("column")) {
      profileRes = await supabaseAdmin
        .from("perfil_lider")
        .select(profileSelectBase)
        .eq("id", id)
        .maybeSingle();
    }
  }

  const [subRes, authUser, childrenRes, lastAccessRes, lastWaRes] = await Promise.all([
    supabaseAdmin.from("subscriptions").select("id, plan, status, expires_at").eq("id", id).maybeSingle(),
    supabaseAdmin.auth.admin.getUserById(id).catch(() => ({ data: { user: null }, error: null })),
    supabaseAdmin
      .from("filhos_de_santo")
      .select("id, nome, status, cargo, foto_url, data_entrada")
      .or(`lider_id.eq.${id},tenant_id.eq.${id}`)
      .limit(500),
    bestEffort(supabaseAdmin
      .from("access_logs")
      .select("created_at, event_type, description")
      .or(`user_id.eq.${id},tenant_id.eq.${id}`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()),
    bestEffort(supabaseAdmin
      .from("whatsapp_logs")
      .select("created_at, tipo, telefone")
      .eq("tenant_id", id)
      .order("created_at", { ascending: false })
      .limit(5)),
  ]);

  if (profileRes.error) throw profileRes.error;
  if (subRes.error) throw subRes.error;
  if (childrenRes.error) throw childrenRes.error;

  const profile = profileRes.data as Record<string, unknown> | null;
  const sub = subRes.data;
  const authMeta = authUser.data?.user ?? null;
  const children = childrenRes.data || [];
  const lastAccess = (lastAccessRes as { data?: { created_at?: string; event_type?: string; description?: string } | null })
    ?.data;
  const waRows = Array.isArray((lastWaRes as { data?: unknown })?.data)
    ? ((lastWaRes as { data: { created_at?: string; tipo?: string; telefone?: string }[] }).data)
    : (lastWaRes as { data?: { created_at?: string; tipo?: string; telefone?: string } | null })?.data
      ? [((lastWaRes as { data: { created_at?: string; tipo?: string; telefone?: string } }).data)]
      : [];
  const lastWa = waRows[0] || null;
  const waLogPhone = pickWhatsappCandidate(...waRows.map((r) => r?.telefone));

  const meta = (authMeta?.user_metadata || {}) as Record<string, unknown>;
  const whatsapp = pickWhatsappCandidate(
    metaWhatsapp(meta),
    profile?.whatsapp_publico,
    authMeta?.phone,
    waLogPhone
  );

  // Backfill perfil when we found a number only in auth/logs (best-effort, non-blocking).
  if (whatsapp && !String(profile?.whatsapp_publico || "").trim()) {
    const digits = whatsapp.replace(/\D/g, "").slice(0, 15);
    if (digits.length >= 8) {
      void bestEffort(supabaseAdmin
        .from("perfil_lider")
        .update({ whatsapp_publico: digits, updated_at: new Date().toISOString() })
        .eq("id", id));
    }
  }

  const lastSignIn = authMeta?.last_sign_in_at ? String(authMeta.last_sign_in_at) : null;
  const lastActivityAt = lastAccess?.created_at
    ? String(lastAccess.created_at)
    : lastWa?.created_at
      ? String(lastWa.created_at)
      : lastSignIn;

  let storage: {
    configured: boolean;
    objects?: number;
    bytes?: number;
    mb?: number;
    truncated?: boolean;
  } = { configured: false };

  if (r2?.client && r2.bucket) {
    try {
      let objects = 0;
      let bytes = 0;
      let token: string | undefined;
      let truncated = false;
      const prefix = `${id}/`;
      const HARD_CAP = 5000;
      do {
        const out = await r2.client.send(
          new ListObjectsV2Command({
            Bucket: r2.bucket,
            Prefix: prefix,
            MaxKeys: 1000,
            ContinuationToken: token,
          })
        );
        for (const o of out.Contents || []) {
          objects += 1;
          bytes += o.Size || 0;
          if (objects >= HARD_CAP) {
            truncated = !!out.IsTruncated;
            break;
          }
        }
        if (objects >= HARD_CAP) break;
        token = out.IsTruncated ? out.NextContinuationToken : undefined;
        if (!token) break;
      } while (true);
      storage = {
        configured: true,
        objects,
        bytes,
        mb: Math.round((bytes / (1024 * 1024)) * 100) / 100,
        truncated,
      };
    } catch (storageErr: unknown) {
      console.warn("[adminTenant] storage:", storageErr);
      storage = { configured: true, objects: 0, bytes: 0, mb: 0 };
    }
  }

  const nomeZelador = String(
    meta.nome_zelador || meta.nomeZelador || profile?.zelador || profile?.cargo || ""
  ).trim();

  return {
    profile: profile
      ? {
          id: profile.id,
          tenant_id: profile.tenant_id,
          email: profile.email,
          nome_terreiro: profile.nome_terreiro,
          cargo: profile.cargo,
          zelador: profile.zelador || nomeZelador || null,
          role: profile.role,
          is_admin_global: profile.is_admin_global,
          is_blocked: profile.is_blocked,
          deleted_at: profile.deleted_at,
          foto_url: profile.foto_url,
          updated_at: profile.updated_at,
          whatsapp_publico: whatsapp || profile.whatsapp_publico || null,
        }
      : null,
    auth: authMeta
      ? {
          id: authMeta.id,
          email: authMeta.email,
          phone: authMeta.phone,
          created_at: authMeta.created_at,
          last_sign_in_at: authMeta.last_sign_in_at,
          user_metadata: authMeta.user_metadata || {},
        }
      : null,
    contact: {
      whatsapp: whatsapp || null,
      phone: authMeta?.phone || null,
      nome_zelador: nomeZelador || null,
      source: whatsapp
        ? metaWhatsapp(meta)
          ? "auth_metadata"
          : profile?.whatsapp_publico
            ? "perfil"
            : authMeta?.phone
              ? "auth_phone"
              : waLogPhone
                ? "whatsapp_logs"
                : "unknown"
        : null,
    },
    activity: {
      last_sign_in_at: lastSignIn,
      last_activity_at: lastActivityAt,
      last_activity_type: lastAccess?.event_type
        ? String(lastAccess.event_type)
        : lastWa?.tipo
          ? `wa.${lastWa.tipo}`
          : lastSignIn
            ? "auth.sign_in"
            : null,
      last_whatsapp_at: lastWa?.created_at ? String(lastWa.created_at) : null,
      last_whatsapp_tipo: lastWa?.tipo ? String(lastWa.tipo) : null,
    },
    subscription: sub
      ? {
          plan: sub.plan,
          status: sub.status,
          expires_at: sub.expires_at,
        }
      : null,
    childrenCount: children.length,
    children: children.slice(0, 50),
    storage,
  };
}

export async function runTenantSetRole(
  supabaseAdmin: SupabaseClient,
  user: User,
  req: any,
  tenantId: string,
  body: { role?: string }
): Promise<{ ok: boolean; role: string }> {
  const id = String(tenantId || "").trim();
  const rawRole = String(body.role || "").toLowerCase().trim();
  const role = rawRole === "filho" ? "filho" : "admin";
  if (!id) throw new Error("id obrigatório");

  const { data, error } = await supabaseAdmin
    .from("perfil_lider")
    .update({ role, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id, role")
    .single();
  if (error) throw error;

  void logEvent(supabaseAdmin, {
    eventType: "tenant.role-set",
    userId: user.id,
    userEmail: user.email,
    targetType: "tenant",
    targetId: id,
    description: `Role definido como ${role}.`,
    metadata: { role },
    req,
  });

  return { ok: true, role: data?.role || role };
}

export async function runTenantResetPassword(
  supabaseAdmin: SupabaseClient,
  user: User,
  req: any,
  tenantId: string
): Promise<{ success: boolean; password: string }> {
  const id = String(tenantId || "").trim();
  if (!id) throw new Error("id obrigatório");

  const newPassword = generateSecureAccessPassword();

  const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(id, {
    password: newPassword,
  });
  if (updErr) throw updErr;

  void logEvent(supabaseAdmin, {
    eventType: "tenant.password-reset",
    userId: user.id,
    userEmail: user.email,
    targetType: "tenant",
    targetId: id,
    tenantId: id,
    description: `Senha do terreiro ${id} redefinida pelo admin.`,
    req,
  });

  return { success: true, password: newPassword };
}

export async function runTenantSendAccessData(
  supabaseAdmin: SupabaseClient,
  user: User,
  req: any,
  tenantId: string
): Promise<{ success: boolean; queued: boolean; phone: string }> {
  const id = String(tenantId || "").trim();
  if (!id) throw new Error("id obrigatorio");

  const [{ data: authData, error: authErr }, { data: profile, error: profileErr }] = await Promise.all([
    supabaseAdmin.auth.admin.getUserById(id),
    supabaseAdmin
      .from("perfil_lider")
      .select("id, email, nome_terreiro, cargo, whatsapp_publico")
      .eq("id", id)
      .maybeSingle(),
  ]);

  if (authErr) throw authErr;
  if (profileErr) throw profileErr;

  const targetUser = authData.user;
  if (!targetUser) throw new Error("Zelador nao encontrado no Auth.");

  const meta = (targetUser.user_metadata || {}) as Record<string, unknown>;
  const email = String(targetUser.email || profile?.email || "").trim().toLowerCase();
  const nomeTerreiro = String(profile?.nome_terreiro || meta.nome_terreiro || "").trim();
  const nomeZelador = String(profile?.cargo || meta.nome_zelador || "").trim();
  const rawWhatsapp = pickWhatsappCandidate(
    metaWhatsapp((targetUser.user_metadata || {}) as Record<string, unknown>),
    profile?.whatsapp_publico,
    targetUser.phone
  );
  const msisdn = normalizeBrazilMsisdn(rawWhatsapp);

  if (!email) throw new Error("E-mail do zelador nao encontrado.");
  if (!msisdn) throw new Error("WhatsApp do zelador nao encontrado ou invalido.");

  const newPassword = generateSecureAccessPassword();
  const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(id, {
    password: newPassword,
  });
  if (updErr) throw updErr;

  const cfg = await loadWelcomeMessageConfig(supabaseAdmin);
  const text = renderWelcomeMessage(cfg.template, {
    nome_terreiro: nomeTerreiro,
    nome_zelador: nomeZelador,
    email,
    senha: newPassword,
    site: cfg.loginUrl,
    assinatura: cfg.signature,
  });

  await dispatchZeladorWelcomeWhatsApp({
    msisdn,
    freeText: text,
    nome_zelador: nomeZelador,
    nome_terreiro: nomeTerreiro,
    email,
    senha: newPassword,
    site: cfg.loginUrl,
  });

  void logEvent(supabaseAdmin, {
    eventType: "tenant.access-data-sent",
    userId: user.id,
    userEmail: user.email,
    targetType: "tenant",
    targetId: id,
    tenantId: id,
    description: `Dados de acesso do terreiro ${id} enviados por WhatsApp pelo admin.`,
    metadata: {
      email,
      nome_terreiro: nomeTerreiro,
      phone: `${msisdn.slice(0, 4)}...`,
      passwordReset: true,
    },
    req,
  });

  return { success: true, queued: true, phone: msisdn };
}
