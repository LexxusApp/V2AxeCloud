import type { SupabaseClient } from "@supabase/supabase-js";
import { format, parseISO } from "date-fns";
import {
  CONSOLE_ADMIN_INSTANCE_NAME,
  ensureOfficialWhatsAppReady,
  sendEvolutionTextByInstance,
} from "../../src/services/evolution.service.js";
import { resolveWhatsAppTemplate } from "../../src/constants/whatsappTemplates.js";
import { assertZeladorTenantAccess, resolveLeaderId } from "./tenantAccess.js";
import { resolvePublicMediaUrl } from "./r2PublicMedia.js";
import {
  buildSignedWhatsAppBody,
  buildWhatsAppAuditMessage,
  extractRsvpToken,
  isAvisoGiraTemplate,
  isBoasVindasTemplate,
  isConviteEventoTemplate,
  resolveLoginPublicUrl,
} from "./whatsappMetaCloud.js";
import { formatFilhoMatricula } from "../../lib/filhoMatricula.js";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type WhatsAppSendInput = {
  tenantId: string;
  tipo: string;
  filhoId?: string | null;
  forcePhone?: string | null;
  variables?: Record<string, string | number>;
};

export type TerreiroWhatsAppContext = {
  idTerreiro: string;
  nomeTerreiro: string;
  leaderId: string;
  zelador?: string;
};

export type MemberWhatsAppTarget = TerreiroWhatsAppContext & {
  phone: string;
  nomeMembro: string;
  filhoId: string | null;
};

function normalizeBrPhone(raw: string): string {
  let digits = String(raw).replace(/\D/g, "");
  if (!digits.startsWith("55")) digits = `55${digits}`;
  return digits;
}

function httpError(message: string, statusCode: number): Error & { statusCode: number } {
  const err = new Error(message) as Error & { statusCode: number };
  err.statusCode = statusCode;
  return err;
}

/** Resolve id e nome do terreiro a partir do tenant do zelador (isolamento por tenant_id). */
export async function resolveTerreiroWhatsAppContext(
  sb: SupabaseClient,
  actorUserId: string,
  tenantId: string
): Promise<TerreiroWhatsAppContext> {
  const ok = await assertZeladorTenantAccess(sb, actorUserId, tenantId);
  if (!ok) throw httpError("Acesso negado ao terreiro solicitado", 403);

  const leaderId = await resolveLeaderId(sb, tenantId);
  const { data: profile } = await sb
    .from("perfil_lider")
    .select("id, tenant_id, nome_terreiro, cargo")
    .eq("id", leaderId)
    .maybeSingle();

  if (!profile) throw httpError("Terreiro não encontrado", 404);

  const idTerreiro = String(profile.tenant_id || profile.id || leaderId).trim();
  const nomeTerreiro = String(profile.nome_terreiro || "Terreiro").trim();
  const zelador = String(profile.cargo || "").trim() || undefined;

  return { idTerreiro, nomeTerreiro, leaderId, zelador };
}

/** Garante que o filho pertence ao terreiro do zelador antes de qualquer envio. */
export async function assertFilhoBelongsToTerreiro(
  sb: SupabaseClient,
  leaderId: string,
  filho: { tenant_id?: string | null; lider_id?: string | null }
): Promise<void> {
  const filhoRef = String(filho.tenant_id || filho.lider_id || "").trim();
  if (!filhoRef) throw httpError("Membro sem vínculo de terreiro", 403);

  const filhoLeader = await resolveLeaderId(sb, filhoRef);
  if (filhoLeader !== leaderId) {
    throw httpError("Filho não pertence ao seu terreiro", 403);
  }
}

