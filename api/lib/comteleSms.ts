/**
 * Integração oficial com a Comtele Gateway V4 (SMS e mensagens de contingência).
 * Permite envio de SMS direto e fallback automático quando a Meta rejeita a entrega no WhatsApp
 * (ex.: erro #131026 - número sem WhatsApp ativo, #131049 - limite de ecossistema da Meta).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { formatFilhoMatricula } from "../../lib/filhoMatricula.js";

export interface ComteleBalanceResponse {
  hasError: boolean;
  message?: string | null;
  object?: {
    balance: number;
  } | null;
  errors?: unknown;
}

export interface ComteleSendResponse {
  hasError: boolean;
  message?: string | null;
  object?: {
    requestId?: string;
    status?: string;
  } | null;
  errors?: unknown;
}

export interface ComteleSendResult {
  success: boolean;
  requestId?: string;
  status?: string;
  error?: string;
  phone?: string;
  raw?: unknown;
}

export interface BuildSmsFallbackInput {
  tipo: string;
  originalMessage?: string | null;
  nomeMembro?: string | null;
  nomeTerreiro?: string | null;
  matricula?: string | null;
  cpfSenha?: string | null;
  telefone?: string | null;
  email?: string | null;
  mesAno?: string | null;
  valor?: string | number | null;
}

const COMTELE_GATEWAY_URL = "https://api.comtele.com.br";

export function getComteleApiKey(): string {
  const envKey = String(
    process.env.COMTELE_API_KEY ||
    process.env.COMTELE_AUTH_KEY ||
    process.env.COMTELE_TOKEN ||
    ""
  ).trim();
  return envKey;
}

export function isComteleConfigured(): boolean {
  return Boolean(getComteleApiKey());
}

/** Normaliza para padrão E.164 brasileiro sem '+' (ex.: 5511999999999). */
export function normalizeSmsPhone(raw: string): string {
  let digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return "";
  if (!digits.startsWith("55") && (digits.length === 10 || digits.length === 11)) {
    digits = `55${digits}`;
  }
  return digits;
}

/** Valida se o número é um celular brasileiro válido para SMS (55 + DDD + 9 dígitos = 13 dígitos) */
export function isValidMobileSmsPhone(phone: string): boolean {
  const digits = normalizeSmsPhone(phone);
  if (digits.length !== 13) return false;
  if (!digits.startsWith("55")) return false;
  // O nono dígito (primeiro após o DDD) deve ser 9
  return digits.charAt(4) === "9";
}

/** Tipos de mensagem elegíveis para envio de SMS contingência */
const ELIGIBLE_SMS_TIPOS = [
  "gira",
  "evento",
  "dados_acesso",
  "acesso",
  "cadastro",
  "mensalidade",
  "cobranca",
  "financeiro",
  "transmissao",
  "mural",
];

export function isEligibleSmsTipo(tipo?: string | null): boolean {
  const t = String(tipo || "").toLowerCase().trim();
  if (!t) return false;
  return ELIGIBLE_SMS_TIPOS.some((eligible) => t.includes(eligible));
}

