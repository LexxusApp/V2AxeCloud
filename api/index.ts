import express from "express";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";
import { existsSync, readFileSync } from "node:fs";
import { constants as zlibConstants } from "node:zlib";
import axios from "axios";
import { fileURLToPath } from "url";
import cors from "cors";
import compression from "compression";
import webpush from "web-push";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  addMonths,
  differenceInCalendarDays,
  endOfMonth,
  format,
  isBefore,
  isValid,
  parseISO,
  startOfDay,
} from "date-fns";
import {
  createAxeInstance,
  createInstanceWithQrCode,
  createInstanceWithPairingCode,
  evolutionInstanceName,
  CONSOLE_ADMIN_INSTANCE_NAME,
  getAxeEvolutionStatusAndQr,
  logoutEvolutionInstance,
  sendEvolutionTextByInstance,
  sendEvolutionTextMessage,
  WHATSAPP_INITIALIZING_MESSAGE_PT,
} from "../src/services/evolution.service.js";
import {
  loadWelcomeMessageConfig,
  normalizeBrazilMsisdn,
  renderWelcomeMessage,
} from "./lib/welcomeMessage.js";
import {
  normalizeWhatsAppTemplates,
  resolveWhatsAppTemplate,
} from "../src/constants/whatsappTemplates.js";
import { permanentDeleteZeladorAccount } from "./permanentAccountDelete.js";
import { getConsoleAdminEmailAllowlist, isConsoleGlobalAdmin } from "./lib/consoleAdmin.js";
import { userCanModifyCalendarEvent } from "./lib/calendarAccess.js";
import { registerAdminConsoleRoutes } from "./admin-console-routes.js";
import { handleAuditTick } from "./lib/audit/cronTick.js";
import cronHandler from "./cron.js";
import { sendWhatsAppForTenant } from "./lib/whatsappSendCore.js";
import { dispatchMuralWhatsApp } from "./lib/cronWhatsAppJobs.js";
import { loadPlansCatalog, normalizePlansCatalog, savePlansCatalog } from "./lib/plansCatalog.js";
import { countFilhosForPerfilLider } from "./lib/countFilhosForTerreiro.js";
import { resolveFilhoRowIdForFinance } from "./lib/resolveFilhoRowIdForFinance.js";
import { fetchFinanceiroRowsForFilho } from "./lib/fetchFinanceiroRowsForFilho.js";
import { logEvent } from "./lib/auditLog.js";
import { createAuditLog } from "./lib/createAuditLog.js";
import { registerAuthAuditRoutes } from "./lib/authAuditRoutes.js";
import { registerOnboardingRoutes } from "./lib/onboardingRoutes.js";
import { registerFounderProgramRoutes } from "./lib/founderProgramRoutes.js";
import { registerConsulentePortalRoutes } from "./lib/consulentePortalRoutes.js";
import { registerEventRsvpRoutes } from "./lib/eventRsvpRoutes.js";
import { registerEfiCheckoutRoutes } from "./lib/efiCheckoutRoutes.js";
import { registerFinancialCaixinhaRoutes } from "./lib/financialCaixinhaRoutes.js";
import { registerStoreCheckoutRoutes } from "./lib/storeCheckoutRoutes.js";
import { registerFilhoHomeRoutes } from "./lib/filhoHomeRoutes.js";
import { registerAdminMetricsRoutes } from "./lib/adminMetricsRoutes.js";
import { isAllowedCorsOrigin } from "./lib/corsOrigins.js";
import {
  getSupabaseServerAnonKey,
  getSupabaseServerServiceKey,
  getSupabaseServerUrl,
  isValidSupabaseHttpUrl,
} from "./lib/supabaseServerEnv.js";
import { resolvePerfilLiderEmail } from "./lib/perfilLiderEmail.js";
import { verifyUser as verifyUserLib } from "./lib/verifyUser.js";
import {
  normalizeQueryTenantId as normalizeQueryTenantIdLib,
  resolveLeaderId as resolveLeaderIdLib,
  resolveTenantAccessForUser as resolveTenantAccessForUserLib,
  assertZeladorTenantAccess as assertZeladorTenantAccessLib,
  resolveFinanceiroTenantScope as resolveFinanceiroTenantScopeLib,
  assertUserCanAccessTenant,
  pickAllowedChildFields,
  isValidUuid,
} from "./lib/tenantAccess.js";
import { requireAuthOrRespond, getBearerToken } from "./lib/requireAuth.js";
import { requireApiUser, requireApiTenantRead, requireApiGlobalAdmin } from "./lib/routeAuthHelpers.js";
import { safeErrorMessage } from "./lib/safeError.js";
import { requireTenantReadAccess, isAllowedPdfProxyUrl, verifyWhatsAppWebhook } from "./lib/secureRoutes.js";
import {
  webhookRateLimit,
  sensitiveActionRateLimit,
  whatsappSendRateLimit,
  pushDirectRateLimit,
  apiReadRateLimit,
  filhoLoginRateLimit,
} from "./lib/rateLimit.js";
import { handleFilhoLoginRoute } from "./lib/filhoLoginRoute.js";
import { isSubscriptionAccessActive } from "./lib/subscriptionAccess.js";
import { handleTenantInfoRoute } from "./lib/tenantInfoRoute.js";
import { getRuntimePublicConfig, injectRuntimeConfigHtml } from "./lib/runtimePublicConfig.js";

process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[FATAL] Unhandled Rejection at:', promise, 'reason:', reason);
});

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const viteEnv = (import.meta as any).env || {};

function getServerEnv(...keys: string[]) {
  for (const key of keys) {
    const fromProcess = process.env[key];
    if (fromProcess) return fromProcess;
    // Na Vercel, só process.env — import.meta.env do build pode ter placeholders inválidos.
    if (process.env.VERCEL !== "1") {
      const fromVite = viteEnv[key];
      if (fromVite) return fromVite;
    }
  }
  return undefined;
}

// --- Financeiro + mensalidades (tudo self-contained; sem imports de outros arquivos em /api) ---

function normalizeQueryTenantId(raw: unknown): string {
  return normalizeQueryTenantIdLib(raw);
}

async function resolveFinanceiroTenantScope(
  supabaseAdmin: { from: (t: string) => any },
  userId: string | undefined,
  userRole: string | undefined,
  tenantFromQuery: string
): Promise<string> {
  if (!userId) return "";
  return resolveFinanceiroTenantScopeLib(
    supabaseAdmin as any,
    userId,
    userRole,
    tenantFromQuery
  );
}

function clampDayInMonth(year: number, monthIndex0: number, dayWanted: number): Date {
  const last = endOfMonth(new Date(year, monthIndex0, 1)).getDate();
  const d = Math.min(Math.max(1, dayWanted), last);
  return new Date(year, monthIndex0, d);
}

function firstDueOnOrAfterInclusion(inclusao: Date, diaVenc: number): Date {
  const d = Math.min(Math.max(1, Math.floor(diaVenc) || 10), 31);
  let y = inclusao.getFullYear();
  let m = inclusao.getMonth();
  let candidate = clampDayInMonth(y, m, d);
  if (isBefore(candidate, startOfDay(inclusao))) {
    const nm = addMonths(new Date(y, m, 1), 1);
    candidate = clampDayInMonth(nm.getFullYear(), nm.getMonth(), d);
  }
  return candidate;
}

function computeProximaDataMensalidadePrevisao(
  dataInclusaoIso: string | null | undefined,
  diaVencimento: number,
  referencia: Date = new Date()
): string {
  const hoje = startOfDay(referencia);
  let inclusao = hoje;
  if (dataInclusaoIso && String(dataInclusaoIso).trim() !== "") {
    const raw = String(dataInclusaoIso).trim().slice(0, 10);
    const parsed = parseISO(raw);
    if (isValid(parsed)) inclusao = startOfDay(parsed);
  }

  const d = Math.min(Math.max(1, Math.floor(Number(diaVencimento)) || 10), 31);

  let cursor = firstDueOnOrAfterInclusion(inclusao, d);
  while (isBefore(cursor, hoje)) {
    const nm = addMonths(new Date(cursor.getFullYear(), cursor.getMonth(), 1), 1);
    cursor = clampDayInMonth(nm.getFullYear(), nm.getMonth(), d);
  }

  const mesmoMesAno =
    cursor.getFullYear() === hoje.getFullYear() && cursor.getMonth() === hoje.getMonth();
  const diasAte = differenceInCalendarDays(cursor, hoje);
  if (mesmoMesAno && diasAte === 1) {
    const nm = addMonths(new Date(cursor.getFullYear(), cursor.getMonth(), 1), 1);
    cursor = clampDayInMonth(nm.getFullYear(), nm.getMonth(), d);
  }

  return format(cursor, "yyyy-MM-dd");
}

type MensalidadeZeladorRow = {
  id: string;
  filho_id: string | null;
  valor: number;
  data: string;
  data_vencimento?: string | null;
  status: string | null;
  descricao: string | null;
  categoria: string | null;
  tipo?: string | null;
  filhos_de_santo?: { nome: string } | null;
};

/** Cache: a tabela financeiro tem coluna status (plano novo) ou não (legado). */
let financeiroStatusColumnSupportedCache: boolean | null = null;
let financeiroStatusColumnResolveInFlight: Promise<boolean> | null = null;

function errorIndicatesMissingFinanceiroStatusColumn(error: any): boolean {
  const message = String(error?.message || "").toLowerCase();
  return (
    error?.code === "PGRST204" ||
    (message.includes("status") &&
      (message.includes("does not exist") ||
        message.includes("schema cache") ||
        message.includes("could not find")))
  );
}

async function resolveFinanceiroStatusColumnSupported(supabaseAdmin: any): Promise<boolean> {
  if (financeiroStatusColumnSupportedCache !== null) return financeiroStatusColumnSupportedCache;
  if (!financeiroStatusColumnResolveInFlight) {
    financeiroStatusColumnResolveInFlight = (async () => {
      try {
        const { error } = await supabaseAdmin.from("financeiro").select("status").limit(1);
        if (!error) {
          financeiroStatusColumnSupportedCache = true;
          return true;
        }
        if (errorIndicatesMissingFinanceiroStatusColumn(error)) {
          financeiroStatusColumnSupportedCache = false;
          return false;
        }
        console.warn("[SERVER] financeiro status probe (assumindo ausente):", error?.message || error);
        financeiroStatusColumnSupportedCache = false;
        return false;
      } finally {
        financeiroStatusColumnResolveInFlight = null;
      }
    })();
  }
  return financeiroStatusColumnResolveInFlight;
}

/** Cache: financeiro tem coluna filho_id ou só o marcador `(ID:uuid)` na descrição (legado). */
let financeiroFilhoIdColumnSupportedCache: boolean | null = null;
let financeiroFilhoIdColumnResolveInFlight: Promise<boolean> | null = null;

function errorIndicatesMissingFinanceiroFilhoIdColumn(error: any): boolean {
  const message = String(error?.message || "").toLowerCase();
  return (
    error?.code === "PGRST204" ||
    (message.includes("filho_id") &&
      (message.includes("does not exist") ||
        message.includes("schema cache") ||
        message.includes("could not find")))
  );
}

async function resolveFinanceiroFilhoIdColumnSupported(supabaseAdmin: any): Promise<boolean> {
  if (financeiroFilhoIdColumnSupportedCache !== null) return financeiroFilhoIdColumnSupportedCache;
  if (!financeiroFilhoIdColumnResolveInFlight) {
    financeiroFilhoIdColumnResolveInFlight = (async () => {
      try {
        const { error } = await supabaseAdmin.from("financeiro").select("filho_id").limit(1);
        if (!error) {
          financeiroFilhoIdColumnSupportedCache = true;
          return true;
        }
        if (errorIndicatesMissingFinanceiroFilhoIdColumn(error)) {
          financeiroFilhoIdColumnSupportedCache = false;
          return false;
        }
        console.warn("[SERVER] financeiro filho_id probe (assumindo ausente):", error?.message || error);
        financeiroFilhoIdColumnSupportedCache = false;
        return false;
      } finally {
        financeiroFilhoIdColumnResolveInFlight = null;
      }
    })();
  }
  return financeiroFilhoIdColumnResolveInFlight;
}

function extractFilhoIdFromMensalidadeDescricao(descricao: string | null | undefined): string | null {
  const m = String(descricao || "").match(/\(ID:([0-9a-fA-F-]{36})\)/);
  return m ? m[1] : null;
}

function deriveMensalidadeFilhoId(row: any): string | null {
  const direct = row?.filho_id;
  if (direct != null && String(direct).trim() !== "") return String(direct).trim().toLowerCase();
  const fromDesc = extractFilhoIdFromMensalidadeDescricao(row?.descricao);
  return fromDesc ? fromDesc.toLowerCase() : null;
}

/** yyyy-MM-dd para comparação de intervalo (aceita ISO ou dd/mm/aaaa vindo do banco/UI). */
function financeiroCampoParaYmdIso(raw: unknown): string | null {
  const s = raw != null ? String(raw).trim() : "";
  if (!s) return null;
  const iso = /^(\d{4}-\d{2}-\d{2})/.exec(s);
  if (iso) return iso[1];
  const dmy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s);
  if (dmy) {
    const dd = dmy[1].padStart(2, "0");
    const mm = dmy[2].padStart(2, "0");
    return `${dmy[3]}-${mm}-${dd}`;
  }
  return null;
}

function mensalidadeVencimentoOuDataYmd(row: any): string | null {
  return financeiroCampoParaYmdIso((row as any).data_vencimento) ?? financeiroCampoParaYmdIso((row as any).data);
}

function mensalidadeYmdDentroDoMesCalendario(ymd: string | null, monthStart: string, monthEnd: string): boolean {
  if (!ymd) return false;
  const d = ymd.length >= 10 ? ymd.slice(0, 10) : ymd;
  return d >= monthStart.slice(0, 10) && d <= monthEnd.slice(0, 10);
}

function enrichMensalidadeRowsWithFilhoId(rows: MensalidadeZeladorRow[]): MensalidadeZeladorRow[] {
  return rows.map((row) => {
    const derived = deriveMensalidadeFilhoId(row);
    if (!derived) return row;
    return { ...row, filho_id: derived };
  });
}

function mensalidadeDescricaoIsCobrancaPendente(descricao: string | null | undefined): boolean {
  return String(descricao || "").toLowerCase().includes("(vencimento");
}

function mensalidadeDescricaoIsPagamentoRegistrado(descricao: string | null | undefined): boolean {
  const d = String(descricao || "").toLowerCase();
  return d.includes("(competência") || d.includes("(competencia");
}

function rowIsMensalidadePendenteSemStatusColumn(row: any): boolean {
  if (String(row.categoria || "") !== "Mensalidade" || !deriveMensalidadeFilhoId(row)) return false;
  return mensalidadeDescricaoIsCobrancaPendente(row.descricao);
}

function rowIsMensalidadePagaSemStatusColumn(row: any): boolean {
  if (String(row.categoria || "") !== "Mensalidade" || !deriveMensalidadeFilhoId(row)) return false;
  if (rowIsMensalidadePendenteSemStatusColumn(row)) return false;
  const tipo = String(row.tipo || "").toLowerCase();
  return (
    mensalidadeDescricaoIsPagamentoRegistrado(row.descricao) ||
    tipo === "entrada" ||
    tipo === "receita" ||
    tipo === ""
  );
}

/** Com coluna `status`: pendente explícito OU legado com status vazio (evita sync inserir de novo). */
function rowIsMensalidadePendenteForDueCheck(row: any, supportsStatus: boolean): boolean {
  if (String(row.categoria || "") !== "Mensalidade" || !deriveMensalidadeFilhoId(row)) return false;
  if (!supportsStatus) return rowIsMensalidadePendenteSemStatusColumn(row);
  const st = String(row.status ?? "").trim().toLowerCase();
  if (st === "pago" || st === "paid" || st === "confirmado") return false;
  if (st === "pendente" || st === "pending") return true;
  return rowIsMensalidadePendenteSemStatusColumn(row);
}

/** Uma linha por filho + mês (data de vencimento ou data), mantém a mais recente. */
function dedupeMensalidadesPendentesPorFilhoMes(rows: MensalidadeZeladorRow[]): MensalidadeZeladorRow[] {
  const byKey = new Map<string, MensalidadeZeladorRow>();
  for (const row of rows) {
    const fid = deriveMensalidadeFilhoId(row);
    if (!fid) continue;
    const ymd = mensalidadeVencimentoOuDataYmd(row);
    const monthKey = ymd && ymd.length >= 7 ? ymd.slice(0, 7) : "";
    const k = `${fid}|${monthKey}`;
    const prev = byKey.get(k);
    if (!prev) {
      byKey.set(k, row);
      continue;
    }
    const ta = new Date(String((prev as any).created_at || "")).getTime();
    const tb = new Date(String((row as any).created_at || "")).getTime();
    const useRow = tb > ta || (tb === ta && String(row.id) > String(prev.id));
    if (useRow) byKey.set(k, row);
  }
  return Array.from(byKey.values());
}

/** PostgREST embed exige FK declarada entre tabelas; sem FK buscamos nomes em lote. */
async function attachFilhosNomesMensalidades(
  supabaseAdmin: any,
  rows: MensalidadeZeladorRow[]
): Promise<MensalidadeZeladorRow[]> {
  const ids = [
    ...new Set(
      rows
        .map((r) => deriveMensalidadeFilhoId(r) || r.filho_id)
        .filter((id): id is string => typeof id === "string" && id.trim() !== "")
    ),
  ];
  if (ids.length === 0) return rows;
  const { data: filhos, error } = await supabaseAdmin.from("filhos_de_santo").select("id, nome").in("id", ids);
  if (error || !filhos?.length) return rows;
  const nomeById = new Map<string, string>(
    (filhos as { id: string; nome: string | null }[]).map((f) => [
      String(f.id).trim().toLowerCase(),
      String(f.nome || "").trim() || "Filho de santo",
    ])
  );
  return rows.map((row) => {
    const fid = deriveMensalidadeFilhoId(row) || (row.filho_id != null ? String(row.filho_id).trim().toLowerCase() : null);
    if (!fid || !nomeById.has(fid)) return row;
    return { ...row, filho_id: fid, filhos_de_santo: { nome: nomeById.get(fid)! } };
  });
}

async function assertZeladorTenantAccess(
  supabaseAdmin: any,
  resolveLeaderId: (id: string) => Promise<string>,
  userId: string,
  tenantId: string
): Promise<boolean> {
  void resolveLeaderId;
  return assertZeladorTenantAccessLib(supabaseAdmin, userId, tenantId);
}