export async function resolveMemberWhatsAppTarget(
  sb: SupabaseClient,
  actorUserId: string,
  tenantId: string,
  filhoId: string
): Promise<MemberWhatsAppTarget> {
  const ctx = await resolveTerreiroWhatsAppContext(sb, actorUserId, tenantId);

  const { data: filho, error } = await sb
    .from("filhos_de_santo")
    .select("id, nome, whatsapp_phone, tenant_id, lider_id")
    .eq("id", filhoId)
    .maybeSingle();

  if (error) throw error;
  if (!filho) throw httpError("Membro não encontrado", 404);

  await assertFilhoBelongsToTerreiro(sb, ctx.leaderId, filho);

  const phoneRaw = String(filho.whatsapp_phone || "").trim();
  if (!phoneRaw) throw httpError("Telefone não encontrado", 400);

  return {
    ...ctx,
    filhoId: String(filho.id),
    nomeMembro: String(filho.nome || "Membro").trim(),
    phone: normalizeBrPhone(phoneRaw),
  };
}

export function buildWhatsAppMessage(
  templates: unknown,
  tipo: string,
  variables?: Record<string, string | number>
): string {
  let message = resolveWhatsAppTemplate(templates, String(tipo || ""));
  Object.entries(variables || {}).forEach(([key, value]) => {
    message = message.replace(new RegExp(`{{${key}}}`, "g"), String(value));
  });
  if (message.includes("nota sigilosa") || message.includes("segredo")) {
    message =
      "Você tem uma nova atualização sigilosa no seu prontuário. Acesse o AxéCloud para conferir.";
  }
  return message;
}

/** @deprecated Use resolveMemberWhatsAppTarget — mantido para compatibilidade interna. */
export async function resolveWhatsAppDestinationPhone(
  sb: SupabaseClient,
  userId: string,
  input: Pick<WhatsAppSendInput, "filhoId" | "forcePhone"> & { tenantId?: string }
): Promise<string | null> {
  const tenantId = String(input.tenantId || userId);
  if (input.filhoId) {
    const target = await resolveMemberWhatsAppTarget(sb, userId, tenantId, String(input.filhoId));
    return target.phone;
  }
  if (input.forcePhone) return normalizeBrPhone(String(input.forcePhone));
  return null;
}

function pickMemberNameFromVariables(
  variables: Record<string, string | number> | undefined,
  fallback: string
): string {
  const candidates = [variables?.nome_filho, variables?.nome_convidado, variables?.nome_membro];
  for (const c of candidates) {
    const s = String(c || "").trim();
    if (s) return s;
  }
  return fallback;
}

function formatEventDateBr(isoDate: string): string {
  const raw = String(isoDate || "").trim();
  if (!raw) return "";
  try {
    const normalized = raw.length > 10 ? raw : `${raw}T12:00:00`;
    return format(parseISO(normalized), "dd/MM/yyyy");
  } catch {
    return raw;
  }
}

/** Garante banner e campos do evento a partir do calendário (convite + aviso_gira). */
export async function enrichEventCalendarVariables(
  sb: SupabaseClient,
  leaderId: string,
  variables: Record<string, string | number>
): Promise<Record<string, string | number>> {
  const eventId = String(variables.event_id || "").trim();
  if (!eventId) return variables;

  const { data: event, error } = await sb
    .from("calendario_axe")
    .select("titulo, data, hora, descricao, banner_url, tenant_id, lider_id")
    .eq("id", eventId)
    .maybeSingle();
  if (error) throw error;
  if (!event) return variables;

  const eventRef = String(event.tenant_id || event.lider_id || "").trim();
  if (eventRef) {
    const eventLeader = await resolveLeaderId(sb, eventRef);
    if (eventLeader !== leaderId) {
      throw httpError("Evento não pertence ao seu terreiro", 403);
    }
  }

  const bannerFromDb = String(event.banner_url || "").trim();
  const publicBanner = resolvePublicMediaUrl(bannerFromDb, { absolute: true }) || bannerFromDb;
  return {
    ...variables,
    nome_evento: variables.nome_evento || String(event.titulo || ""),
    data_evento: variables.data_evento || formatEventDateBr(String(event.data || "")),
    hora_evento: variables.hora_evento || String(event.hora || ""),
    local_evento:
      variables.local_evento ||
      variables.descricao_evento ||
      String(event.descricao || "").trim() ||
      "A confirmar",
    banner_url: publicBanner || String(variables.banner_url || ""),
  };
}

