/**
 * Processador de respostas de presença em Gira via WhatsApp.
 * Quando o filho de santo clica no botão "Confirmar presença" ou "Não poderei ir"
 * (ou responde texto equivalente), atualiza automaticamente:
 *   1. evento_participantes (presença da gira)
 *   2. frequência / assiduidade do filho de santo no AxéCloud
 * E envia uma confirmação imediata de recebimento no WhatsApp.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";
import { isMetaCloudDirectConfigured, sendMetaCloudText } from "./metaCloudSend.js";
import { normalizeInboxPhone } from "./adminWhatsAppInbox.js";

export type GiraAttendanceAction = "confirmado" | "recusado";

export function detectGiraAttendanceAction(
  body: string,
  messageType?: string
): GiraAttendanceAction | null {
  const text = String(body || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, ""); // remove acentos

  // Confirmação
  if (
    text.includes("confirmar presenca") ||
    text === "confirmar" ||
    text === "confirmado" ||
    text === "confirmada" ||
    text.includes("presenca confirmada") ||
    text === "vou sim" ||
    text === "sim, vou" ||
    text === "estarei presente" ||
    text === "vou"
  ) {
    return "confirmado";
  }

  // Recusa / Ausência
  if (
    text.includes("nao poderei ir") ||
    text.includes("nao vou poder") ||
    text === "nao vou" ||
    text === "nao poderei" ||
    text === "recusar" ||
    text === "recusado" ||
    text === "ausente" ||
    text.includes("nao poderei comparecer") ||
    text.includes("nao posso ir")
  ) {
    return "recusado";
  }

  return null;
}

export type GiraAttendanceResolution = {
  filhoId: string;
  tenantId: string;
  eventId: string;
  nomeMembro?: string;
  tituloEvento?: string;
  dataEvento?: string;
  horaEvento?: string;
};

/**
 * Localiza o membro (filho de santo), o terreiro (tenant) e o evento (gira)
 * a partir do telefone e/ou contexto da mensagem original.
 */
