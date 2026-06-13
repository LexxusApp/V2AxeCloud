import type { SupabaseClient } from "@supabase/supabase-js";
import { differenceInCalendarDays, format, startOfDay } from "date-fns";
import { getOfficialWhatsAppStatus } from "../../src/services/evolution.service.js";
import {
  buildWhatsAppMessage,
  logAndSendWhatsApp,
  resolveTerreiroWhatsAppContext,
  assertFilhoBelongsToTerreiro,
} from "./whatsappSendCore.js";
const REMINDER_DAYS_BEFORE = 3;

function clampDayInMonth(year: number, month0: number, day: number): Date {
  const last = new Date(year, month0 + 1, 0).getDate();
  return new Date(year, month0, Math.min(Math.max(day, 1), last));
}

async function whatsappLogExistsToday(
  sb: SupabaseClient,
  tenantId: string,
  tipo: string,
  dedupeKey: string
): Promise<boolean> {
  const today = format(new Date(), "yyyy-MM-dd");
  const { count } = await sb
    .from("whatsapp_logs")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("tipo", tipo)
    .ilike("mensagem", `%${dedupeKey}%`)
    .gte("created_at", `${today}T00:00:00`);
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
    return { sent: 0, skipped: 0, errors: 0 };
  }

  const today = startOfDay(new Date());
  const y = today.getFullYear();
  const m0 = today.getMonth();

  const { data: configs } = await sb.from("whatsapp_config").select("tenant_id, templates");
  for (const cfg of configs || []) {
    const tenantId = String(cfg.tenant_id || "");
    if (!tenantId) continue;

    try {
      const ctx = await resolveTerreiroWhatsAppContext(sb, tenantId, tenantId);

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

      const dueDate = startOfDay(clampDayInMonth(y, m0, dia));
      const daysUntilDue = differenceInCalendarDays(dueDate, today);
      if (daysUntilDue !== REMINDER_DAYS_BEFORE && daysUntilDue !== 0) {
        skipped++;
        continue;
      }

      const monthStart = `${y}-${String(m0 + 1).padStart(2, "0")}-01`;
      const lastDay = new Date(y, m0 + 1, 0).getDate();
      const monthEnd = `${y}-${String(m0 + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

      const { data: children } = await sb
        .from("filhos_de_santo")
        .select("id, nome, whatsapp_phone, status, tenant_id, lider_id")
        .or(`tenant_id.eq.${ctx.idTerreiro},lider_id.eq.${ctx.leaderId}`);

      for (const child of children || []) {
        const st = String(child.status || "Ativo").trim().toLowerCase();
        if (st === "inativo" || st === "desligado" || st === "falecido") continue;
        const phone = child.whatsapp_phone;
        if (!phone) continue;

        await assertFilhoBelongsToTerreiro(sb, ctx.leaderId, child);

        const fid = String(child.id);
        const { data: pendingRows } = await sb
          .from("financeiro")
          .select("id, status, descricao, data, data_vencimento")
          .eq("categoria", "Mensalidade")
          .gte("data", monthStart)
          .lte("data", monthEnd);

        const hasPending = (pendingRows || []).some((row: { descricao?: string; status?: string }) => {
          const desc = String(row.descricao || "");
          if (!desc.includes(`ID:${fid}`)) return false;
          const stRow = String(row.status || "").toLowerCase();
          if (stRow === "pago" || stRow === "paid") return false;
          return desc.toLowerCase().includes("vencimento") || stRow === "pendente" || stRow === "pending";
        });
        if (!hasPending) continue;

        const dedupeKey = `lembrete-${fid}-${format(dueDate, "yyyy-MM")}`;
        if (await whatsappLogExistsToday(sb, tenantId, "financeiro", dedupeKey)) {
          skipped++;
          continue;
        }

        const vencStr = format(dueDate, "dd/MM/yyyy");
        const nomeMembro = String(child.nome || "Filho");
        const message =
          buildWhatsAppMessage(cfg.templates, "financeiro", {
            nome_filho: nomeMembro,
            valor_mensalidade: valor > 0 ? valor.toFixed(2) : "—",
            data_vencimento: vencStr,
            nome_terreiro: ctx.nomeTerreiro,
          }) + `\n\n[${dedupeKey}]`;

        let digits = String(phone).replace(/\D/g, "");
        if (!digits.startsWith("55")) digits = `55${digits}`;

        await logAndSendWhatsApp(sb, {
          tenantId,
          filhoId: fid,
          tipo: "financeiro",
          phone: digits,
          message,
          nomeMembro,
          nomeTerreiro: ctx.nomeTerreiro,
          idTerreiro: ctx.idTerreiro,
          variables: {
            nome_filho: nomeMembro,
            nome_terreiro: ctx.nomeTerreiro,
          },
        });
        sent++;
      }
    } catch (err) {
      errors++;
      console.error(`[CRON WA] mensalidade tenant=${tenantId}:`, err);
    }
  }

  return { sent, skipped, errors };
}

async function runEstoqueAlerts(sb: SupabaseClient): Promise<{ sent: number; skipped: number; errors: number }> {
  let sent = 0;
  let skipped = 0;
  let errors = 0;

  if (!(await isOfficialChannelReady())) {
    return { sent: 0, skipped: 0, errors: 0 };
  }

  const { data: allItems } = await sb
    .from("almoxarifado")
    .select("id, item, quantidade_atual, quantidade_minima, tenant_id");

  const lowItems = (allItems || []).filter(
    (row) => Number(row.quantidade_atual) <= Number(row.quantidade_minima)
  );

  const byTenant = new Map<string, typeof lowItems>();
  for (const row of lowItems) {
    const tid = String(row.tenant_id || "");
    if (!tid) continue;
    const list = byTenant.get(tid) || [];
    list.push(row);
    byTenant.set(tid, list);
  }

  for (const [tenantId, items] of byTenant) {
    try {
      const ctx = await resolveTerreiroWhatsAppContext(sb, tenantId, tenantId);

      const { data: authData } = await sb.auth.admin.getUserById(tenantId);
      const meta = authData?.user?.user_metadata as { whatsapp?: string } | undefined;
      const { data: waCfg } = await sb
        .from("whatsapp_config")
        .select("phone_number, templates")
        .eq("tenant_id", tenantId)
        .maybeSingle();
      const alertPhone = String(waCfg?.phone_number || meta?.whatsapp || "").trim();
      if (!alertPhone) {
        skipped += items.length;
        continue;
      }

      let digits = String(alertPhone).replace(/\D/g, "");
      if (!digits.startsWith("55")) digits = `55${digits}`;

      for (const item of items) {
        const dedupeKey = `estoque-${item.id}`;
        if (await whatsappLogExistsToday(sb, tenantId, "estoque_critico", dedupeKey)) {
          skipped++;
          continue;
        }
        const message =
          buildWhatsAppMessage(waCfg?.templates, "estoque_critico", {
            item_nome: item.item,
            quantidade: String(item.quantidade_atual),
            nome_terreiro: ctx.nomeTerreiro,
          }) + `\n\n[${dedupeKey}]`;

        await logAndSendWhatsApp(sb, {
          tenantId,
          tipo: "estoque_critico",
          phone: digits,
          message,
          nomeMembro: ctx.nomeTerreiro,
          nomeTerreiro: ctx.nomeTerreiro,
          idTerreiro: ctx.idTerreiro,
          variables: { nome_terreiro: ctx.nomeTerreiro },
        });
        sent++;
      }
    } catch (err) {
      errors++;
      console.error(`[CRON WA] estoque tenant=${tenantId}:`, err);
    }
  }

  return { sent, skipped, errors };
}

export async function dispatchMuralWhatsApp(
  sb: SupabaseClient,
  tenantId: string,
  titulo: string,
  nomeTerreiro: string
): Promise<{ sent: number; errors: number }> {
  let sent = 0;
  let errors = 0;

  try {
    if (!(await isOfficialChannelReady())) return { sent: 0, errors: 0 };

    const ctx = await resolveTerreiroWhatsAppContext(sb, tenantId, tenantId);
    const terreiroNome = nomeTerreiro || ctx.nomeTerreiro;

    const { data: cfg } = await sb
      .from("whatsapp_config")
      .select("templates")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    const { data: children } = await sb
      .from("filhos_de_santo")
      .select("id, nome, whatsapp_phone, status, tenant_id, lider_id")
      .or(`tenant_id.eq.${ctx.idTerreiro},lider_id.eq.${ctx.leaderId}`);

    for (const child of children || []) {
      const st = String(child.status || "Ativo").trim().toLowerCase();
      if (st === "inativo" || st === "desligado" || st === "falecido") continue;
      if (!child.whatsapp_phone) continue;

      try {
        await assertFilhoBelongsToTerreiro(sb, ctx.leaderId, child);

        let digits = String(child.whatsapp_phone).replace(/\D/g, "");
        if (!digits.startsWith("55")) digits = `55${digits}`;

        const nomeMembro = String(child.nome || "Filho");
        const message = buildWhatsAppMessage(cfg?.templates, "mural_aviso", {
          nome_filho: nomeMembro,
          nome_terreiro: terreiroNome,
          titulo_aviso: titulo,
        });

        await logAndSendWhatsApp(sb, {
          tenantId,
          filhoId: child.id,
          tipo: "mural_aviso",
          phone: digits,
          message,
          nomeMembro,
          nomeTerreiro: terreiroNome,
          idTerreiro: ctx.idTerreiro,
          variables: { nome_filho: nomeMembro, nome_terreiro: terreiroNome },
        });
        sent++;
      } catch (err) {
        errors++;
        console.error(`[MURAL WA] filho=${child.id}:`, err);
      }
    }
  } catch (err) {
    console.error("[MURAL WA] dispatch:", err);
    errors++;
  }

  return { sent, errors };
}

export async function runWhatsAppCronJobs(sb: SupabaseClient) {
  const mensalidade = await runMensalidadeReminders(sb);
  const estoque = await runEstoqueAlerts(sb);
  return { mensalidade, estoque };
}
