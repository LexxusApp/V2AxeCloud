import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, differenceInCalendarDays, format, parseISO, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getOfficialWhatsAppStatus } from "../../src/services/evolution.service.js";
import {
  buildWhatsAppMessage,
  enrichEventCalendarVariables,
  logAndSendWhatsApp,
  resolveTerreiroWhatsAppContext,
  assertFilhoBelongsToTerreiro,
} from "./whatsappSendCore.js";
import { resolveLeaderId } from "./tenantAccess.js";
import {
  assertFanoutCooldown,
  capAndShuffleRecipients,
} from "./whatsappSendGuards.js";
import { normalizeBrWhatsAppMsisdn } from "../../src/lib/whatsappPhone.js";

function envInt(name: string, fallback: number): number {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw >= 0 ? Math.floor(raw) : fallback;
}

const FANOUT_MAX_RECIPIENTS = envInt("WA_FANOUT_MAX_RECIPIENTS", 30);
const BR_TZ = "America/Sao_Paulo";
const MENSALIDADE_SKIP_TENANT_IDS = new Set(
  String(process.env.WA_MENSALIDADE_SKIP_TENANT_IDS || "")
    .split(/[,\s]+/)
    .map((id) => id.trim())
    .filter(Boolean)
);

function isMensalidadeNotifEnabled(metadata: unknown): boolean {
  const meta = metadata && typeof metadata === "object" ? (metadata as Record<string, unknown>) : {};
  const prefs =
    meta.preferences && typeof meta.preferences === "object"
      ? (meta.preferences as Record<string, unknown>)
      : {};
  return prefs.notifFinanceiro !== false;
}

type WaCfgRow = { tenant_id?: string; templates?: unknown; metadata?: unknown };

async function loadWhatsAppConfigsByTenant(sb: SupabaseClient): Promise<Map<string, WaCfgRow>> {
  const map = new Map<string, WaCfgRow>();
  const { data } = await sb.from("whatsapp_config").select("tenant_id, templates, metadata");
  for (const row of data || []) {
    const tid = String((row as WaCfgRow).tenant_id || "");
    if (tid) map.set(tid, row as WaCfgRow);
  }
  return map;
}

async function listMensalidadeTenantIds(sb: SupabaseClient, cfgMap: Map<string, WaCfgRow>): Promise<string[]> {
  const ids = new Set<string>(cfgMap.keys());
  const { data: pixRows } = await sb.from("configuracoes_pix").select("terreiro_id");
  for (const row of pixRows || []) {
    const tid = String((row as { terreiro_id?: string }).terreiro_id || "");
    if (tid) ids.add(tid);
  }
  const { data: finRows } = await sb
    .from("financeiro")
    .select("tenant_id, lider_id")
    .eq("categoria", "Mensalidade");
  for (const row of finRows || []) {
    const tid = String((row as { tenant_id?: string }).tenant_id || (row as { lider_id?: string }).lider_id || "");
    if (tid) ids.add(tid);
  }
  return [...ids];
}

async function resolveCronTerreiroContext(sb: SupabaseClient, tenantId: string) {
  const leaderId = await resolveLeaderId(sb, tenantId);
  return resolveTerreiroWhatsAppContext(sb, leaderId, tenantId);
}

/** Data civil no fuso de SP (o container costuma estar em UTC). */
function brazilTodayParts(now = new Date()): { y: number; m0: number; day: number; ymd: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BR_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const y = Number(parts.find((p) => p.type === "year")?.value || "1970");
  const m = Number(parts.find((p) => p.type === "month")?.value || "01");
  const day = Number(parts.find((p) => p.type === "day")?.value || "01");
  return { y, m0: m - 1, day, ymd: `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}` };
}

function clampDayNumber(year: number, month0: number, day: number): number {
  const last = new Date(year, month0 + 1, 0).getDate();
  return Math.min(Math.max(day, 1), last);
}

function formatBrl(value: number): string {
  if (!(value > 0)) return "—";
  return value.toFixed(2).replace(".", ",");
}

function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

