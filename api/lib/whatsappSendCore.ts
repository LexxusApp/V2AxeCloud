import type { SupabaseClient } from "@supabase/supabase-js";
import { format, parseISO } from "date-fns";
import {
  CONSOLE_ADMIN_INSTANCE_NAME,
  ensureOfficialWhatsAppReady,
} from "../../src/services/evolution.service.js";
import { sendEvolutionTemplateQueued, sendEvolutionTextQueued } from "./evolutionSendQueue.js";
import {
  assertBroadcastCooldown,
  assertBroadcastRecipientLimit,
  assertTenantWhatsAppDailyQuota,
  assertWhatsAppOutboundAllowed,
  capAndShuffleRecipients,
  validateWhatsAppOutboundMessage,
} from "./whatsappSendGuards.js";
import { buildSendMeta, humanizeWhatsAppMessage } from "./whatsappAntiSpam.js";
import { appendFingerprintMarker } from "./whatsappPersistentLimits.js";
import { resolveWhatsAppTemplate } from "../../src/constants/whatsappTemplates.js";
import { assertZeladorTenantAccess, resolveLeaderId } from "./tenantAccess.js";
import { resolvePublicMediaUrl } from "./r2PublicMedia.js";
import {
  isMetaCloudDirectConfigured,
  sendMetaCloudTemplate,
  sendMetaCloudText,
} from "./metaCloudSend.js";
import {
  buildCredentialsFollowUpText,
  buildCredenciaisAcessoComponents,
  buildCredentialsPackedInAvisoGeralComponents,
  buildMetaTemplateComponentsForTipo,
  buildSignedWhatsAppBody,
  buildTransmissaoFollowUpText,
  buildWhatsAppAuditMessage,
  extractRsvpToken,
  isAvisoGiraTemplate,
  isConviteEventoTemplate,
  isCredentialsAccessTemplate,
  resolveCredentialsFollowUpDelayMs,
  resolveCredenciaisTemplateName,
  resolveMetaTemplateLanguage,
  resolveMetaTemplateName,
  resolveTransmissaoFollowUpDelayMs,
  usesCredentialsTwoStepFlow,
  usesMetaBroadcastTemplateFlow,
  usesMetaUtilityTemplateFlow,
  usesTransmissaoTwoStepFlow,
  resolveLoginPublicUrl,
} from "./whatsappMetaCloud.js";
import { formatFilhoMatricula } from "../../lib/filhoMatricula.js";

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

function messageIncludesCredentials(
  body: string,
  variables: Record<string, string | number> | undefined
): boolean {
  const loginId = String(variables?.filho_login_id || "").trim();
  const senha = String(variables?.senha_acesso || "").trim();
  if (!loginId) return false;
  const hasLogin = body.includes(loginId);
  const hasSenha = senha ? body.includes(senha) : /\bsenha\b/i.test(body);
  return hasLogin && hasSenha;
}

function buildCredentialsAccessBlock(variables: Record<string, string | number>): string {
  const loginId = String(variables.filho_login_id || "").trim();
  const senha = String(variables.senha_acesso || "").trim();
  const loginUrl = String(variables.login_url || resolveLoginPublicUrl()).trim();
  if (!loginId) return "";
  return `\n\n🔐 *Seu acesso:*\nRegistro: ${loginId}\nSenha: ${senha}\nEntrar: ${loginUrl}`;
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

/** Dados de acesso do filho (registro + URL /login). */
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
    .select("id, nome, cpf, tenant_id, lider_id, data_entrada")
    .eq("id", filhoId)
    .maybeSingle();
  if (error) throw error;
  if (!filho) return base;

  await assertFilhoBelongsToTerreiro(sb, leaderId, filho);

  const cpfDigits = String(filho.cpf || "").replace(/\D/g, "");
  const senhaAcesso =
    cpfDigits.length >= 6
      ? cpfDigits.slice(0, 6)
      : "os 6 primeiros dígitos do seu CPF (cadastre o CPF no perfil se ainda não informou)";

  return {
    ...base,
    nome_filho: variables.nome_filho || String(filho.nome || ""),
    filho_login_id: formatFilhoMatricula(String(filho.id), filho.data_entrada),
    senha_acesso: senhaAcesso,
  };
}

function isBroadcastLikeTipo(tipo: string): boolean {
  const t = String(tipo || "").toLowerCase();
  return t === "broadcast" || t === "teste" || t === "transmissao_aviso" || t === "mural_aviso";
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
      includeGreeting: true,
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

  if (isCredentialsAccessTemplate(normalized) && !messageIncludesCredentials(body, mergedVars)) {
    body += buildCredentialsAccessBlock(mergedVars);
  }

  return body.slice(0, 4096);
}

