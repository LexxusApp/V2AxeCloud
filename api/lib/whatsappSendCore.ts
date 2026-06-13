import type { SupabaseClient } from "@supabase/supabase-js";
import { format, parseISO } from "date-fns";
import {
  CONSOLE_ADMIN_INSTANCE_NAME,
  ensureOfficialWhatsAppReady,
  sendEvolutionTemplateByInstance,
} from "../../src/services/evolution.service.js";
import { resolveWhatsAppTemplate } from "../../src/constants/whatsappTemplates.js";
import { assertZeladorTenantAccess, resolveLeaderId } from "./tenantAccess.js";
import {
  buildMetaTemplateComponentsForTipo,
  buildWhatsAppAuditMessage,
  filhoLoginIdShort,
  isBoasVindasTemplate,
  isAvisoGiraTemplate,
  isConviteEventoTemplate,
  resolveLoginPublicUrl,
  resolveMetaTemplateLanguage,
  resolveMetaTemplateName,
} from "./whatsappMetaCloud.js";

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
    .select("id, tenant_id, nome_terreiro")
    .eq("id", leaderId)
    .maybeSingle();

  if (!profile) throw httpError("Terreiro não encontrado", 404);

  const idTerreiro = String(profile.tenant_id || profile.id || leaderId).trim();
  const nomeTerreiro = String(profile.nome_terreiro || "Terreiro").trim();

  return { idTerreiro, nomeTerreiro, leaderId };
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
async function enrichEventCalendarVariables(
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
    banner_url: bannerFromDb || String(variables.banner_url || ""),
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
    .select("id, nome, tenant_id, lider_id")
    .eq("id", filhoId)
    .maybeSingle();
  if (error) throw error;
  if (!filho) return base;

  await assertFilhoBelongsToTerreiro(sb, leaderId, filho);

  return {
    ...base,
    nome_filho: variables.nome_filho || String(filho.nome || ""),
    filho_login_id: filhoLoginIdShort(String(filho.id)),
  };
}

export async function logAndSendWhatsApp(
  sb: SupabaseClient,
  input: WhatsAppSendInput & {
    phone: string;
    message: string;
    nomeMembro: string;
    nomeTerreiro: string;
    idTerreiro: string;
  }
): Promise<{ messageId?: string; externalId: string }> {
  await ensureOfficialWhatsAppReady();

  const { tipo, phone, message, nomeMembro, nomeTerreiro, filhoId, tenantId } = input;

  const templateName = resolveMetaTemplateName(tipo);
  const language = resolveMetaTemplateLanguage();
  const components = buildMetaTemplateComponentsForTipo(
    tipo,
    nomeMembro,
    nomeTerreiro,
    input.variables
  );

  const { messageId } = await sendEvolutionTemplateByInstance(
    CONSOLE_ADMIN_INSTANCE_NAME,
    phone,
    templateName,
    language,
    components
  );

  const externalId = messageId || `msg_${Math.random().toString(36).substr(2, 9)}`;
  await sb.from("whatsapp_logs").insert({
    tenant_id: tenantId,
    filho_id: filhoId || null,
    tipo,
    telefone: phone,
    mensagem: message,
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
    ...(input.variables || {}),
  };

  if (isConviteEventoTemplate(input.tipo) || isAvisoGiraTemplate(input.tipo)) {
    variables = await enrichEventCalendarVariables(sb, ctx.leaderId, variables);
  }
  if (isBoasVindasTemplate(input.tipo)) {
    variables = await enrichBoasVindasVariables(sb, ctx.leaderId, filhoId, variables);
  }

  const message =
    buildWhatsAppAuditMessage(input.tipo, variables, nomeMembro, ctx.nomeTerreiro) ||
    buildWhatsAppMessage(config?.templates, input.tipo, variables);
  const { externalId } = await logAndSendWhatsApp(sb, {
    ...input,
    filhoId,
    phone,
    message,
    nomeMembro,
    nomeTerreiro: ctx.nomeTerreiro,
    idTerreiro: ctx.idTerreiro,
    variables,
  });
  return { success: true, externalId };
}

/** Transmissão para todos os filhos do terreiro — um envio por membro com isolamento. */
export async function broadcastWhatsAppForTenant(
  sb: SupabaseClient,
  tenantId: string,
  messageText: string
): Promise<{ sent: number; failed: number; total: number }> {
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

  let sent = 0;
  let failed = 0;

  for (const filho of targets) {
    try {
      await assertFilhoBelongsToTerreiro(sb, ctx.leaderId, filho);
      const phone = normalizeBrPhone(String(filho.whatsapp_phone));
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
        variables: { nome_filho: nomeMembro, nome_terreiro: ctx.nomeTerreiro },
      });
      sent += 1;
    } catch {
      failed += 1;
    }
  }

  if (sent > 0) {
    await sb.from("whatsapp_logs").insert({
      tenant_id: tenantId,
      tipo: "broadcast",
      telefone: "corrente_geral",
      mensagem: messageText,
      status: failed > 0 ? "partial" : "sent",
      external_id: `broadcast_${Date.now()}`,
    });
  }

  return { sent, failed, total: targets.length };
}