/** Segunda-feira da semana civil (ISO), sem depender do fuso do servidor. */
function mondayOfWeek(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const dow = date.getUTCDay();
  const offset = dow === 0 ? -6 : 1 - dow;
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function hash32(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Dias estáveis por semente — o cron diário não escolhe outro dia a cada execução. */
function pickStableDays(days: string[], count: number, seed: string): string[] {
  if (count <= 0 || days.length === 0) return [];
  const scored = days.map((d) => ({ d, s: hash32(`${seed}:${d}`) }));
  scored.sort((a, b) => a.s - b.s || a.d.localeCompare(b.d));
  return scored.slice(0, Math.min(count, scored.length)).map((row) => row.d);
}

function daysOfWeekInMonth(weekMonday: string, monthStart: string, monthEnd: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < 7; i++) {
    const ymd = addDaysYmd(weekMonday, i);
    if (ymd >= monthStart && ymd <= monthEnd) out.push(ymd);
  }
  return out;
}

type MensalidadeCronKind = "disponivel" | "pendente" | "vence_hoje" | "atrasada";

/**
 * Calendário pedido:
 * - dia 1 → disponível
 * - toda semana → 1 dia estável
 * - semana do vencimento → 2 dias estáveis (exceto o vencimento)
 * - no vencimento → vence_hoje
 * - após o vencimento (ainda no mês) → atrasada (diário até pagar)
 */
function resolveMensalidadeCronKind(opts: {
  todayYmd: string;
  monthStart: string;
  monthEnd: string;
  dueYmd: string;
  tenantId: string;
}): MensalidadeCronKind | null {
  const { todayYmd, monthStart, monthEnd, dueYmd, tenantId } = opts;
  if (todayYmd === dueYmd) return "vence_hoje";
  if (todayYmd === monthStart) return "disponivel";

  // Depois do vencimento: cobrar todo dia enquanto houver pendência.
  if (todayYmd > dueYmd && todayYmd <= monthEnd) return "atrasada";

  const weekMonday = mondayOfWeek(todayYmd);
  const inDueWeek = weekMonday === mondayOfWeek(dueYmd);
  const exclude = new Set([dueYmd, monthStart]);
  const eligible = daysOfWeekInMonth(weekMonday, monthStart, monthEnd).filter((d) => !exclude.has(d));
  const picked = pickStableDays(eligible, inDueWeek ? 2 : 1, `${tenantId}:${weekMonday}`);
  return picked.includes(todayYmd) ? "pendente" : null;
}

function rowMatchesFilho(row: { filho_id?: string | null; descricao?: string | null }, fid: string): boolean {
  const rowFilho = String(row.filho_id || "").trim();
  if (rowFilho && rowFilho === fid) return true;
  return String(row.descricao || "").includes(`ID:${fid}`);
}

function rowIsUnpaidMensalidade(row: { status?: string | null; descricao?: string | null }): boolean {
  const stRow = String(row.status || "").toLowerCase();
  if (stRow === "pago" || stRow === "paid") return false;
  return stRow === "pendente" || stRow === "pending" || String(row.descricao || "").toLowerCase().includes("vencimento");
}

async function whatsappLogExistsToday(
  sb: SupabaseClient,
  tenantId: string,
  tipo: string,
  dedupeKey: string,
  todayYmd?: string
): Promise<boolean> {
  const ymd = todayYmd || brazilTodayParts().ymd;
  const { count } = await sb
    .from("whatsapp_logs")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("tipo", tipo)
    .ilike("mensagem", `%${dedupeKey}%`)
    .gte("created_at", `${ymd}T00:00:00-03:00`);
  return (count || 0) > 0;
}

async function isOfficialChannelReady(): Promise<boolean> {
  const st = await getOfficialWhatsAppStatus();
  return st.status === "CONNECTED";
}

async function runMensalidadeReminders(sb: SupabaseClient): Promise<{ sent: number; skipped: number; errors: number }> {
  let sent = 0;
  let skipped = 0;
  let errors = 0;

  if (!(await isOfficialChannelReady())) {
    console.warn("[CRON WA] mensalidade: canal oficial offline — nenhum disparo");
    return { sent: 0, skipped: 0, errors: 0 };
  }

  const { y, m0, ymd: todayYmd } = brazilTodayParts();
  const mesAno = `${String(m0 + 1).padStart(2, "0")}/${y}`;
  const mesExtenso = format(new Date(y, m0, 15), "MMMM 'de' yyyy", { locale: ptBR });
  // Janela ampliada para pegar atrasadas de meses anteriores.
  const lookbackStart = addDaysYmd(todayYmd, -120);

  const cfgMap = await loadWhatsAppConfigsByTenant(sb);
  const tenantIds = await listMensalidadeTenantIds(sb, cfgMap);
  for (const tenantId of tenantIds) {
    const cfg = cfgMap.get(tenantId) || {};
    if (MENSALIDADE_SKIP_TENANT_IDS.has(tenantId) || !isMensalidadeNotifEnabled(cfg.metadata)) {
      skipped++;
      continue;
    }

    try {
      const ctx = await resolveCronTerreiroContext(sb, tenantId);

      let dia = 10;
      let valor = 0;
      const { data: pix } = await sb
        .from("configuracoes_pix")
        .select("valor_mensalidade, dia_vencimento")
        .or(`terreiro_id.eq.${tenantId}`)
        .maybeSingle();
      if (pix) {
        dia = parseInt(String((pix as { dia_vencimento?: unknown }).dia_vencimento), 10) || 10;
        valor = Number((pix as { valor_mensalidade?: unknown }).valor_mensalidade) || 0;
      }

      const dueDay = clampDayNumber(y, m0, dia);
      const dueYmd = `${y}-${String(m0 + 1).padStart(2, "0")}-${String(dueDay).padStart(2, "0")}`;
      const monthStart = `${y}-${String(m0 + 1).padStart(2, "0")}-01`;
      const lastDay = new Date(y, m0 + 1, 0).getDate();
      const monthEnd = `${y}-${String(m0 + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
      const calendarKind = resolveMensalidadeCronKind({
        todayYmd,
        monthStart,
        monthEnd,
        dueYmd,
        tenantId,
      });

      const vencStr = format(parseISO(dueYmd), "dd/MM/yyyy");
      const valorFmt = formatBrl(valor);

      const { data: children } = await sb
        .from("filhos_de_santo")
        .select("id, nome, whatsapp_phone, status, tenant_id, lider_id")
        .or(`tenant_id.eq.${ctx.idTerreiro},lider_id.eq.${ctx.leaderId}`);

      const { data: pendingRows } = await sb
        .from("financeiro")
        .select("id, status, descricao, data, tenant_id, lider_id, filho_id, valor")
        .eq("categoria", "Mensalidade")
        .or(`tenant_id.eq.${tenantId},lider_id.eq.${ctx.leaderId}`)
        .gte("data", lookbackStart)
        .lte("data", monthEnd);

      const unpaid = (pendingRows || []).filter((row) => rowIsUnpaidMensalidade(row));
      if (unpaid.length === 0) {
        skipped++;
        continue;
      }

      for (const child of children || []) {
        const st = String(child.status || "Ativo").trim().toLowerCase();
        if (st === "inativo" || st === "desligado" || st === "falecido") continue;
        const phone = child.whatsapp_phone;
        if (!phone) continue;

        await assertFilhoBelongsToTerreiro(sb, ctx.leaderId, child);

        const fid = String(child.id);
        const childRows = unpaid.filter((row) => rowMatchesFilho(row, fid));
        if (childRows.length === 0) continue;

        const hasCurrentPending = childRows.some((row) => {
          const d = String(row.data || "").slice(0, 10);
          return d >= monthStart && d <= monthEnd;
        });
        const hasOverdue = childRows.some((row) => {
          const d = String(row.data || "").slice(0, 10);
          return Boolean(d) && d < todayYmd;
        });

        let kind = calendarKind;
        // Atrasadas começam a disparar imediatamente (não esperam o próximo dia sorteado).
        if (!kind && hasOverdue) kind = "atrasada";
        if (kind === "disponivel" && !hasCurrentPending && hasOverdue) kind = "atrasada";
        if (!kind) continue;
        if ((kind === "disponivel" || kind === "vence_hoje") && !hasCurrentPending) continue;
        if (kind === "atrasada" && !hasOverdue && !(todayYmd > dueYmd && hasCurrentPending)) continue;
        if (kind === "pendente" && !hasCurrentPending && !hasOverdue) continue;

        const tipo =
          kind === "disponivel"
            ? "mensalidade_disponivel"
            : kind === "vence_hoje"
              ? "mensalidade_vence_hoje"
              : "mensalidade_pendente";
        const mesAnoParam =
          kind === "disponivel" || kind === "vence_hoje"
            ? mesExtenso
            : kind === "atrasada"
              ? `${mesAno} (atrasada · venc. ${vencStr})`
              : `${mesAno} (venc. ${vencStr})`;

        const overdueValor = Number(
          childRows.find((row) => String(row.data || "").slice(0, 10) < todayYmd)?.valor ??
            childRows[0]?.valor ??
            valor
        );
        const valorEnvio = formatBrl(overdueValor > 0 ? overdueValor : valor);

        const dedupeKey =
          kind === "pendente" || kind === "atrasada"
            ? `${kind}-${fid}-${todayYmd}`
            : `${kind}-${fid}-${format(parseISO(dueYmd), "yyyy-MM")}`;
        if (await whatsappLogExistsToday(sb, tenantId, tipo, dedupeKey, todayYmd)) {
          skipped++;
          continue;
        }

        const nomeMembro = String(child.nome || "Filho");
        const variables = {
          nome_filho: nomeMembro,
          nome_terreiro: ctx.nomeTerreiro,
          valor_mensalidade: valorEnvio,
          valor: valorEnvio,
          data_vencimento: vencStr,
          mes_ano: mesAnoParam,
          competencia: mesAno,
        };
        const message =
          buildWhatsAppMessage(cfg.templates, tipo, variables) + `\n\n[${dedupeKey}]`;

        let digits = String(phone).replace(/\D/g, "");
        if (!digits.startsWith("55")) digits = `55${digits}`;

        await logAndSendWhatsApp(sb, {
          tenantId,
          filhoId: fid,
          tipo,
          phone: digits,
          message,
          nomeMembro,
          nomeTerreiro: ctx.nomeTerreiro,
          idTerreiro: ctx.idTerreiro,
          variables,
        });
        sent++;
      }
    } catch (err) {
      errors++;
      console.error(`[CRON WA] mensalidade tenant=${tenantId}:`, err);
    }
  }

  console.log(`[CRON WA] mensalidade sent=${sent} skipped=${skipped} errors=${errors} today=${todayYmd}`);
  return { sent, skipped, errors };
}


async function runEstoqueAlerts(sb: SupabaseClient): Promise<{ sent: number; skipped: number; errors: number }> {
  // HARD OFF — nao reativar sem aprovacao explicita.
  void sb;
  if (String(process.env.WA_DISABLE_ESTOQUE_ALERTS || "1").trim() === "1") {
    return { sent: 0, skipped: 0, errors: 0 };
  }
  return { sent: 0, skipped: 0, errors: 0 };
}

export async function dispatchTransmissaoAviso(
  sb: SupabaseClient,
  tenantId: string,
  titulo: string,
  conteudo: string,
  nomeTerreiro: string
): Promise<{ sent: number; errors: number; skipped: number; status: "sent" | "skipped" | "offline" }> {
  let sent = 0;
  let errors = 0;
  let skipped = 0;

  try {
    if (!(await isOfficialChannelReady())) {
      return { sent: 0, errors: 0, skipped: 0, status: "offline" };
    }

    await assertFanoutCooldown(sb, tenantId, "transmissao_aviso");

    const ctx = await resolveCronTerreiroContext(sb, tenantId);
    const terreiroNome = nomeTerreiro || ctx.nomeTerreiro;
    const tituloSafe = String(titulo || "").trim();
    const conteudoSafe = String(conteudo || "").trim();
    const excerpt =
      conteudoSafe.length > 400 ? `${conteudoSafe.slice(0, 400).trim()}…` : conteudoSafe;
    const comunicado = [`*${tituloSafe}*`, excerpt].filter(Boolean).join("\n\n");

    const { data: children } = await sb
      .from("filhos_de_santo")
      .select("id, nome, whatsapp_phone, status, tenant_id, lider_id")
      .or(`tenant_id.eq.${ctx.idTerreiro},lider_id.eq.${ctx.leaderId}`);

    const eligible = (children || []).filter((child) => {
      const st = String(child.status || "Ativo").trim().toLowerCase();
      if (st === "inativo" || st === "desligado" || st === "falecido") return false;
      return Boolean(child.whatsapp_phone);
    });

    const batch = capAndShuffleRecipients(eligible, FANOUT_MAX_RECIPIENTS);
    skipped = Math.max(0, eligible.length - batch.length);

    for (let batchIndex = 0; batchIndex < batch.length; batchIndex++) {
      const child = batch[batchIndex];
      try {
        await assertFilhoBelongsToTerreiro(sb, ctx.leaderId, child);

        let digits = String(child.whatsapp_phone).replace(/\D/g, "");
        if (!digits.startsWith("55")) digits = `55${digits}`;

        const nomeMembro = String(child.nome || "Filho");
        await logAndSendWhatsApp(sb, {
          tenantId,
          filhoId: child.id,
          tipo: "transmissao_aviso",
          phone: digits,
          message: comunicado,
          nomeMembro,
          nomeTerreiro: terreiroNome,
          idTerreiro: ctx.idTerreiro,
          zelador: ctx.zelador,
          variables: {
            nome_filho: nomeMembro,
            nome_terreiro: terreiroNome,
            titulo_aviso: tituloSafe,
            conteudo_aviso: excerpt,
            comunicado,
            zelador: ctx.zelador || "",
            nome_zelador: ctx.zelador || "",
          },
        });
        sent++;
      } catch (err) {
        errors++;
        console.error(`[TRANSMISSAO AVISO] filho=${child.id}:`, err);
        const code = (err as { code?: string })?.code || "";
        if (code.startsWith("WA_QUOTA") || code.startsWith("WA_CAMPAIGN") || code.startsWith("WA_SEND_WINDOW")) {
          break;
        }
      }
    }
  } catch (err) {
    console.error("[TRANSMISSAO AVISO] dispatch:", err);
    errors++;
  }

  const status: "sent" | "skipped" | "offline" =
    sent > 0 ? "sent" : errors > 0 ? "skipped" : "skipped";
  return { sent, errors, skipped, status };
}

/** @deprecated Use dispatchTransmissaoAviso */
export async function dispatchMuralWhatsApp(
  sb: SupabaseClient,
  tenantId: string,
  titulo: string,
  nomeTerreiro: string
): Promise<{ sent: number; errors: number; skipped: number }> {
  const out = await dispatchTransmissaoAviso(sb, tenantId, titulo, titulo, nomeTerreiro);
  return { sent: out.sent, errors: out.errors, skipped: out.skipped };
}

function formatEventDateBr(isoDate: string): string {
  const raw = String(isoDate || "").trim();
  if (!raw) return "";
  try {
    return format(parseISO(raw.length > 10 ? raw : `${raw}T12:00:00`), "dd/MM/yyyy");
  } catch {
    return raw;
  }
}

/** Aviso de nova gira/evento para filhos da corrente (template aviso_gira_axecloud). */
export type GiraWhatsAppDispatchResult = {
  sent: number;
  errors: number;
  eligible: number;
  status: "sent" | "partial" | "no_recipients" | "channel_offline" | "disabled" | "failed";
  externalIds?: string[];
};

export type DispatchGiraWhatsAppOptions = {
  /** Incluído na mensagem para dedupe diário via whatsapp_logs (cron de lembretes). */
  messageSuffix?: string;
  /** Cron de lembretes: vários eventos no mesmo tenant no mesmo dia. */
  bypassFanoutCooldown?: boolean;
  /** Envia resumo atrasado ao zelador após o fan-out (criação manual / reenvio). */
  notifyZeladorSummary?: boolean;
};

export async function dispatchGiraWhatsApp(
  sb: SupabaseClient,
  tenantId: string,
  event: {
    id?: string;
    titulo: string;
    data: string;
    hora: string;
    banner_url?: string | null;
  },
  options?: DispatchGiraWhatsAppOptions
): Promise<GiraWhatsAppDispatchResult> {
  let sent = 0;
  let errors = 0;
  let eligible = 0;
  const externalIds: string[] = [];
  let ctx: Awaited<ReturnType<typeof resolveCronTerreiroContext>> | null = null;
  let dataEvento = "";
  let horaEvento = "";
  try {
    if (!(await isOfficialChannelReady())) {
      return { sent: 0, errors: 0, eligible: 0, status: "channel_offline", externalIds };
    }

    if (!options?.bypassFanoutCooldown) {
      await assertFanoutCooldown(sb, tenantId, "aviso_gira");
    }

    const { data: cfg } = await sb
      .from("whatsapp_config")
      .select("metadata")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    const meta = (cfg?.metadata && typeof cfg.metadata === "object" ? cfg.metadata : {}) as Record<
      string,
      unknown
    >;
    const prefs = (meta.preferences && typeof meta.preferences === "object"
      ? meta.preferences
      : {}) as Record<string, boolean>;
    if (prefs.notifGiras === false) {
      return { sent: 0, errors: 0, eligible: 0, status: "disabled", externalIds };
    }

    ctx = await resolveCronTerreiroContext(sb, tenantId);
    dataEvento = formatEventDateBr(event.data);
    horaEvento = String(event.hora || "").trim();

    let baseVariables: Record<string, string | number> = {
      event_id: event.id || "",
      nome_evento: event.titulo,
      data_evento: dataEvento,
      hora_evento: horaEvento,
      nome_terreiro: ctx.nomeTerreiro,
    };
    const bannerUrl = String(event.banner_url || "").trim();
    if (bannerUrl) baseVariables.banner_url = bannerUrl;
    if (event.id) {
      baseVariables = await enrichEventCalendarVariables(sb, ctx.leaderId, baseVariables);
    }

    const { data: children } = await sb
      .from("filhos_de_santo")
      .select("id, nome, whatsapp_phone, status, tenant_id, lider_id")
      .or(`tenant_id.eq.${ctx.idTerreiro},lider_id.eq.${ctx.leaderId}`);

    const eligibleChildren = (children || []).filter((child) => {
      const st = String(child.status || "Ativo").trim().toLowerCase();
      if (st === "inativo" || st === "desligado" || st === "falecido") return false;
      return Boolean(child.whatsapp_phone);
    });

    const batch = capAndShuffleRecipients(eligibleChildren, FANOUT_MAX_RECIPIENTS);
    eligible = batch.length;

    for (let batchIndex = 0; batchIndex < batch.length; batchIndex++) {
      const child = batch[batchIndex];

      try {
        await assertFilhoBelongsToTerreiro(sb, ctx.leaderId, child);

        let digits: string;
        try {
          digits = normalizeBrWhatsAppMsisdn(String(child.whatsapp_phone || ""));
        } catch (phoneErr) {
          throw new Error(
            phoneErr instanceof Error
              ? phoneErr.message
              : "Telefone WhatsApp inválido no cadastro do filho"
          );
        }

        const nomeMembro = String(child.nome || "Filho");
        const suffix = String(options?.messageSuffix || "").trim();
        const baseMsg = `Gira: ${event.titulo} — ${dataEvento} ${horaEvento}`;
        const out = await logAndSendWhatsApp(sb, {
          tenantId,
          filhoId: String(child.id),
          tipo: "aviso_gira",
          phone: digits,
          message: suffix ? `${baseMsg} [${suffix}]` : baseMsg,
          nomeMembro,
          nomeTerreiro: ctx.nomeTerreiro,
          idTerreiro: ctx.idTerreiro,
          variables: { ...baseVariables },
        });
        if (out.externalId) externalIds.push(out.externalId);
        sent++;
      } catch (err) {
        errors++;
        console.error(`[GIRA WA] filho=${child.id}:`, err);
        const code = (err as { code?: string })?.code || "";
        if (code.startsWith("WA_QUOTA") || code.startsWith("WA_CAMPAIGN") || code.startsWith("WA_SEND_WINDOW")) {
          break;
        }
      }
    }
  } catch (err) {
    console.error("[GIRA WA] dispatch:", err);
    errors++;
  }

  let status: GiraWhatsAppDispatchResult["status"];
  if (errors > 0 && sent === 0) status = "failed";
  else if (errors > 0) status = "partial";
  else if (sent > 0) status = "sent";
  else if (eligible === 0) status = "no_recipients";
  else status = "no_recipients";

  if (sent === 0 && errors === 0) {
    console.warn(
      `[GIRA WA] tenant=${tenantId} evento="${event.titulo}" — nenhum envio (${status}, eligible=${eligible})`
    );
  } else {
    console.log(
      `[GIRA WA] tenant=${tenantId} evento="${event.titulo}" sent=${sent} errors=${errors} eligible=${eligible}`
    );
  }

  if (options?.notifyZeladorSummary && ctx) {
    const eventoRotulo = `${String(event.titulo || "Gira/Evento").trim()} — ${dataEvento} ${horaEvento}`
      .replace(/\s+/g, " ")
      .trim();
    void import("./giraDispatchSummaryWhatsApp.js")
      .then(({ scheduleGiraDispatchSummary }) =>
        scheduleGiraDispatchSummary(sb, {
          tenantId,
          leaderId: ctx!.leaderId,
          zeladorNome: ctx!.zelador,
          eventoRotulo,
          externalIds,
          apiErrors: errors,
          eligible,
          dispatchStatus: status,
        })
      )
      .catch((err: unknown) => {
        console.error(
          "[GIRA WA] agendar resumo zelador:",
          err instanceof Error ? err.message : err
        );
      });
  }

  return { sent, errors, eligible, status, externalIds };
}

async function runGiraReminders(
  sb: SupabaseClient
): Promise<{ sent: number; skipped: number; errors: number; events: number }> {
  let sent = 0;
  let skipped = 0;
  let errors = 0;
  let eventsProcessed = 0;

  if (!(await isOfficialChannelReady())) {
    return { sent: 0, skipped: 0, errors: 0, events: 0 };
  }

  const today = startOfDay(new Date());
  const todayStr = format(today, "yyyy-MM-dd");

  const { data: rows, error } = await sb
    .from("calendario_axe")
    .select(
      "id, titulo, data, hora, banner_url, tenant_id, lider_id, wa_reminder_interval_days, created_at"
    )
    .gte("data", todayStr)
    .not("wa_reminder_interval_days", "is", null)
    .order("data", { ascending: true })
    .limit(200);

  if (error) {
    console.error("[GIRA REMINDER] query:", error.message);
    return { sent: 0, skipped: 0, errors: 1, events: 0 };
  }

  for (const row of rows || []) {
    const interval = Math.floor(Number(row.wa_reminder_interval_days));
    if (!Number.isFinite(interval) || interval < 1 || interval > 7) {
      skipped++;
      continue;
    }

    const dataRaw = String(row.data || "").trim();
    if (!dataRaw) {
      skipped++;
      continue;
    }

    let eventDay: Date;
    try {
      eventDay = startOfDay(parseISO(dataRaw.length > 10 ? dataRaw : `${dataRaw}T12:00:00`));
    } catch {
      skipped++;
      continue;
    }

    const daysUntil = differenceInCalendarDays(eventDay, today);
    if (daysUntil < 0) {
      skipped++;
      continue;
    }
    if (daysUntil !== 0 && daysUntil % interval !== 0) {
      skipped++;
      continue;
    }

    const createdRaw = String(row.created_at || "").trim();
    if (createdRaw) {
      try {
        const createdDay = format(
          parseISO(createdRaw.length > 10 ? createdRaw : `${createdRaw}T12:00:00`),
          "yyyy-MM-dd"
        );
        if (createdDay === todayStr) {
          skipped++;
          continue;
        }
      } catch {
        /* ignore parse — still allow reminder */
      }
    }

    const tenantId = String(row.tenant_id || row.lider_id || "").trim();
    const eventId = String(row.id || "").trim();
    if (!tenantId || !eventId) {
      skipped++;
      continue;
    }

    const dedupeKey = `gira-lembrete-${eventId}-${todayStr}`;
    if (await whatsappLogExistsToday(sb, tenantId, "aviso_gira", dedupeKey)) {
      skipped++;
      continue;
    }

    eventsProcessed++;
    try {
      const result = await dispatchGiraWhatsApp(
        sb,
        tenantId,
        {
          id: eventId,
          titulo: String(row.titulo || "Gira"),
          data: dataRaw.slice(0, 10),
          hora: String(row.hora || ""),
          banner_url: row.banner_url ?? null,
        },
        { messageSuffix: dedupeKey, bypassFanoutCooldown: true }
      );
      sent += result.sent;
      errors += result.errors;
      if (result.sent === 0 && result.status !== "disabled") {
        skipped++;
      }
    } catch (err) {
      errors++;
      console.error(`[GIRA REMINDER] event=${eventId}:`, err);
    }
  }

  console.log(
    `[GIRA REMINDER] events=${eventsProcessed} sent=${sent} skipped=${skipped} errors=${errors}`
  );
  return { sent, skipped, errors, events: eventsProcessed };
}

export async function runWhatsAppCronJobs(sb: SupabaseClient) {
  const mensalidade = await runMensalidadeReminders(sb);
  // Estoque crítico desligado (WA_DISABLE_ESTOQUE_ALERTS=1 por padrão).
  const estoque = { sent: 0, skipped: 0, errors: 0 };
  void runEstoqueAlerts;
  const gira = await runGiraReminders(sb);
  return { mensalidade, estoque, gira };
}