async function hasPaidMensalidadeInCalendarMonth(
  supabaseAdmin: any,
  filhoId: string,
  ref: Date
): Promise<boolean> {
  const supportsStatus = await resolveFinanceiroStatusColumnSupported(supabaseAdmin);
  const supportsFilhoId = await resolveFinanceiroFilhoIdColumnSupported(supabaseAdmin);
  const y = ref.getFullYear();
  const m0 = ref.getMonth();
  const start = `${y}-${String(m0 + 1).padStart(2, "0")}-01`;
  const last = new Date(y, m0 + 1, 0).getDate();
  const endStr = `${y}-${String(m0 + 1).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
  const selectCols = supportsStatus ? "id, status, categoria, tipo, descricao" : "id, categoria, tipo, descricao";
  let q = supabaseAdmin
    .from("financeiro")
    .select(selectCols)
    .eq("categoria", "Mensalidade")
    .gte("data", start)
    .lte("data", endStr);
  const fidNorm = String(filhoId || "").trim().toLowerCase();
  if (supportsFilhoId) q = q.eq("filho_id", filhoId);
  else q = q.ilike("descricao", `%ID:${fidNorm}%`);
  const { data, error } = await q;
  if (error) return false;
  for (const r of data || []) {
    if (!supportsFilhoId && deriveMensalidadeFilhoId(r) !== fidNorm) continue;
    if (supportsStatus) {
      const st = String((r as any).status || "").toLowerCase();
      const isPaidStatus = st === "pago" || st === "paid" || st === "confirmado";
      if (!isPaidStatus) continue;
      const tipo = String((r as any).tipo || "").toLowerCase();
      if (tipo === "entrada" || tipo === "receita" || tipo === "") return true;
    } else if (rowIsMensalidadePagaSemStatusColumn(r)) {
      return true;
    }
  }
  return false;
}

/** Pendência de mensalidade cujo vencimento (ou data) cai no mês [monthStart, monthEnd]. */
async function hasPendingMensalidadeForDueMonth(
  supabaseAdmin: any,
  filhoId: string,
  monthStart: string,
  monthEnd: string
): Promise<boolean> {
  const supportsStatus = await resolveFinanceiroStatusColumnSupported(supabaseAdmin);
  const supportsFilhoId = await resolveFinanceiroFilhoIdColumnSupported(supabaseAdmin);
  let selectCols = supportsFilhoId
    ? "id, data, data_vencimento, descricao, categoria, filho_id"
    : "id, data, data_vencimento, descricao, categoria";
  if (supportsStatus) selectCols += ",status";
  const baseQuery = () => {
    let q = supabaseAdmin.from("financeiro").select(selectCols).eq("categoria", "Mensalidade");
    if (supportsFilhoId) q = q.eq("filho_id", filhoId);
    else q = q.ilike("descricao", `%ID:${filhoId}%`);
    return q;
  };
  let { data, error } = await baseQuery();
  if (error && String(error?.message || "").toLowerCase().includes("data_vencimento")) {
    selectCols = selectCols.replace("data_vencimento, ", "").replace(",data_vencimento", "");
    ({ data, error } = await baseQuery());
  }
  if (error) {
    console.warn(
      "[SERVER] hasPendingMensalidadeForDueMonth: erro na query — seguir sync (assumir sem pendência detectável):",
      error?.message || error
    );
    return false;
  }
  const fidNorm = String(filhoId || "").trim().toLowerCase();
  for (const r of data || []) {
    if (deriveMensalidadeFilhoId(r) !== fidNorm) continue;
    if (!rowIsMensalidadePendenteForDueCheck(r, supportsStatus)) continue;
    const ymd = mensalidadeVencimentoOuDataYmd(r);
    if (mensalidadeYmdDentroDoMesCalendario(ymd, monthStart, monthEnd)) return true;
  }
  return false;
}

/** Filho já existia no terreiro até o dia do vencimento deste mês (evita mensalidade antes da entrada). */
function childEligibleForDueMonth(child: any, dueStr: string): boolean {
  const raw = (child as any).data_entrada || (child as any).created_at;
  if (!raw) return true;
  const parsed = parseISO(String(raw).trim().slice(0, 10));
  if (!isValid(parsed)) return true;
  const due = startOfDay(parseISO(dueStr));
  return startOfDay(parsed).getTime() <= due.getTime();
}

async function fetchMensalidadesPendentesList(
  supabaseAdmin: any,
  tenantId: string,
  ref: Date = new Date()
): Promise<MensalidadeZeladorRow[]> {
  const supportsStatus = await resolveFinanceiroStatusColumnSupported(supabaseAdmin);
  const y = ref.getFullYear();
  const m0 = ref.getMonth();
  const start = `${y}-${String(m0 + 1).padStart(2, "0")}-01`;
  const last = new Date(y, m0 + 1, 0).getDate();
  const endStr = `${y}-${String(m0 + 1).padStart(2, "0")}-${String(last).padStart(2, "0")}`;

  let q = supabaseAdmin
    .from("financeiro")
    .select("*")
    .or(`tenant_id.eq.${tenantId},lider_id.eq.${tenantId}`)
    .eq("categoria", "Mensalidade");
  if (!supportsStatus) {
    q = q.ilike("descricao", "%(vencimento%");
  }
  const { data, error } = await q;
  if (error) throw error;
  const pendentesMesAtual = ((data || []) as MensalidadeZeladorRow[]).filter((row) => {
    const ymd = mensalidadeVencimentoOuDataYmd(row);
    if (!mensalidadeYmdDentroDoMesCalendario(ymd, start, endStr)) return false;
    if (!deriveMensalidadeFilhoId(row)) return false;
    return rowIsMensalidadePendenteForDueCheck(row, supportsStatus);
  });
  pendentesMesAtual.sort((a, b) => {
    const aRef = String((a as any).data_vencimento || a.data || "").slice(0, 10);
    const bRef = String((b as any).data_vencimento || b.data || "").slice(0, 10);
    return aRef.localeCompare(bRef);
  });
  const deduped = dedupeMensalidadesPendentesPorFilhoMes(pendentesMesAtual);
  deduped.sort((a, b) => {
    const aRef = String((a as any).data_vencimento || a.data || "").slice(0, 10);
    const bRef = String((b as any).data_vencimento || b.data || "").slice(0, 10);
    return aRef.localeCompare(bRef);
  });
  return attachFilhosNomesMensalidades(supabaseAdmin, enrichMensalidadeRowsWithFilhoId(deduped));
}

async function fetchMensalidadesPagasMesAtual(
  supabaseAdmin: any,
  tenantId: string,
  ref: Date = new Date()
): Promise<MensalidadeZeladorRow[]> {
  const supportsStatus = await resolveFinanceiroStatusColumnSupported(supabaseAdmin);
  const y = ref.getFullYear();
  const m0 = ref.getMonth();
  const start = `${y}-${String(m0 + 1).padStart(2, "0")}-01`;
  const last = new Date(y, m0 + 1, 0).getDate();
  const endStr = `${y}-${String(m0 + 1).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
  let q = supabaseAdmin
    .from("financeiro")
    .select("*")
    .or(`tenant_id.eq.${tenantId},lider_id.eq.${tenantId}`)
    .eq("categoria", "Mensalidade")
    .gte("data", start)
    .lte("data", endStr)
    .order("data", { ascending: false });
  if (supportsStatus) q = q.eq("status", "pago");
  const { data, error } = await q;
  if (error) throw error;
  const rows = (data || []) as MensalidadeZeladorRow[];
  const withChild = rows.filter((row) => deriveMensalidadeFilhoId(row));
  const filtered = supportsStatus ? withChild : withChild.filter((row) => rowIsMensalidadePagaSemStatusColumn(row));
  return attachFilhosNomesMensalidades(supabaseAdmin, enrichMensalidadeRowsWithFilhoId(filtered));
}

async function syncMensalidadesPendentes(
  supabaseAdmin: any,
  resolveLeaderId: (id: string) => Promise<string>,
  userId: string,
  tenantId: string
): Promise<{ created: number }> {
  const resolvedTenant = await resolveLeaderId(tenantId);
  let dia = 10;
  let valorPadrao = 89.9;
  const { data: pix } = await supabaseAdmin
    .from("configuracoes_pix")
    .select("valor_mensalidade, dia_vencimento")
    .or(`terreiro_id.eq.${resolvedTenant},terreiro_id.eq.${tenantId}`)
    .maybeSingle();
  if (pix) {
    dia = parseInt(String((pix as any).dia_vencimento), 10) || 10;
    valorPadrao = Number((pix as any).valor_mensalidade) || valorPadrao;
  }

  const { data: children, error: chErr } = await supabaseAdmin
    .from("filhos_de_santo")
    .select("id, nome, tenant_id, lider_id, created_at, data_entrada, status")
    .or(
      [
        `tenant_id.eq.${tenantId}`,
        `tenant_id.eq.${resolvedTenant}`,
        `lider_id.eq.${tenantId}`,
        `lider_id.eq.${resolvedTenant}`,
        `lider_id.eq.${userId}`,
      ].join(",")
    );
  if (chErr) throw chErr;
  const rows = (children || []).filter((c: any) => {
    const same =
      c.tenant_id === tenantId ||
      c.tenant_id === resolvedTenant ||
      c.lider_id === userId ||
      c.lider_id === tenantId ||
      c.lider_id === resolvedTenant;
    return same;
  });

  const ref = new Date();
  const y = ref.getFullYear();
  const m0 = ref.getMonth();
  const monthStart = `${y}-${String(m0 + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(y, m0 + 1, 0).getDate();
  const monthEnd = `${y}-${String(m0 + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  const dueStr = format(clampDayInMonth(y, m0, dia), "yyyy-MM-dd");

  const supportsStatus = await resolveFinanceiroStatusColumnSupported(supabaseAdmin);
  const supportsFilhoId = await resolveFinanceiroFilhoIdColumnSupported(supabaseAdmin);

  let created = 0;
  for (const child of rows) {
    const stFilho = String((child as any).status || "Ativo")
      .trim()
      .toLowerCase();
    // Só ignora filhos explicitamente inativos; qualquer outro status continua elegível.
    if (stFilho === "inativo" || stFilho === "desligado" || stFilho === "falecido") continue;

    const fid = child.id as string;
    if (!childEligibleForDueMonth(child, dueStr)) continue;

    const pendingThisMonth = await hasPendingMensalidadeForDueMonth(
      supabaseAdmin,
      fid,
      monthStart,
      monthEnd
    );
    if (pendingThisMonth) continue;

    const paid = await hasPaidMensalidadeInCalendarMonth(supabaseAdmin, fid, ref);
    if (paid) continue;

    const nome = String((child as any).nome || "Filho").trim() || "Filho";
    const insert: Record<string, unknown> = {
      tipo: "entrada",
      valor: valorPadrao,
      categoria: "Mensalidade",
      data: dueStr,
      descricao: `Mensalidade - ${nome} (vencimento ${dueStr}) (ID:${fid})`,
      tenant_id: tenantId,
      lider_id: userId,
      data_vencimento: dueStr,
    };
    if (supportsFilhoId) insert.filho_id = fid;
    if (supportsStatus) insert.status = "pendente";
    let { error: insErr } = await supabaseAdmin.from("financeiro").insert([insert]);
    if (insErr && String(insErr.message || "").includes("data_vencimento")) {
      delete insert.data_vencimento;
      const r2 = await supabaseAdmin.from("financeiro").insert([insert]);
      insErr = r2.error;
    }
    if (insErr && String(insErr.message || "").includes("filho_id")) {
      delete insert.filho_id;
      const r3 = await supabaseAdmin.from("financeiro").insert([insert]);
      insErr = r3.error;
    }
    if (insErr && String(insErr.message || "").toLowerCase().includes("status")) {
      delete insert.status;
      const r4 = await supabaseAdmin.from("financeiro").insert([insert]);
      insErr = r4.error;
    }
    if (!insErr) created += 1;
  }
  return { created };
}

async function loadFinanceiroRow(supabaseAdmin: any, id: string) {
  const { data, error } = await supabaseAdmin.from("financeiro").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as any;
}

function rowTenantMatches(row: any, tenantId: string, resolvedTenant: string, userId: string): boolean {
  return (
    row.tenant_id === tenantId ||
    row.tenant_id === resolvedTenant ||
    row.lider_id === tenantId ||
    row.lider_id === resolvedTenant ||
    row.lider_id === userId
  );
}

async function liquidarMensalidadePendente(
  supabaseAdmin: any,
  resolveLeaderId: (id: string) => Promise<string>,
  userId: string,
  tenantId: string,
  financeiroId: string,
  valorOverride?: number
): Promise<{ ok: true }> {
  const row = await loadFinanceiroRow(supabaseAdmin, financeiroId);
  if (!row) throw new Error("Lançamento não encontrado");
  const resolved = await resolveLeaderId(tenantId);
  if (!rowTenantMatches(row, tenantId, resolved, userId)) {
    throw new Error("Sem permissão para este lançamento");
  }
  const supportsStatus = await resolveFinanceiroStatusColumnSupported(supabaseAdmin);
  const st = String(row.status || "").toLowerCase();
  if (supportsStatus) {
    if (st !== "pendente") throw new Error("Este registro não está pendente");
  } else if (!rowIsMensalidadePendenteSemStatusColumn(row)) {
    throw new Error("Este registro não está pendente");
  }
  if (String(row.categoria || "") !== "Mensalidade") throw new Error("Tipo de lançamento inválido");

  const paymentDate = new Date().toISOString().split("T")[0];
  const v = Number.isFinite(valorOverride) && (valorOverride as number) > 0 ? (valorOverride as number) : Number(row.valor) || 0;
  if (v <= 0) throw new Error("Valor inválido");

  const filhoId = deriveMensalidadeFilhoId(row);
  if (!filhoId) throw new Error("Lançamento sem vínculo de filho (filho_id ou ID na descrição)");
  const { data: child } = await supabaseAdmin
    .from("filhos_de_santo")
    .select("nome")
    .eq("id", filhoId)
    .maybeSingle();
  const nome = String(child?.nome || "Filho").trim() || "Filho";
  const comp = String(row.data_vencimento || row.data || paymentDate).slice(0, 10);

  const up: Record<string, unknown> = {
    tipo: "entrada",
    valor: v,
    data: paymentDate,
    descricao: `Mensalidade - ${nome} (competência ${comp}) (ID:${filhoId})`,
  };
  if (supportsStatus) up.status = "pago";
  let upd = supabaseAdmin.from("financeiro").update(up).eq("id", financeiroId);
  if (supportsStatus) upd = upd.eq("status", "pendente");
  const { error: upErr } = await upd;
  if (upErr) throw upErr;
  return { ok: true };
}

async function estornarMensalidadePaga(
  supabaseAdmin: any,
  resolveLeaderId: (id: string) => Promise<string>,
  userId: string,
  tenantId: string,
  financeiroId: string,
  ref: Date = new Date()
): Promise<{ ok: true }> {
  const row = await loadFinanceiroRow(supabaseAdmin, financeiroId);
  if (!row) throw new Error("Lançamento não encontrado");
  const resolved = await resolveLeaderId(tenantId);
  if (!rowTenantMatches(row, tenantId, resolved, userId)) {
    throw new Error("Sem permissão para este lançamento");
  }
  const supportsStatus = await resolveFinanceiroStatusColumnSupported(supabaseAdmin);
  const st = String(row.status || "").toLowerCase();
  if (supportsStatus) {
    if (st !== "pago") throw new Error("Apenas mensalidades marcadas como pagas podem ser estornadas");
  } else if (!rowIsMensalidadePagaSemStatusColumn(row)) {
    throw new Error("Apenas mensalidades marcadas como pagas podem ser estornadas");
  }
  if (String(row.categoria || "") !== "Mensalidade") throw new Error("Tipo de lançamento inválido");

  const y = ref.getFullYear();
  const m0 = ref.getMonth();
  const start = `${y}-${String(m0 + 1).padStart(2, "0")}-01`;
  const last = new Date(y, m0 + 1, 0).getDate();
  const endStr = `${y}-${String(m0 + 1).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
  const payDay = String(row.data || "").slice(0, 10);
  if (payDay < start || payDay > endStr) {
    throw new Error("Só é possível estornar pagamentos registrados no mês atual");
  }

  const due = String(row.data_vencimento || row.data || payDay).slice(0, 10);
  const filhoId = deriveMensalidadeFilhoId(row);
  if (!filhoId) throw new Error("Lançamento sem vínculo de filho (filho_id ou ID na descrição)");
  const { data: child } = await supabaseAdmin
    .from("filhos_de_santo")
    .select("nome")
    .eq("id", filhoId)
    .maybeSingle();
  const nome = String(child?.nome || "Filho").trim() || "Filho";

  const up: Record<string, unknown> = {
    tipo: "entrada",
    data: due,
    descricao: `Mensalidade - ${nome} (vencimento ${due}) (ID:${filhoId})`,
  };
  if (supportsStatus) up.status = "pendente";
  let upd = supabaseAdmin.from("financeiro").update(up).eq("id", financeiroId);
  if (supportsStatus) upd = upd.eq("status", "pago");
  const { error: upErr } = await upd;
  if (upErr) throw upErr;
  return { ok: true };
}

// --- fim bloco financeiro / mensalidades ---

function canonicalPlanSlug(plan: string | undefined): string {
  if (!plan) return 'premium';
  const stripped = plan.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const p = stripped.toLowerCase().trim().replace(/\s+/g, ' ');
  const compact = p.replace(/[\s_-]/g, '');

  if (p === 'vita' || p === 'plano vita' || compact === 'planovita') return 'vita';
  if (p === 'premium' || compact === 'premium') return 'premium';
  if (p === 'oro' || compact === 'oro' || compact === 'planoor') return 'premium';
  if (p === 'cortesia' || compact === 'cortesia') return 'cortesia';
  if (p === 'axe' || p === 'free' || compact === 'axe' || compact === 'free') return 'premium';
  return p;
}

function isLifetimePlan(plan: string | undefined): boolean {
  const c = canonicalPlanSlug(plan);
  return c === 'cortesia' || c === 'vita';
}

function usesDistantSubscriptionExpiry(plan: string | undefined): boolean {
  if (!plan) return false;
  const raw = plan.toLowerCase().trim();
  if (raw === 'premium') return true;
  return isLifetimePlan(plan);
}

// Web Push — O par público/privado DEVE ser o mesmo de `src/hooks/useWebPush.ts` e `server.ts`
// (o cliente gera a subscription com a chave pública; enviar com outro par quebra o envio em silêncio).
const VAPID_PUBLIC_KEY = getServerEnv("VAPID_PUBLIC_KEY", "VITE_VAPID_PUBLIC_KEY");
const VAPID_PRIVATE_KEY = getServerEnv("VAPID_PRIVATE_KEY", "VITE_VAPID_PRIVATE_KEY");

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  try {
    webpush.setVapidDetails("mailto:contato@axecloud.com.br", VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  } catch (e) {
    console.error("[webpush] setVapidDetails falhou (push pode não funcionar):", e);
  }
} else {
  console.warn("[webpush] VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY não configurados — push desativado.");
}

// Supabase: mesma ordem de env que rotas públicas (tenant-info) — evita URL inválida no boot.
const SUPABASE_URL = getSupabaseServerUrl();
const SUPABASE_SERVICE_ROLE_KEY = getSupabaseServerServiceKey();
const SUPABASE_ANON_KEY = getSupabaseServerAnonKey();
const IS_PRODUCTION_SERVER =
  process.env.VERCEL === "1" || process.env.NODE_ENV === "production";
const SUPABASE_SERVER_KEY =
  SUPABASE_SERVICE_ROLE_KEY || (!IS_PRODUCTION_SERVER ? SUPABASE_ANON_KEY : undefined);

let supabaseAdmin: any;
let pixSupportsValorMensalidade = true;
let pixSupportsDiaVencimento = true;

function getPixConfigSelectClause() {
  const baseColumns = ['id', 'terreiro_id', 'chave_pix', 'tipo_chave', 'nome_beneficiario'];
  if (pixSupportsValorMensalidade) baseColumns.push('valor_mensalidade');
  if (pixSupportsDiaVencimento) baseColumns.push('dia_vencimento');
  return baseColumns.join(', ');
}

function sanitizePixConfigData(configData: any) {
  const sanitized = { ...configData };
  if (!pixSupportsValorMensalidade) delete sanitized.valor_mensalidade;
  if (!pixSupportsDiaVencimento) delete sanitized.dia_vencimento;
  return sanitized;
}

function slugifyStoragePath(str: string) {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_.-]/g, '_')
    .toLowerCase();
}

const GALLERY_QUOTA_BYTES = 10 * 1024 * 1024 * 1024;
const R2_ENDPOINT = getServerEnv("R2_S3_ENDPOINT", "R2_ENDPOINT");
const R2_ACCESS_KEY_ID = getServerEnv("R2_ACCESS_KEY_ID");
const R2_SECRET_ACCESS_KEY = getServerEnv("R2_SECRET_ACCESS_KEY");
const R2_BUCKET_NAME = getServerEnv("R2_BUCKET_NAME");
const R2_PUBLIC_BASE_URL = getServerEnv("R2_PUBLIC_BASE_URL");

const r2Client =
  R2_ENDPOINT && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY
    ? new S3Client({
        region: "auto",
        endpoint: R2_ENDPOINT,
        credentials: {
          accessKeyId: R2_ACCESS_KEY_ID,
          secretAccessKey: R2_SECRET_ACCESS_KEY,
        },
      })
    : null;

function buildR2PublicUrl(storageKey: string): string {
  const base =
    R2_PUBLIC_BASE_URL ||
    (R2_ENDPOINT && R2_BUCKET_NAME ? `${R2_ENDPOINT.replace(/\/+$/, "")}/${R2_BUCKET_NAME}` : "");
  return `${String(base).replace(/\/+$/, "")}/${storageKey}`;
}

async function resolveTenantAccessForUser(userId: string) {
  return resolveTenantAccessForUserLib(supabaseAdmin, userId);
}

if (!isValidSupabaseHttpUrl(SUPABASE_URL) || !SUPABASE_SERVER_KEY) {
  console.error("CRITICAL: Missing or invalid Supabase environment variables. Server will start but database features will fail.");
  console.error("SUPABASE_URL:", SUPABASE_URL ? "INVALID_OR_SET" : "MISSING");
  console.error("SUPABASE_SERVICE_ROLE_KEY:", SUPABASE_SERVICE_ROLE_KEY ? "SET" : "MISSING");
  // Create a mock or null client to avoid immediate crashes
  supabaseAdmin = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null, error: new Error("Supabase not configured") }),
          single: async () => ({ data: null, error: new Error("Supabase not configured") }),
          limit: () => ({
            maybeSingle: async () => ({ data: null, error: new Error("Supabase not configured") }),
            single: async () => ({ data: null, error: new Error("Supabase not configured") }),
          })
        }),
        limit: () => ({
          maybeSingle: async () => ({ data: null, error: new Error("Supabase not configured") }),
          single: async () => ({ data: null, error: new Error("Supabase not configured") }),
        })
      }),
      storage: {
        getBucket: async () => ({ data: null, error: { message: 'not found' } }),
        createBucket: async () => ({ error: new Error("Supabase not configured") })
      }
    }),
    auth: {
      getUser: async () => ({ data: { user: null }, error: new Error("Supabase not configured") }),
    },
  };
} else {
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    if (IS_PRODUCTION_SERVER) {
      console.error("CRITICAL: SUPABASE_SERVICE_ROLE_KEY é obrigatória em produção.");
    } else {
      console.warn("SUPABASE_SERVICE_ROLE_KEY is missing; using anon key fallback (somente dev).");
    }
  }

  try {
    supabaseAdmin = createClient(SUPABASE_URL!, SUPABASE_SERVER_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  } catch (err) {
    console.error("[SERVER] Falha ao criar cliente Supabase — usando mock:", (err as Error)?.message || err);
    supabaseAdmin = {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: new Error("Supabase not configured") }),
            single: async () => ({ data: null, error: new Error("Supabase not configured") }),
            limit: () => ({
              maybeSingle: async () => ({ data: null, error: new Error("Supabase not configured") }),
              single: async () => ({ data: null, error: new Error("Supabase not configured") }),
            })
          }),
          limit: () => ({
            maybeSingle: async () => ({ data: null, error: new Error("Supabase not configured") }),
            single: async () => ({ data: null, error: new Error("Supabase not configured") }),
          })
        }),
        storage: {
          getBucket: async () => ({ data: null, error: { message: 'not found' } }),
          createBucket: async () => ({ error: new Error("Supabase not configured") })
        }
      }),
      auth: {
        getUser: async () => ({ data: { user: null }, error: new Error("Supabase not configured") }),
      },
    };
  }
}

// Função para garantir que os buckets de storage existam
async function ensureBucketsExist() {
  const buckets = ['biblioteca_estudos', 'loja_imagens'];
  console.log("[SERVER] Verificando buckets de storage...");
  
  for (const bucketName of buckets) {
    try {
      const { data: bucket, error } = await supabaseAdmin.storage.getBucket(bucketName);
      
      if (error && error.message.includes('not found')) {
        console.log(`[SERVER] Criando bucket: ${bucketName}`);
        const { error: createError } = await supabaseAdmin.storage.createBucket(bucketName, {
          public: false,
          allowedMimeTypes: bucketName === 'biblioteca_estudos' ? ['application/pdf'] : ['image/*'],
          fileSizeLimit: 52428800 // 50MB
        });
        if (createError) console.error(`[SERVER] Erro ao criar bucket ${bucketName}:`, createError);
      } else if (error) {
        console.error(`[SERVER] Erro ao verificar bucket ${bucketName}:`, error);
      } else if (bucket?.public) {
        const { error: updateError } = await supabaseAdmin.storage.updateBucket(bucketName, { public: false });
        if (updateError) console.error(`[SERVER] Erro ao tornar bucket ${bucketName} privado:`, updateError);
        else console.log(`[SERVER] Bucket ${bucketName} atualizado para privado.`);
      } else {
        console.log(`[SERVER] Bucket OK: ${bucketName}`);
      }
    } catch (err) {
      console.error(`[SERVER] Erro inesperado ao verificar bucket ${bucketName}:`, err);
    }
  }
}

// Função para inicializar o esquema do banco (is_admin_global)
async function initializeDatabase() {
  console.log("[SERVER] Inicializando esquema do banco...");
  try {
    // Tenta verificar se a coluna is_admin_global existe
    const { error: checkError } = await supabaseAdmin.from('perfil_lider').select('is_admin_global').limit(1);
    
    if (checkError && checkError.message.includes('column "is_admin_global" does not exist')) {
      console.warn("[SERVER] ATENÇÃO: A coluna 'is_admin_global' não existe na tabela 'perfil_lider'.");
      console.warn("[SERVER] Por favor, execute o conteúdo de 'setup_admin_role.sql' e 'harden_rls.sql' no SQL Editor do Supabase.");
    } else if (!checkError) {
      console.log("[SERVER] Esquema do banco OK (is_admin_global presente).");
      const allow = getConsoleAdminEmailAllowlist();
      if (allow.length) {
        for (const adminEmail of allow) {
          const { error: updateError } = await supabaseAdmin
            .from('perfil_lider')
            .update({ is_admin_global: true })
            .ilike('email', adminEmail);
          if (updateError) console.error("[SERVER] Erro ao atualizar admin:", adminEmail, updateError);
        }
        console.log("[SERVER] perfil_lider.is_admin_global para:", allow.join(", "));
      }
    }
  } catch (err) {
    console.error("[SERVER] Erro ao inicializar banco:", err);
  }
}

// Helper para verificar usuário de forma robusta
async function verifyUser(token: string) {
  return verifyUserLib(supabaseAdmin, token);
}

/** Resolve perfil_lider.id a partir do id do zelador ou do tenant_id (ex.: tenant compartilhado). */
async function resolveLeaderId(idOrTenantId: string): Promise<string> {
  return resolveLeaderIdLib(supabaseAdmin, idOrTenantId);
}

async function ensurePerfilLiderForMural(user: { id: string; email?: string | null }) {
  if (!user?.id) return;
  const email = (user.email || '').toLowerCase().trim();
  if (email.endsWith('@axecloud.internal')) return;
  const { data: filhoRow } = await supabaseAdmin
    .from('filhos_de_santo')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (filhoRow) return;
  const { data: row } = await supabaseAdmin.from('perfil_lider').select('id').eq('id', user.id).maybeSingle();
  if (row) return;
  const upsertEmail = email || `u_${user.id.replace(/-/g, '')}@placeholder.axecloud.local`;
  const { error } = await supabaseAdmin.from('perfil_lider').upsert(
    {
      id: user.id,
      email: upsertEmail,
      nome_terreiro: 'Meu Terreiro',
      role: 'admin',
      tenant_id: user.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  );
  if (error) console.error('[SERVER] ensurePerfilLiderForMural:', error.message);
}

function isMissingColumnErr(error: any, columnName: string) {
  const message = error?.message || '';
  return message.includes(`column "${columnName}" does not exist`) || error?.code === 'PGRST204';
}

function authUserIdFromToken(user: { id?: string }, bearerToken: string): string {
  let id = typeof user?.id === 'string' ? user.id.trim() : '';
  if (id.length > 10) return id;
  const raw = bearerToken.replace(/^Bearer\s+/i, '').trim();
  if (!raw.includes('.')) return '';
  const b64 = raw.split('.')[1];
  if (!b64) return '';
  const tryParse = (buf: Buffer) => JSON.parse(buf.toString('utf8')) as { sub?: string };
  try {
    const p = tryParse(Buffer.from(b64, 'base64url'));
    if (typeof p.sub === 'string' && p.sub.length > 10) return p.sub.trim();
  } catch {
    try {
      const pad = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
      const p = tryParse(Buffer.from(pad, 'base64'));
      if (typeof p.sub === 'string' && p.sub.length > 10) return p.sub.trim();
    } catch {
      /* ignore */
    }
  }
  return '';
}

async function ensureSubscriptionForMural(zeladorId: string, logicalTenant: string) {
  const { data: row } = await supabaseAdmin.from('subscriptions').select('id').eq('id', zeladorId).maybeSingle();
  if (row) return;
  const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
  let payload: Record<string, unknown> = {
    id: zeladorId,
    tenant_id: logicalTenant,
    plan: 'premium',
    status: 'active',
    expires_at: expires,
  };
  let { error } = await supabaseAdmin.from('subscriptions').upsert(payload, { onConflict: 'id' });
  if (error && isMissingColumnErr(error, 'tenant_id')) {
    delete payload.tenant_id;
    ({ error } = await supabaseAdmin.from('subscriptions').upsert(payload, { onConflict: 'id' }));
  }
  if (error) console.error('[SERVER] ensureSubscriptionForMural:', error.message);
}

async function startServer() {
  console.log("[SERVER] Iniciando processo de boot...");
  const app = express();
  const PORT = 3000;

  /** Na Vercel o path interno pode ser `/api/index`; restaura o URL público a partir de headers. */
  app.use((req, _res, next) => {
    if (process.env.VERCEL === "1") {
      const orig = typeof req.originalUrl === "string" ? req.originalUrl.split("#")[0] : "";
      if (orig.startsWith("/api/") && orig !== req.url) {
        delete (req as any)._parsedUrl;
        req.url = orig;
        return next();
      }
      const h = req.headers;
      const candidates = [
        h["x-vercel-original-url"],
        h["x-forwarded-uri"],
        h["x-invoke-path"],
      ].filter((x): x is string => typeof x === "string" && x.length > 0);
      for (const raw of candidates) {
        try {
          const pathAndQuery = raw.startsWith("http")
            ? new URL(raw).pathname + new URL(raw).search
            : raw.split("#")[0];
          if (pathAndQuery.startsWith("/api/") && pathAndQuery !== req.url) {
            delete (req as any)._parsedUrl;
            req.url = pathAndQuery;
            break;
          }
        } catch {
          /* ignorar header inválido */
        }
      }
    }
    next();
  });

  // Middleware de log global (antes de qualquer rota)
  app.use((req, res, next) => {
    const u = req.url || "";
    if (!u.startsWith('/@vite') && !u.startsWith('/src')) {
      console.log(`[SERVER] ${req.method} ${u}`);
    }
    next();
  });

  app.use(compression({
    brotli: { params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 5 } },
    level: 5,
    filter: (_req, res) => {
      const type = String(res.getHeader("Content-Type") || "").toLowerCase();
      if (!type) return false;
      return /^(text\/(?:html|plain|css)|application\/(?:javascript|json)|image\/svg\+xml)(?:;|$)/.test(type);
    },
  }));

  // CORS endurecido — origens explícitas, sem "*" quando credentials=true.
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (isAllowedCorsOrigin(origin)) return callback(null, true);
        return callback(new Error(`CORS bloqueado para origem: ${origin}`));
      },
      credentials: true,
      methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: [
        "Authorization",
        "Content-Type",
        "Accept",
        "apikey",
        "X-Client-Info",
        "X-Requested-With",
        "X-Supabase-Api-Version",
        "Range",
      ],
      exposedHeaders: ["Content-Length", "Content-Type", "Content-Range", "X-Request-Id"],
      maxAge: 86400,
      optionsSuccessStatus: 204,
    })
  );
  app.use(express.json({ limit: '10mb' }));

  // Fase 3 — Cache-Control HTTP: padrão seguro; rotas de leitura estável sobrescrevem antes do res.json.
  const pathOnlyForCache = (req: express.Request) =>
    typeof req.path === "string" && req.path.length > 0
      ? req.path
      : String(req.url || "").split("?")[0] || "";
  app.use((req, res, next) => {
    if (!pathOnlyForCache(req).startsWith("/api")) return next();
    const m = (req.method || "GET").toUpperCase();
    if (m === "OPTIONS" || m === "TRACE" || m === "HEAD") return next();
    res.setHeader("Cache-Control", "private, no-store, must-revalidate");
    next();
  });

  app.get("/api/public-config", (_req, res) => {
    const cfg = getRuntimePublicConfig();
    res.json({
      supabaseUrl: cfg.supabaseUrl,
      supabaseAnonKey: cfg.supabaseAnonKey,
      vapidPublicKey: cfg.vapidPublicKey,
    });
  });

  app.get("/api/health-check", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Middleware de log para todas as requisições API
  app.use("/api", (req, _res, next) => {
    console.log(`[API LOG] ${req.method} ${req.url}`);
    next();
  });

  app.get("/api/ping", (req, res) => {
    res.json({ status: "pong", timestamp: new Date().toISOString() });
  });

  // API Route: Web Push Subscribe
  app.post("/api/push-subscribe", async (req, res) => {
    const user = await requireAuthOrRespond(supabaseAdmin, req, res);
    if (!user) return;

    const { subscription, userId, tenantId } = req.body;
    
    if (!subscription || !userId || !tenantId) {
      return res.status(400).json({ error: "Dados incompletos para inscrição" });
    }
    if (user.id !== userId) {
      return res.status(403).json({ error: "Acesso negado" });
    }

    try {
      const ok = await assertUserCanAccessTenant(supabaseAdmin, user, String(tenantId));
      if (!ok) return res.status(403).json({ error: "Acesso negado" });

      const metaRole = String(user.user_metadata?.role || '').toLowerCase();
      const { data: filhoRow } = await supabaseAdmin
        .from('filhos_de_santo')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();
      if (metaRole !== 'filho' && !filhoRow) {
        return res.status(403).json({ error: 'Apenas filhos de santo podem ativar notificações push.' });
      }

      const { error } = await supabaseAdmin
        .from('push_subscriptions')
        .upsert({
          user_id: userId,
          tenant_id: tenantId,
          subscription_object: subscription,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id,tenant_id' });

      if (error) throw error;
      res.json({ success: true });
    } catch (error: any) {
      console.error("[PUSH] Erro ao salvar inscrição:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/push-broadcast", async (req, res) => {
    const user = await requireAuthOrRespond(supabaseAdmin, req, res);
    if (!user) return;
    try {
      const { tenantId, title, body, url } = req.body || {};
      if (!tenantId) return res.status(400).json({ error: "tenantId é obrigatório" });
      const ok = await assertZeladorTenantAccess(supabaseAdmin, resolveLeaderId, user.id, String(tenantId));
      if (!ok) return res.status(403).json({ error: "Acesso negado" });
      const result = await sendPushNotification(String(tenantId), {
        title: String(title || "AxéCloud"),
        body: String(body || ""),
        url: String(url || "/calendar"),
      });
      res.json({ success: true, sentCount: result.sent });
    } catch (error: any) {
      console.error("[PUSH] push-broadcast:", error);
      res.status(500).json({ error: safeErrorMessage(error, "Erro ao enviar notificações") });
    }
  });

  app.post("/api/push-direct", pushDirectRateLimit, async (req, res) => {
    const user = await requireAuthOrRespond(supabaseAdmin, req, res);
    if (!user) return;
    try {
      const { childId, title, body, url } = req.body || {};
      if (!childId) return res.status(400).json({ error: "childId é obrigatório" });

      const { data: filho, error: filhoErr } = await supabaseAdmin
        .from("filhos_de_santo")
        .select("id, user_id, tenant_id, lider_id")
        .eq("id", childId)
        .maybeSingle();
      if (filhoErr || !filho) return res.status(404).json({ error: "Filho não encontrado" });

      const houseRef = String(filho.tenant_id || filho.lider_id || "");
      const okHouse = await assertZeladorTenantAccess(
        supabaseAdmin,
        resolveLeaderId,
        user.id,
        houseRef
      );
      if (!okHouse) return res.status(403).json({ error: "Acesso negado" });

      if (!filho.user_id) {
        return res.json({ success: false, message: "Filho sem conta de login vinculada." });
      }

      const { data: subs, error: subErr } = await supabaseAdmin
        .from("push_subscriptions")
        .select("subscription_object")
        .eq("user_id", filho.user_id);
      if (subErr) throw subErr;

      const payload = JSON.stringify({
        title: String(title || "AxéCloud"),
        body: String(body || ""),
        url: String(url || "/"),
      });
      let sentCount = 0;
      for (const row of subs || []) {
        try {
          await webpush.sendNotification(row.subscription_object, payload);
          sentCount++;
        } catch (e: any) {
          if (e?.statusCode === 410 || e?.statusCode === 404) {
            const endpoint = row.subscription_object?.endpoint;
            if (endpoint) {
              await supabaseAdmin
                .from("push_subscriptions")
                .delete()
                .eq("subscription_object->>endpoint", endpoint);
            }
          }
        }
      }
      res.json({ success: true, sentCount });
    } catch (error: any) {
      console.error("[PUSH] push-direct:", error);
      res.status(500).json({ error: safeErrorMessage(error, "Erro ao enviar notificação") });
    }
  });

  async function notifyMensalidadeConfirmadaWhatsApp(
    sb: typeof supabaseAdmin,
    args: {
      tenantId: string;
      zeladorId: string;
      filhoId: string;
      nome: string;
      valor: number;
      competencia: string;
    }
  ): Promise<void> {
    const { data: profile } = await sb
      .from("perfil_lider")
      .select("nome_terreiro")
      .eq("id", args.zeladorId)
      .maybeSingle();
    const competenciaFmt = args.competencia.includes("-")
      ? format(parseISO(args.competencia), "MM/yyyy")
      : args.competencia;
    await sendWhatsAppForTenant(sb, {
      tenantId: args.zeladorId,
      tipo: "mensalidade_confirmada",
      filhoId: args.filhoId,
      variables: {
        nome_filho: args.nome,
        valor: args.valor.toFixed(2),
        competencia: competenciaFmt,
        nome_terreiro: String(profile?.nome_terreiro || "Terreiro"),
      },
    });
  }

  // Helper: enviar push apenas para filhos de santo (tabela push_subscriptions por user_id)
  async function sendPushNotification(
    tenantId: string,
    payload: { title: string; body: string; url: string }
  ): Promise<{ sent: number; targets: number }> {
    try {
      const resolvedTenant = await resolveLeaderId(tenantId);
      const { data: filhos, error: filhosErr } = await supabaseAdmin
        .from('filhos_de_santo')
        .select('user_id')
        .or(`tenant_id.eq.${resolvedTenant},lider_id.eq.${resolvedTenant},tenant_id.eq.${tenantId},lider_id.eq.${tenantId}`);
      if (filhosErr) throw filhosErr;
      const userIds = [...new Set((filhos || []).map((f: any) => f.user_id).filter(Boolean))];
      if (userIds.length === 0) {
        console.warn('[PUSH] Nenhum filho de santo vinculado a este terreiro para notificar.');
        return { sent: 0, targets: 0 };
      }

      const { data: subscriptions, error } = await supabaseAdmin
        .from('push_subscriptions')
        .select('subscription_object')
        .in('user_id', userIds);

      if (error) throw error;
      if (!subscriptions || subscriptions.length === 0) {
        console.warn('[PUSH] Filhos do terreiro sem inscrição push (push_subscriptions vazia).');
        return { sent: 0, targets: userIds.length };
      }

      console.log(`[PUSH] Enviando para ${subscriptions.length} inscrição(ões) de filhos do terreiro`);

      let sent = 0;
      await Promise.all(
        subscriptions.map((sub: any) =>
          webpush
            .sendNotification(sub.subscription_object, JSON.stringify(payload))
            .then(() => {
              sent++;
            })
            .catch((err) => {
              if (err.statusCode === 410 || err.statusCode === 404) {
                console.log('[PUSH] Removendo inscrição inválida');
                return supabaseAdmin
                  .from('push_subscriptions')
                  .delete()
                  .eq('subscription_object->>endpoint', sub.subscription_object.endpoint);
              }
              console.error('[PUSH] Erro ao enviar notificação individual:', err);
            })
        )
      );

      console.log(`[PUSH] Concluído: ${sent}/${subscriptions.length} enviados`);
      return { sent, targets: userIds.length };
    } catch (error) {
      console.error('[PUSH] Erro geral ao enviar notificações:', error);
      return { sent: 0, targets: 0 };
    }
  }

  // API Route: Create Notice (Mural) and Trigger Push
  app.post("/api/notices", async (req, res) => {
    const { titulo, conteudo, categoria, tenantId: _bodyTenantIgnored, expiracao } = req.body;

    try {
      const user = await requireApiUser(supabaseAdmin, req, res);
      if (!user) return;
      const token = getBearerToken(req);

      if (!titulo || !conteudo) {
        return res.status(400).json({ error: "Título e conteúdo são obrigatórios." });
      }

      const zeladorId = authUserIdFromToken(user, token);
      if (!zeladorId) {
        return res.status(401).json({ error: "Sessão inválida (id do usuário ausente)." });
      }

      await ensurePerfilLiderForMural({ id: zeladorId, email: user.email });

      const { data: pl } = await supabaseAdmin
        .from('perfil_lider')
        .select('id, tenant_id')
        .eq('id', zeladorId)
        .maybeSingle();
      if (!pl?.id) {
        return res.status(500).json({
          error: 'Não foi possível garantir perfil_lider para sua conta. Confira colunas obrigatórias da tabela ou execute o SQL de migração.',
        });
      }

      const logicalTenant =
        typeof pl.tenant_id === 'string' && pl.tenant_id.length > 10 ? pl.tenant_id : zeladorId;
      await ensureSubscriptionForMural(zeladorId, logicalTenant);

      let sub: { id?: string; tenant_id?: string | null } | null = null;
      const subRes = await supabaseAdmin.from('subscriptions').select('id, tenant_id').eq('id', zeladorId).maybeSingle();
      if (!subRes.error) sub = subRes.data;

      const resolvedLeader = await resolveLeaderId(zeladorId);
      const tenantCandidates = [zeladorId, resolvedLeader, pl.tenant_id, sub?.tenant_id].filter(
        (v): v is string => typeof v === 'string' && v.length > 10
      );
      const uniqueTenants = [...new Set(tenantCandidates)];

      const baseRow = {
        titulo,
        conteudo,
        categoria: categoria || 'Geral',
        expiracao: expiracao || null,
        data_publicacao: new Date().toISOString(),
      };

      let notice: any = null;
      let lastErr: any = null;
      const errLog: string[] = [];
      for (const tid of uniqueTenants) {
        const ins = await supabaseAdmin
          .from('mural_avisos')
          .insert({ ...baseRow, tenant_id: tid })
          .select()
          .single();
        if (!ins.error) {
          notice = ins.data;
          break;
        }
        lastErr = ins.error;
        errLog.push(`${tid}: ${ins.error?.message || ins.error?.code || JSON.stringify(ins.error)}`);
      }

      if (!notice) {
        console.error('[SERVER] mural insert failed; candidatos:', uniqueTenants.join(', '));
        console.error('[SERVER] mural erros por tenant_id:', errLog.join(' | '));
        return res.status(500).json({
          error: lastErr?.message || 'Não foi possível publicar o aviso (FK tenant_id).',
          details: {
            zeladorId,
            candidatos: uniqueTenants,
            perfil_lider_id: pl.id,
            perfil_lider_tenant_id: pl.tenant_id ?? null,
            erros: errLog,
            hint:
              'Confirme que o .env aponta para o mesmo projeto Supabase onde rodou o SQL. Rode scripts/fix_mural_avisos_fk.sql ou scripts/remove_mural_tenant_fk.sql.',
          },
        });
      }

      const pushTargetTenant = pl.tenant_id || zeladorId;
      const pushResult = await sendPushNotification(pushTargetTenant, {
        title: `Novo Aviso: ${titulo}`,
        body: conteudo.substring(0, 100) + (conteudo.length > 100 ? '...' : ''),
        url: '/mural'
      });

      const { data: leaderProfile } = await supabaseAdmin
        .from("perfil_lider")
        .select("nome_terreiro")
        .eq("id", zeladorId)
        .maybeSingle();
      void dispatchMuralWhatsApp(
        supabaseAdmin,
        zeladorId,
        titulo,
        String(leaderProfile?.nome_terreiro || "Terreiro")
      ).catch((err) => console.error("[MURAL WA] auto-dispatch:", err));

      res.json({ success: true, data: notice, push: pushResult });
    } catch (error: any) {
      console.error("[SERVER] Erro ao criar aviso:", error);
      res.status(500).json({ error: error.message });
    }
  });

  /** Mesmo conjunto de tenant_ids que o POST tenta ao publicar — aviso só pode ser apagado pelo líder dono daquele tenant_id. */
  async function leaderMayDeleteMuralNotice(zeladorId: string, noticeTenantId: string): Promise<boolean> {
    const { data: pl } = await supabaseAdmin
      .from("perfil_lider")
      .select("id, tenant_id")
      .eq("id", zeladorId)
      .maybeSingle();
    if (!pl?.id) return false;
    let sub: { tenant_id?: string | null } | null = null;
    const subRes = await supabaseAdmin.from("subscriptions").select("id, tenant_id").eq("id", zeladorId).maybeSingle();
    if (!subRes.error) sub = subRes.data;
    const resolvedLeader = await resolveLeaderId(zeladorId);
    const tenantCandidates = [zeladorId, resolvedLeader, pl.tenant_id, sub?.tenant_id].filter(
      (v): v is string => typeof v === "string" && v.length > 10
    );
    const uniqueTenants = [...new Set(tenantCandidates)];
    const nt = String(noticeTenantId || "");
    if (uniqueTenants.includes(nt)) return true;
    try {
      const rn = await resolveLeaderId(nt);
      return uniqueTenants.includes(rn);
    } catch {
      return false;
    }
  }

  app.delete("/api/notices/:id", async (req, res) => {
    const id = String(req.params.id || "").trim();
    if (!id) return res.status(400).json({ error: "id obrigatório" });
    try {
      const user = await requireApiUser(supabaseAdmin, req, res);
      if (!user) return;
      const token = getBearerToken(req);
      const zeladorId = authUserIdFromToken(user, token);
      if (!zeladorId) return res.status(401).json({ error: "Sessão inválida (id do usuário ausente)." });

      const { data: notice, error: nErr } = await supabaseAdmin
        .from("mural_avisos")
        .select("id, tenant_id")
        .eq("id", id)
        .maybeSingle();
      if (nErr) throw nErr;
      if (!notice) return res.status(404).json({ error: "Aviso não encontrado" });

      const allowed = await leaderMayDeleteMuralNotice(zeladorId, String(notice.tenant_id || ""));
      if (!allowed) return res.status(403).json({ error: "Sem permissão para excluir este aviso." });

      const { error: delErr } = await supabaseAdmin.from("mural_avisos").delete().eq("id", id);
      if (delErr) throw delErr;
      res.json({ success: true });
    } catch (error: any) {
      console.error("[SERVER] DELETE /api/notices/:id:", error?.message || error);
      res.status(500).json({ error: error.message || "Erro ao excluir aviso" });
    }
  });

  // API Route: Create Inventory Item (Almoxarifado) and Trigger Push
  app.post("/api/inventory", async (req, res) => {
    const { item, quantidade_atual, quantidade_minima, categoria, tenantId, autorId } = req.body;

    try {
      const user = await requireApiUser(supabaseAdmin, req, res);
      if (!user) return;

      const effectiveTenant = String(tenantId || user.id);
      const ok = await assertZeladorTenantAccess(supabaseAdmin, resolveLeaderId, user.id, effectiveTenant);
      if (!ok) return res.status(403).json({ error: "Acesso negado" });

      const { data: inventoryItem, error } = await supabaseAdmin
        .from('almoxarifado')
        .insert({
          item,
          quantidade_atual: Number(quantidade_atual) || 0,
          quantidade_minima: Number(quantidade_minima) || 5,
          categoria,
          lider_id: user.id,
          tenant_id: effectiveTenant,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      res.json({ success: true, data: inventoryItem });
    } catch (error: any) {
      console.error("[SERVER] Erro ao criar item no almoxarifado:", error);
      res.status(500).json({ error: error.message });
    }
  });

  const handleStoreProductsGet = async (req: express.Request, res: express.Response) => {
    const access = await requireTenantReadAccess(supabaseAdmin, req, res, req.query.tenantId);
    if (!access) return;
    try {
      const { data, error } = await supabaseAdmin
        .from("produtos")
        .select("*")
        .eq("tenant_id", access.tenantId)
        .is("deleted_at", null)
        .order("nome");
      if (error) throw error;
      res.json({ data: data || [] });
    } catch (err: any) {
      console.error("[SERVER] Erro ao buscar produtos:", err.message);
      res.status(500).json({ error: err.message });
    }
  };
  app.get("/api/v1/store/products", handleStoreProductsGet);
  app.get("/api/store/products", handleStoreProductsGet);

  const handleStoreProductsPost = async (req: express.Request, res: express.Response) => {
    try {
      const user = await requireApiUser(supabaseAdmin, req, res);
      if (!user) return;

      const {
        tenantId,
        nome,
        descricao = "",
        preco = 0,
        estoque_atual = 0,
        estoque_minimo = 0,
        categoria = "Velas",
        imagem_url = "",
      } = req.body;

      if (!nome || typeof nome !== "string" || !nome.trim()) {
        return res.status(400).json({ error: "Nome do produto é obrigatório." });
      }
      if (!tenantId || typeof tenantId !== "string") {
        return res.status(400).json({ error: "tenantId é obrigatório." });
      }

      const { data: pl } = await supabaseAdmin
        .from("perfil_lider")
        .select("role, tenant_id, is_admin_global")
        .eq("id", user.id)
        .maybeSingle();

      if (pl?.role === "filho") {
        return res.status(403).json({ error: "Sem permissão para cadastrar produtos." });
      }

      const allowed =
        !!pl?.is_admin_global ||
        user.id === tenantId ||
        (!!pl?.tenant_id && pl.tenant_id === tenantId);

      if (!allowed) {
        return res.status(403).json({ error: "Você não pode cadastrar produtos neste terreiro." });
      }

      const row = {
        nome: nome.trim(),
        descricao: String(descricao ?? "").trim(),
        preco: Number(preco) || 0,
        estoque_atual: Number(estoque_atual) || 0,
        estoque_minimo: Number(estoque_minimo) || 0,
        categoria: categoria || "Velas",
        imagem_url: imagem_url && String(imagem_url).trim() ? String(imagem_url).trim() : null,
        tenant_id: tenantId,
      };

      const { data, error } = await supabaseAdmin.from("produtos").insert([row]).select().single();
      if (error) throw error;
      res.status(201).json({ success: true, data });
    } catch (err: any) {
      console.error("[SERVER] Erro ao criar produto:", err.message || err);
      res.status(500).json({ error: err.message || "Erro ao salvar produto" });
    }
  };
  app.post("/api/v1/store/products", handleStoreProductsPost);
  app.post("/api/store/products", handleStoreProductsPost);

  const handleStoreProductDelete = async (req: express.Request, res: express.Response) => {
    try {
      const user = await requireApiUser(supabaseAdmin, req, res);
      if (!user) return;

      const productId = String(req.params.id || "").trim();
      const tenantId = normalizeQueryTenantId(req.query.tenantId);
      if (!productId || !tenantId) {
        return res.status(400).json({ error: "id e tenantId são obrigatórios" });
      }

      const { data: pl } = await supabaseAdmin
        .from("perfil_lider")
        .select("role, tenant_id, is_admin_global")
        .eq("id", user.id)
        .maybeSingle();

      if (pl?.role === "filho") {
        return res.status(403).json({ error: "Sem permissão para excluir produtos." });
      }

      const allowed =
        !!pl?.is_admin_global ||
        user.id === tenantId ||
        (!!pl?.tenant_id && pl.tenant_id === tenantId);

      if (!allowed) {
        return res.status(403).json({ error: "Você não pode excluir produtos neste terreiro." });
      }

      const { data: row } = await supabaseAdmin
        .from("produtos")
        .select("id, tenant_id")
        .eq("id", productId)
        .maybeSingle();

      if (!row) return res.status(404).json({ error: "Produto não encontrado" });
      if (String(row.tenant_id) !== tenantId) {
        return res.status(403).json({ error: "Acesso negado" });
      }

      const { error: softErr } = await supabaseAdmin
        .from("produtos")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", productId)
        .eq("tenant_id", tenantId);

      if (softErr) {
        const { error: hardErr } = await supabaseAdmin
          .from("produtos")
          .delete()
          .eq("id", productId)
          .eq("tenant_id", tenantId);
        if (hardErr) throw hardErr;
      }

      res.json({ success: true });
    } catch (err: any) {
      console.error("[SERVER] Erro ao excluir produto:", err.message || err);
      res.status(500).json({ error: err.message || "Erro ao excluir produto" });
    }
  };
  app.delete("/api/v1/store/products/:id", handleStoreProductDelete);
  app.delete("/api/store/products/:id", handleStoreProductDelete);

  const handleStoreProductImageSuggestion = async (req: express.Request, res: express.Response) => {
    try {
      const user = await requireApiUser(supabaseAdmin, req, res);
      if (!user) return;

      const raw = typeof req.query.q === "string" ? req.query.q.trim() : "";
      if (raw.length < 2) return res.json({ url: null });

      const ptEn: Record<string, string> = {
        vela: "candle",
        velas: "candles",
        guia: "prayer ribbon",
        guias: "prayer ribbons",
        erva: "herbs",
        ervas: "herbs",
        incenso: "incense",
        defumacao: "incense smoke cleansing",
        manto: "ceremonial robe",
        roupa: "clothing",
        colar: "necklace",
        livro: "book",
        cruz: "cross",
        copo: "cup",
        prato: "plate",
      };
      const dictBoost = raw
        .split(/\s+/)
        .map((w) => {
          const k = w.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/[^a-z]/gi, "");
          return ptEn[k] || w;
        })
        .join(" ")
        .trim();

      let searchQuery = dictBoost || raw;
      try {
        const trUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(raw)}&langpair=pt|en`;
        const trRes = await fetch(trUrl);
        if (trRes.ok) {
          const tj = (await trRes.json()) as { responseData?: { translatedText?: string } };
          const tr = (tj?.responseData?.translatedText || "").trim();
          if (tr.length > 1 && !/^MYMEMORY\s+WARNING/i.test(tr) && tr.toLowerCase() !== raw.toLowerCase()) {
            searchQuery = `${tr} ${dictBoost}`.trim();
          }
        }
      } catch {
        /* ignore */
      }

      const pexelsKey = process.env.PEXELS_API_KEY || process.env.PEXELS_ACCESS_KEY;
      if (!pexelsKey) {
        return res.json({ url: null });
      }

      const pxUrl = `https://api.pexels.com/v1/search?query=${encodeURIComponent(searchQuery.slice(0, 120))}&per_page=1`;
      const pxRes = await fetch(pxUrl, { headers: { Authorization: pexelsKey } });
      if (!pxRes.ok) {
        console.warn("[PEXELS] HTTP", pxRes.status);
        return res.json({ url: null });
      }
      const pj = (await pxRes.json()) as { photos?: Array<{ src?: { large?: string; medium?: string } }> };
      const photo = pj?.photos?.[0];
      const url = photo?.src?.large || photo?.src?.medium || null;
      return res.json({ url });
    } catch (err: any) {
      console.error("[product-image-suggestion]", err?.message || err);
      return res.status(500).json({ error: err?.message || "Erro ao sugerir imagem" });
    }
  };
  app.get("/api/v1/store/product-image-suggestion", handleStoreProductImageSuggestion);
  app.get("/api/store/product-image-suggestion", handleStoreProductImageSuggestion);

  // API Route: Pix Config — GET e POST (bypasses RLS, resolve FK automaticamente)
  app.get("/api/v1/financial/pix-config", async (req, res) => {
    const access = await requireTenantReadAccess(supabaseAdmin, req, res, req.query.tenantId);
    if (!access) return;
    const { tenantId } = access;

    try {
      const resolvedId = await resolveLeaderId(tenantId);
      const { data, error } = await supabaseAdmin
        .from('configuracoes_pix')
        .select(getPixConfigSelectClause())
        .or(`terreiro_id.eq.${resolvedId},terreiro_id.eq.${tenantId}`)
        .maybeSingle();

      if (error) throw error;
      res.setHeader("Cache-Control", "private, max-age=60, stale-while-revalidate=300");
      res.json({ data });
    } catch (err: any) {
      console.error("[SERVER] Erro ao buscar pix config:", err.message || err);
      res.status(500).json({ error: safeErrorMessage(err, "Erro ao buscar configuração PIX") });
    }
  });

  app.post("/api/v1/financial/pix-config", async (req, res) => {
    try {
      const user = await requireApiUser(supabaseAdmin, req, res);
      if (!user) return;

      const { terreiro_id, chave_pix, tipo_chave, nome_beneficiario, valor_mensalidade, dia_vencimento } = req.body;
      if (!terreiro_id) return res.status(400).json({ error: "terreiro_id required" });

      const ok = await assertZeladorTenantAccess(supabaseAdmin, resolveLeaderId, user.id, String(terreiro_id));
      if (!ok) return res.status(403).json({ error: "Acesso negado" });

      const resolvedId = await resolveLeaderId(terreiro_id);
      const configData: any = { terreiro_id: resolvedId, chave_pix, tipo_chave, nome_beneficiario };
      if (valor_mensalidade !== undefined) configData.valor_mensalidade = parseFloat(valor_mensalidade) || 0;
      if (dia_vencimento !== undefined) {
        const dia = parseInt(dia_vencimento);
        if (dia >= 1 && dia <= 31) configData.dia_vencimento = dia;
      }

      const sanitizedConfigData = sanitizePixConfigData(configData);
      const { data: existing } = await supabaseAdmin
        .from('configuracoes_pix')
        .select('id')
        .or(`terreiro_id.eq.${resolvedId},terreiro_id.eq.${terreiro_id}`)
        .maybeSingle();

      const { error } = existing
        ? await supabaseAdmin.from('configuracoes_pix').update(sanitizedConfigData).eq('id', existing.id)
        : await supabaseAdmin.from('configuracoes_pix').insert([sanitizedConfigData]);

      if (error) throw error;
      res.json({ success: true });
    } catch (err: any) {
      console.error("[SERVER] Erro ao salvar pix config:", err.message || err);
      res.status(500).json({ error: err.message || "Erro ao salvar configuração PIX" });
    }
  });

  app.post("/api/v1/financial/confirm-mensalidade", async (req, res) => {
    try {
      const user = await requireApiUser(supabaseAdmin, req, res);
      if (!user) return;

      const { filho_id, filho_nome, valor, competencia_date, tenant_id } = req.body || {};
      if (!filho_id || !tenant_id) {
        return res.status(400).json({ error: "filho_id e tenant_id são obrigatórios" });
      }
      const v = Number(valor);
      if (!Number.isFinite(v) || v <= 0) {
        return res.status(400).json({ error: "valor inválido" });
      }

      const { data: child, error: childErr } = await supabaseAdmin
        .from("filhos_de_santo")
        .select("id, nome, tenant_id, lider_id")
        .eq("id", filho_id)
        .maybeSingle();
      if (childErr || !child) {
        return res.status(404).json({ error: "Filho não encontrado" });
      }

      const resolvedTenant = await resolveLeaderId(tenant_id as string);
      const okTenant = await assertZeladorTenantAccess(supabaseAdmin, resolveLeaderId, user.id, String(tenant_id));
      if (!okTenant) return res.status(403).json({ error: "Acesso negado" });

      const sameHouse =
        child.tenant_id === tenant_id ||
        child.tenant_id === resolvedTenant ||
        child.lider_id === user.id ||
        child.lider_id === tenant_id ||
        child.lider_id === resolvedTenant;
      if (!sameHouse) {
        return res.status(403).json({ error: "Sem permissão para confirmar este pagamento" });
      }

      const paymentDate = new Date().toISOString().split("T")[0];
      const compDate = (competencia_date && String(competencia_date).trim()) || paymentDate;
      const nome = (filho_nome && String(filho_nome).trim()) || child.nome || "Filho";

      const rpcArgs = {
        p_filho_id: filho_id,
        p_filho_nome: nome,
        p_valor: v,
        p_competencia_date: compDate,
        p_payment_date: paymentDate,
        p_tenant_id: tenant_id,
        p_lider_id: user.id,
      };

      const { data: rpcId, error: rpcErr } = await supabaseAdmin.rpc("confirm_mensalidade_payment", rpcArgs);
      if (!rpcErr && rpcId) {
        void notifyMensalidadeConfirmadaWhatsApp(supabaseAdmin, {
          tenantId: String(tenant_id),
          zeladorId: user.id,
          filhoId: String(filho_id),
          nome,
          valor: v,
          competencia: compDate,
        }).catch((err) => console.error("[confirm-mensalidade WA]:", err));
        return res.json({ success: true, id: rpcId, via: "rpc" });
      }
      if (rpcErr) {
        console.warn("[SERVER] RPC confirm_mensalidade_payment indisponível — fallback:", rpcErr.message || rpcErr);
      }

      const row: Record<string, unknown> = {
        tipo: "entrada",
        valor: v,
        categoria: "Mensalidade",
        data: paymentDate,
        descricao: `Mensalidade - ${nome} (competência ${compDate}) (ID:${filho_id})`,
        tenant_id,
        lider_id: user.id,
        filho_id,
      };

      const { data: inserted, error: insErr } = await supabaseAdmin.from("financeiro").insert([row]).select("id").single();
      if (insErr) {
        console.error("[SERVER] confirm-mensalidade fallback insert:", insErr);
        return res.status(500).json({ error: insErr.message || "Falha ao registrar pagamento" });
      }
      void notifyMensalidadeConfirmadaWhatsApp(supabaseAdmin, {
        tenantId: String(tenant_id),
        zeladorId: user.id,
        filhoId: String(filho_id),
        nome,
        valor: v,
        competencia: compDate,
      }).catch((err) => console.error("[confirm-mensalidade WA]:", err));
      return res.json({ success: true, id: inserted?.id, via: "insert" });
    } catch (err: any) {
      console.error("[SERVER] confirm-mensalidade:", err?.message || err);
      res.status(500).json({ error: err?.message || "Erro interno" });
    }
  });

  app.post("/api/v1/financial/mensalidades/sync-pendentes", async (req, res) => {
    try {
      const user = await requireApiUser(supabaseAdmin, req, res);
      if (!user) return;
      const tenant_id = String((req.body || {}).tenant_id || "").trim();
      if (!tenant_id) return res.status(400).json({ error: "tenant_id obrigatório" });
      const ok = await assertZeladorTenantAccess(supabaseAdmin, resolveLeaderId, user.id, tenant_id);
      if (!ok) return res.status(403).json({ error: "Sem permissão" });
      const { created } = await syncMensalidadesPendentes(supabaseAdmin, resolveLeaderId, user.id, tenant_id);
      console.info("[SERVER] mensalidades/sync-pendentes: created =", created, "tenant =", tenant_id);
      res.json({ success: true, created });
    } catch (err: any) {
      console.error("[SERVER] mensalidades/sync-pendentes:", err?.message || err);
      res.status(500).json({ error: err?.message || "Erro interno" });
    }
  });

  app.get("/api/v1/financial/mensalidades", async (req, res) => {
    try {
      const user = await requireApiUser(supabaseAdmin, req, res);
      if (!user) return;
      const tenantId = String(req.query.tenantId || "").trim();
      const view = String(req.query.view || "pendentes").toLowerCase();
      if (!tenantId) return res.status(400).json({ error: "tenantId obrigatório" });
      const ok = await assertZeladorTenantAccess(supabaseAdmin, resolveLeaderId, user.id, tenantId);
      if (!ok) return res.status(403).json({ error: "Sem permissão" });
      const data =
        view === "pagas"
          ? await fetchMensalidadesPagasMesAtual(supabaseAdmin, tenantId, new Date())
          : await fetchMensalidadesPendentesList(supabaseAdmin, tenantId);
      res.json({ data });
    } catch (err: any) {
      console.error("[SERVER] mensalidades GET:", err?.message || err);
      res.status(500).json({ error: err?.message || "Erro interno" });
    }
  });

  app.post("/api/v1/financial/mensalidades/liquidar", async (req, res) => {
    try {
      const user = await requireApiUser(supabaseAdmin, req, res);
      if (!user) return;
      const { id, tenant_id, valor } = req.body || {};
      if (!id || !tenant_id) return res.status(400).json({ error: "id e tenant_id obrigatórios" });
      const ok = await assertZeladorTenantAccess(supabaseAdmin, resolveLeaderId, user.id, String(tenant_id));
      if (!ok) return res.status(403).json({ error: "Sem permissão" });
      const v = valor !== undefined && valor !== null ? Number(valor) : undefined;
      await liquidarMensalidadePendente(
        supabaseAdmin,
        resolveLeaderId,
        user.id,
        String(tenant_id),
        String(id),
        v
      );
      res.json({ success: true });
    } catch (err: any) {
      console.error("[SERVER] mensalidades/liquidar:", err?.message || err);
      res.status(500).json({ error: err?.message || "Erro interno" });
    }
  });

  app.post("/api/v1/financial/mensalidades/estornar", async (req, res) => {
    try {
      const user = await requireApiUser(supabaseAdmin, req, res);
      if (!user) return;
      const { id, tenant_id } = req.body || {};
      if (!id || !tenant_id) return res.status(400).json({ error: "id e tenant_id obrigatórios" });
      const ok = await assertZeladorTenantAccess(supabaseAdmin, resolveLeaderId, user.id, String(tenant_id));
      if (!ok) return res.status(403).json({ error: "Sem permissão" });
      await estornarMensalidadePaga(supabaseAdmin, resolveLeaderId, user.id, String(tenant_id), String(id), new Date());
      res.json({ success: true });
    } catch (err: any) {
      console.error("[SERVER] mensalidades/estornar:", err?.message || err);
      res.status(500).json({ error: err?.message || "Erro interno" });
    }
  });

  // API Route: Get Library Materials (bypasses RLS — filhos podem ler materiais do zelador)
  app.get("/api/v1/library/materials", async (req, res) => {
    const access = await requireTenantReadAccess(supabaseAdmin, req, res, req.query.tenantId);
    if (!access) return;

    try {
      const resolvedId = await resolveLeaderId(access.tenantId);
      const { data, error } = await supabaseAdmin
        .from('biblioteca')
        .select('*')
        .or(`tenant_id.eq.${resolvedId},tenant_id.eq.${access.tenantId}`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const enriched = await Promise.all(
        (data || []).map(async (row: { storage_path?: string | null; arquivo_url?: string | null }) => {
          const storagePath = String(row.storage_path || "").replace(/\\/g, "/");
          if (!storagePath) return row;
          const { data: signed } = await supabaseAdmin.storage
            .from("biblioteca_estudos")
            .createSignedUrl(storagePath, 3600);
          return {
            ...row,
            arquivo_url: signed?.signedUrl || row.arquivo_url,
          };
        })
      );

      res.json({ data: enriched });
    } catch (err: any) {
      console.error("[SERVER] Erro ao buscar materiais:", err.message || err);
      res.status(500).json({ error: err.message || "Erro ao buscar materiais" });
    }
  });

  app.post("/api/v1/library/upload-url", async (req, res) => {
    const { fileName, contentType, categoria, tenantId } = req.body;
    if (!fileName || !tenantId) {
      return res.status(400).json({ error: "Unauthorized or missing data" });
    }

    try {
      const user = await requireApiUser(supabaseAdmin, req, res);
      if (!user) return;

      const ok = await assertUserCanAccessTenant(supabaseAdmin, user, String(tenantId));
      if (!ok) return res.status(403).json({ error: "Acesso negado" });

      const safeCategoria = slugifyStoragePath(categoria || 'geral');
      const safeFileName = slugifyStoragePath(fileName);
      const storagePath = `${tenantId}/${safeCategoria}/${Date.now()}_${safeFileName}`;

      const { data, error } = await supabaseAdmin.storage
        .from('biblioteca_estudos')
        .createSignedUploadUrl(storagePath);

      if (error) throw error;
      res.json({
        path: storagePath,
        token: data.token,
        contentType: contentType || 'application/pdf'
      });
    } catch (error: any) {
      console.error("[SERVER] Erro ao criar URL de upload:", error.message || error);
      res.status(500).json({ error: error.message || "Erro ao preparar upload" });
    }
  });

  app.post("/api/v1/library/complete-upload", async (req, res) => {
    const { storagePath, titulo, categoria, tenantId } = req.body;
    if (!storagePath || !titulo || !tenantId) {
      return res.status(400).json({ error: "Unauthorized or missing data" });
    }

    try {
      const user = await requireApiUser(supabaseAdmin, req, res);
      if (!user) return;

      const ok = await assertUserCanAccessTenant(supabaseAdmin, user, String(tenantId));
      if (!ok) return res.status(403).json({ error: "Acesso negado" });

      const normalizedPath = String(storagePath || "").replace(/\\/g, "/");
      if (!normalizedPath.startsWith(`${tenantId}/`)) {
        return res.status(400).json({ error: "storagePath inválido para este tenant" });
      }

      const { data: signed, error: signErr } = await supabaseAdmin.storage
        .from('biblioteca_estudos')
        .createSignedUrl(normalizedPath, 3600 * 24 * 7);

      if (signErr) throw signErr;

      const { error: dbError } = await supabaseAdmin
        .from('biblioteca')
        .insert([{
          titulo,
          categoria,
          arquivo_url: signed?.signedUrl || null,
          tenant_id: tenantId,
          storage_path: normalizedPath
        }]);

      if (dbError) throw dbError;
      res.json({ success: true, publicUrl: signed?.signedUrl || null });
    } catch (error: any) {
      console.error("[SERVER] Erro ao finalizar upload:", error.message || error);
      res.status(500).json({ error: error.message || "Erro interno ao salvar material" });
    }
  });

  app.delete("/api/v1/library/material/:id", async (req, res) => {
    const user = await requireAuthOrRespond(supabaseAdmin, req, res);
    if (!user) return;

    const materialId = String(req.params.id || "").trim();
    const tenantId = normalizeQueryTenantId(req.query.tenantId);
    if (!materialId || !tenantId) {
      return res.status(400).json({ error: "id e tenantId são obrigatórios" });
    }

    const ok = await assertZeladorTenantAccess(supabaseAdmin, resolveLeaderId, user.id, tenantId);
    if (!ok) return res.status(403).json({ error: "Acesso negado" });

    try {
      const resolvedId = await resolveLeaderId(tenantId);
      const { data: row, error: fetchErr } = await supabaseAdmin
        .from("biblioteca")
        .select("id, tenant_id, storage_path")
        .eq("id", materialId)
        .maybeSingle();
      if (fetchErr) throw fetchErr;
      if (!row) return res.status(404).json({ error: "Material não encontrado" });

      const rowTenant = String(row.tenant_id || "");
      if (rowTenant !== tenantId && rowTenant !== resolvedId) {
        return res.status(403).json({ error: "Acesso negado" });
      }

      const storagePath = String(row.storage_path || "").replace(/\\/g, "/");
      if (storagePath) {
        await supabaseAdmin.storage.from("biblioteca_estudos").remove([storagePath]);
      }

      const { error: delErr } = await supabaseAdmin.from("biblioteca").delete().eq("id", materialId);
      if (delErr) throw delErr;

      res.json({ success: true });
    } catch (error: any) {
      console.error("[SERVER] Erro ao excluir material:", error.message || error);
      res.status(500).json({ error: safeErrorMessage(error, "Erro ao excluir material") });
    }
  });

  app.post("/api/v1/library/comment-notify", async (req, res) => {
    const user = await requireAuthOrRespond(supabaseAdmin, req, res);
    if (!user) return;

    const role = String(user.user_metadata?.role || "").toLowerCase();
    if (role !== "filho") {
      return res.status(403).json({ error: "Apenas filhos podem enviar esta notificação" });
    }

    const { tenantId, mensagem, link } = req.body || {};
    const tid = normalizeQueryTenantId(tenantId);
    if (!tid || !mensagem) {
      return res.status(400).json({ error: "tenantId e mensagem são obrigatórios" });
    }

    const ok = await assertUserCanAccessTenant(supabaseAdmin, user, tid);
    if (!ok) return res.status(403).json({ error: "Acesso negado" });

    try {
      const { error } = await supabaseAdmin.from("notificacoes").insert([
        {
          tenant_id: tid,
          tipo: "biblioteca_duvida",
          mensagem: String(mensagem).slice(0, 500),
          link: String(link || "library"),
          lida: false,
        },
      ]);
      if (error) throw error;
      res.json({ success: true });
    } catch (error: any) {
      console.error("[SERVER] comment-notify:", error.message || error);
      res.status(500).json({ error: safeErrorMessage(error, "Erro ao notificar zelador") });
    }
  });

  app.get("/api/v1/gallery/albums", async (req, res) => {
    const tenantId = String(req.query.tenantId || "").trim();
    if (!tenantId) return res.status(400).json({ error: "Dados incompletos" });

    try {
      const access = await requireApiTenantRead(supabaseAdmin, req, res, tenantId);
      if (!access) return;

      const { data: albums, error: albumsError } = await supabaseAdmin
        .from("gallery_albums")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      if (albumsError) throw albumsError;

      const { data: media, error: mediaError } = await supabaseAdmin
        .from("gallery_media")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      if (mediaError) throw mediaError;

      const usedBytes = (media || []).reduce((acc: number, item: any) => acc + Number(item.size_bytes || 0), 0);
      res.json({
        albums: (albums || []).map((album: any) => ({
          ...album,
          media: (media || []).filter((item: any) => item.album_id === album.id),
        })),
        quota: {
          usedBytes,
          limitBytes: GALLERY_QUOTA_BYTES,
          remainingBytes: Math.max(0, GALLERY_QUOTA_BYTES - usedBytes),
        },
      });
    } catch (error: any) {
      console.error("[SERVER] Erro ao buscar albuns da galeria:", error.message || error);
      res.status(500).json({ error: error.message || "Erro ao buscar galeria" });
    }
  });

  app.post("/api/v1/gallery/albums", async (req, res) => {
    const { tenantId, name, description } = req.body;
    if (!tenantId || !name) return res.status(400).json({ error: "Dados incompletos" });

    try {
      const access = await requireApiTenantRead(supabaseAdmin, req, res, tenantId);
      if (!access) return;
      const { user } = access;

      const { data, error } = await supabaseAdmin
        .from("gallery_albums")
        .insert([
          {
            tenant_id: tenantId,
            name: String(name).trim(),
            description: String(description || "").trim(),
            created_by: user.id,
          },
        ])
        .select("*")
        .single();
      if (error) throw error;
      res.json({ album: { ...data, media: [] } });
    } catch (error: any) {
      console.error("[SERVER] Erro ao criar album:", error.message || error);
      res.status(500).json({ error: error.message || "Erro ao criar album" });
    }
  });

  app.post("/api/v1/gallery/upload-url", async (req, res) => {
    const { tenantId, albumId, fileName, contentType, sizeBytes } = req.body;
    if (!tenantId || !albumId || !fileName || !contentType || !sizeBytes) {
      return res.status(400).json({ error: "Dados incompletos" });
    }
    if (!r2Client || !R2_BUCKET_NAME) {
      return res.status(500).json({ error: "R2 não configurado no servidor" });
    }

    try {
      const access = await requireApiTenantRead(supabaseAdmin, req, res, tenantId);
      if (!access) return;

      const normalizedType = String(contentType).toLowerCase();
      if (!normalizedType.startsWith("image/") && !normalizedType.startsWith("video/")) {
        return res.status(400).json({ error: "Envie apenas imagem ou vídeo" });
      }

      const numericSize = Number(sizeBytes);
      if (!Number.isFinite(numericSize) || numericSize <= 0) {
        return res.status(400).json({ error: "Tamanho de arquivo inválido" });
      }
      if (numericSize > 500 * 1024 * 1024) {
        return res.status(400).json({ error: "Arquivo muito grande (máx. 500MB)" });
      }

      const { data: album, error: albumError } = await supabaseAdmin
        .from("gallery_albums")
        .select("id, tenant_id")
        .eq("id", albumId)
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (albumError) throw albumError;
      if (!album) return res.status(404).json({ error: "Álbum não encontrado" });

      const { data: mediaRows, error: mediaError } = await supabaseAdmin
        .from("gallery_media")
        .select("size_bytes")
        .eq("tenant_id", tenantId);
      if (mediaError) throw mediaError;

      const usedBytes = (mediaRows || []).reduce((acc: number, item: any) => acc + Number(item.size_bytes || 0), 0);
      if (usedBytes + numericSize > GALLERY_QUOTA_BYTES) {
        return res.status(403).json({
          error: "Cota da galeria excedida (10GB por terreiro)",
          quota: {
            usedBytes,
            limitBytes: GALLERY_QUOTA_BYTES,
            remainingBytes: Math.max(0, GALLERY_QUOTA_BYTES - usedBytes),
          },
        });
      }

      const safeFileName = slugifyStoragePath(fileName);
      const storageKey = `${tenantId}/${albumId}/${Date.now()}_${safeFileName}`;
      const command = new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: storageKey,
        ContentType: normalizedType,
      });
      const uploadUrl = await getSignedUrl(r2Client, command, { expiresIn: 300 });
      const publicUrl = buildR2PublicUrl(storageKey);

      res.json({
        uploadUrl,
        storageKey,
        publicUrl,
        quota: {
          usedBytes,
          limitBytes: GALLERY_QUOTA_BYTES,
          remainingBytes: Math.max(0, GALLERY_QUOTA_BYTES - usedBytes),
        },
      });
    } catch (error: any) {
      console.error("[SERVER] Erro ao preparar upload da galeria:", error.message || error);
      res.status(500).json({ error: error.message || "Erro ao preparar upload" });
    }
  });

  app.post("/api/v1/gallery/complete-upload", async (req, res) => {
    const { tenantId, albumId, storageKey, publicUrl, fileName, contentType, sizeBytes } = req.body;
    if (!tenantId || !albumId || !storageKey || !publicUrl || !fileName || !contentType || !sizeBytes) {
      return res.status(400).json({ error: "Dados incompletos" });
    }

    try {
      const access = await requireApiTenantRead(supabaseAdmin, req, res, tenantId);
      if (!access) return;
      const { user } = access;

      const normalizedKey = String(storageKey || "").replace(/\\/g, "/");
      const expectedPrefix = `${tenantId}/${albumId}/`;
      if (!normalizedKey.startsWith(expectedPrefix) || normalizedKey.includes("..")) {
        return res.status(400).json({ error: "storageKey inválido para este álbum" });
      }

      const { data: album, error: albumError } = await supabaseAdmin
        .from("gallery_albums")
        .select("id")
        .eq("id", albumId)
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (albumError) throw albumError;
      if (!album) return res.status(404).json({ error: "Álbum não encontrado" });

      const expectedPublicUrl = buildR2PublicUrl(normalizedKey);
      if (String(publicUrl) !== expectedPublicUrl) {
        return res.status(400).json({ error: "publicUrl não confere com storageKey" });
      }

      const numericSize = Number(sizeBytes);
      const mediaType = String(contentType).toLowerCase().startsWith("video/") ? "video" : "image";
      const { data, error } = await supabaseAdmin
        .from("gallery_media")
        .insert([
          {
            album_id: albumId,
            tenant_id: tenantId,
            media_type: mediaType,
            file_name: String(fileName),
            mime_type: String(contentType),
            size_bytes: numericSize,
            storage_key: normalizedKey,
            public_url: expectedPublicUrl,
            created_by: user.id,
          },
        ])
        .select("*")
        .single();

      if (error) throw error;
      res.json({ media: data });
    } catch (error: any) {
      console.error("[SERVER] Erro ao concluir upload da galeria:", error.message || error);
      res.status(500).json({ error: error.message || "Erro ao concluir upload" });
    }
  });

  /** Banner de evento — upload para o mesmo bucket da biblioteca (pasta event_banners por tenant). */
  app.post("/api/v1/event-banner", async (req, res) => {
    const { fileData, fileName, contentType, tenantId } = req.body;
    if (!fileData || !tenantId) {
      return res.status(400).json({ error: "Dados incompletos" });
    }

    try {
      const user = await requireApiUser(supabaseAdmin, req, res);
      if (!user) return;

      const ok = await assertUserCanAccessTenant(supabaseAdmin, user, String(tenantId));
      if (!ok) return res.status(403).json({ error: "Sem permissão para este terreiro" });

      const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
      const ct = String(contentType || "image/jpeg").toLowerCase();
      if (!allowedTypes.includes(ct)) {
        return res.status(400).json({ error: "Use imagem JPEG, PNG, WebP ou GIF" });
      }

      const buffer = Buffer.from(fileData, "base64");
      if (buffer.length > 5 * 1024 * 1024) {
        return res.status(400).json({ error: "Imagem muito grande (máx. 5 MB)" });
      }

      const safeName = slugifyStoragePath(fileName || "banner.jpg");
      const storagePath = `${tenantId}/event_banners/${Date.now()}_${safeName}`;

      const { error: uploadError } = await supabaseAdmin.storage
        .from("biblioteca_estudos")
        .upload(storagePath, buffer, { contentType: ct, upsert: true });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabaseAdmin.storage.from("biblioteca_estudos").getPublicUrl(storagePath);

      res.json({ success: true, publicUrl });
    } catch (error: any) {
      console.error("[SERVER] Erro no upload de banner de evento:", error.message || error);
      res.status(500).json({ error: error.message || "Erro ao enviar banner" });
    }
  });

  // API Route: PDF Proxy — serve o PDF localmente para evitar CORS no PDF.js (Vercel)
  app.get("/api/v1/library/pdf-proxy", async (req, res) => {
    const user = await requireAuthOrRespond(supabaseAdmin, req, res);
    if (!user) return;

    const pathRaw = typeof req.query.path === "string" ? req.query.path : "";
    const tenantIdRaw = normalizeQueryTenantId(req.query.tenantId);
    const urlRaw = typeof req.query.url === "string" ? req.query.url : "";

    if (pathRaw && tenantIdRaw) {
      const ok = await assertUserCanAccessTenant(supabaseAdmin, user, tenantIdRaw);
      if (!ok) return res.status(403).json({ error: "Acesso negado" });

      const normalizedPath = pathRaw.replace(/\\/g, "/");
      if (!normalizedPath.startsWith(`${tenantIdRaw}/`)) {
        return res.status(403).json({ error: "Caminho inválido" });
      }

      try {
        const { data, error } = await supabaseAdmin.storage
          .from("biblioteca_estudos")
          .download(normalizedPath);
        if (error || !data) {
          return res.status(404).send("PDF não encontrado");
        }
        const buffer = Buffer.from(await data.arrayBuffer());
        res.set({
          "Content-Type": "application/pdf",
          "Content-Length": String(buffer.length),
          "Cache-Control": "private, max-age=300",
        });
        return res.send(buffer);
      } catch (err: any) {
        console.error("[PDF-PROXY] storage:", err.message || err);
        return res.status(500).send("Erro interno");
      }
    }

    if (!urlRaw) {
      return res.status(400).json({ error: "url ou path+tenantId obrigatórios" });
    }

    if (!isAllowedPdfProxyUrl(urlRaw)) {
      return res.status(403).json({ error: "URL não permitida" });
    }

    try {
      const response = await fetch(urlRaw);
      if (!response.ok) {
        return res.status(response.status).send("Erro ao buscar PDF");
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      res.set({
        'Content-Type': response.headers.get('content-type') || 'application/pdf',
        'Content-Length': String(buffer.length),
        'Cache-Control': 'public, max-age=3600',
      });
      res.send(buffer);
    } catch (err: any) {
      console.error("[PDF-PROXY] Erro:", err.message || err);
      res.status(500).send("Erro interno");
    }
  });

  // API Route: Create Tenant (Admin only)
  app.post("/api/admin/create-tenant", sensitiveActionRateLimit, async (req, res) => {
    const { email, password, nome_terreiro, nome_zelador, whatsapp, plan, observacao } = req.body;

    try {
      const user = await requireApiGlobalAdmin(supabaseAdmin, req, res, {
        forbiddenMessage: "Forbidden: Admin access required",
      });
      if (!user) return;

      // 2. Create or Update User in Supabase Auth
      let targetUser;
      const { data: createdUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          nome_terreiro,
          nome_zelador,
          whatsapp,
          plan,
          observacao
        }
      });

      if (createError) {
        if (createError.message.includes('already been registered')) {
          console.log(`[ADMIN] Usuário ${email} já existe. Atualizando...`);
          // Buscar usuário existente
          const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers();
          if (listError || !listData) throw listError || new Error("Falha ao listar usuários");
          const existingUser = (listData.users as any[]).find(u => u.email === email);
          
          if (!existingUser) {
            throw new Error("Erro ao recuperar usuário existente.");
          }

          // Atualizar metadados e senha do usuário existente
          const { data: updatedUser, error: updateAuthError } = await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
            password,
            user_metadata: {
              nome_terreiro,
              nome_zelador,
              whatsapp,
              plan,
              observacao
            }
          });

          if (updateAuthError) throw updateAuthError;
          targetUser = updatedUser.user;
        } else {
          throw createError;
        }
      } else {
        targetUser = createdUser.user;
      }

      // 3. Update Profile and Subscription
      if (plan && plan !== 'free') {
        const planSlug = String(plan).toLowerCase().trim();
        const isLifetime = planSlug === 'vita' || planSlug === 'cortesia';
        // Vitalício / cortesia: SEM expiração (expires_at = null). Premium: +30 dias.
        const expiresAt: string | null = isLifetime
          ? null
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

        console.log(
          `[ADMIN][create-tenant] plan="${planSlug}" lifetime=${isLifetime} expires_at=${expiresAt ?? 'null'} user=${targetUser.id}`
        );

        const { error: subError } = await supabaseAdmin
          .from('subscriptions')
          .upsert({
            id: targetUser.id,
            plan: planSlug,
            status: 'active',
            expires_at: expiresAt
          }, { onConflict: 'id' });

        if (subError) {
          console.error("[ADMIN][create-tenant] subscription upsert FAILED:", subError);
          return res.status(500).json({
            error: `Falha ao gravar assinatura (${planSlug}): ${subError.message || subError}`,
          });
        }
      }

      // Update profile with extra info
      const { error: profileError } = await supabaseAdmin
        .from('perfil_lider')
        .upsert({ 
          id: targetUser.id,
          email: email,
          nome_terreiro,
          cargo: nome_zelador,
          role: 'admin',
          tenant_id: targetUser.id,
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' });

      if (profileError) console.error("Error updating profile info:", profileError);

      // 4. Boas-vindas via WhatsApp (instância do console admin) — não bloqueia a resposta.
      let welcomeStatus: "skipped" | "queued" | "no-phone" | "disabled" = "skipped";
      try {
        const cfg = await loadWelcomeMessageConfig(supabaseAdmin);
        if (!cfg.enabled) {
          welcomeStatus = "disabled";
        } else {
          const msisdn = normalizeBrazilMsisdn(whatsapp || "");
          if (!msisdn) {
            welcomeStatus = "no-phone";
            console.log("[ADMIN] Welcome WhatsApp: número do zelador ausente/inválido — pulado.");
          } else {
            const text = renderWelcomeMessage(cfg.template, {
              nome_terreiro,
              nome_zelador,
              email,
              senha: password,
              site: cfg.loginUrl,
              assinatura: cfg.signature,
            });
            welcomeStatus = "queued";
            void sendEvolutionTextByInstance(CONSOLE_ADMIN_INSTANCE_NAME, msisdn, text)
              .then((r) => console.log(`[ADMIN] Welcome WhatsApp enviado para ${msisdn}`, r?.messageId || ""))
              .catch((err) => console.error(`[ADMIN] Welcome WhatsApp falhou (${msisdn}):`, err?.message || err));
          }
        }
      } catch (welErr: any) {
        console.error("[ADMIN] Welcome WhatsApp setup error:", welErr?.message || welErr);
      }

      void logEvent(supabaseAdmin, {
        eventType: "tenant.created",
        userId: user?.id,
        userEmail: user?.email,
        targetType: "tenant",
        targetId: targetUser.id,
        tenantId: targetUser.id,
        description: `Terreiro "${nome_terreiro}" criado para ${email} (plano ${plan || "free"}).`,
        metadata: {
          email,
          nome_terreiro,
          nome_zelador,
          plan,
          welcome: welcomeStatus,
        },
        req,
      });

      res.json({ 
        success: true, 
        user: {
          id: targetUser.id,
          email: targetUser.email,
          password // Returning password for the "Copy" feature
        },
        welcome: { status: welcomeStatus },
      });

    } catch (error: any) {
      console.error("Admin Create Tenant Error:", error);
      res.status(500).json({ error: error.message || "Internal Server Error" });
    }
  });

  app.post("/api/v1/profile/upload-photo", async (req, res) => {
    const { fileData, fileName, contentType } = req.body || {};

    if (!fileData || !fileName) {
      return res.status(400).json({ error: "Dados da imagem ausentes." });
    }

    try {
      const user = await requireApiUser(supabaseAdmin, req, res);
      if (!user) return;

      const safeName = String(fileName).replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
      if (!safeName || !safeName.startsWith(user.id)) {
        return res.status(400).json({ error: "Nome de arquivo inválido." });
      }

      const buffer = Buffer.from(String(fileData), "base64");
      if (buffer.length > 5 * 1024 * 1024) {
        return res.status(400).json({ error: "Imagem maior que 5 MB." });
      }

      const { error: uploadError } = await supabaseAdmin.storage
        .from("perfil_fotos")
        .upload(safeName, buffer, {
          contentType: contentType || "image/jpeg",
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabaseAdmin.storage.from("perfil_fotos").getPublicUrl(safeName);

      res.json({ publicUrl });
    } catch (error: unknown) {
      console.error("[SERVER] Erro no upload de foto:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Erro interno ao subir foto",
      });
    }
  });

  // API Route: Save User Settings (Bypasses RLS)
  app.post("/api/v1/settings/save", async (req, res) => {
    console.log(`[SERVER] Recebida requisição em /api/v1/settings/save`);
    const { userId, tenantId, profile } = req.body;

    try {
      const user = await requireApiUser(supabaseAdmin, req, res);
      if (!user) return;

      if (user.id !== userId) {
        console.error(`[SECURITY ALERT] Tentativa de Mass Assignment. Token: ${user.id}, Req: ${userId}`);
        return res.status(403).json({
          error: "Acesso negado",
          details: "ID do usuário não coincide",
        });
      }
      console.log(`[SERVER] Tentando salvar configurações para: ${userId}, tenantId: ${tenantId}`);
      
      // Verificação de segurança: A tabela existe?
      const { error: tableCheck } = await supabaseAdmin.from('perfil_lider').select('id').limit(1);
      if (tableCheck && tableCheck.code === '42P01') {
        return res.status(500).json({ error: "A tabela 'perfil_lider' não existe. Você precisa executar o SQL no Supabase Editor." });
      }

      // 1. Save Profile
      const isSuperAdmin = await isConsoleGlobalAdmin(supabaseAdmin, user);
      const SHARED_TENANT_ID = '6588b6c9-ce84-4140-a69a-f487a0c61dab';

      const profileData: any = {
        id: userId,
        email: profile?.email,
        nome_terreiro: profile?.nome_terreiro || 'Meu Terreiro',
        cargo: profile?.cargo || 'Zelador',
        zelador: profile?.zelador || profile?.cargo || null,
        foto_url: profile?.foto_url || null,
        updated_at: new Date().toISOString()
      };

      if (isSuperAdmin) {
        profileData.tenant_id = SHARED_TENANT_ID;
        profileData.is_admin_global = true;
      } else {
        const access = await resolveTenantAccessForUser(user.id);
        profileData.tenant_id = access.tenantId || user.id;
      }

      const { error: profileError } = await supabaseAdmin
        .from('perfil_lider')
        .upsert(profileData, { onConflict: 'id' });

      if (profileError) {
        console.error("[SERVER] Erro no Perfil:", profileError);
        return res.status(500).json({ error: `Erro no Banco (Perfil): ${profileError.message}` });
      }

      console.log(`[SERVER] SUCESSO TOTAL para ${userId}`);
      res.json({ success: true });

    } catch (error: any) {
      console.error("[SERVER] Erro ao salvar configurações:", error);
      res.status(500).json({ error: error.message || "Internal Server Error" });
    }
  });

  const LEGAL_TERMS_VERSION_ACCEPT = "2026-05-15";

  app.post("/api/v1/legal/accept-terms", async (req, res) => {
    try {
      const user = await requireApiUser(supabaseAdmin, req, res);
      if (!user) return;

      const version = String((req.body || {}).version || LEGAL_TERMS_VERSION_ACCEPT).trim() || LEGAL_TERMS_VERSION_ACCEPT;
      const now = new Date().toISOString();

      const { data: existing } = await supabaseAdmin
        .from("perfil_lider")
        .select("id, email")
        .eq("id", user.id)
        .maybeSingle();

      let saved: { terms_accepted_version?: string | null } | null = null;
      let saveError: { message?: string } | null = null;

      if (existing?.id) {
        const patch: Record<string, unknown> = {
          terms_accepted_version: version,
          terms_accepted_at: now,
          updated_at: now,
        };
        if (!existing.email) {
          patch.email = await resolvePerfilLiderEmail(supabaseAdmin, user);
        }
        const result = await supabaseAdmin
          .from("perfil_lider")
          .update(patch)
          .eq("id", user.id)
          .select("terms_accepted_version")
          .single();
        saved = result.data;
        saveError = result.error;
      } else {
        const email = await resolvePerfilLiderEmail(supabaseAdmin, user);
        const result = await supabaseAdmin
          .from("perfil_lider")
          .upsert(
            {
              id: user.id,
              email,
              nome_terreiro: "Meu Terreiro",
              role: "admin",
              tenant_id: user.id,
              terms_accepted_version: version,
              terms_accepted_at: now,
              updated_at: now,
            },
            { onConflict: "id" }
          )
          .select("terms_accepted_version")
          .single();
        saved = result.data;
        saveError = result.error;
      }

      if (saveError) {
        console.error("[SERVER] accept-terms:", saveError);
        return res.status(500).json({ error: saveError.message || "Erro ao registrar aceite" });
      }
      if (saved?.terms_accepted_version !== version) {
        return res.status(500).json({
          error: "Aceite não foi gravado. Execute a migration de termos em perfil_lider no Supabase.",
        });
      }

      return res.json({ success: true, version });
    } catch (error: any) {
      console.error("[SERVER] accept-terms:", error);
      return res.status(500).json({ error: error?.message || "Erro interno" });
    }
  });

  /** Exclusão total da conta do zelador, dados do terreiro no Postgres, storage, R2 (galeria) e auth (incl. filhos com login). */
  app.post("/api/v1/account/permanent-delete", sensitiveActionRateLimit, async (req, res) => {
    try {
      const user = await requireApiUser(supabaseAdmin, req, res);
      if (!user) return;

      const confirmEmail = String((req.body || {}).confirmEmail || "").trim().toLowerCase();
      const email = String(user.email || "").trim().toLowerCase();
      if (!confirmEmail || confirmEmail !== email) {
        return res.status(400).json({ error: "Confirme digitando o mesmo e-mail da conta." });
      }

      const result = await permanentDeleteZeladorAccount(
        {
          supabaseAdmin,
          r2:
            r2Client && R2_BUCKET_NAME ? { client: r2Client, bucket: R2_BUCKET_NAME } : undefined,
          beforeDbPurge: async (lid) => {
            try {
              await logoutEvolutionInstance(lid);
            } catch (e) {
              console.warn("[permanent-delete] Evolution:", e);
            }
          },
        },
        user.id
      );

      if (result.ok === false) {
        return res.status(result.status).json({ error: result.message });
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error("[permanent-delete]", error);
      res.status(500).json({ error: error?.message || "Erro interno" });
    }
  });

  // GET /api/tenant-info: em produção via api/public.ts (rewrite); localmente também neste Express.
  app.get("/api/tenant-info", (req, res) => {
    void handleTenantInfoRoute(req as Parameters<typeof handleTenantInfoRoute>[0], res);
  });

  // API Route: List Tenants (Admin only)
  app.get("/api/admin/tenants", async (req, res) => {
    try {
      const user = await requireApiGlobalAdmin(supabaseAdmin, req, res);
      if (!user) return;

      // 1. Fetch Profiles
      const { data: profiles, error: pError } = await supabaseAdmin
        .from('perfil_lider')
        .select('id, tenant_id, email, nome_terreiro, cargo, updated_at, is_blocked, deleted_at')
        .is('deleted_at', null);

      if (pError) throw pError;

      // 2. Fetch Subscriptions
      const { data: subs, error: sError } = await supabaseAdmin
        .from('subscriptions')
        .select('id, plan, expires_at, status');

      if (sError) throw sError;

      // 2b. Fetch filhos_de_santo para filtrar "shadow filhos" (auto-perfis criados pelo tenant-info para usuários filho).
      const { data: childrenRaw, error: cError } = await supabaseAdmin
        .from("filhos_de_santo")
        .select("tenant_id, lider_id, user_id");
      if (cError) throw cError;
      const childrenList = (childrenRaw || []) as {
        tenant_id?: string | null;
        lider_id?: string | null;
        user_id?: string | null;
      }[];
      const childUserIdSet = new Set<string>(
        childrenList.map((c) => String(c.user_id || "")).filter(Boolean)
      );

      // 3. Fetch Global Settings
      const plans = await loadPlansCatalog(supabaseAdmin);

      const isShadowFilhoEmail = (email?: string | null) =>
        typeof email === "string" && /(^f_[a-f0-9-]{8,}@|@axecloud\.internal$)/i.test(email);

      const realTenants =
        profiles?.filter((p: { id: string; email?: string | null }) => {
          if (childUserIdSet.has(String(p.id))) return false; // está cadastrado como filho de santo
          if (isShadowFilhoEmail(p.email)) return false; // email interno de login de filho
          return true;
        }) || [];

      const augmentedProfiles = realTenants.map((p: { id: string; tenant_id?: string | null }) => {
        const sub = subs?.find((s: any) => s.id === p.id);
        return {
          ...p,
          totalChildren: countFilhosForPerfilLider({ id: p.id, tenant_id: p.tenant_id }, childrenList),
          plan: sub?.plan || "premium",
          expires_at: sub?.expires_at ?? null,
          subscription_status: sub?.status ?? null,
        };
      });

      res.json({ profiles: augmentedProfiles, subs, plans });
    } catch (error: any) {
      console.error("[SERVER] Erro ao listar tenants:", error);
      return res.status(500).json({ error: "Erro ao listar tenants", details: error.message || String(error) });
    }
  });

  // API Route: Update Global Plans Config (Admin only)
  app.post("/api/admin/update-plans", async (req, res) => {
    const { plans: incoming } = req.body || {};

    try {
      const user = await requireApiGlobalAdmin(supabaseAdmin, req, res);
      if (!user) return;

      const plans = normalizePlansCatalog(incoming);
      await savePlansCatalog(supabaseAdmin, plans);

      void logEvent(supabaseAdmin, {
        eventType: "plans.updated",
        userId: user.id,
        userEmail: user.email,
        targetType: "global_settings",
        targetId: "plans",
        description: "Admin atualizou o catálogo global de planos.",
        metadata: { slugs: Object.keys(plans), premiumPrice: plans.premium.price },
        req,
      });

      res.json({ success: true, plans });
    } catch (error: any) {
      console.error("[SERVER] Erro ao salvar planos:", error);
      res.status(500).json({ error: error.message || "Erro ao salvar planos" });
    }
  });

  // API Route: Get Global Plans Config
  app.get("/api/plans", apiReadRateLimit, async (req, res) => {
    try {
      const plans = await loadPlansCatalog(supabaseAdmin);
      res.setHeader("Cache-Control", "public, max-age=0, s-maxage=30, must-revalidate");
      res.json({ success: true, plans });
    } catch (error: any) {
      console.error("[SERVER] Erro ao buscar planos:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/v1/app-build", (_req, res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    const buildInfoPath = path.join(process.cwd(), "dist", "build-info.json");
    if (!existsSync(buildInfoPath)) {
      return res.status(503).json({ buildId: null });
    }
    try {
      const data = JSON.parse(readFileSync(buildInfoPath, "utf8")) as {
        buildId?: string;
        builtAt?: string;
      };
      return res.json({ buildId: data.buildId || null, builtAt: data.builtAt || null });
    } catch {
      return res.status(500).json({ buildId: null });
    }
  });

  // API Route: Manage Tenant (Admin only)
  app.post("/api/admin/manage-tenant", sensitiveActionRateLimit, async (req, res) => {
    const { targetUserId, action, newPlan } = req.body;

    try {
      const user = await requireApiGlobalAdmin(supabaseAdmin, req, res);
      if (!user) return;

      console.log(`[ADMIN COMMAND] Action: ${action} on User: ${targetUserId}`);

      let logDescription = "";
      let logMetadata: Record<string, unknown> = {};

      switch (action) {
        case 'block':
          await supabaseAdmin.from('perfil_lider').update({ is_blocked: true }).eq('id', targetUserId);
          logDescription = `Terreiro ${targetUserId} bloqueado.`;
          break;
        case 'unblock':
          await supabaseAdmin.from('perfil_lider').update({ is_blocked: false }).eq('id', targetUserId);
          logDescription = `Terreiro ${targetUserId} desbloqueado.`;
          break;
        case 'delete':
          await supabaseAdmin.from('perfil_lider').update({ deleted_at: new Date().toISOString() }).eq('id', targetUserId);
          logDescription = `Terreiro ${targetUserId} marcado como excluído (soft delete).`;
          break;
        case 'permanent-delete': {
          const result = await permanentDeleteZeladorAccount(
            {
              supabaseAdmin,
              r2:
                r2Client && R2_BUCKET_NAME ? { client: r2Client, bucket: R2_BUCKET_NAME } : undefined,
              beforeDbPurge: async (lid) => {
                try {
                  await logoutEvolutionInstance(lid);
                } catch (e) {
                  console.warn("[permanent-delete] Evolution:", e);
                }
              },
            },
            targetUserId
          );
          if (result.ok === false) {
            return res.status(result.status).json({ error: result.message });
          }
          logDescription = `Terreiro ${targetUserId} excluído permanentemente (Postgres, storage, auth).`;
          break;
        }
        case 'change-plan': {
          if (!newPlan) return res.status(400).json({ error: "Novo plano é obrigatório" });
          const newPlanSlug = String(newPlan).toLowerCase().trim();
          const lifetimeChange = newPlanSlug === 'vita' || newPlanSlug === 'cortesia';
          const changePayload: Record<string, unknown> = {
            id: targetUserId,
            plan: newPlanSlug,
            status: 'active',
          };
          if (lifetimeChange) changePayload.expires_at = null;
          await supabaseAdmin.from('subscriptions').upsert(changePayload, { onConflict: 'id' });
          logDescription = `Plano do terreiro alterado para "${newPlanSlug}".`;
          logMetadata = { newPlan: newPlanSlug, lifetime: lifetimeChange };
          break;
        }
        case 'renew': {
          const { amount, unit } = req.body as { amount?: string; unit?: string };
          if (!amount || !unit) {
            return res.status(400).json({ error: "Quantidade e unidade são obrigatórios para renovação" });
          }
          const { data: currentSub } = await supabaseAdmin
            .from('subscriptions')
            .select('expires_at')
            .eq('id', targetUserId)
            .maybeSingle();
          let baseDate = new Date();
          if (currentSub?.expires_at && new Date(String((currentSub as any).expires_at)) > new Date()) {
            baseDate = new Date(String((currentSub as any).expires_at));
          }
          if (unit === 'days') {
            baseDate.setDate(baseDate.getDate() + parseInt(String(amount), 10));
          } else if (unit === 'months') {
            baseDate.setMonth(baseDate.getMonth() + parseInt(String(amount), 10));
          } else {
            return res.status(400).json({ error: "Unidade inválida (days ou months)" });
          }
          await supabaseAdmin.from('subscriptions').upsert({
            id: targetUserId,
            expires_at: baseDate.toISOString(),
            status: 'active',
          }, { onConflict: 'id' });
          logDescription = `Assinatura renovada (+${amount} ${unit}) até ${baseDate.toISOString().split("T")[0]}.`;
          logMetadata = { amount, unit, newExpiresAt: baseDate.toISOString() };
          break;
        }
        case "set-lifetime":
          await supabaseAdmin.from("subscriptions").upsert(
            {
              id: targetUserId,
              plan: "vita",
              status: "active",
              expires_at: null,
            },
            { onConflict: "id" }
          );
          logDescription = "Terreiro marcado como Vitalício (sem expiração).";
          break;
        default:
          return res.status(400).json({ error: "Ação inválida" });
      }

      void logEvent(supabaseAdmin, {
        eventType: `tenant.${action}`,
        userId: user?.id,
        userEmail: user?.email,
        targetType: "tenant",
        targetId: targetUserId,
        tenantId: targetUserId,
        description: logDescription,
        metadata: logMetadata,
        req,
      });

      res.json({ success: true, message: "Comando enviado com sucesso" });
    } catch (error: any) {
      console.error("[SERVER] Erro ao gerenciar tenant:", error);
      res.status(500).json({ error: error.message });
    }
  });

  registerAuthAuditRoutes(app, { supabaseAdmin, verifyUser });

  app.post("/api/auth/filho-login", filhoLoginRateLimit, (req, res) => {
    void handleFilhoLoginRoute(req, res);
  });

  registerAdminConsoleRoutes(app, {
    verifyUser,
    supabaseAdmin,
    r2Client,
    r2Bucket: R2_BUCKET_NAME,
  });

  registerOnboardingRoutes(app, { supabaseAdmin });
  registerFounderProgramRoutes(app, { supabaseAdmin });
  registerConsulentePortalRoutes(app, {
    supabaseAdmin,
    resolveLeaderId: (tenantId) => resolveLeaderIdLib(supabaseAdmin, tenantId),
  });
  registerEventRsvpRoutes(app, { supabaseAdmin });
  registerEfiCheckoutRoutes(app, { supabaseAdmin });
  registerFinancialCaixinhaRoutes(app, { supabaseAdmin, resolveLeaderId });
  registerStoreCheckoutRoutes(app, { supabaseAdmin, resolveLeaderId });
  registerFilhoHomeRoutes(app, { supabaseAdmin });
  registerAdminMetricsRoutes(app, { supabaseAdmin });

  // Cron: ping Evolution (Vercel rewrite + VPS Express)
  app.get("/api/v1/cron/ping-evolution", async (req, res) => {
    req.query = { ...req.query, job: "ping-evolution" };
    await cronHandler(req, res);
  });
  app.get("/api/v1/cron/whatsapp-jobs", async (req, res) => {
    req.query = { ...req.query, job: "whatsapp-jobs" };
    await cronHandler(req, res);
  });
  app.all("/api/cron", async (req, res) => {
    await cronHandler(req, res);
  });

  // Cron (Fase 4): monitoramento contínuo dos audit_targets — secret em CRON_SECRET.
  app.all("/api/cron/audit-tick", async (req, res) => {
    await handleAuditTick(req, res, supabaseAdmin);
  });

  // API Route: Update User Plan — desativado (ativação somente via pagamento/webhook)
  app.post("/api/v1/subscription/update-plan", async (_req, res) => {
    return res.status(403).json({
      error: "Ativação de plano disponível apenas via checkout ou confirmação de pagamento.",
    });
  });

  // API Route: Test Supabase Admin (somente console global)
  app.get("/api/test-db", async (req, res) => {
    const user = await requireAuthOrRespond(supabaseAdmin, req, res);
    if (!user) return;
    const isAdmin = await isConsoleGlobalAdmin(supabaseAdmin, user);
    if (!isAdmin) return res.status(403).json({ error: "Acesso negado" });

    try {
      console.log("[SERVER] Testing Supabase Admin connection...");
      const { data, error } = await supabaseAdmin.from('perfil_lider').select('id').limit(1);
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error: any) {
      console.error("[SERVER] Test DB error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // API Route: Get Single Child (Bypasses RLS)
  app.get("/api/children/:id", async (req, res) => {
    const childId = req.params.id;
    const user = await requireAuthOrRespond(supabaseAdmin, req, res);
    if (!user) return;
    const userId = user.id;
    const tenantIdFromQuery = normalizeQueryTenantId(req.query.tenantId);
    const userRoleQ = String(req.query.userRole || "");

    try {
      const tenantId = await resolveFinanceiroTenantScope(
        supabaseAdmin,
        userId,
        userRoleQ,
        tenantIdFromQuery
      );
      if (!tenantId) return res.status(403).json({ error: "Acesso negado" });

      let query = supabaseAdmin.from('filhos_de_santo').select('*').eq('id', childId);
      
      if (tenantId) {
         query = query.or(`tenant_id.eq.${tenantId},lider_id.eq.${tenantId}`);
      } else {
         query = query.eq('lider_id', userId);
      }

      const { data, error } = await query.single();

      if (error) {
        console.error("[SERVER] Error fetching child:", error);
        return res.status(404).json({ error: "Filho não encontrado ou acesso negado" });
      }

      res.setHeader("Cache-Control", "private, max-age=10, stale-while-revalidate=60");
      res.json({ success: true, data });
    } catch (error: any) {
      console.error("[SERVER] Unexpected error in GET /api/children/:id:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // API Route: Update Single Child (Bypasses RLS)
  app.put("/api/children/:id", async (req, res) => {
    const childId = req.params.id;
    const user = await requireAuthOrRespond(supabaseAdmin, req, res);
    if (!user) return;
    const userId = user.id;
    const tenantIdFromQuery = normalizeQueryTenantId(req.query.tenantId);
    const userRoleQ = String(req.query.userRole || "");
    const updateData = pickAllowedChildFields(req.body || {});

    try {
      const tenantId = await resolveFinanceiroTenantScope(
        supabaseAdmin,
        userId,
        userRoleQ,
        tenantIdFromQuery
      );
      if (!tenantId) return res.status(403).json({ error: "Acesso negado" });

      let query = supabaseAdmin.from('filhos_de_santo').select('id').eq('id', childId);
      if (tenantId) {
         query = query.or(`tenant_id.eq.${tenantId},lider_id.eq.${tenantId}`);
      } else {
         query = query.eq('lider_id', userId);
      }
      const { data: existingChild, error: verifyError } = await query.single();

      if (verifyError || !existingChild) {
        return res.status(404).json({ error: "Filho não encontrado ou acesso negado" });
      }

      // 3. Update the child
      const { data, error } = await supabaseAdmin
        .from('filhos_de_santo')
        .update(updateData)
        .eq('id', childId)
        .select()
        .single();

      if (error) {
        console.error("[SERVER] Error updating child:", error);
        return res.status(500).json({ error: "Erro ao atualizar filho de santo" });
      }

      res.json({ success: true, data });
    } catch (error: any) {
      console.error("[SERVER] Unexpected error in PUT /api/children/:id:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // API Route: Get Children (Bypasses RLS)
  app.get("/api/children", async (req, res) => {
    try {
      const user = await requireAuthOrRespond(supabaseAdmin, req, res);
      if (!user) return;
      const userId = user.id;
      const tenantIdFromQuery = normalizeQueryTenantId(req.query.tenantId);
      const userRoleQ = String(req.query.userRole || "");

      const tenantId = await resolveFinanceiroTenantScope(
        supabaseAdmin,
        userId,
        userRoleQ,
        tenantIdFromQuery
      );
      if (!tenantId) return res.status(403).json({ error: "Acesso negado" });

      let query = supabaseAdmin.from('filhos_de_santo').select('*').order('nome', { ascending: true });
      
      if (tenantId) {
        console.log(`[SERVER] Fetching children for tenant_id/lider_id: ${tenantId}`);
        query = query.or(`tenant_id.eq.${tenantId},lider_id.eq.${tenantId}`);
      } else {
        console.log(`[SERVER] Fetching children for lider_id: ${userId}`);
        query = query.eq('lider_id', userId);
      }

      const { data, error } = await query;
      
      if (error) {
        console.error(`[SERVER] Query error:`, error);
        throw error;
      }
      
      console.log(`[SERVER] GET /api/children success. Found ${data?.length || 0} children.`);
      res.setHeader("Cache-Control", "private, max-age=10, stale-while-revalidate=60");
      res.json({ data });
    } catch (error: any) {
      console.error("[SERVER] Erro ao buscar filhos:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // API Route: Add Child (Bypasses RLS)
  app.post("/api/children", async (req, res) => {
    const { userId, tenantId: tenantIdFromBody, childData } = req.body;

    try {
      const user = await requireApiUser(supabaseAdmin, req, res);
      if (!user) return;
      if (user.id !== userId) {
        return res.status(403).json({ error: "Operação proibida" });
      }

      // Buscar o tenant_id real do usuário no banco (NUNCA confiar no tenantId do body)
      const { data: userProfile } = await supabaseAdmin
        .from('perfil_lider')
        .select('tenant_id')
        .eq('id', userId)
        .single();
      
      const tenantId = userProfile?.tenant_id;
      if (!tenantId) return res.status(403).json({ error: "Tenant não configurado" });

      const allowed = pickAllowedChildFields((childData || {}) as Record<string, unknown>);
      const dataToInsert: Record<string, unknown> = {
        ...allowed,
        lider_id: userId,
        tenant_id: tenantId,
      };

      if (dataToInsert.data_nascimento === "") dataToInsert.data_nascimento = null;
      if (dataToInsert.data_entrada === "") dataToInsert.data_entrada = null;
      const presetId = String(childData?.id || "").trim();
      if (presetId && isValidUuid(presetId)) dataToInsert.id = presetId;
      
      console.log(`[SERVER] Inserting child data:`, dataToInsert);

      const { data, error } = await supabaseAdmin
        .from('filhos_de_santo')
        .insert([dataToInsert])
        .select()
        .single();

      if (error) {
        console.error(`[SERVER] Insert error:`, error);
        throw error;
      }
      
      console.log(`[SERVER] POST /api/children success. Inserted child ID: ${data.id}`);
      res.json({ success: true, data });
    } catch (error: any) {
      console.error("[SERVER] Erro ao adicionar filho:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // API Route: Get Events (Bypasses RLS)
  app.get("/api/events", async (req, res) => {
    const access = await requireTenantReadAccess(supabaseAdmin, req, res, req.query.tenantId);
    if (!access) return;
    const tenantId = access.tenantId;
    const { start, end } = req.query;
    try {
      const resolvedId = await resolveLeaderId(tenantId);
      const ids = Array.from(new Set([tenantId, resolvedId].filter(Boolean)));
      const tenantFilters = ids.flatMap((id) => [`tenant_id.eq.${id}`, `lider_id.eq.${id}`]).join(',');
      let query = supabaseAdmin.from('calendario_axe').select('*').order('data', { ascending: true });
      query = query.or(tenantFilters);
      if (start) query = query.gte('data', start as string);
      if (end) query = query.lte('data', end as string);
      
      const { data, error } = await query;
      if (error) throw error;
      res.json({ data });
    } catch (error: any) {
      console.error("[SERVER] Error fetching events:", error.message || error);
      res.status(500).json({ error: error.message || "Internal Server Error" });
    }
  });

  // API Route: Create Event (Verifies Plan)
  app.post("/api/events", async (req, res) => {
    try {
      const user = await requireApiUser(supabaseAdmin, req, res);
      if (!user) return;

      const { data: sub } = await supabaseAdmin
        .from('subscriptions')
        .select('plan, status, expires_at')
        .eq('id', user.id)
        .maybeSingle();
        
      const { data: profile } = await supabaseAdmin
        .from('perfil_lider')
        .select('is_admin_global, tenant_id')
        .eq('id', user.id)
        .maybeSingle();

      const isGlobalAdmin = !!profile?.is_admin_global;
      const role = String(user.user_metadata?.role || "").toLowerCase();
      if (role === "filho") {
        return res.status(403).json({ error: "Acesso negado" });
      }

      const tenant_id = profile?.tenant_id || user.id;
      const zeladorOk = await assertZeladorTenantAccess(supabaseAdmin, resolveLeaderId, user.id, tenant_id);
      if (!isGlobalAdmin && !zeladorOk) {
        return res.status(403).json({ error: "Acesso negado" });
      }
      if (!isGlobalAdmin && !isSubscriptionAccessActive(sub)) {
        return res.status(403).json({ error: "Assinatura inativa" });
      }

      const rawBanner = req.body?.banner_url;
      const banner_url =
        typeof rawBanner === "string" && rawBanner.trim().length > 0 ? rawBanner.trim() : null;

      const eventData = {
        titulo: req.body?.titulo,
        data: req.body?.data,
        hora: req.body?.hora,
        tipo: req.body?.tipo,
        descricao: req.body?.descricao ?? "",
        status_confirmacao: req.body?.status_confirmacao ?? "Confirmado",
        ...(banner_url ? { banner_url } : {}),
        lider_id: user.id,
        tenant_id,
      };

      const { data, error } = await supabaseAdmin
        .from('calendario_axe')
        .insert([eventData])
        .select()
        .single();

      if (error) throw error;

      // Push apenas para filhos de santo inscritos
      void sendPushNotification(profile?.tenant_id || user.id, {
        title: `Novo evento: ${req.body.titulo}`,
        body: `${req.body.data} às ${req.body.hora}`,
        url: '/calendar'
      }).catch((e) => console.error('[PUSH] após criar evento:', e));

      res.json({ success: true, data });
    } catch (error: any) {
      console.error("[SERVER] Error creating event:", error.message || error);
      res.status(500).json({ error: error.message || "Internal Server Error" });
    }
  });

  // API Route: Delete Event (Verifies Plan)
  app.delete("/api/events/:id", async (req, res) => {
    try {
      const user = await requireApiUser(supabaseAdmin, req, res);
      if (!user) return;

      const { data: sub } = await supabaseAdmin
        .from('subscriptions')
        .select('plan, status, expires_at')
        .eq('id', user.id)
        .maybeSingle();
        
      const { data: profile } = await supabaseAdmin
        .from('perfil_lider')
        .select('is_admin_global, tenant_id')
        .eq('id', user.id)
        .maybeSingle();

      const isGlobalAdmin = !!profile?.is_admin_global;
      const role = String(user.user_metadata?.role || "").toLowerCase();
      if (role === "filho") {
        return res.status(403).json({ error: "Acesso negado" });
      }
      if (!isGlobalAdmin && !isSubscriptionAccessActive(sub)) {
        return res.status(403).json({ error: "Assinatura inativa" });
      }

      const access = await userCanModifyCalendarEvent(supabaseAdmin, user, req.params.id);
      if (access.notFound) {
        return res.status(404).json({ error: "Evento não encontrado." });
      }
      if (!access.allowed) {
        return res.status(403).json({ error: "Acesso negado" });
      }

      const { error } = await supabaseAdmin
        .from('calendario_axe')
        .delete()
        .eq('id', req.params.id);

      if (error) throw error;
      res.json({ success: true });
    } catch (error: any) {
      console.error("[SERVER] Error deleting event:", error.message || error);
      res.status(500).json({ error: error.message || "Internal Server Error" });
    }
  });

  // API Route: Get Notices (Bypasses RLS)
  app.get("/api/notices", async (req, res) => {
    const access = await requireTenantReadAccess(supabaseAdmin, req, res, req.query.tenantId);
    if (!access) return;
    const tenantId = access.tenantId;
    try {
      const resolvedId = await resolveLeaderId(tenantId);
      const { data, error } = await supabaseAdmin
        .from('mural_avisos')
        .select('*')
        .or(`tenant_id.eq.${resolvedId},tenant_id.eq.${tenantId}`)
        .order('data_publicacao', { ascending: false });
      if (error) throw error;
      res.json({ data });
    } catch (error: any) {
      console.error("[SERVER] Error fetching notices:", error.message || error);
      res.status(500).json({ error: error.message || "Internal Server Error" });
    }
  });

  // API Route: Get Inventory (Bypasses RLS)
  app.get("/api/inventory", async (req, res) => {
    const access = await requireTenantReadAccess(supabaseAdmin, req, res, req.query.tenantId);
    if (!access) return;
    const tenantId = access.tenantId;
    try {
      const query = supabaseAdmin
        .from('almoxarifado')
        .select('*')
        .order('item', { ascending: true })
        .or(`tenant_id.eq.${tenantId},lider_id.eq.${tenantId}`);
      const { data, error } = await query;
      if (error) throw error;
      res.json({ data });
    } catch (error: any) {
      console.error("[SERVER] Error fetching inventory:", error.message || error);
      res.status(500).json({ error: error.message || "Internal Server Error" });
    }
  });

  // API Route: Get Transactions (Bypasses RLS)
  app.get("/api/transactions", async (req, res) => {
    try {
      const authUser = await requireAuthOrRespond(supabaseAdmin, req, res);
      if (!authUser) return;
      const { tenantId, userRole, limit, userEmail: userEmailQ } = req.query;
      const userId = authUser.id;
      const userRoleStr = String(userRole || "").toLowerCase();
      const tenantIdRaw = normalizeQueryTenantId(tenantId);
      const limNum = limit ? Number(limit) : 150;

      if (userRoleStr === "filho") {
        const jwtUid = authUser.id;
        const jwtEm = String(authUser.email || "").trim().toLowerCase();
        let fid: string | null = null;
        try {
          fid = await resolveFilhoRowIdForFinance(supabaseAdmin, {
            queryUserId: userId,
            queryUserEmail: String(userEmailQ || "").trim().toLowerCase(),
            jwtUserId: jwtUid,
            jwtEmail: jwtEm,
          });
        } catch (e: any) {
          console.error("[SERVER] resolveFilhoRowIdForFinance:", e?.message || e);
        }
        if (!fid) {
          return res.json({ data: [] });
        }
        try {
          const rows = await fetchFinanceiroRowsForFilho(supabaseAdmin, fid, limNum);
          const filtered = rows.filter(
            (r: any) => String(r?.status || "").toLowerCase() !== "excluido"
          );
          return res.json({ data: filtered });
        } catch (e: any) {
          console.error("[SERVER] fetchFinanceiroRowsForFilho:", e?.message || e);
          return res.status(500).json({ error: e?.message || "Erro ao listar financeiro" });
        }
      }

      const effectiveTenant = await resolveFinanceiroTenantScope(
        supabaseAdmin,
        userId,
        userRoleStr,
        tenantIdRaw
      );
      if (!effectiveTenant) return res.status(403).json({ error: "Acesso negado" });

      let query = supabaseAdmin.from('financeiro').select('*').order('data', { ascending: false });
      query = query.or(`tenant_id.eq.${effectiveTenant},lider_id.eq.${effectiveTenant}`);

      if (limit) {
        query = query.limit(Number(limit));
      }

      const { data, error } = await query;
      if (error) throw error;
      const filtered = (data || []).filter(
        (r: any) => String(r?.status || "").toLowerCase() !== "excluido"
      );
      console.log(
        `[SERVER] GET /api/transactions ok. tenant=${effectiveTenant} rows=${filtered.length}`
      );
      res.json({ data: filtered });
    } catch (error: any) {
      console.error("[SERVER] Error fetching transactions:", error.message || error);
      res.status(500).json({ error: error.message || "Internal Server Error" });
    }
  });

  app.post("/api/transactions", async (req, res) => {
    const authUser = await requireAuthOrRespond(supabaseAdmin, req, res);
    if (!authUser) return;

    const { tenantId, ...payload } = req.body || {};
    const tid = normalizeQueryTenantId(tenantId);
    if (!tid) return res.status(400).json({ error: "tenantId obrigatório" });

    const ok = await assertZeladorTenantAccess(supabaseAdmin, resolveLeaderId, authUser.id, tid);
    if (!ok) return res.status(403).json({ error: "Acesso negado" });

    try {
      const allowedTxFields = new Set([
        "tipo",
        "valor",
        "categoria",
        "data",
        "descricao",
        "filho_id",
        "data_vencimento",
        "status",
        "competencia_date",
      ]);
      const insertData: Record<string, unknown> = {
        lider_id: authUser.id,
        tenant_id: tid,
        valor: Number(payload.valor) || 0,
      };
      for (const [k, v] of Object.entries(payload)) {
        if (allowedTxFields.has(k)) insertData[k] = v;
      }
      if (insertData.filho_id) {
        const fid = String(insertData.filho_id);
        const { data: childRow } = await supabaseAdmin
          .from("filhos_de_santo")
          .select("id")
          .eq("id", fid)
          .eq("tenant_id", tid)
          .maybeSingle();
        if (!childRow) return res.status(400).json({ error: "filho_id inválido para este terreiro" });
      }
      const { data, error } = await supabaseAdmin
        .from("financeiro")
        .insert([insertData])
        .select("*")
        .single();
      if (error) throw error;
      res.json({ data });
    } catch (error: any) {
      console.error("[SERVER] POST /api/transactions:", error.message || error);
      res.status(500).json({ error: safeErrorMessage(error, "Erro ao registrar lançamento") });
    }
  });

  /**
   * Pedidos recentes da loja (dashboard). Via servidor para evitar 404 no browser
   * quando a tabela `loja_pedidos` ainda não existe no PostgREST (migração pendente).
   */
  app.get("/api/loja-pedidos", async (req, res) => {
    try {
      const authUser = await requireAuthOrRespond(supabaseAdmin, req, res);
      if (!authUser) return;
      const userId = authUser.id;
      const userRoleStr = String(req.query.userRole || "").toLowerCase();
      const tenantIdRaw = normalizeQueryTenantId(req.query.tenantId);
      if (userRoleStr === "filho") {
        return res.json({ data: [] });
      }
      const tenantIdEfetivo = await resolveFinanceiroTenantScope(
        supabaseAdmin,
        userId,
        userRoleStr,
        tenantIdRaw
      );
      if (!tenantIdEfetivo) return res.status(403).json({ error: "Acesso negado" });
      const seed = tenantIdEfetivo || userId;
      const { data: plRow } = await supabaseAdmin
        .from("perfil_lider")
        .select("id")
        .or(`id.eq.${seed},tenant_id.eq.${seed}`)
        .maybeSingle();
      const lojaTenantPk = String(plRow?.id || seed || "").trim();
      if (!lojaTenantPk) {
        return res.json({ data: [] });
      }
      const { data, error } = await supabaseAdmin
        .from("loja_pedidos")
        .select("*")
        .eq("tenant_id", lojaTenantPk)
        .order("created_at", { ascending: false })
        .limit(12);
      if (error) {
        const msg = String((error as { message?: string }).message || error || "");
        const tabelaAusente =
          /could not find the table|schema cache/i.test(msg) ||
          String((error as { code?: string }).code || "") === "PGRST205";
        if (!tabelaAusente) {
          console.warn("[SERVER] /api/loja-pedidos (retornando vazio):", msg);
        }
        return res.json({ data: [] });
      }
      return res.json({ data: data || [] });
    } catch (e: any) {
      console.warn("[SERVER] /api/loja-pedidos:", e?.message || e);
      return res.json({ data: [] });
    }
  });

  function isFinanceiroFkDeleteError(err: any): boolean {
    const code = String(err?.code || "");
    const msg = String(err?.message || err || "");
    return code === "23503" || /foreign key|violates foreign key constraint/i.test(msg);
  }

  /** Líder do terreiro ou filho dono do lançamento (mensalidade / filho_id). */
  async function userMayDeleteFinanceiroRow(user: { id: string; user_metadata?: Record<string, unknown> }, row: any) {
    const role = String(user.user_metadata?.role || "").toLowerCase();
    if (role === "filho") {
      const fid = await resolveFilhoRowIdForFinance(supabaseAdmin, {
        jwtUserId: user.id,
        jwtEmail: String((user as { email?: string | null }).email || "").trim().toLowerCase(),
      });
      if (!fid) return false;
      if (row.filho_id === fid) return true;
      const m = String(row.descricao || "").match(/\(ID:([^)]+)\)/);
      return !!(m && m[1] === fid);
    }
    const { data: profile } = await supabaseAdmin
      .from("perfil_lider")
      .select("id, tenant_id")
      .eq("id", user.id)
      .maybeSingle();
    if (!profile) return false;
    const house = profile.tenant_id || profile.id;
    const resolvedHouse = await resolveLeaderId(String(house));
    const candidates = new Set(
      [user.id, profile.id, profile.tenant_id, house, resolvedHouse].filter((x) => typeof x === "string" && x.length > 0)
    );
    for (const k of candidates) {
      if (row.lider_id === k || row.tenant_id === k) return true;
    }
    if (row.tenant_id) {
      const r = await resolveLeaderId(String(row.tenant_id));
      if (candidates.has(r)) return true;
    }
    return false;
  }

  // API Route: Delete financeiro row (service role — o cliente não tem DELETE via RLS)
  app.delete("/api/transactions/:id", async (req, res) => {
    const id = String(req.params.id || "").trim();
    if (!id) return res.status(400).json({ error: "id obrigatório" });
    try {
      const user = await requireApiUser(supabaseAdmin, req, res);
      if (!user) return;
      const { data: row, error: fetchErr } = await supabaseAdmin
        .from("financeiro")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (fetchErr) throw fetchErr;
      if (!row) return res.status(404).json({ error: "Lançamento não encontrado" });
      const allowed = await userMayDeleteFinanceiroRow(user, row);
      if (!allowed) return res.status(403).json({ error: "Sem permissão para excluir este lançamento" });

      const { error: delErr } = await supabaseAdmin.from("financeiro").delete().eq("id", id);
      if (!delErr) {
        return res.json({ success: true, mode: "hard" });
      }
      if (isFinanceiroFkDeleteError(delErr)) {
        const { error: softErr } = await supabaseAdmin
          .from("financeiro")
          .update({ status: "excluido" })
          .eq("id", id);
        if (!softErr) {
          return res.json({ success: true, mode: "soft", reason: "foreign_key" });
        }
        console.error("[SERVER] DELETE financeiro FK fallback (status=excluido) falhou:", {
          id,
          deleteError: delErr,
          softStatusError: softErr,
        });
        return res.status(409).json({
          error:
            "Não foi possível excluir por vínculo no banco e o soft delete falhou. Confirme a coluna `status` em `financeiro`.",
          details: String(delErr?.message || delErr),
        });
      }
      console.error("[SERVER] DELETE financeiro:", { id, deleteError: delErr });
      return res.status(500).json({ error: String(delErr?.message || delErr) });
    } catch (error: any) {
      console.error("[SERVER] /api/transactions DELETE:", error?.message || error);
      res.status(500).json({ error: error.message || "Internal Server Error" });
    }
  });

  // API Route: Get Library Materials (legado — protegido; preferir /api/v1/library/materials)
  app.get("/api/library", async (req, res) => {
    const access = await requireTenantReadAccess(supabaseAdmin, req, res, req.query.tenantId);
    if (!access) return;
    try {
      const { data, error } = await supabaseAdmin
        .from("biblioteca")
        .select("*")
        .eq("tenant_id", access.tenantId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      res.json({ data: data || [] });
    } catch (error: any) {
      console.error("[SERVER] Error fetching library:", error.message || error);
      res.status(500).json({ error: safeErrorMessage(error, "Erro ao buscar biblioteca") });
    }
  });

  // API Route: Get Notifications (protegido)
  app.get("/api/notifications", async (req, res) => {
    const access = await requireTenantReadAccess(supabaseAdmin, req, res, req.query.tenantId);
    if (!access) return;
    const { tipo, lida, limit } = req.query;
    try {
      let query = supabaseAdmin
        .from("notificacoes")
        .select("*")
        .eq("tenant_id", access.tenantId)
        .order("created_at", { ascending: false });
      if (tipo) query = query.eq("tipo", tipo as string);
      if (lida !== undefined) query = query.eq("lida", lida === "true");
      if (limit) query = query.limit(Number(limit));
      const { data, error } = await query;
      if (error) throw error;
      res.json({ data: data || [] });
    } catch (error: any) {
      console.error("[SERVER] Error fetching notifications:", error.message || error);
      res.status(500).json({ error: safeErrorMessage(error, "Erro ao buscar notificações") });
    }
  });

  async function userCanAccessCalendarEvent(
    user: { id: string; email?: string | null },
    eventId: string
  ): Promise<boolean> {
    const { data: ev } = await supabaseAdmin
      .from("calendario_axe")
      .select("tenant_id, lider_id")
      .eq("id", eventId)
      .maybeSingle();
    if (!ev) return false;
    const ref = String(ev.tenant_id || ev.lider_id || "").trim();
    if (!ref) return false;
    return assertUserCanAccessTenant(supabaseAdmin, user, ref);
  }

  // API Route: Get Event Guests (protegido)
  app.get("/api/event-guests", async (req, res) => {
    const user = await requireAuthOrRespond(supabaseAdmin, req, res);
    if (!user) return;
    const eventId = String(req.query.eventId || "").trim();
    try {
      if (!eventId) return res.status(400).json({ error: "Missing eventId" });
      if (!(await userCanAccessCalendarEvent(user, eventId))) {
        return res.status(403).json({ error: "Acesso negado" });
      }
      const { data, error } = await supabaseAdmin
        .from("convidados_eventos")
        .select("*")
        .eq("event_id", eventId)
        .order("nome");
      if (error) throw error;
      res.json({ data: data || [] });
    } catch (error: any) {
      console.error("[SERVER] Error fetching event guests:", error.message || error);
      res.status(500).json({ error: safeErrorMessage(error, "Erro ao buscar convidados") });
    }
  });

  // API Route: Update Event Guest Status (protegido + validação de tenant)
  app.post("/api/event-guests/update-status", async (req, res) => {
    const user = await requireAuthOrRespond(supabaseAdmin, req, res);
    if (!user) return;
    const { guestId, status } = req.body || {};
    try {
      if (!guestId || !status) return res.status(400).json({ error: "Missing guestId or status" });

      const { data: guest, error: guestErr } = await supabaseAdmin
        .from("convidados_eventos")
        .select("id, event_id")
        .eq("id", guestId)
        .maybeSingle();
      if (guestErr || !guest?.event_id) {
        return res.status(404).json({ error: "Convidado não encontrado" });
      }
      if (!(await userCanAccessCalendarEvent(user, String(guest.event_id)))) {
        return res.status(403).json({ error: "Acesso negado" });
      }

      const { error } = await supabaseAdmin
        .from("convidados_eventos")
        .update({ status })
        .eq("id", guestId);
      if (error) throw error;
      res.json({ success: true });
    } catch (error: any) {
      console.error("[SERVER] Error updating event guest status:", error.message || error);
      res.status(500).json({ error: safeErrorMessage(error, "Erro ao atualizar convidado") });
    }
  });

  /** WhatsApp via Evolution API (src/services/evolution.service). */
  function whatsappInitializingResponse(res: express.Response, err?: unknown) {
    const msg =
      err && typeof err === "object" && "message" in err && String((err as { message?: string }).message)
        ? String((err as { message: string }).message)
        : WHATSAPP_INITIALIZING_MESSAGE_PT;
    return res.status(503).json({
      error: msg,
      code: "WHATSAPP_INITIALIZING",
    });
  }

  const defaultWaPreferences = () => ({
    notifGiras: true,
    notifFinanceiro: true,
    notifReza: true,
    notifAniversarios: true,
  });

  // --- WHATSAPP INTEGRATION ENDPOINTS (Evolution API) ---
  app.get("/api/whatsapp/config", async (req, res) => {
    try {
      const user = await requireApiUser(supabaseAdmin, req, res);
      if (!user) return;

      const { data, error } = await supabaseAdmin
        .from("whatsapp_config")
        .select("templates, metadata, phone_number")
        .eq("tenant_id", user.id)
        .maybeSingle();
      if (error) {
        const msg = String((error as { message?: string })?.message || "");
        const code = String((error as { code?: string })?.code || "");
        if (code === "PGRST205" || code === "42P01" || /schema cache|whatsapp_config/i.test(msg)) {
          return res.json({
            success: true,
            templates: normalizeWhatsAppTemplates(null),
            preferences: defaultWaPreferences(),
            phoneNumber: null,
            warning: "WHATSAPP_TABLE_NOT_READY",
          });
        }
        throw error;
      }

      const meta = (data?.metadata && typeof data.metadata === "object" ? data.metadata : {}) as Record<string, unknown>;
      const prefs = (meta.preferences && typeof meta.preferences === "object" ? meta.preferences : {}) as Record<string, boolean>;

      return res.json({
        success: true,
        templates: normalizeWhatsAppTemplates(data?.templates),
        preferences: { ...defaultWaPreferences(), ...prefs },
        phoneNumber: data?.phone_number || null,
      });
    } catch (error: any) {
      return res.status(500).json({ error: error?.message || "Erro ao carregar configurações do WhatsApp." });
    }
  });

  app.post("/api/whatsapp/config", async (req, res) => {
    try {
      const user = await requireApiUser(supabaseAdmin, req, res);
      if (!user) return;

      const { instance_name, evolution_api_url, templates, preferences } = req.body || {};
      const safeTemplates = normalizeWhatsAppTemplates(templates);
      const { data: existing } = await supabaseAdmin
        .from("whatsapp_config")
        .select("metadata")
        .eq("tenant_id", user.id)
        .maybeSingle();
      const prevMeta = (existing?.metadata && typeof existing.metadata === "object" ? existing.metadata : {}) as Record<string, unknown>;
      const nextMeta = { ...prevMeta };
      if (preferences && typeof preferences === "object") {
        nextMeta.preferences = { ...defaultWaPreferences(), ...preferences };
      }
      const { error } = await supabaseAdmin
        .from('whatsapp_config')
        .upsert({
          instance_name,
          evolution_api_url,
          templates: safeTemplates,
          metadata: nextMeta,
          id: user.id,
          tenant_id: user.id,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/whatsapp/logs", async (req, res) => {
    try {
      const user = await requireApiUser(supabaseAdmin, req, res);
      if (!user) return;
      const { data, error } = await supabaseAdmin
        .from("whatsapp_logs")
        .select("id, telefone, mensagem, tipo, status, created_at")
        .eq("tenant_id", user.id)
        .order("created_at", { ascending: false })
        .limit(40);
      if (error) throw error;
      res.json({ success: true, logs: data || [] });
    } catch (error: any) {
      res.status(500).json({ error: error?.message || "Erro ao carregar logs." });
    }
  });

  app.post("/api/whatsapp/broadcast", async (req, res) => {
    try {
      const user = await requireApiUser(supabaseAdmin, req, res);
      if (!user) return;
      const message = String(req.body?.message || "").trim();
      if (!message) return res.status(400).json({ error: "Mensagem obrigatória." });

      const { data: leader } = await supabaseAdmin
        .from("perfil_lider")
        .select("tenant_id")
        .eq("id", user.id)
        .maybeSingle();
      const tenantScope = String(leader?.tenant_id || user.id);

      const { data: filhos, error: filhosErr } = await supabaseAdmin
        .from("filhos_de_santo")
        .select("id, nome, whatsapp_phone")
        .or(`tenant_id.eq.${tenantScope},lider_id.eq.${user.id}`)
        .not("whatsapp_phone", "is", null);
      if (filhosErr) throw filhosErr;

      const targets = (filhos || []).filter((f) => String(f.whatsapp_phone || "").replace(/\D/g, "").length >= 10);
      if (!targets.length) {
        return res.status(400).json({ error: "Nenhum filho de santo com WhatsApp cadastrado." });
      }

      let sent = 0;
      let failed = 0;
      for (const filho of targets) {
        try {
          let phoneDigits = String(filho.whatsapp_phone).replace(/\D/g, "");
          if (!phoneDigits.startsWith("55")) phoneDigits = `55${phoneDigits}`;
          await sendEvolutionTextMessage(user.id, phoneDigits, message);
          sent += 1;
        } catch {
          failed += 1;
        }
      }

      if (sent > 0) {
        await supabaseAdmin.from("whatsapp_logs").insert({
          tenant_id: user.id,
          tipo: "teste",
          telefone: "corrente_geral",
          mensagem: message,
          status: failed > 0 ? "partial" : "sent",
          external_id: `broadcast_${Date.now()}`,
        });
      }

      res.json({
        success: true,
        sent,
        failed,
        total: targets.length,
        destino: `Corrente Geral (${targets.length} médiuns)`,
      });
    } catch (error: any) {
      if (error?.code === "WHATSAPP_INITIALIZING") return whatsappInitializingResponse(res, error);
      res.status(500).json({ error: error?.message || "Erro na transmissão." });
    }
  });

  app.post("/api/whatsapp/send", whatsappSendRateLimit, async (req, res) => {
    try {
      const user = await requireApiUser(supabaseAdmin, req, res);
      if (!user) return;

      const { tipo, filhoId, variables, forcePhone } = req.body;

      const result = await sendWhatsAppForTenant(supabaseAdmin, {
        tenantId: user.id,
        tipo: String(tipo || ""),
        filhoId,
        forcePhone,
        variables,
      });

      res.json({ success: true, message: "Mensagem enviada com sucesso", externalId: result.externalId });
    } catch (error: any) {
      if (error?.code === "WHATSAPP_INITIALIZING") {
        return whatsappInitializingResponse(res, error);
      }
      const status = error?.statusCode === 403 ? 403 : error?.statusCode === 400 ? 400 : 500;
      res.status(status).json({ error: error?.message || "Erro ao enviar mensagem" });
    }
  });

  app.post("/api/whatsapp/webhook", webhookRateLimit, async (req, res) => {
    if (!verifyWhatsAppWebhook(req)) {
      return res.status(401).json({ error: "Webhook não autorizado" });
    }
    const { data } = req.body;
    const externalId = data?.key?.id;
    const status = data?.status;

    if (externalId) {
      let mappedStatus = 'sent';
      if (status === 'DELIVERY_ACK') mappedStatus = 'delivered';
      if (status === 'READ') mappedStatus = 'read';

      await supabaseAdmin
        .from('whatsapp_logs')
        .update({ status: mappedStatus })
        .eq('external_id', externalId);
    }

    res.status(200).send('OK');
  });

  app.post("/api/whatsapp/start", async (req, res) => {
    try {
      const user = await requireApiUser(supabaseAdmin, req, res);
      if (!user) return;

      const merged = await getAxeEvolutionStatusAndQr(user.id);
      if (merged.status === "CONNECTED") {
        return res.json({ message: "WhatsApp já está conectado." });
      }

      const phone = String((req.body && (req.body.phone || req.body.number)) || "").trim();
      const mode = String((req.body && req.body.mode) || "").trim().toLowerCase();

      if (phone && mode !== "qrcode") {
        const out = await createInstanceWithPairingCode(evolutionInstanceName(user.id), phone);
        return res.json({
          message: "Use o código ou escaneie o QR no WhatsApp em até 60 segundos.",
          pairingCode: out.pairingCode,
          qrcode: out.qrcode,
          mode: "pairing",
        });
      }

      const qrcode = await createInstanceWithQrCode(user.id);
      return res.json({ message: "Escaneie o QR Code no WhatsApp.", qrcode, mode: "qrcode" });
    } catch (err: any) {
      if (err?.code === "WHATSAPP_INITIALIZING") return whatsappInitializingResponse(res, err);
      res.status(500).json({ error: err?.message || "Erro ao iniciar" });
    }
  });

  app.post("/api/whatsapp/test-message", async (req, res) => {
    try {
      const user = await requireApiUser(supabaseAdmin, req, res);
      if (!user) return;

      const { phone } = req.body;
      if (!phone) return res.status(400).json({ error: "Telefone é obrigatório." });

      const msg = "Axé! Este é um teste de conexão do AxéCloud. Se você recebeu isso, seu terreiro já está automatizado!";
      let phoneDigits = String(phone).replace(/\D/g, "");
      if (!phoneDigits.startsWith("55")) phoneDigits = `55${phoneDigits}`;
      await sendEvolutionTextMessage(user.id, phoneDigits, msg);
      return res.json({ success: true, message: "Mensagem enviada com sucesso!" });
    } catch (err: any) {
      if (err?.code === "WHATSAPP_INITIALIZING") return whatsappInitializingResponse(res, err);
      res.status(500).json({ error: err?.message || "Falha ao enviar." });
    }
  });

  app.get("/api/whatsapp/status", async (req, res) => {
    try {
      const user = await requireApiUser(supabaseAdmin, req, res);
      if (!user) return;

      const merged = await getAxeEvolutionStatusAndQr(user.id);
      res.json({ status: merged.status, qrcode: merged.qrcode });
    } catch (err: any) {
      console.error("[WHATSAPP] /api/whatsapp/status:", err?.message || err);
      if (err?.code === "WHATSAPP_INITIALIZING") return whatsappInitializingResponse(res, err);
      return whatsappInitializingResponse(res, new Error(WHATSAPP_INITIALIZING_MESSAGE_PT));
    }
  });

  app.post("/api/whatsapp/logout", async (req, res) => {
    try {
      const user = await requireApiUser(supabaseAdmin, req, res);
      if (!user) return;

      await logoutEvolutionInstance(user.id);

      res.json({ message: "Sessão WhatsApp encerrada na Evolution API." });
    } catch (err: any) {
      if (err?.code === "WHATSAPP_INITIALIZING") return whatsappInitializingResponse(res, err);
      res.status(500).json({ error: err?.message || "Erro ao deslogar" });
    }
  });

  // Vite middleware setup
  if (process.env.NODE_ENV !== "production") {
    try {
      console.log("[SERVER] Carregando middleware do Vite (Desenvolvimento)...");
      const viteModule = await import("vite");
      const vite = await viteModule.createServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
      console.log("[SERVER] Middleware do Vite carregado com sucesso.");
    } catch (e: any) {
      console.error("[SERVER] ERRO CRÍTICO ao carregar Vite:", e);
    }
  } else {
    console.log("[SERVER] Serving static files (Production)...");
    const distPath = path.join(process.cwd(), "dist");
    const indexPath = path.join(distPath, "index.html");
    const hasSpa = existsSync(indexPath);
    if (hasSpa) {
      app.use((req, res, next) => {
        const pathOnly = String(req.path || (req.url || "").split("?")[0] || "");
        if (
          pathOnly.startsWith("/dashboard") ||
          pathOnly.startsWith("/checkout") ||
          pathOnly.startsWith("/register") ||
          pathOnly.startsWith("/consulente")
        ) {
          res.setHeader("X-Robots-Tag", "noindex, nofollow");
        }
        if (
          pathOnly === "/sw.js" ||
          pathOnly === "/manifest.webmanifest" ||
          pathOnly === "/build-info.json" ||
          pathOnly.startsWith("/workbox-")
        ) {
          res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
          res.setHeader("Pragma", "no-cache");
        }
        next();
      });
      app.use(express.static(distPath));
    } else {
      console.warn(
        "[SERVER] dist/index.html ausente neste bundle (comum na função serverless só-API na Vercel)."
      );
    }
    app.get("*", (req, res) => {
      const pathOnly = String(req.path || (req.url || "").split("?")[0] || "");
      if (pathOnly.startsWith("/api")) {
        return res.status(404).json({
          error: "Rota API não encontrada",
          path: req.originalUrl || req.url,
        });
      }
      if (!hasSpa) {
        return res.status(503).type("text/plain").send("Frontend não incluído nesta função serverless.");
      }
      try {
        const html = injectRuntimeConfigHtml(readFileSync(indexPath, "utf8"));
        res.type("html").send(html);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error("[SERVER] serve SPA index.html:", message);
        if (!res.headersSent) res.status(503).type("text/plain").send("Erro ao servir SPA");
      }
    });
  }

  if (process.env.VERCEL !== '1') {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
      
      // Garantir buckets e esquema após o início para não bloquear o boot
      ensureBucketsExist().catch(err => console.error("[SERVER] Erro ao garantir buckets:", err));
      initializeDatabase().catch(err => console.error("[SERVER] Erro ao inicializar banco:", err));
    });
  }

  // Global Error Handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("[SERVER ERROR]", err);
    res.status(500).json({ error: "Internal Server Error", details: err.message });
  });

  return app;
}

const appPromise = startServer();

export default async function handler(req: any, res: any) {
  try {
    const app = await appPromise;
    return app(req, res);
  } catch (err: any) {
    console.error("[VERCEL HANDLER ERROR]", err);
    res.status(500).json({ error: "Internal Server Error during initialization", details: err.message || String(err) });
  }
}

// deploy-bump: 2026-05-10 — permanentAccountDelete em /api (compatível com bundle Vercel)