/** Dados de acesso do filho para boas-vindas (ID curto + URL /login). */
async function enrichBoasVindasVariables(
  sb: SupabaseClient,
  leaderId: string,
  filhoId: string | null,
  variables: Record<string, string | number>
): Promise<Record<string, string | number>> {
  const loginUrl = resolveLoginPublicUrl();
  const base = {
    ...variables,
    nome_sistema: variables.nome_sistema || "AxéCloud",
    login_url: loginUrl,
  };
  if (!filhoId) return base;

  const { data: filho, error } = await sb
    .from("filhos_de_santo")
    .select("id, nome, tenant_id, lider_id, data_entrada")
    .eq("id", filhoId)
    .maybeSingle();
  if (error) throw error;
  if (!filho) return base;

  await assertFilhoBelongsToTerreiro(sb, leaderId, filho);

  return {
    ...base,
    nome_filho: variables.nome_filho || String(filho.nome || ""),
    filho_login_id: formatFilhoMatricula(String(filho.id), filho.data_entrada),
  };
}

function isBroadcastLikeTipo(tipo: string): boolean {
  const t = String(tipo || "").toLowerCase();
  return t === "broadcast" || t === "teste";
}

function resolveBroadcastRawText(
  variables: Record<string, string | number> | undefined,
  fallbackMessage: string
): string {
  return String(
    variables?.comunicado || variables?.mensagem || variables?.message || fallbackMessage || ""
  ).trim();
}

function resolveZeladorFromVariables(
  variables: Record<string, string | number> | undefined,
  fallback?: string
): string | undefined {
  const fromVars = String(variables?.zelador || variables?.nome_zelador || "").trim();
  return fromVars || fallback;
}

function buildConviteRsvpLinks(variables?: Record<string, string | number>): string {
  const token = extractRsvpToken(variables);
  if (!token) return "";
  const base = String(process.env.VITE_APP_URL || process.env.WA_APP_LOGIN_URL || "https://axecloud.com.br")
    .trim()
    .replace(/\/$/, "");
  const origin = base.startsWith("http") ? base : "https://axecloud.com.br";
  return `\n\nConfirmar presença: ${origin}/convite/${token}/confirmar\nNão poderei ir: ${origin}/convite/${token}/declinar`;
}

/** Monta o texto completo enviado via Baileys (Evolution sendText). */
export function buildWhatsAppDeliverableText(
  templates: unknown,
  tipo: string,
  nomeMembro: string,
  nomeTerreiro: string,
  variables?: Record<string, string | number>,
  zelador?: string
): string {
  if (isBroadcastLikeTipo(tipo)) {
    const rawMessage = resolveBroadcastRawText(variables, "");
    return buildSignedWhatsAppBody(nomeMembro, nomeTerreiro, rawMessage, zelador, {
      includeGreeting: false,
    });
  }

  const mergedVars: Record<string, string | number> = {
    ...(variables || {}),
    nome_filho: variables?.nome_filho || nomeMembro,
    nome_membro: variables?.nome_membro || nomeMembro,
    nome_terreiro: variables?.nome_terreiro || nomeTerreiro,
  };

  let body = buildWhatsAppMessage(templates, tipo, mergedVars);
  const normalized = String(tipo || "").toLowerCase();

  if (normalized === "convite_evento") {
    body += buildConviteRsvpLinks(variables);
  }

  if (normalized === "aviso_gira") {
    const banner = String(variables?.banner_url || "").trim();
    if (banner) body += `\n\n${banner}`;
  }

  return body.slice(0, 4096);
}

async function sendWhatsAppTextMessage(phone: string, text: string): Promise<{ messageId?: string }> {
  const out = await sendEvolutionTextByInstance(CONSOLE_ADMIN_INSTANCE_NAME, phone, text);
  console.log(`[WHATSAPP] text via Evolution → ${phone.slice(0, 4)}…`);
  return out;
}

