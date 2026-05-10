import type { SupabaseClient } from "@supabase/supabase-js";
import type { S3Client } from "@aws-sdk/client-s3";
import { DeleteObjectsCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";

/** Mesmo UUID usado em `settings/save` para tenant compartilhado de super-admin. */
export const SHARED_GLOBAL_TENANT_ID = "6588b6c9-ce84-4140-a69a-f487a0c61dab";

export type PermanentDeleteOptions = {
  supabaseAdmin: SupabaseClient;
  /** Galeria em R2: apaga objetos sob prefixos do terreiro. */
  r2?: { client: S3Client; bucket: string };
  /** Ex.: logout na Evolution antes de apagar linhas no Postgres. */
  beforeDbPurge?: (leaderId: string) => Promise<void>;
};

function isUuidLike(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

async function deleteR2Prefix(r2: { client: S3Client; bucket: string }, prefix: string): Promise<void> {
  const p = prefix.replace(/^\/+/, "");
  if (!p) return;
  let token: string | undefined;
  do {
    const out = await r2.client.send(
      new ListObjectsV2Command({
        Bucket: r2.bucket,
        Prefix: p,
        ContinuationToken: token,
      })
    );
    const keys = (out.Contents || []).map((c) => c.Key).filter((k): k is string => !!k);
    if (keys.length) {
      await r2.client.send(
        new DeleteObjectsCommand({
          Bucket: r2.bucket,
          Delete: { Objects: keys.map((Key) => ({ Key })) },
        })
      );
    }
    token = out.IsTruncated ? out.NextContinuationToken : undefined;
  } while (token);
}

async function removeStorageFolderRecursive(
  admin: SupabaseClient,
  bucket: string,
  folder: string
): Promise<void> {
  const { data: items, error } = await admin.storage.from(bucket).list(folder, { limit: 500 });
  if (error || !items?.length) return;
  const files: string[] = [];
  for (const item of items) {
    const path = folder ? `${folder}/${item.name}` : item.name;
    if (item.id) files.push(path);
    else await removeStorageFolderRecursive(admin, bucket, path);
  }
  if (files.length) {
    await admin.storage.from(bucket).remove(files);
  }
}

function tenantScopeOr(leaderId: string, tenantScope: string): string {
  const a = leaderId.trim();
  const b = tenantScope.trim();
  if (a === b) return `tenant_id.eq.${a},lider_id.eq.${a}`;
  return `tenant_id.eq.${a},tenant_id.eq.${b},lider_id.eq.${a},lider_id.eq.${b}`;
}

export async function permanentDeleteZeladorAccount(
  opts: PermanentDeleteOptions,
  leaderAuthUserId: string
): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  const admin = opts.supabaseAdmin;
  const uid = String(leaderAuthUserId || "").trim();
  if (!isUuidLike(uid)) {
    return { ok: false, status: 400, message: "Identificador de conta inválido." };
  }

  const { data: profile, error: profileErr } = await admin
    .from("perfil_lider")
    .select("id, tenant_id, role, is_admin_global, email")
    .eq("id", uid)
    .maybeSingle();

  if (profileErr) {
    return { ok: false, status: 500, message: profileErr.message || "Erro ao ler perfil." };
  }
  if (!profile) {
    return { ok: false, status: 404, message: "Perfil não encontrado." };
  }

  const role = String((profile as { role?: string }).role || "").toLowerCase();
  if (role === "filho") {
    return { ok: false, status: 403, message: "Esta ação só está disponível para o zelador do terreiro." };
  }

  if ((profile as { is_admin_global?: boolean }).is_admin_global) {
    return {
      ok: false,
      status: 403,
      message: "Contas de administrador global não podem ser excluídas por este fluxo.",
    };
  }

  const tenantScope = String((profile as { tenant_id?: string | null }).tenant_id || uid).trim();
  if (tenantScope === SHARED_GLOBAL_TENANT_ID) {
    return {
      ok: false,
      status: 403,
      message: "Conta vinculada ao ambiente compartilhado não pode ser excluída automaticamente.",
    };
  }

  const leaderId = String((profile as { id: string }).id).trim();

  try {
    await opts.beforeDbPurge?.(leaderId);
  } catch (e) {
    console.warn("[permanent-delete] beforeDbPurge:", e);
  }

  const { data: filhosRows, error: filhosErr } = await admin
    .from("filhos_de_santo")
    .select("id, user_id")
    .or(tenantScopeOr(leaderId, tenantScope));
  if (filhosErr) {
    return { ok: false, status: 500, message: filhosErr.message || "Erro ao listar filhos de santo." };
  }

  const childAuthIds = [
    ...new Set(
      (filhosRows || [])
        .map((r: { user_id?: string | null }) => String(r.user_id || "").trim())
        .filter((id) => id && id !== leaderId && isUuidLike(id))
    ),
  ];

  const allAuthIds = [leaderId, ...childAuthIds];

  if (opts.r2) {
    try {
      await deleteR2Prefix(opts.r2, `${tenantScope}/`);
      if (tenantScope !== leaderId) await deleteR2Prefix(opts.r2, `${leaderId}/`);
    } catch (e) {
      console.warn("[permanent-delete] R2 purge:", e);
    }
  }

  const { data: bibRows } = await admin
    .from("biblioteca")
    .select("id, storage_path")
    .or(`tenant_id.eq.${tenantScope},tenant_id.eq.${leaderId}`);
  const paths = (bibRows || [])
    .map((r: { storage_path?: string | null }) => String(r.storage_path || "").trim())
    .filter(Boolean);
  if (paths.length) {
    const { error: rmLib } = await admin.storage.from("biblioteca_estudos").remove(paths);
    if (rmLib) console.warn("[permanent-delete] biblioteca_estudos remove:", rmLib.message);
  }

  const { error: comDelErr } = await admin
    .from("biblioteca_comentarios")
    .delete()
    .or(`tenant_id.eq.${tenantScope},tenant_id.eq.${leaderId}`);
  if (comDelErr) console.warn("[permanent-delete] biblioteca_comentarios:", comDelErr.message);

  const { error: bErr } = await admin.from("biblioteca").delete().or(`tenant_id.eq.${tenantScope},tenant_id.eq.${leaderId}`);
  if (bErr) return { ok: false, status: 500, message: `biblioteca: ${bErr.message}` };

  const { data: events } = await admin
    .from("calendario_axe")
    .select("id")
    .or(tenantScopeOr(leaderId, tenantScope));
  const eventIds = (events || []).map((e: { id: string }) => e.id).filter(Boolean);
  if (eventIds.length) {
    const { error: ce } = await admin.from("convidados_eventos").delete().in("event_id", eventIds);
    if (ce) console.warn("[permanent-delete] convidados_eventos:", ce.message);
    const { error: rt } = await admin.from("ritual_tasks").delete().in("event_id", eventIds);
    if (rt) console.warn("[permanent-delete] ritual_tasks:", rt.message);
  }

  const { error: calErr } = await admin.from("calendario_axe").delete().or(tenantScopeOr(leaderId, tenantScope));
  if (calErr) return { ok: false, status: 500, message: `calendario_axe: ${calErr.message}` };

  const { error: galErr } = await admin.from("gallery_albums").delete().or(`tenant_id.eq.${tenantScope},tenant_id.eq.${leaderId}`);
  if (galErr) console.warn("[permanent-delete] gallery_albums:", galErr.message);

  const delOrIgnore = async (table: string, fn: (q: any) => any) => {
    const { error } = await fn(admin.from(table));
    if (error && error.code !== "42P01" && error.code !== "PGRST116") {
      console.warn(`[permanent-delete] ${table}:`, error.message);
    }
  };

  await delOrIgnore("notificacoes", (q) => q.delete().or(`tenant_id.eq.${tenantScope},tenant_id.eq.${leaderId}`));
  await delOrIgnore("mural_avisos", (q) => q.delete().or(`tenant_id.eq.${tenantScope},tenant_id.eq.${leaderId}`));
  await delOrIgnore("push_subscriptions", (q) =>
    q.delete().or(`tenant_id.eq.${tenantScope},tenant_id.eq.${leaderId}`)
  );
  if (allAuthIds.length) {
    const { error: psU } = await admin.from("push_subscriptions").delete().in("user_id", allAuthIds);
    if (psU) console.warn("[permanent-delete] push_subscriptions by user:", psU.message);
  }

  const { error: alErr } = await admin.from("access_logs").delete().in("user_id", allAuthIds);
  if (alErr) console.warn("[permanent-delete] access_logs:", alErr.message);

  await delOrIgnore("whatsapp_logs", (q) => q.delete().or(`tenant_id.eq.${leaderId},tenant_id.eq.${tenantScope}`));
  await delOrIgnore("whatsapp_config", (q) => q.delete().or(`tenant_id.eq.${leaderId},tenant_id.eq.${tenantScope},id.eq.${leaderId}`));

  await delOrIgnore("loja_pedidos", (q) => q.delete().or(`tenant_id.eq.${tenantScope},tenant_id.eq.${leaderId}`));
  await delOrIgnore("produtos", (q) => q.delete().or(`tenant_id.eq.${tenantScope},tenant_id.eq.${leaderId}`));
  await delOrIgnore("almoxarifado", (q) => q.delete().or(tenantScopeOr(leaderId, tenantScope)));

  await delOrIgnore("caixinha_doacoes", (q) => q.delete().or(`tenant_id.eq.${tenantScope},tenant_id.eq.${leaderId}`));
  await delOrIgnore("caixinha_metas", (q) => q.delete().or(`tenant_id.eq.${tenantScope},tenant_id.eq.${leaderId}`));

  const { error: finErr } = await admin.from("financeiro").delete().or(tenantScopeOr(leaderId, tenantScope));
  if (finErr) return { ok: false, status: 500, message: `financeiro: ${finErr.message}` };

  await delOrIgnore("configuracoes_pix", (q) =>
    q.delete().or(`terreiro_id.eq.${leaderId},terreiro_id.eq.${tenantScope}`)
  );

  const { error: filhosDelErr } = await admin.from("filhos_de_santo").delete().or(tenantScopeOr(leaderId, tenantScope));
  if (filhosDelErr) return { ok: false, status: 500, message: `filhos_de_santo: ${filhosDelErr.message}` };

  const { error: subErr } = await admin.from("subscriptions").delete().eq("id", leaderId);
  if (subErr) console.warn("[permanent-delete] subscriptions:", subErr.message);

  const { error: plErr } = await admin.from("perfil_lider").delete().eq("id", leaderId);
  if (plErr) return { ok: false, status: 500, message: `perfil_lider: ${plErr.message}` };

  try {
    const { data: pf } = await admin.storage.from("perfil_fotos").list("", { search: leaderId, limit: 200 });
    const names = (pf || []).map((x: { name: string }) => x.name).filter(Boolean);
    if (names.length) await admin.storage.from("perfil_fotos").remove(names);
  } catch (e) {
    console.warn("[permanent-delete] perfil_fotos:", e);
  }

  try {
    await removeStorageFolderRecursive(admin, "biblioteca_estudos", tenantScope);
    if (tenantScope !== leaderId) await removeStorageFolderRecursive(admin, "biblioteca_estudos", leaderId);
  } catch (e) {
    console.warn("[permanent-delete] biblioteca_estudos folder sweep:", e);
  }

  for (const cid of childAuthIds) {
    const { error: delAuth } = await admin.auth.admin.deleteUser(cid);
    if (delAuth) console.warn("[permanent-delete] auth child:", cid, delAuth.message);
  }

  const { error: delLeaderAuth } = await admin.auth.admin.deleteUser(leaderId);
  if (delLeaderAuth) {
    return { ok: false, status: 500, message: `Auth: ${delLeaderAuth.message || "Falha ao remover conta."}` };
  }

  return { ok: true };
}