function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendMetaTemplateMessage(
  phone: string,
  tipo: string,
  nomeMembro: string,
  nomeTerreiro: string,
  variables: Record<string, string | number> | undefined,
  opts?: {
    tenantId?: string;
    filhoId?: string | null;
    sb?: SupabaseClient;
    fallbackText?: string;
    zelador?: string;
  }
): Promise<{ messageId?: string }> {
  const templateName = resolveMetaTemplateName(tipo);
  const language = resolveMetaTemplateLanguage();
  const mergedVars: Record<string, string | number> = {
    ...(variables || {}),
    zelador: variables?.zelador || opts?.zelador || "",
    nome_zelador: variables?.nome_zelador || opts?.zelador || "",
  };
  const components = buildMetaTemplateComponentsForTipo(
    tipo,
    nomeMembro,
    nomeTerreiro,
    mergedVars
  );
  const meta = buildSendMeta(tipo, {
    tenantId: opts?.tenantId,
    filhoId: opts?.filhoId,
  });

  try {
    if (isMetaCloudDirectConfigured()) {
      const out = await sendMetaCloudTemplate(phone, templateName, language, components);
      console.log(`[WHATSAPP] template Meta direct (${templateName}) → ${phone.slice(0, 4)}…`);
      return out;
    }

    await ensureOfficialWhatsAppReady();
    const out = await sendEvolutionTemplateQueued(
      CONSOLE_ADMIN_INSTANCE_NAME,
      phone,
      templateName,
      language,
      components,
      { ...meta, sb: opts?.sb, skipSendWindow: true }
    );
    console.log(`[WHATSAPP] template Evolution (${templateName}) → ${phone.slice(0, 4)}…`);
    return out;
  } catch (err) {
    const fallback = String(opts?.fallbackText || "").trim();
    if (!fallback) throw err;
    console.error(
      `[WHATSAPP] template Meta falhou (${templateName}), fallback texto:`,
      err instanceof Error ? err.message : err
    );
    return sendWhatsAppTextMessage(phone, fallback, {
      tipo,
      tenantId: opts?.tenantId,
      filhoId: opts?.filhoId,
      nomeMembro,
      sb: opts?.sb,
    });
  }
}

async function sendCredentialsFollowUpMessage(
  phone: string,
  text: string,
  tipo: string,
  opts?: {
    tenantId?: string;
    filhoId?: string | null;
    nomeMembro?: string;
    sb?: SupabaseClient;
  }
): Promise<{ messageId?: string }> {
  const safeText = validateWhatsAppOutboundMessage(text);
  const meta = buildSendMeta(tipo, {
    tenantId: opts?.tenantId,
    filhoId: opts?.filhoId,
  });

  if (isMetaCloudDirectConfigured()) {
    const out = await sendMetaCloudText(phone, safeText);
    console.log(`[WHATSAPP] credenciais Meta direct (texto livre) → ${phone.slice(0, 4)}…`);
    return out;
  }

  const out = await sendEvolutionTextQueued(CONSOLE_ADMIN_INSTANCE_NAME, phone, safeText, {
    ...meta,
    sb: opts?.sb,
    skipSendWindow: true,
    skipPhoneCooldown: true,
  });
  console.log(`[WHATSAPP] credenciais Evolution (texto livre) → ${phone.slice(0, 4)}…`);
  return out;
}

/**
 * 2ª mensagem de dados_acesso: template Meta (obrigatório fora da janela do cliente).
 * Preferência: credenciais_acesso_axecloud → senão empacota em aviso_geral_axecloud → por último texto livre.
 */