export async function logAndSendWhatsApp(
  sb: SupabaseClient,
  input: WhatsAppSendInput & {
    phone: string;
    message: string;
    deliverableText?: string;
    nomeMembro: string;
    nomeTerreiro: string;
    idTerreiro: string;
    zelador?: string;
  }
): Promise<{ messageId?: string; externalId: string }> {
  await ensureOfficialWhatsAppReady();

  const { tipo, phone, message, deliverableText, filhoId, tenantId } = input;
  const zelador = resolveZeladorFromVariables(input.variables, input.zelador);
  const textToSend =
    deliverableText ||
    (isBroadcastLikeTipo(tipo)
      ? buildSignedWhatsAppBody(
          input.nomeMembro,
          input.nomeTerreiro,
          resolveBroadcastRawText(input.variables, message),
          zelador,
          { includeGreeting: false }
        )
      : message);

  const sent = await sendWhatsAppTextMessage(phone, textToSend);
  const messageId = sent.messageId;
  const auditMessage = isBroadcastLikeTipo(tipo)
    ? textToSend
    : buildWhatsAppAuditMessage(tipo, input.variables, input.nomeMembro, input.nomeTerreiro) || textToSend;

  const externalId = messageId || `msg_${Math.random().toString(36).substr(2, 9)}`;
  await sb.from("whatsapp_logs").insert({
    tenant_id: tenantId,
    filho_id: filhoId || null,
    tipo,
    telefone: phone,
    mensagem: auditMessage,
    status: "sent",
    external_id: externalId,
  });
  return { messageId, externalId };
}

export async function sendWhatsAppForTenant(
  sb: SupabaseClient,
  input: WhatsAppSendInput
): Promise<{ success: true; externalId: string }> {
  const ctx = await resolveTerreiroWhatsAppContext(sb, input.tenantId, input.tenantId);

  let phone: string;
  let nomeMembro: string;
  let filhoId: string | null = input.filhoId ? String(input.filhoId) : null;

  if (input.filhoId) {
    const target = await resolveMemberWhatsAppTarget(sb, input.tenantId, input.tenantId, String(input.filhoId));
    phone = target.phone;
    nomeMembro = target.nomeMembro;
    filhoId = target.filhoId;
  } else if (input.forcePhone) {
    phone = normalizeBrPhone(String(input.forcePhone));
    nomeMembro = pickMemberNameFromVariables(input.variables, "Membro");
  } else {
    throw httpError("Telefone não encontrado", 400);
  }

  const { data: config } = await sb
    .from("whatsapp_config")
    .select("templates")
    .eq("tenant_id", input.tenantId)
    .maybeSingle();

  let variables: Record<string, string | number> = {
    nome_filho: nomeMembro,
    nome_membro: nomeMembro,
    nome_terreiro: ctx.nomeTerreiro,
    zelador: ctx.zelador || "",
    nome_zelador: ctx.zelador || "",
    ...(input.variables || {}),
  };

  if (isConviteEventoTemplate(input.tipo) || isAvisoGiraTemplate(input.tipo)) {
    variables = await enrichEventCalendarVariables(sb, ctx.leaderId, variables);
  }
  if (isBoasVindasTemplate(input.tipo)) {
    variables = await enrichBoasVindasVariables(sb, ctx.leaderId, filhoId, variables);
  }

  const deliverableText = buildWhatsAppDeliverableText(
    config?.templates,
    input.tipo,
    nomeMembro,
    ctx.nomeTerreiro,
    variables,
    ctx.zelador
  );
  const auditMessage =
    buildWhatsAppAuditMessage(input.tipo, variables, nomeMembro, ctx.nomeTerreiro) || deliverableText;
  const { externalId } = await logAndSendWhatsApp(sb, {
    ...input,
    filhoId,
    phone,
    message: auditMessage,
    deliverableText,
    nomeMembro,
    nomeTerreiro: ctx.nomeTerreiro,
    idTerreiro: ctx.idTerreiro,
    zelador: ctx.zelador,
    variables,
  });
  return { success: true, externalId };
}

