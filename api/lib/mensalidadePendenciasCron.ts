/**
 * Gera cobranças de mensalidade pendentes sem o zelador abrir o Financeiro.
 * Usado pelo cron diário (antes dos disparos WA), especialmente no dia 1.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { format } from "date-fns";
import { childEligibleForDueMonth, clampDayInMonth } from "./mensalidadeEligibility.js";
import { resolveLeaderId } from "./tenantAccess.js";
import { filterActiveTenantIds } from "./activeTenantScope.js";

const BR_TZ = "America/Sao_Paulo";

function brazilTodayParts(now = new Date()): { y: number; m0: number; ymd: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BR_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const y = Number(parts.find((p) => p.type === "year")?.value || "1970");
  const m = Number(parts.find((p) => p.type === "month")?.value || "1");
  const d = Number(parts.find((p) => p.type === "day")?.value || "1");
  const ymd = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  return { y, m0: m - 1, ymd };
}

function deriveFilhoIdFromRow(row: {
  filho_id?: string | null;
  descricao?: string | null;
}): string | null {
  const direct = String(row.filho_id || "").trim().toLowerCase();
  if (direct) return direct;
  const m = String(row.descricao || "").match(/\(ID:([0-9a-f-]{36})\)/i);
  return m?.[1] ? m[1].toLowerCase() : null;
}

function rowLooksUnpaid(row: { status?: string | null; descricao?: string | null }): boolean {
  const st = String(row.status || "").toLowerCase();
  if (st === "pago" || st === "paid") return false;
  if (st === "pendente" || st === "pending" || st === "atrasado" || st === "overdue") return true;
  return String(row.descricao || "").toLowerCase().includes("vencimento");
}

function rowLooksPaid(row: { status?: string | null; tipo?: string | null; descricao?: string | null }): boolean {
  const st = String(row.status || "").toLowerCase();
  if (st === "pago" || st === "paid") return true;
  const desc = String(row.descricao || "").toLowerCase();
  if (desc.includes("confirmad") || desc.includes("pago")) return true;
  return String(row.tipo || "").toLowerCase() === "entrada" && desc.includes("pagamento");
}

async function isMensalidadeAtiva(sb: SupabaseClient, tenantId: string, leaderId: string): Promise<boolean> {
  const { data: pix, error } = await sb
    .from("configuracoes_pix")
    .select("mensalidade_ativa")
    .or(`terreiro_id.eq.${leaderId},terreiro_id.eq.${tenantId}`)
    .maybeSingle();
  if (error) {
    const msg = String(error.message || "").toLowerCase();
    if (msg.includes("mensalidade_ativa")) return true;
    throw error;
  }
  if (!pix) return true;
  return (pix as { mensalidade_ativa?: boolean }).mensalidade_ativa !== false;
}

async function listTenantIds(sb: SupabaseClient): Promise<string[]> {
  const ids = new Set<string>();
  const { data: pixRows } = await sb.from("configuracoes_pix").select("terreiro_id");
  for (const row of pixRows || []) {
    const tid = String((row as { terreiro_id?: string }).terreiro_id || "").trim();
    if (tid) ids.add(tid);
  }
  const { data: finRows } = await sb.from("financeiro").select("tenant_id, lider_id").eq("categoria", "Mensalidade");
  for (const row of finRows || []) {
    const tid = String(
      (row as { tenant_id?: string }).tenant_id || (row as { lider_id?: string }).lider_id || ""
    ).trim();
    if (tid) ids.add(tid);
  }
  const { data: waRows } = await sb.from("whatsapp_config").select("tenant_id");
  for (const row of waRows || []) {
    const tid = String((row as { tenant_id?: string }).tenant_id || "").trim();
    if (tid) ids.add(tid);
  }
  return filterActiveTenantIds(sb, ids);
}

async function hasPendingThisMonth(
  sb: SupabaseClient,
  filhoId: string,
  monthStart: string,
  monthEnd: string
): Promise<boolean> {
  const fid = filhoId.toLowerCase();
  const { data, error } = await sb
    .from("financeiro")
    .select("id, status, descricao, data, data_vencimento, filho_id")
    .eq("categoria", "Mensalidade")
    .or(`filho_id.eq.${filhoId},descricao.ilike.%ID:${filhoId}%`);
  if (error) {
    // fallback sem data_vencimento / filho_id
    const { data: d2 } = await sb
      .from("financeiro")
      .select("id, status, descricao, data, filho_id")
      .eq("categoria", "Mensalidade")
      .ilike("descricao", `%ID:${filhoId}%`);
    for (const row of d2 || []) {
      if (deriveFilhoIdFromRow(row) !== fid) continue;
      if (!rowLooksUnpaid(row)) continue;
      const ymd = String((row as { data?: string }).data || "").slice(0, 10);
      if (ymd >= monthStart && ymd <= monthEnd) return true;
    }
    return false;
  }
  for (const row of data || []) {
    if (deriveFilhoIdFromRow(row) !== fid) continue;
    if (!rowLooksUnpaid(row)) continue;
    const ymd = String(
      (row as { data_vencimento?: string }).data_vencimento || (row as { data?: string }).data || ""
    ).slice(0, 10);
    if (ymd >= monthStart && ymd <= monthEnd) return true;
  }
  return false;
}

async function hasPaidThisMonth(
  sb: SupabaseClient,
  filhoId: string,
  monthStart: string,
  monthEnd: string
): Promise<boolean> {
  const fid = filhoId.toLowerCase();
  const { data } = await sb
    .from("financeiro")
    .select("id, status, tipo, descricao, data, filho_id")
    .eq("categoria", "Mensalidade")
    .gte("data", monthStart)
    .lte("data", monthEnd)
    .or(`filho_id.eq.${filhoId},descricao.ilike.%ID:${filhoId}%`);
  for (const row of data || []) {
    if (deriveFilhoIdFromRow(row) !== fid) continue;
    if (rowLooksPaid(row)) return true;
  }
  return false;
}

async function syncTenantPendencias(
  sb: SupabaseClient,
  tenantId: string,
  y: number,
  m0: number
): Promise<number> {
  const leaderId = await resolveLeaderId(sb, tenantId);
  if (!(await isMensalidadeAtiva(sb, tenantId, leaderId))) return 0;

  let dia = 10;
  let valorPadrao = 89.9;
  const { data: pix } = await sb
    .from("configuracoes_pix")
    .select("valor_mensalidade, dia_vencimento")
    .or(`terreiro_id.eq.${leaderId},terreiro_id.eq.${tenantId}`)
    .maybeSingle();
  if (pix) {
    dia = parseInt(String((pix as { dia_vencimento?: unknown }).dia_vencimento), 10) || 10;
    valorPadrao = Number((pix as { valor_mensalidade?: unknown }).valor_mensalidade) || valorPadrao;
  }

  const dueStr = format(clampDayInMonth(y, m0, dia), "yyyy-MM-dd");
  const monthStart = `${y}-${String(m0 + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(y, m0 + 1, 0).getDate();
  const monthEnd = `${y}-${String(m0 + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const { data: children, error: childErr } = await sb
    .from("filhos_de_santo")
    .select("id, nome, tenant_id, lider_id, created_at, data_entrada, status")
    .or(
      [
        `tenant_id.eq.${tenantId}`,
        `tenant_id.eq.${leaderId}`,
        `lider_id.eq.${tenantId}`,
        `lider_id.eq.${leaderId}`,
      ].join(",")
    );
  if (childErr) throw childErr;

  let created = 0;
  for (const child of children || []) {
    const stFilho = String((child as { status?: string }).status || "Ativo").trim().toLowerCase();
    if (stFilho === "inativo" || stFilho === "desligado" || stFilho === "falecido") continue;

    const fid = String((child as { id: string }).id || "").trim();
    if (!fid) continue;
    if (!childEligibleForDueMonth(child, dueStr, dia)) continue;
    if (await hasPendingThisMonth(sb, fid, monthStart, monthEnd)) continue;
    if (await hasPaidThisMonth(sb, fid, monthStart, monthEnd)) continue;

    const nome = String((child as { nome?: string }).nome || "Filho").trim() || "Filho";
    const insert: Record<string, unknown> = {
      tipo: "entrada",
      valor: valorPadrao,
      categoria: "Mensalidade",
      data: dueStr,
      descricao: `Mensalidade - ${nome} (vencimento ${dueStr}) (ID:${fid})`,
      tenant_id: tenantId,
      lider_id: leaderId,
      data_vencimento: dueStr,
      filho_id: fid,
      status: "pendente",
    };

    let { error: insErr } = await sb.from("financeiro").insert([insert]);
    if (insErr && String(insErr.message || "").includes("data_vencimento")) {
      delete insert.data_vencimento;
      ({ error: insErr } = await sb.from("financeiro").insert([insert]));
    }
    if (insErr && String(insErr.message || "").includes("filho_id")) {
      delete insert.filho_id;
      ({ error: insErr } = await sb.from("financeiro").insert([insert]));
    }
    if (insErr && String(insErr.message || "").toLowerCase().includes("status")) {
      delete insert.status;
      ({ error: insErr } = await sb.from("financeiro").insert([insert]));
    }
    if (!insErr) created += 1;
    else {
      console.warn(
        "[CRON MENSALIDADE] insert falhou tenant=",
        tenantId,
        "filho=",
        fid,
        "err=",
        insErr.message || insErr
      );
    }
  }
  return created;
}

/** Gera pendências do mês corrente (fuso SP) para todos os terreiros elegíveis. */
export async function syncAllMensalidadePendenciasForCron(sb: SupabaseClient): Promise<{
  tenants: number;
  created: number;
  errors: number;
  day1: boolean;
  ymd: string;
}> {
  const { y, m0, ymd } = brazilTodayParts();
  const day1 = ymd.endsWith("-01");
  const tenantIds = await listTenantIds(sb);
  let created = 0;
  let errors = 0;
  let tenantsTouched = 0;

  for (const tenantId of tenantIds) {
    try {
      const n = await syncTenantPendencias(sb, tenantId, y, m0);
      created += n;
      tenantsTouched += 1;
    } catch (err) {
      errors += 1;
      console.error(`[CRON MENSALIDADE] sync tenant=${tenantId}:`, err);
    }
  }

  console.log(
    `[CRON MENSALIDADE] sync-pendencias ymd=${ymd} day1=${day1} tenants=${tenantsTouched} created=${created} errors=${errors}`
  );
  return { tenants: tenantsTouched, created, errors, day1, ymd };
}
