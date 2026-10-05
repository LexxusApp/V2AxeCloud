import type { SupabaseClient } from "@supabase/supabase-js";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { loadActiveTenantScopeIds } from "./activeTenantScope.js";
import { isMetaCloudDirectConfigured } from "./metaCloudSend.js";
import { resolveLeaderId } from "./tenantAccess.js";
import {
  assertFilhoBelongsToTerreiro,
  buildWhatsAppMessage,
  logAndSendWhatsApp,
  resolveTerreiroWhatsAppContext,
} from "./whatsappSendCore.js";
import { normalizeBrWhatsAppMsisdn } from "../../src/lib/whatsappPhone.js";

const BR_TZ = "America/Sao_Paulo";
const MAX_MANUAL_RECIPIENTS = Math.max(
  1,
  Math.min(Number(process.env.WA_FANOUT_MAX_RECIPIENTS) || 30, 100),
);

type ProfileRow = {
  id?: string | null;
  tenant_id?: string | null;
  nome_terreiro?: string | null;
  email?: string | null;
};

type FinanceRow = {
  id?: string | null;
  status?: string | null;
  descricao?: string | null;
  data?: string | null;
  data_vencimento?: string | null;
  filho_id?: string | null;
  valor?: number | string | null;
};

export type AdminMensalidadeRecipient = {
  filhoId: string;
  nome: string;
  phone: string;
  phoneMasked: string;
  valor: number;
  valorFmt: string;
  vencimento: string;
  vencimentoBr: string;
  sentToday: boolean;
};

function todayParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BR_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const year = Number(parts.find((part) => part.type === "year")?.value || "1970");
  const month = Number(parts.find((part) => part.type === "month")?.value || "1");
  const day = Number(parts.find((part) => part.type === "day")?.value || "1");
  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const monthEnd = `${year}-${String(month).padStart(2, "0")}-${String(new Date(year, month, 0).getDate()).padStart(2, "0")}`;
  return {
    year,
    month,
    day,
    ymd: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    monthStart,
    monthEnd,
    competencia: `${String(month).padStart(2, "0")}/${year}`,
    mesExtenso: format(new Date(year, month - 1, 15), "MMMM 'de' yyyy", { locale: ptBR }),
  };
}

function isUnpaid(row: FinanceRow): boolean {
  const status = String(row.status || "").toLowerCase();
  if (status === "pago" || status === "paid") return false;
  return status === "pendente" || status === "pending" || status === "atrasado" || status === "overdue" ||
    String(row.descricao || "").toLowerCase().includes("vencimento");
}

function rowFilhoId(row: FinanceRow): string {
  const direct = String(row.filho_id || "").trim();
  if (direct) return direct;
  return String(row.descricao || "").match(/\(ID:([0-9a-f-]{36})\)/i)?.[1] || "";
}