async function sendCredentialsFollowUpReliable(
  phone: string,
  tipo: string,
  nomeMembro: string,
  variables: Record<string, string | number>,
  opts?: {
    tenantId?: string;
    filhoId?: string | null;
    sb?: SupabaseClient;
  }
): Promise<{ messageId?: string }> {
  const followUpText = buildCredentialsFollowUpText(variables);
  if (!followUpText.trim()) {
    throw httpError("Registro/senha do filho não encontrados para envio de credenciais.", 400);
  }

  const language = resolveMetaTemplateLanguage();
  const dedicatedName = resolveCredenciaisTemplateName();
  const packedName = String(process.env.WA_META_TEMPLATE_DEFAULT || "aviso_geral_axecloud").trim();

  if (isMetaCloudDirectConfigured()) {
    try {
      const out = await sendMetaCloudTemplate(
        phone,
        dedicatedName,
        language,
        buildCredenciaisAcessoComponents(variables)
      );
      console.log(`[WHATSAPP] credenciais template Meta (${dedicatedName}) → ${phone.slice(0, 4)}…`);
      return out;
    } catch (err) {
      console.warn(
        `[WHATSAPP] template ${dedicatedName} indisponível, empacotando em ${packedName}:`,
        err instanceof Error ? err.message : err
      );
    }

    try {
      const out = await sendMetaCloudTemplate(
        phone,
        packedName,
        language,
        buildCredentialsPackedInAvisoGeralComponents(nomeMembro, variables)
      );
      console.log(`[WHATSAPP] credenciais template Meta (${packedName} pack) → ${phone.slice(0, 4)}…`);
      return out;
    } catch (err) {
      console.warn(
        `[WHATSAPP] pack ${packedName} falhou, tentando texto livre:`,
        err instanceof Error ? err.message : err
      );
    }

    // Último recurso — só entrega se o destinatário já tiver janela de 24h aberta.
    return sendCredentialsFollowUpMessage(phone, followUpText, tipo, {
      ...opts,
      nomeMembro,
    });
  }

  return sendCredentialsFollowUpMessage(phone, followUpText, tipo, {
    ...opts,
    nomeMembro,
  });
}

/** Template conta_ativa_axecloud + credenciais (2ª msg via template Meta). */
async function sendCredentialsAccessPair(
  phone: string,
  tipo: string,
  nomeMembro: string,
  nomeTerreiro: string,
  variables: Record<string, string | number>,
  opts?: {
    tenantId?: string;
    filhoId?: string | null;
    sb?: SupabaseClient;
    fallbackText?: string;
  }
): Promise<{ messageId?: string; templateMessageId?: string; followUpMessageId?: string }> {
  const followUpText = buildCredentialsFollowUpText(variables);
  if (!followUpText.trim()) {
    throw httpError("Registro/senha do filho não encontrados para envio de credenciais.", 400);
  }

  let templateOut: { messageId?: string } | null = null;
  try {
    templateOut = await sendMetaTemplateMessage(phone, tipo, nomeMembro, nomeTerreiro, variables, opts);
  } catch (err) {
    const fallback = String(opts?.fallbackText || "").trim();
    if (!fallback) throw err;
    console.error(
      `[WHATSAPP] template conta_ativa falhou (${tipo}), fallback texto único:`,
      err instanceof Error ? err.message : err
    );
    const out = await sendWhatsAppTextMessage(phone, fallback, {
      tipo,
      tenantId: opts?.tenantId,
      filhoId: opts?.filhoId,
      nomeMembro,
      sb: opts?.sb,
    });
    return { messageId: out.messageId };
  }

  // Aguarda a Meta processar o 1º template antes do 2º.
  await sleepMs(Math.max(resolveCredentialsFollowUpDelayMs(), 5000));

  try {
    const followUpOut = await sendCredentialsFollowUpReliable(phone, tipo, nomeMembro, variables, opts);
    return {
      messageId: followUpOut.messageId || templateOut.messageId,
      templateMessageId: templateOut.messageId,
      followUpMessageId: followUpOut.messageId,
    };
  } catch (err) {
    console.error(
      `[WHATSAPP] 2ª mensagem (credenciais) falhou após conta_ativa:`,
      err instanceof Error ? err.message : err
    );
    // Conta_ativa já foi enviada — não mascara o erro com fallback de texto (Meta bloquearia).
    throw err;
  }
}

/** Template aviso_portal_axecloud + comunicado completo em texto livre (janela 24h). */
async function sendTransmissaoPair(
  phone: string,
  tipo: string,
  nomeMembro: string,
  nomeTerreiro: string,
  variables: Record<string, string | number>,
  opts?: {
    tenantId?: string;
    filhoId?: string | null;
    sb?: SupabaseClient;
    fallbackText?: string;
    zelador?: string;
  }
): Promise<{ messageId?: string; templateMessageId?: string; followUpMessageId?: string }> {
  const zelador = resolveZeladorFromVariables(variables, opts?.zelador);
  const followUpText = buildTransmissaoFollowUpText(nomeTerreiro, variables, zelador);
  if (!followUpText.trim()) {
    throw httpError("Texto do comunicado não encontrado para transmissão.", 400);
  }

  const templateOut = await sendMetaTemplateMessage(phone, tipo, nomeMembro, nomeTerreiro, variables, opts);
  await sleepMs(resolveTransmissaoFollowUpDelayMs());

  try {
    const followUpOut = await sendCredentialsFollowUpMessage(phone, followUpText, tipo, {
      ...opts,
      nomeMembro,
    });

    return {
      messageId: followUpOut.messageId || templateOut.messageId,
      templateMessageId: templateOut.messageId,
      followUpMessageId: followUpOut.messageId,
    };
  } catch (err) {
    // Template aviso_portal já saiu — não mascara com fallback de texto (Meta costuma bloquear fora da janela).
    console.error(
      `[WHATSAPP] 2ª mensagem (comunicado) falhou após aviso_portal:`,
      err instanceof Error ? err.message : err
    );
    throw err;
  }
}

