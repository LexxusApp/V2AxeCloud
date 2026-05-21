import { ListObjectsV2Command, type S3Client } from "@aws-sdk/client-s3";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { logEvent } from "./auditLog.js";

type R2Ctx = { client: S3Client; bucket: string } | null;

export async function runTenantDetail(
  supabaseAdmin: SupabaseClient,
  r2: R2Ctx,
  tenantId: string
): Promise<Record<string, unknown>> {
  const id = String(tenantId || "").trim();
  if (!id) throw new Error("id obrigatório");

  const [profileRes, subRes, authUser, childrenRes] = await Promise.all([
    supabaseAdmin
      .from("perfil_lider")
      .select(
        "id, tenant_id, email, nome_terreiro, cargo, role, is_admin_global, is_blocked, deleted_at, foto_url, updated_at"
      )
      .eq("id", id)
      .maybeSingle(),
    supabaseAdmin.from("subscriptions").select("id, plan, status, expires_at").eq("id", id).maybeSingle(),
    supabaseAdmin.auth.admin.getUserById(id).catch(() => ({ data: { user: null }, error: null })),
    supabaseAdmin
      .from("filhos_de_santo")
      .select("id, nome, status, cargo, foto_url, data_entrada")
      .or(`lider_id.eq.${id},tenant_id.eq.${id}`)
      .limit(500),
  ]);

  if (profileRes.error) throw profileRes.error;
  if (subRes.error) throw subRes.error;
  if (childrenRes.error) throw childrenRes.error;

  const profile = profileRes.data;
  const sub = subRes.data;
  const authMeta = authUser.data?.user ?? null;
  const children = childrenRes.data || [];

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

  return {
    profile: profile
      ? {
          id: profile.id,
          tenant_id: profile.tenant_id,
          email: profile.email,
          nome_terreiro: profile.nome_terreiro,
          cargo: profile.cargo,
          role: profile.role,
          is_admin_global: profile.is_admin_global,
          is_blocked: profile.is_blocked,
          deleted_at: profile.deleted_at,
          foto_url: profile.foto_url,
          updated_at: profile.updated_at,
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

  const bytes = new Uint8Array(8);
  try {
    (globalThis as { crypto?: { getRandomValues: (a: Uint8Array) => void } }).crypto?.getRandomValues(bytes);
  } catch {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  const newPassword = Array.from(bytes, (b) => String((b ?? 0) % 10)).join("");

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