function formatBrl(value: number): string {
  return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return "••••";
  return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) •••••-${digits.slice(-4)}`;
}

function financialNotificationsEnabled(metadata: unknown): boolean {
  const meta = metadata && typeof metadata === "object" ? metadata as Record<string, unknown> : {};
  const prefs = meta.preferences && typeof meta.preferences === "object"
    ? meta.preferences as Record<string, unknown>
    : {};
  return prefs.notifFinanceiro !== false;
}

export async function listAdminMensalidadeTenants(sb: SupabaseClient) {
  const [{ data, error }, activeIds] = await Promise.all([
    sb
      .from("perfil_lider")
      .select("id, tenant_id, nome_terreiro, email, deleted_at, is_blocked")
      .is("deleted_at", null)
      .order("nome_terreiro", { ascending: true }),
    loadActiveTenantScopeIds(sb),
  ]);
  if (error) throw error;

  const tenants = ((data || []) as ProfileRow[])
    .filter((row) => activeIds.has(String(row.id || "")) || activeIds.has(String(row.tenant_id || "")))
    .map((row) => ({
      id: String(row.tenant_id || row.id || ""),
      nomeTerreiro: String(row.nome_terreiro || "Terreiro"),
      email: row.email ? String(row.email) : null,
    }))
    .filter((row) => row.id);

  return { tenants, metaConfigured: isMetaCloudDirectConfigured() };
}

export async function previewAdminMensalidadeDispatch(sb: SupabaseClient, tenantIdRaw: string) {
  const tenantId = String(tenantIdRaw || "").trim();
  if (!tenantId) throw Object.assign(new Error("Selecione um terreiro."), { status: 400 });

  const leaderId = await resolveLeaderId(sb, tenantId);
  const ctx = await resolveTerreiroWhatsAppContext(sb, leaderId, tenantId);
  const calendar = todayParts();

  const [childrenResult, financeResult, configResult] = await Promise.all([
    sb
      .from("filhos_de_santo")
      .select("id, nome, whatsapp_phone, status, tenant_id, lider_id")
      .or(`tenant_id.eq.${tenantId},tenant_id.eq.${leaderId},lider_id.eq.${tenantId},lider_id.eq.${leaderId}`),
    sb
      .from("financeiro")
      .select("id, status, descricao, data, data_vencimento, filho_id, valor, tenant_id, lider_id")
      .eq("categoria", "Mensalidade")
      .or(`tenant_id.eq.${tenantId},tenant_id.eq.${leaderId},lider_id.eq.${tenantId},lider_id.eq.${leaderId}`)
      .gte("data", calendar.monthStart)
      .lte("data", calendar.monthEnd),
    sb
      .from("whatsapp_config")
      .select("templates, metadata")
      .or(`tenant_id.eq.${tenantId},tenant_id.eq.${leaderId}`)
      .limit(1)
      .maybeSingle(),
  ]);
  if (childrenResult.error) throw childrenResult.error;
  if (financeResult.error) throw financeResult.error;

  const pendingByChild = new Map<string, FinanceRow>();
  for (const row of (financeResult.data || []) as FinanceRow[]) {
    if (!isUnpaid(row)) continue;
    const filhoId = rowFilhoId(row);
    if (filhoId && !pendingByChild.has(filhoId)) pendingByChild.set(filhoId, row);
  }

  const { data: sentLogs } = await sb
    .from("whatsapp_logs")
    .select("filho_id")
    .eq("tenant_id", tenantId)
    .eq("tipo", "cobranca_mensalidade")
    .gte("created_at", `${calendar.ymd}T00:00:00-03:00`);
  const sentTodayIds = new Set((sentLogs || []).map((row) => String(row.filho_id || "")).filter(Boolean));

  const recipients: AdminMensalidadeRecipient[] = [];
  let withoutPhone = 0;
  for (const child of childrenResult.data || []) {
    const status = String(child.status || "Ativo").trim().toLowerCase();
    if (status === "inativo" || status === "desligado" || status === "falecido") continue;
    const filhoId = String(child.id || "");
    const pending = pendingByChild.get(filhoId);
    if (!pending) continue;
    const rawPhone = String(child.whatsapp_phone || "");
    let phone = "";
    try {
      phone = normalizeBrWhatsAppMsisdn(rawPhone);
    } catch {
      withoutPhone += 1;
      continue;
    }
    const valor = Number(pending.valor || 0);
    const dueYmd = String(pending.data_vencimento || pending.data || "").slice(0, 10);
    recipients.push({
      filhoId,
      nome: String(child.nome || "Membro"),
      phone,
      phoneMasked: maskPhone(phone),
      valor,
      valorFmt: formatBrl(valor),
      vencimento: dueYmd,
      vencimentoBr: dueYmd ? format(parseISO(dueYmd), "dd/MM/yyyy") : "—",
      sentToday: sentTodayIds.has(filhoId),
    });
  }

  recipients.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const sendable = recipients.filter((recipient) => !recipient.sentToday);
  const cappedRecipients = sendable.slice(0, MAX_MANUAL_RECIPIENTS);
  const config = configResult.data as { templates?: unknown; metadata?: unknown } | null;

  return {
    tenantId,
    nomeTerreiro: ctx.nomeTerreiro,
    leaderId,
    competencia: calendar.competencia,
    mesExtenso: calendar.mesExtenso,
    pending: pendingByChild.size,
    eligible: recipients.length,
    withoutPhone,
    alreadySentToday: recipients.length - sendable.length,
    sendable: cappedRecipients.length,
    truncated: Math.max(0, sendable.length - cappedRecipients.length),
    automaticEnabled: financialNotificationsEnabled(config?.metadata),
    recipients,
    templates: config?.templates,
    maxRecipients: MAX_MANUAL_RECIPIENTS,
  };
}

export async function sendAdminMensalidadeDispatch(
  sb: SupabaseClient,
  input: { tenantId: string; confirmation: string },
) {
  const preview = await previewAdminMensalidadeDispatch(sb, input.tenantId);
  if (String(input.confirmation || "").trim() !== preview.nomeTerreiro) {
    throw Object.assign(new Error("Confirmação inválida. Recarregue a prévia e tente novamente."), { status: 400 });
  }

  const targets = preview.recipients.filter((recipient) => !recipient.sentToday).slice(0, preview.maxRecipients);
  if (!targets.length) {
    return { sent: 0, failed: 0, skipped: preview.alreadySentToday, results: [] };
  }

  let sent = 0;
  let failed = 0;
  const results: Array<{ filhoId: string; nome: string; ok: boolean; error?: string }> = [];
  for (const target of targets) {
    try {
      await assertFilhoBelongsToTerreiro(sb, preview.leaderId, {
        tenant_id: preview.tenantId,
        lider_id: preview.leaderId,
      });
      const variables = {
        nome_filho: target.nome,
        nome_terreiro: preview.nomeTerreiro,
        mes_ano: preview.mesExtenso,
        competencia: preview.competencia,
        valor: target.valorFmt,
        valor_mensalidade: target.valorFmt,
        data_vencimento: target.vencimentoBr,
      };
      const message = buildWhatsAppMessage(preview.templates, "cobranca_mensalidade", variables);
      await logAndSendWhatsApp(sb, {
        tenantId: preview.tenantId,
        filhoId: target.filhoId,
        tipo: "cobranca_mensalidade",
        phone: target.phone,
        message,
        nomeMembro: target.nome,
        nomeTerreiro: preview.nomeTerreiro,
        idTerreiro: preview.tenantId,
        variables,
      });
      sent += 1;
      results.push({ filhoId: target.filhoId, nome: target.nome, ok: true });
    } catch (error) {
      failed += 1;
      results.push({
        filhoId: target.filhoId,
        nome: target.nome,
        ok: false,
        error: error instanceof Error ? error.message : "Falha no envio",
      });
    }
  }

  return { sent, failed, skipped: preview.alreadySentToday, results };
}