/** Limpa formatação de WhatsApp (asteriscos de negrito, itálico, crases) para SMS limpo */
export function cleanSmsText(text: string): string {
  return String(text || "")
    .replace(/[*_~`]/g, "") // remove formatações de markdown
    .replace(/[ \t]+/g, " ") // normaliza espaços
    .replace(/\n{3,}/g, "\n\n") // normaliza quebras
    .trim();
}

/** Consulta saldo atual da conta na Comtele */
export async function getComteleBalance(apiKeyOverride?: string): Promise<{
  success: boolean;
  balance: number;
  error?: string;
}> {
  const apiKey = apiKeyOverride || getComteleApiKey();
  if (!apiKey) {
    return { success: false, balance: 0, error: "Chave da Comtele não configurada" };
  }

  try {
    const res = await fetch(`${COMTELE_GATEWAY_URL}/balance`, {
      method: "GET",
      headers: {
        "x-api-key": apiKey,
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      return { success: false, balance: 0, error: `HTTP ${res.status}: ${errText}` };
    }

    const json = (await res.json()) as ComteleBalanceResponse;
    if (json.hasError) {
      return { success: false, balance: 0, error: json.message || "Erro retornado pela Comtele" };
    }

    const balance = Number(json.object?.balance ?? 0);
    return { success: true, balance };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, balance: 0, error: msg };
  }
}

/**
 * Envia um SMS via Comtele Gateway V4.
 */
export async function sendComteleSms(input: {
  phone: string;
  message: string;
  tag?: string;
  custom?: string;
  apiKeyOverride?: string;
}): Promise<ComteleSendResult> {
  const apiKey = input.apiKeyOverride || getComteleApiKey();
  if (!apiKey) {
    return { success: false, error: "Chave da Comtele não configurada" };
  }

  const phone = normalizeSmsPhone(input.phone);
  if (!phone || phone.length < 12) {
    return { success: false, error: `Número de telefone inválido para SMS: ${input.phone}` };
  }

  const message = cleanSmsText(input.message);
  if (!message) {
    return { success: false, error: "Mensagem SMS vazia" };
  }

  try {
    const payload = {
      messages: [
        {
          receiver: phone,
          message,
          tag: input.tag || "axecloud",
          custom: input.custom || "sms-dispatch",
        },
      ],
      route: 17, // Rota 17: Premium (SMS shortcode)
    };

    const res = await fetch(`${COMTELE_GATEWAY_URL}/messages/sms/batch/send`, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    let json: ComteleSendResponse;
    try {
      json = JSON.parse(text);
    } catch {
      return {
        success: false,
        error: `Resposta não JSON da Comtele (HTTP ${res.status}): ${text}`,
        phone,
      };
    }

    if (!res.ok || json.hasError) {
      return {
        success: false,
        error: json.message || `Erro HTTP ${res.status} da Comtele`,
        phone,
        raw: json,
      };
    }

    return {
      success: true,
      requestId: json.object?.requestId,
      status: json.object?.status || "queued",
      phone,
      raw: json,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: `Falha na requisição para Comtele: ${msg}`,
      phone,
    };
  }
}

/** Extrai detalhes de data/hora amigáveis da mensagem de gira */
function parseGiraDetails(raw: string): { titulo: string; dataHora: string } {
  const clean = raw.replace(/\[[^\]]+\]/g, "").trim();
  const parts = clean.split("—");

  let tituloPart = parts[0] || "Gira";
  tituloPart = tituloPart.replace(/^Gira(?:\s*\([^)]*\))?:?\s*/i, "").trim();
  const titulo = tituloPart || "Gira";

  let dataHora = "";
  if (parts.length > 1) {
    const afterDash = parts[1].trim();
    const dateMatch = afterDash.match(/(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)(?:\s+(\d{1,2}:\d{2}))?/);
    if (dateMatch) {
      const dataStr = dateMatch[1];
      const dataParts = dataStr.split("/");
      const dataFmt = dataParts.length >= 2 ? `${dataParts[0]}/${dataParts[1]}` : dataStr;
      const horaFmt = dateMatch[2] ? ` às ${dateMatch[2]}` : "";
      dataHora = ` dia ${dataFmt}${horaFmt}`;
    }
  }

  return { titulo, dataHora };
}

/** Extrai o mês de referência a partir da mensagem original ou opções, com fallback para o mês corrente */
export function extractMesReferencia(raw: string, explicit?: string | null): string {
  if (explicit && explicit.trim()) {
    return explicit.trim().replace(/^de\s+/i, "");
  }

  const rawClean = String(raw || "").trim();

  // 1. Procura expressões como "mensalidade de <mês>", "referente a <mês>", "mês de <mês>"
  const mesExtensoMatch = rawClean.match(
    /(?:mensalidade\s+de\s+|referente\s+(?:a|ao\s+mês\s+de)\s+|mês\s+de\s+|mes\s+de\s+)([a-zA-ZçÇáéíóúâêôãõ]+(?:\s+de\s+\d{4})?)/i
  );
  if (mesExtensoMatch && mesExtensoMatch[1]) {
    return mesExtensoMatch[1].trim();
  }

  // 2. Procura meses por extenso (janeiro a dezembro) com ano opcional
  const mesesRegex =
    /\b(janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)(?:\s+de\s+\d{4})?\b/i;
  const namedMatch = rawClean.match(mesesRegex);
  if (namedMatch && namedMatch[0]) {
    return namedMatch[0].trim();
  }

  // 3. Procura formato de competência MM/AAAA ou MM/AA
  const compMatch = rawClean.match(/\b(0?[1-9]|1[0-2])\/(20\d{2}|\d{2})\b/);
  if (compMatch && compMatch[0]) {
    return compMatch[0].trim();
  }

  // 4. Fallback: mês atual por extenso em português
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      month: "long",
      timeZone: "America/Sao_Paulo",
    }).format(new Date());
  } catch {
    return "mês vigente";
  }
}

/**
 * Constrói texto humanizado, personalizado e com dados completos para SMS de contingência.
 */
export function buildSmsFallbackMessage(input: BuildSmsFallbackInput | string, legacyMsg?: string | null): string {
  const opts: BuildSmsFallbackInput =
    typeof input === "string"
      ? { tipo: input, originalMessage: legacyMsg }
      : input;

  const t = String(opts.tipo || "").toLowerCase();
  const raw = String(opts.originalMessage || "");
  const nome = opts.nomeMembro ? opts.nomeMembro.trim() : "";
  const saudacao = nome ? `Olá, ${nome}! ` : "";
  const terreiro = opts.nomeTerreiro ? ` no ${opts.nomeTerreiro.trim()}` : "";

  // 1. AVISO DE GIRA / EVENTO
  if (t.includes("gira") || t.includes("evento")) {
    const { titulo, dataHora } = parseGiraDetails(raw);
    return `${saudacao}Gira / Evento${terreiro}: ${titulo}${dataHora}. Confirme sua presença: https://axecloud.com.br/entrar`;
  }

  // 2. CADASTRO / DADOS DE ACESSO DO MÉDIUM
  if (t === "dados_acesso" || t.includes("acesso") || t.includes("cadastro")) {
    const matriculaStr = opts.matricula ? ` ou Registro ${opts.matricula}` : "";
    const emailStr = opts.email?.trim()
      ? `seu e-mail (${opts.email.trim()}), `
      : "seu e-mail, ";
    return `${saudacao}Seu acesso ao AxéCloud${terreiro} está pronto! Login: ${emailStr}celular${matriculaStr}. Senha: 6 primeiros dígitos do seu CPF. Acesse: https://axecloud.com.br/entrar`;
  }

  // 3. MENSALIDADES E COBRANÇAS
  if (t.includes("mensalidade") || t.includes("cobranca") || t.includes("financeiro")) {
    const valorMatch = raw.match(/R\$\s*[\d.,]+/i);
    const valorStr = valorMatch
      ? ` (${valorMatch[0]})`
      : opts.valor
      ? ` (R$ ${opts.valor})`
      : "";
    const mes = extractMesReferencia(raw, opts.mesAno);
    const mesStr = mes ? ` de ${mes}` : "";
    return `${saudacao}Sua contribuição mensal${mesStr}${valorStr}${terreiro} consta pendente. Acesse o portal para ver detalhes e pagar via Pix: https://axecloud.com.br/entrar`;
  }

  // 4. MURAL / COMUNICADO
  if (t.includes("transmissao") || t.includes("mural")) {
    const avisoMatch = raw.match(/\*([^*]+)\*/);
    const tituloAviso = avisoMatch ? avisoMatch[1].trim() : "Novo comunicado importante";
    return `${saudacao}Comunicado do terreiro${terreiro}: ${tituloAviso}. Acesse o mural: https://axecloud.com.br/entrar`;
  }

  // Se não for um dos 4 tipos com template homologado, NÃO envia nada genérico
  return "";
}

/**
 * Dispara automaticamente um SMS de contingência via Comtele quando o WhatsApp falha.
 * Registra o envio no Supabase para auditoria e controle.
 */
export async function triggerSmsFallbackForFailedDelivery(
  sb: SupabaseClient,
  opts: {
    logId?: string;
    phone: string;
    tipo: string;
    mensagemOriginal?: string | null;
    metaError?: string | null;
    tenantId?: string | null;
    filhoId?: string | null;
    nomeMembro?: string | null;
    nomeTerreiro?: string | null;
  }
): Promise<{ sent: boolean; requestId?: string; reason?: string }> {
  if (!isComteleConfigured()) {
    return { sent: false, reason: "Comtele nao configurada" };
  }

  if (!isEligibleSmsTipo(opts.tipo)) {
    return {
      sent: false,
      reason: `Tipo "${opts.tipo}" não possui template de SMS homologado — envio ignorado.`,
    };
  }

  const phone = normalizeSmsPhone(opts.phone);
  if (!isValidMobileSmsPhone(phone)) {
    return {
      sent: false,
      reason: `Número ${opts.phone} inválido para SMS (precisa ser celular BR com DDD + 9 dígitos, ex: 5511999999999).`,
    };
  }

  const original = String(opts.mensagemOriginal || "");
  if (original.includes("[sms:comtele")) {
    return { sent: false, reason: "SMS de contingencia ja enviado anteriormente" };
  }

  // Busca dados completos do membro e do terreiro para personalizar o SMS
  let nomeMembro = opts.nomeMembro ? opts.nomeMembro.trim().split(" ")[0] : "";
  let matricula = "";
  let email = "";
  let nomeTerreiro = opts.nomeTerreiro ? opts.nomeTerreiro.trim() : "";

  if (opts.filhoId && (!nomeMembro || !matricula || !email)) {
    try {
      const { data: filho } = await sb
        .from("filhos_de_santo")
        .select("id, nome, email, data_entrada, tenant_id")
        .eq("id", opts.filhoId)
        .maybeSingle();

      if (filho) {
        if (!nomeMembro) nomeMembro = String(filho.nome || "").trim().split(" ")[0]; // Primeiro nome (ex.: "Janiel", "Gisele")
        matricula = formatFilhoMatricula(String(filho.id), filho.data_entrada);
        if (!email) email = filho.email ? String(filho.email).trim() : "";
      }
    } catch {
      /* fallback se não conseguir consultar */
    }
  }

  const tid = opts.tenantId;
  if (tid && !nomeTerreiro) {
    try {
      const { data: lider } = await sb
        .from("perfil_lider")
        .select("nome_terreiro")
        .or(`id.eq.${tid},tenant_id.eq.${tid}`)
        .maybeSingle();

      if (lider?.nome_terreiro) {
        nomeTerreiro = String(lider.nome_terreiro).trim();
      }
    } catch {
      /* fallback se não conseguir consultar */
    }
  }

  const smsText = buildSmsFallbackMessage({
    tipo: opts.tipo,
    originalMessage: original,
    nomeMembro,
    nomeTerreiro,
    matricula,
    email,
    telefone: phone,
  });

  if (!smsText || !smsText.trim()) {
    return {
      sent: false,
      reason: `Nenhum template de SMS homologado para o tipo "${opts.tipo}" — disparo cancelado.`,
    };
  }

  const result = await sendComteleSms({
    phone,
    message: smsText,
    tag: "fallback_meta",
    custom: opts.logId || opts.tipo,
  });

  if (!result.success) {
    console.warn(`[SMS CONTINGENCY] Falha no disparo de SMS para ${phone}: ${result.error}`);
    return { sent: false, reason: result.error };
  }

  const requestId = result.requestId || `sms_${Date.now()}`;
  console.log(`[SMS CONTINGENCY] SMS entregue à Comtele para ${phone} (reqId=${requestId})`);

  // Registra no whatsapp_logs como sms_contingencia
  try {
    await sb.from("whatsapp_logs").insert({
      tenant_id: opts.tenantId || null,
      filho_id: opts.filhoId || null,
      tipo: "sms_contingencia",
      telefone: phone,
      mensagem: `${smsText}\n\n[origem:${opts.tipo}] [meta_erro:${opts.metaError || "falha"}]`,
      status: "delivered",
      external_id: requestId,
    });

    if (opts.logId) {
      const marker = `[sms:comtele ${requestId}]`;
      const updatedMsg = original ? `${original}\n\n${marker}` : marker;
      await sb.from("whatsapp_logs").update({ mensagem: updatedMsg }).eq("id", opts.logId);
    }
  } catch (dbErr) {
    console.warn("[SMS CONTINGENCY] Erro ao registrar log de SMS no Supabase:", dbErr);
  }

  return { sent: true, requestId };
}