export async function resolveGiraAttendanceTarget(
  sb: SupabaseClient,
  phoneE164: string,
  contextMessageId?: string | null
): Promise<GiraAttendanceResolution | null> {
  const normalizedPhone = normalizeInboxPhone(phoneE164);
  const rawDigits = normalizedPhone.replace(/\D/g, "");
  const localDigits = rawDigits.startsWith("55") ? rawDigits.slice(2) : rawDigits;

  let tenantId: string | null = null;
  let filhoId: string | null = null;
  let eventId: string | null = null;
  let nomeMembro: string | null = null;

  // 1. Tentar contexto direto via external_id (wamid) em whatsapp_logs
  if (contextMessageId) {
    const { data: logMsg } = await sb
      .from("whatsapp_logs")
      .select("tenant_id, filho_id, mensagem, tipo, created_at")
      .eq("external_id", contextMessageId)
      .maybeSingle();

    if (logMsg) {
      if (logMsg.tenant_id) tenantId = String(logMsg.tenant_id);
      if (logMsg.filho_id) filhoId = String(logMsg.filho_id);
      const match = String(logMsg.mensagem || "").match(/\[event_id:([^\]\s]+)\]/i);
      if (match?.[1]) {
        eventId = match[1];
      }
    }
  }

  // 2. Se eventId ou filhoId não foram achados, buscar últimos logs de aviso_gira deste telefone
  if (!eventId || !filhoId) {
    const { data: recentLogs } = await sb
      .from("whatsapp_logs")
      .select("tenant_id, filho_id, mensagem, tipo, created_at")
      .eq("tipo", "aviso_gira")
      .or(`telefone.eq.${normalizedPhone},telefone.eq.${rawDigits},telefone.eq.${localDigits}`)
      .order("created_at", { ascending: false })
      .limit(5);

    if (recentLogs && recentLogs.length > 0) {
      for (const r of recentLogs) {
        if (!tenantId && r.tenant_id) tenantId = String(r.tenant_id);
        if (!filhoId && r.filho_id) filhoId = String(r.filho_id);
        if (!eventId) {
          const match = String(r.mensagem || "").match(/\[event_id:([^\]\s]+)\]/i);
          if (match?.[1]) {
            eventId = match[1];
            break;
          }
        }
      }
    }
  }

  // 3. Se filhoId ainda faltar, resolver pelo cadastro de filhos_de_santo
  if (!filhoId) {
    const { data: filhos } = await sb
      .from("filhos_de_santo")
      .select("id, nome, tenant_id, lider_id, whatsapp_phone")
      .neq("status", "Inativo")
      .limit(600);

    const matchedFilho = (filhos || []).find((f) => {
      const p = String(f.whatsapp_phone || "").replace(/\D/g, "");
      return (
        p === rawDigits ||
        p === localDigits ||
        `55${p}` === rawDigits ||
        (localDigits.length >= 8 && p.endsWith(localDigits.slice(-8)))
      );
    });

    if (matchedFilho) {
      filhoId = String(matchedFilho.id);
      nomeMembro = String(matchedFilho.nome || "");
      if (!tenantId) {
        tenantId = String(matchedFilho.tenant_id || matchedFilho.lider_id || "");
      }
    }
  } else if (!nomeMembro) {
    const { data: f } = await sb
      .from("filhos_de_santo")
      .select("nome, tenant_id, lider_id")
      .eq("id", filhoId)
      .maybeSingle();
    if (f) {
      nomeMembro = String(f.nome || "");
      if (!tenantId) tenantId = String(f.tenant_id || f.lider_id || "");
    }
  }

  if (!tenantId || !filhoId) {
    return null;
  }

  // 4. Se eventId ainda faltar, buscar a próxima gira futura em calendario_axe
  let tituloEvento = "Gira";
  let dataEvento = "";
  let horaEvento = "";

  if (eventId) {
    const { data: ev } = await sb
      .from("calendario_axe")
      .select("id, titulo, data, hora")
      .eq("id", eventId)
      .maybeSingle();
    if (ev) {
      tituloEvento = String(ev.titulo || "Gira");
      dataEvento = String(ev.data || "");
      horaEvento = String(ev.hora || "");
    }
  } else {
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
    const { data: upcomingEvents } = await sb
      .from("calendario_axe")
      .select("id, titulo, data, hora")
      .or(`tenant_id.eq.${tenantId},lider_id.eq.${tenantId}`)
      .gte("data", today)
      .order("data", { ascending: true })
      .limit(1);

    if (upcomingEvents && upcomingEvents.length > 0) {
      const ev = upcomingEvents[0];
      eventId = String(ev.id);
      tituloEvento = String(ev.titulo || "Gira");
      dataEvento = String(ev.data || "");
      horaEvento = String(ev.hora || "");
    } else {
      const { data: recentEvents } = await sb
        .from("calendario_axe")
        .select("id, titulo, data, hora")
        .or(`tenant_id.eq.${tenantId},lider_id.eq.${tenantId}`)
        .order("data", { ascending: false })
        .limit(1);
      if (recentEvents && recentEvents.length > 0) {
        const ev = recentEvents[0];
        eventId = String(ev.id);
        tituloEvento = String(ev.titulo || "Gira");
        dataEvento = String(ev.data || "");
        horaEvento = String(ev.hora || "");
      }
    }
  }

  if (!eventId) {
    return null;
  }

  return {
    filhoId,
    tenantId,
    eventId,
    nomeMembro: nomeMembro || undefined,
    tituloEvento,
    dataEvento,
    horaEvento,
  };
}

/**
 * Atualiza evento_participantes:
 * - status: 'confirmado' ou 'recusado'
 * - responded_at: carimbo de data/hora atual
 * - justificativa: preenchida caso ausente
 */