/** Transmissão para todos os filhos do terreiro — um envio por membro com isolamento. */
export async function broadcastWhatsAppForTenant(
  sb: SupabaseClient,
  tenantId: string,
  messageText: string
): Promise<{ sent: number; failed: number; total: number; lastError?: string }> {
  const ctx = await resolveTerreiroWhatsAppContext(sb, tenantId, tenantId);

  const { data: filhos, error } = await sb
    .from("filhos_de_santo")
    .select("id, nome, whatsapp_phone, status, tenant_id, lider_id")
    .or(`tenant_id.eq.${ctx.idTerreiro},lider_id.eq.${ctx.leaderId}`)
    .not("whatsapp_phone", "is", null);

  if (error) throw error;

  const targets = (filhos || []).filter((f) => {
    const st = String(f.status || "Ativo").trim().toLowerCase();
    if (st === "inativo" || st === "desligado" || st === "falecido") return false;
    return String(f.whatsapp_phone || "").replace(/\D/g, "").length >= 10;
  });

  const seenPhones = new Set<string>();
  const uniqueTargets = targets.filter((f) => {
    const phone = normalizeBrPhone(String(f.whatsapp_phone));
    if (seenPhones.has(phone)) return false;
    seenPhones.add(phone);
    return true;
  });

  const cooldownMs = Number(process.env.WA_BROADCAST_PHONE_COOLDOWN_MS || 180000);
  if (cooldownMs > 0 && uniqueTargets.length > 0) {
    const phone = normalizeBrPhone(String(uniqueTargets[0].whatsapp_phone));
    const { data: last } = await sb
      .from("whatsapp_logs")
      .select("created_at")
      .eq("tenant_id", tenantId)
      .eq("telefone", phone)
      .eq("tipo", "broadcast")
      .in("status", ["sent", "partial"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (last?.created_at) {
      const elapsed = Date.now() - new Date(String(last.created_at)).getTime();
      if (elapsed < cooldownMs) {
        const waitMin = Math.ceil((cooldownMs - elapsed) / 60000);
        throw httpError(
          `Aguarde cerca de ${waitMin} min antes de reenviar para o mesmo número (limite anti-spam do WhatsApp).`,
          429
        );
      }
    }
  }

  let sent = 0;
  let failed = 0;
  let lastError: string | undefined;

  for (let i = 0; i < uniqueTargets.length; i++) {
    const filho = uniqueTargets[i];
    const phone = normalizeBrPhone(String(filho.whatsapp_phone));
    try {
      if (i > 0) await sleep(2000);
      await assertFilhoBelongsToTerreiro(sb, ctx.leaderId, filho);
      const nomeMembro = String(filho.nome || "Membro");
      await logAndSendWhatsApp(sb, {
        tenantId,
        filhoId: String(filho.id),
        tipo: "broadcast",
        phone,
        message: messageText,
        nomeMembro,
        nomeTerreiro: ctx.nomeTerreiro,
        idTerreiro: ctx.idTerreiro,
        zelador: ctx.zelador,
        variables: {
          nome_filho: nomeMembro,
          nome_terreiro: ctx.nomeTerreiro,
          zelador: ctx.zelador || "",
          nome_zelador: ctx.zelador || "",
          comunicado: messageText,
        },
      });
      sent += 1;
    } catch (err) {
      failed += 1;
      lastError = err instanceof Error ? err.message : String(err);
      console.error(`[WHATSAPP] broadcast falhou (${phone}):`, lastError);
      try {
        await sb.from("whatsapp_logs").insert({
          tenant_id: tenantId,
          filho_id: String(filho.id),
          tipo: "broadcast",
          telefone: phone,
          mensagem: messageText,
          status: "failed",
          external_id: `failed_${Date.now()}_${i}`,
        });
      } catch {
        /* ok */
      }
    }
  }

  if (sent > 0 || failed > 0) {
    await sb.from("whatsapp_logs").insert({
      tenant_id: tenantId,
      tipo: "broadcast",
      telefone: "corrente_geral",
      mensagem: messageText,
      status: sent > 0 ? (failed > 0 ? "partial" : "sent") : "failed",
      external_id: `broadcast_${Date.now()}`,
    });
  }

  return { sent, failed, total: uniqueTargets.length, lastError };
}