async function sendWhatsAppTextMessage(
  phone: string,
  text: string,
  opts?: {
    tipo?: string;
    tenantId?: string;
    filhoId?: string | null;
    nomeMembro?: string;
    batchIndex?: number;
    batchTotal?: number;
    sb?: SupabaseClient;
    skipSendWindow?: boolean;
  }
): Promise<{ messageId?: string }> {
  const tipo = String(opts?.tipo || "notification");
  const humanized = humanizeWhatsAppMessage(text, {
    nomeMembro: opts?.nomeMembro || "Membro",
    tipo,
    tenantId: opts?.tenantId,
    filhoId: opts?.filhoId,
    phone,
    forceGreeting:
      tipo === "broadcast" ||
      tipo === "transmissao_aviso" ||
      tipo === "mural_aviso" ||
      tipo === "aviso_gira",
  });
  const safeText = validateWhatsAppOutboundMessage(humanized);
  const meta = buildSendMeta(tipo, {
    tenantId: opts?.tenantId,
    filhoId: opts?.filhoId,
    batchIndex: opts?.batchIndex,
    batchTotal: opts?.batchTotal,
  });
  const out = await sendEvolutionTextQueued(CONSOLE_ADMIN_INSTANCE_NAME, phone, safeText, {
    ...meta,
    sb: opts?.sb,
    skipSendWindow: opts?.skipSendWindow,
  });
  console.log(`[WHATSAPP] ${meta.category} via Evolution (fila) → ${phone.slice(0, 4)}…`);
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
  const variables = input.variables || {};
  const useCredentialsTwoStep = usesCredentialsTwoStepFlow(tipo);
  const useTransmissaoTwoStep = usesTransmissaoTwoStepFlow(tipo);
  const useMetaUtility = usesMetaUtilityTemplateFlow(tipo);
  const useMetaBroadcast = usesMetaBroadcastTemplateFlow(tipo);
  const templateOnlyPortal =
    tipo.trim().toLowerCase() === "transmissao_aviso" ||
    tipo.trim().toLowerCase() === "mural_aviso";

  const textToSend =
    deliverableText ||
    (isBroadcastLikeTipo(tipo)
      ? buildSignedWhatsAppBody(
          input.nomeMembro,
          input.nomeTerreiro,
          resolveBroadcastRawText(input.variables, message),
          zelador,
          { includeGreeting: true }
        )
      : message);

  const auditBase = isBroadcastLikeTipo(tipo)
    ? textToSend
    : buildWhatsAppAuditMessage(tipo, input.variables, input.nomeMembro, input.nomeTerreiro) || textToSend;

  const followUpPreview = useCredentialsTwoStep
    ? buildCredentialsFollowUpText(variables)
    : useTransmissaoTwoStep
      ? buildTransmissaoFollowUpText(input.nomeTerreiro, variables, zelador)
      : "";
  const followUpLabel = useCredentialsTwoStep ? "credenciais" : "comunicado";
  const quotaText =
    useCredentialsTwoStep || useTransmissaoTwoStep
      ? `${auditBase}\n\n--- ${followUpLabel} (texto livre) ---\n${followUpPreview}`
      : textToSend;

  const { fingerprint } = await assertWhatsAppOutboundAllowed(sb, {
    tenantId,
    tipo,
    messageText: quotaText,
    plannedSends: useCredentialsTwoStep || useTransmissaoTwoStep ? 2 : 1,
  });

  let sent: { messageId?: string };
  if (useCredentialsTwoStep) {
    sent = await sendCredentialsAccessPair(
      phone,
      tipo,
      input.nomeMembro,
      input.nomeTerreiro,
      variables,
      { tenantId, filhoId, sb, fallbackText: textToSend }
    );
  } else if (useTransmissaoTwoStep) {
    sent = await sendTransmissaoPair(
      phone,
      tipo,
      input.nomeMembro,
      input.nomeTerreiro,
      variables,
      { tenantId, filhoId, sb, fallbackText: textToSend, zelador }
    );
  } else if (useMetaUtility || useMetaBroadcast) {
    sent = await sendMetaTemplateMessage(
      phone,
      tipo,
      input.nomeMembro,
      input.nomeTerreiro,
      variables,
      {
        tenantId,
        filhoId,
        sb,
        // Mural/transmissão deve enviar somente o template aprovado da Meta.
        fallbackText: templateOnlyPortal ? undefined : textToSend,
        zelador,
      }
    );
  } else {
    sent = await sendWhatsAppTextMessage(phone, textToSend, {
      tipo,
      tenantId,
      filhoId,
      nomeMembro: input.nomeMembro,
      sb,
    });
  }

  const messageId = sent.messageId;
  let auditMessage =
    useCredentialsTwoStep || useTransmissaoTwoStep
      ? `${auditBase}\n\n--- ${followUpLabel} ---\n${followUpPreview}`
      : auditBase;
  if (fingerprint) {
    auditMessage = appendFingerprintMarker(auditMessage, fingerprint);
  }

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
  if (isCredentialsAccessTemplate(input.tipo)) {
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

  const shuffled = capAndShuffleRecipients(uniqueTargets, uniqueTargets.length);
  assertBroadcastRecipientLimit(shuffled.length);
  await assertBroadcastCooldown(sb, tenantId);
  await assertWhatsAppOutboundAllowed(sb, {
    tenantId,
    tipo: "broadcast",
    messageText: messageText,
    plannedSends: shuffled.length,
  });

  let sent = 0;
  let failed = 0;
  let lastError: string | undefined;

  for (let i = 0; i < shuffled.length; i++) {
    const filho = shuffled[i];
    const phone = normalizeBrPhone(String(filho.whatsapp_phone));
    try {
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
      const code = (err as { code?: string })?.code || "";
      console.error(`[WHATSAPP] broadcast falhou (${phone}):`, lastError);
      if (code.startsWith("WA_QUOTA")) break;
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

  return { sent, failed, total: shuffled.length, lastError };
}

/** Reenvia dados de acesso (registro, senha CPF, link) para filhos com WhatsApp. */
export async function resendDadosAcessoWhatsAppForTenant(
  sb: SupabaseClient,
  tenantId: string
): Promise<{
  sent: number;
  failed: number;
  skipped: number;
  total: number;
  skippedNoPhone: number;
  skippedNoCpf: number;
  lastError?: string;
}> {
  const ctx = await resolveTerreiroWhatsAppContext(sb, tenantId, tenantId);

  const { data: filhos, error } = await sb
    .from("filhos_de_santo")
    .select("id, nome, whatsapp_phone, cpf, status, tenant_id, lider_id, data_entrada")
    .or(`tenant_id.eq.${ctx.idTerreiro},lider_id.eq.${ctx.leaderId}`);

  if (error) throw error;

  let skippedNoPhone = 0;
  let skippedNoCpf = 0;
  const eligible: NonNullable<typeof filhos> = [];

  for (const f of filhos || []) {
    const st = String(f.status || "Ativo").trim().toLowerCase();
    if (st === "inativo" || st === "desligado" || st === "falecido") continue;

    const hasPhone = String(f.whatsapp_phone || "").replace(/\D/g, "").length >= 10;
    if (!hasPhone) {
      skippedNoPhone += 1;
      continue;
    }

    const cpfDigits = String(f.cpf || "").replace(/\D/g, "");
    if (cpfDigits.length < 6) {
      skippedNoCpf += 1;
      continue;
    }

    eligible.push(f);
  }

  await assertTenantWhatsAppDailyQuota(sb, tenantId, eligible.length);

  let sent = 0;
  let failed = 0;
  let lastError: string | undefined;

  for (let i = 0; i < eligible.length; i++) {
    const filho = eligible[i];
    try {
      await assertFilhoBelongsToTerreiro(sb, ctx.leaderId, filho);
      const nomeMembro = String(filho.nome || "Membro");
      await sendWhatsAppForTenant(sb, {
        tenantId,
        filhoId: String(filho.id),
        tipo: "dados_acesso",
        variables: {
          nome_filho: nomeMembro,
          nome_terreiro: ctx.nomeTerreiro,
          nome_sistema: "AxéCloud",
        },
      });
      sent += 1;
    } catch (err) {
      failed += 1;
      lastError = err instanceof Error ? err.message : String(err);
      const code = (err as { code?: string })?.code || "";
      console.error(`[WHATSAPP] dados-acesso falhou (${filho.id}):`, lastError);
      if (code.startsWith("WA_QUOTA")) break;
    }
  }

  return {
    sent,
    failed,
    skipped: skippedNoPhone + skippedNoCpf,
    total: eligible.length,
    skippedNoPhone,
    skippedNoCpf,
    lastError,
  };
}
