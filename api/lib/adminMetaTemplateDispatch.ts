import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildAdminMetaTemplateComponents,
  getAdminMetaTemplateById,
  renderAdminMetaTemplatePreview,
  validateAdminMetaTemplateValues,
  type AdminMetaTemplateDefinition,
} from "./adminMetaTemplateCatalog.js";
import { isMetaCloudDirectConfigured, sendMetaCloudTemplate } from "./metaCloudSend.js";
import { resolveMetaTemplateLanguage } from "./whatsappMetaCloud.js";

const BR_TZ = "America/Sao_Paulo";

export type AdminMetaRecipient = {
  tenantId: string;
  nomeTerreiro: string;
  nomeZelador: string;
  email: string;
  phone: string | null;
  phoneMasked: string | null;
  hasPhone: boolean;
  expiresAt: string | null;
  expiresDateBr: string | null;
  isTrial: boolean;
  daysUntilExpiry: number | null;
};

function formatDateBr(iso: string | null | undefined): string | null {
  if (!iso) return null;
  try {
    const dt = new Date(iso);
    if (Number.isNaN(dt.getTime())) return null;
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: BR_TZ,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(dt);
  } catch {
    return null;
  }
}

function daysUntilExpiryBr(iso: string | null | undefined): number | null {
  if (!iso) return null;
  try {
    const exp = new Date(iso);
    if (Number.isNaN(exp.getTime())) return null;
    const nowParts = new Intl.DateTimeFormat("en-CA", {
      timeZone: BR_TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const y = nowParts.find((p) => p.type === "year")?.value || "1970";
    const m = nowParts.find((p) => p.type === "month")?.value || "01";
    const d = nowParts.find((p) => p.type === "day")?.value || "01";
    const today = new Date(`${y}-${m}-${d}T12:00:00-03:00`);
    const expParts = new Intl.DateTimeFormat("en-CA", {
      timeZone: BR_TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(exp);
    const ey = expParts.find((p) => p.type === "year")?.value || "1970";
    const em = expParts.find((p) => p.type === "month")?.value || "01";
    const ed = expParts.find((p) => p.type === "day")?.value || "01";
    const expDay = new Date(`${ey}-${em}-${ed}T12:00:00-03:00`);
    return Math.round((expDay.getTime() - today.getTime()) / 86_400_000);
  } catch {
    return null;
  }
}

function maskPhone(digits: string): string {
  const d = digits.replace(/\D/g, "");
  if (d.length < 8) return d;
  return `+${d.slice(0, 2)} ${d.slice(2, -4).replace(/\d/g, "•")}${d.slice(-4)}`;
}

function normalizePhone(raw: string): string {
  let digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return "";
  if (!digits.startsWith("55")) digits = `55${digits}`;
  return digits;
}

async function resolveRecipientPhone(
  sb: SupabaseClient,
  tenantId: string,
  profile: { whatsapp_publico?: string | null; email?: string | null }
): Promise<string | null> {
  const { data: waCfg } = await sb
    .from("whatsapp_config")
    .select("phone_number")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (waCfg?.phone_number) {
    const p = normalizePhone(String(waCfg.phone_number));
    if (p) return p;
  }
  if (profile.whatsapp_publico) {
    const p = normalizePhone(String(profile.whatsapp_publico));
    if (p) return p;
  }
  try {
    const { data: authData } = await sb.auth.admin.getUserById(tenantId);
    const meta = (authData?.user?.user_metadata || {}) as Record<string, unknown>;
    const fromMeta = normalizePhone(String(meta.whatsapp || meta.telefone || meta.phone || ""));
    if (fromMeta) return fromMeta;
  } catch {
    /* ignore */
  }
  return null;
}

function buildValuesForRecipient(
  tpl: AdminMetaTemplateDefinition,
  recipient: AdminMetaRecipient,
  manualValues: Record<string, string>
): Record<string, string> {
  const out: Record<string, string> = { ...manualValues };
  for (const v of tpl.variables) {
    if (v.source === "manual") continue;
    if (v.source === "zelador") out[v.key] = recipient.nomeZelador;
    else if (v.source === "terreiro") out[v.key] = recipient.nomeTerreiro;
    else if (v.source === "email") out[v.key] = recipient.email;
    else if (v.source === "expires_date_br") out[v.key] = recipient.expiresDateBr || manualValues[v.key] || "";
  }
  return out;
}

export async function listAdminMetaTemplateRecipients(
  sb: SupabaseClient,
  filter: "all" | "trial" | "expiring_14" = "all"
): Promise<{ metaConfigured: boolean; recipients: AdminMetaRecipient[] }> {
  const { data: profiles } = await sb
    .from("perfil_lider")
    .select("id, nome_terreiro, cargo, email, whatsapp_publico")
    .is("deleted_at", null);

  const { data: subs } = await sb
    .from("subscriptions")
    .select("id, expires_at, status, efi_charge_id");

  const subById = new Map((subs || []).map((s) => [String(s.id), s]));

  const trialMeta = new Map<string, boolean>();
  try {
    let page = 1;
    while (page <= 20) {
      const { data: listData } = await sb.auth.admin.listUsers({ page, perPage: 200 });
      const users = listData?.users || [];
      if (!users.length) break;
      for (const u of users) {
        const meta = (u.user_metadata || {}) as Record<string, unknown>;
        if (meta.is_trial === true) trialMeta.set(u.id, true);
      }
      if (users.length < 200) break;
      page++;
    }
  } catch {
    /* ignore */
  }

  const recipients: AdminMetaRecipient[] = [];

  for (const row of profiles || []) {
    const tenantId = String(row.id || "").trim();
    if (!tenantId) continue;
    const sub = subById.get(tenantId);
    const expiresAt = sub?.expires_at ? String(sub.expires_at) : null;
    const isTrial =
      trialMeta.get(tenantId) === true &&
      String(sub?.status || "") === "active" &&
      !sub?.efi_charge_id;
    const days = daysUntilExpiryBr(expiresAt);

    if (filter === "trial" && !isTrial) continue;
    if (filter === "expiring_14" && (days == null || days < 0 || days > 14)) continue;

    const phone = await resolveRecipientPhone(sb, tenantId, row);
    recipients.push({
      tenantId,
      nomeTerreiro: String(row.nome_terreiro || "Terreiro").trim(),
      nomeZelador: String(row.cargo || "Zelador").trim(),
      email: String(row.email || "").trim(),
      phone,
      phoneMasked: phone ? maskPhone(phone) : null,
      hasPhone: Boolean(phone),
      expiresAt,
      expiresDateBr: formatDateBr(expiresAt),
      isTrial,
      daysUntilExpiry: days,
    });
  }

  recipients.sort((a, b) => {
    const da = a.daysUntilExpiry ?? 9999;
    const db = b.daysUntilExpiry ?? 9999;
    if (da !== db) return da - db;
    return a.nomeTerreiro.localeCompare(b.nomeTerreiro, "pt-BR");
  });

  return { metaConfigured: isMetaCloudDirectConfigured(), recipients };
}

export type AdminMetaDispatchLogRow = {
  id: string;
  tenantId: string;
  nomeTerreiro: string | null;
  tipo: string;
  telefone: string;
  telefoneMasked: string;
  status: string;
  externalId: string | null;
  preview: string;
  createdAt: string;
};

const ADMIN_LOG_TIPOS = [
  "admin_teste_encerrando",
  "admin_novo_modulo",
  "boas_vindas_zelador",
];

export async function listAdminMetaDispatchLog(
  sb: SupabaseClient,
  limit = 40
): Promise<AdminMetaDispatchLogRow[]> {
  const { data, error } = await sb
    .from("whatsapp_logs")
    .select("id, tenant_id, tipo, telefone, mensagem, status, external_id, created_at")
    .in("tipo", ADMIN_LOG_TIPOS)
    .order("created_at", { ascending: false })
    .limit(Math.min(100, Math.max(1, limit)));

  if (error) throw error;

  const tenantIds = [...new Set((data || []).map((r) => String(r.tenant_id || "")).filter(Boolean))];
  const names = new Map<string, string>();
  if (tenantIds.length) {
    const { data: profs } = await sb
      .from("perfil_lider")
      .select("id, nome_terreiro")
      .in("id", tenantIds);
    for (const p of profs || []) {
      names.set(String(p.id), String(p.nome_terreiro || ""));
    }
  }

  return (data || []).map((row) => {
    const phone = String(row.telefone || "");
    return {
      id: String(row.id),
      tenantId: String(row.tenant_id || ""),
      nomeTerreiro: names.get(String(row.tenant_id || "")) || null,
      tipo: String(row.tipo || ""),
      telefone: phone,
      telefoneMasked: maskPhone(phone),
      status: String(row.status || "sent"),
      externalId: row.external_id ? String(row.external_id) : null,
      preview: String(row.mensagem || "").slice(0, 200),
      createdAt: String(row.created_at || ""),
    };
  });
}

export async function sendAdminMetaTemplateDispatch(
  sb: SupabaseClient,
  input: {
    templateId: string;
    tenantIds: string[];
    manualValues: Record<string, string>;
  }
): Promise<{
  sent: number;
  failed: number;
  results: Array<{
    tenantId: string;
    nomeTerreiro: string;
    ok: boolean;
    messageId?: string;
    externalId?: string;
    error?: string;
  }>;
}> {
  if (!isMetaCloudDirectConfigured()) {
    throw Object.assign(new Error("Meta Cloud API não configurada na VPS (WA_META_TOKEN / WA_PHONE_NUMBER_ID)."), {
      status: 503,
    });
  }

  const tpl = getAdminMetaTemplateById(input.templateId);
  if (!tpl) {
    throw Object.assign(new Error("Template não encontrado."), { status: 400 });
  }

  const tenantIds = [...new Set(input.tenantIds.map((id) => String(id || "").trim()).filter(Boolean))];
  if (!tenantIds.length) {
    throw Object.assign(new Error("Selecione ao menos um terreiro."), { status: 400 });
  }

  const manualOnly: Record<string, string> = {};
  for (const v of tpl.variables) {
    if (v.source === "manual") {
      manualOnly[v.key] = String(input.manualValues[v.key] ?? "").trim();
    }
  }
  for (const v of tpl.variables.filter((x) => x.source === "manual")) {
    const raw = String(manualOnly[v.key] ?? "").trim();
    if (!raw) {
      throw Object.assign(new Error(`Preencha «${v.label}».`), { status: 400 });
    }
    if (raw.length > v.maxLength) {
      throw Object.assign(new Error(`«${v.label}» excede ${v.maxLength} caracteres.`), { status: 400 });
    }
  }

  const { recipients } = await listAdminMetaTemplateRecipients(sb, "all");
  const byId = new Map(recipients.map((r) => [r.tenantId, r]));

  const language = resolveMetaTemplateLanguage();
  const results: Array<{
    tenantId: string;
    nomeTerreiro: string;
    ok: boolean;
    messageId?: string;
    externalId?: string;
    error?: string;
  }> = [];
  let sent = 0;
  let failed = 0;

  for (const tenantId of tenantIds) {
    const recipient = byId.get(tenantId);
    if (!recipient) {
      failed++;
      results.push({ tenantId, nomeTerreiro: "?", ok: false, error: "Terreiro não encontrado." });
      continue;
    }
    if (!recipient.phone) {
      failed++;
      results.push({
        tenantId,
        nomeTerreiro: recipient.nomeTerreiro,
        ok: false,
        error: "Sem WhatsApp no cadastro.",
      });
      continue;
    }

    const values = buildValuesForRecipient(tpl, recipient, manualOnly);
    const fullValidation = validateAdminMetaTemplateValues(tpl, values);
    if (fullValidation) {
      failed++;
      results.push({
        tenantId,
        nomeTerreiro: recipient.nomeTerreiro,
        ok: false,
        error: fullValidation,
      });
      continue;
    }

    const preview = renderAdminMetaTemplatePreview(tpl, values);
    const auditText = [preview.body, preview.footer, preview.button ? `[${preview.button.text}]` : ""]
      .filter(Boolean)
      .join("\n\n");

    try {
      const components = buildAdminMetaTemplateComponents(tpl, values);
      const out = await sendMetaCloudTemplate(recipient.phone, tpl.templateName, language, components);
      const externalId = out.messageId || `admin_${Date.now()}_${tenantId.slice(0, 8)}`;
      await sb.from("whatsapp_logs").insert({
        tenant_id: tenantId,
        filho_id: null,
        tipo: tpl.logTipo,
        telefone: recipient.phone,
        mensagem: auditText,
        status: "sent",
        external_id: externalId,
      });
      sent++;
      results.push({
        tenantId,
        nomeTerreiro: recipient.nomeTerreiro,
        ok: true,
        messageId: out.messageId,
        externalId,
      });
    } catch (err: unknown) {
      failed++;
      const msg = err instanceof Error ? err.message : "Falha ao enviar.";
      try {
        await sb.from("whatsapp_logs").insert({
          tenant_id: tenantId,
          filho_id: null,
          tipo: tpl.logTipo,
          telefone: recipient.phone,
          mensagem: auditText,
          status: "failed",
          external_id: `fail_${Date.now()}_${tenantId.slice(0, 8)}`,
        });
      } catch {
        /* ignore */
      }
      results.push({ tenantId, nomeTerreiro: recipient.nomeTerreiro, ok: false, error: msg });
    }
  }

  return { sent, failed, results };
}