export async function applyGiraAttendanceResponse(
  sb: SupabaseClient,
  target: GiraAttendanceResolution,
  action: GiraAttendanceAction
): Promise<{ success: boolean; status: GiraAttendanceAction }> {
  const { eventId, filhoId, tenantId } = target;
  const nowIso = new Date().toISOString();

  const { data: existing } = await sb
    .from("evento_participantes")
    .select("id, status")
    .eq("event_id", eventId)
    .eq("filho_id", filhoId)
    .maybeSingle();

  if (existing) {
    const { error } = await sb
      .from("evento_participantes")
      .update({
        status: action,
        responded_at: nowIso,
        justificativa: action === "recusado" ? "Informou ausência via WhatsApp" : null,
      })
      .eq("id", existing.id);
    if (error) throw error;
  } else {
    const checkinToken = randomBytes(24).toString("base64url");
    const { error } = await sb
      .from("evento_participantes")
      .insert({
        event_id: eventId,
        filho_id: filhoId,
        tenant_id: tenantId,
        status: action,
        responded_at: nowIso,
        checkin_token: checkinToken,
        justificativa: action === "recusado" ? "Informou ausência via WhatsApp" : null,
      });
    if (error) throw error;
  }

  return { success: true, status: action };
}

/**
 * Envia mensagem automática no WhatsApp confirmando o registro da resposta do membro.
 */
export async function sendGiraAttendanceReply(
  phone: string,
  action: GiraAttendanceAction,
  nomeMembro?: string,
  tituloEvento?: string
): Promise<boolean> {
  if (!isMetaCloudDirectConfigured()) return false;
  try {
    const saudacao = nomeMembro ? `Olá, ${nomeMembro}!` : "Olá!";
    const eventoNome = tituloEvento || "gira";
    const text =
      action === "confirmado"
        ? `${saudacao} Sua presença na ${eventoNome} foi confirmada com sucesso! Axé! 🕊️`
        : `${saudacao} Entendido, sua ausência na ${eventoNome} foi registrada no sistema. Obrigado por avisar! Axé! 🕊️`;

    await sendMetaCloudText(phone, text);
    return true;
  } catch (err) {
    console.warn("[GIRA ATTENDANCE] falha ao enviar resposta de confirmação:", err);
    return false;
  }
}

/**
 * Handler principal chamado na recepção de mensagens do webhook Meta.
 */
export async function handleGiraAttendanceInbound(
  sb: SupabaseClient,
  inbound: {
    from: string;
    body: string;
    messageType: string;
    raw?: Record<string, unknown>;
  }
): Promise<{
  handled: boolean;
  action?: GiraAttendanceAction;
  eventId?: string;
  filhoId?: string;
  replySent?: boolean;
}> {
  const action = detectGiraAttendanceAction(inbound.body, inbound.messageType);
  if (!action) {
    return { handled: false };
  }

  const raw = inbound.raw || {};
  const contextId =
    raw.context && typeof raw.context === "object"
      ? String((raw.context as { id?: string }).id || "").trim()
      : null;

  const target = await resolveGiraAttendanceTarget(sb, inbound.from, contextId);
  if (!target) {
    console.log(
      `[GIRA ATTENDANCE] Ação ${action} detectada para telefone ${inbound.from}, mas evento/filho não resolvido.`
    );
    return { handled: false };
  }

  await applyGiraAttendanceResponse(sb, target, action);
  console.log(
    `[GIRA ATTENDANCE] Presença atualizada com sucesso: filho=${target.filhoId} evento=${target.eventId} status=${action}`
  );

  const replySent = await sendGiraAttendanceReply(
    inbound.from,
    action,
    target.nomeMembro,
    target.tituloEvento
  );

  return {
    handled: true,
    action,
    eventId: target.eventId,
    filhoId: target.filhoId,
    replySent,
  };
}
