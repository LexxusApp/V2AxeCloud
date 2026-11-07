/**
 * Avisa o zelador no WhatsApp quando uma mensagem importante enviada a um médium da casa
 * falha na Meta (ex.: #131026 número sem WhatsApp ou #131049 bloqueio de engajamento da Meta),
 * fornecendo o nome do médium, motivo amigável e ações recomendadas (dados manuais para acesso).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { formatFilhoMatricula } from "../../lib/filhoMatricula.js";
import { filhoSenhaFromCpf, isValidFilhoCpfCadastro } from "../../lib/brCpf.js";
import { normalizeBrazilMsisdn } from "./welcomeMessage.js";
import { resolveFilhoLoginPublicUrl } from "./whatsappMetaCloud.js";
import { formatPhoneBr } from "./giraDispatchSummaryWhatsApp.js";

const TIPO_ACESSO = "falha_acesso_membro_zelador";
const TIPO_GERAL = "falha_entrega_membro_zelador";
const DEDUP_MS = Number(process.env.WA_FALHA_ACESSO_ZELADOR_DEDUP_MS || 3 * 60 * 60 * 1000);

function resolveDedupMs(): number {
  if (!Number.isFinite(DEDUP_MS) || DEDUP_MS <= 0) return 3 * 60 * 60 * 1000;
  return Math.min(Math.max(DEDUP_MS, 60_000), 24 * 60 * 60 * 1000);
}

export function humanizeMetaFailureReason(metaError?: string | null): string {
  const err = String(metaError || "").toLowerCase();
  if (err.includes("131026") || err.includes("undeliverable")) {
    return "Número sem WhatsApp ativo ou telefone incorreto (#131026)";
  }
  if (err.includes("131049") || err.includes("ecosystem")) {
    return "Bloqueio temporário pela Meta (#131049 — peça para o médium mandar um 'Oi' para o WhatsApp do AxéCloud)";
  }
  if (err.includes("131047") || err.includes("re-engagement")) {
    return "Janela de conversa de 24h fechada pela Meta (#131047)";
  }
  if (err.includes("131051") || err.includes("unsupported")) {
    return "Tipo de mensagem não suportado pelo aparelho (#131051)";
  }
  if (err.includes("131021") || err.includes("spam")) {
    return "Número temporariamente restrito por denúncia (#131021)";
  }
  return metaError ? `Falha de entrega: ${metaError}` : "Falha na entrega da mensagem pela Meta";
}

export function humanizeTipoMensagem(tipo: string): string {
  const t = String(tipo || "").toLowerCase();
  if (t === "dados_acesso") return "Dados de Acesso";
  if (t === "transmissao_aviso" || t === "mural_aviso" || t === "broadcast") return "Comunicado do Mural";
  if (t.includes("gira")) return "Aviso de Gira";
  if (t.includes("mensalidade") || t.includes("cobranca")) return "Cobrança de Mensalidade";
  if (t.includes("portal")) return "Convite do Portal";
  if (t.includes("reza")) return "Pedido de Reza";
  return "Mensagem do Terreiro";
}

async function resolveZeladorContact(
  sb: SupabaseClient,
  leaderId: string
): Promise<{ nome: string; phone: string } | null> {
  const { data, error } = await sb.auth.admin.getUserById(leaderId);
  if (error) {
    console.warn("[falha-entrega-zelador] auth user:", error.message);
    return null;
  }
  const meta = (data.user?.user_metadata || {}) as Record<string, unknown>;
  const phone = normalizeBrazilMsisdn(String(meta.whatsapp || ""));
  if (!phone) return null;
  const nome =
    String(meta.nome_zelador || meta.name || "Zelador").trim() || "Zelador";
  return { nome, phone };
}

export function buildFalhaAcessoDadosManuais(opts: {
  registro: string;
  senha: string;
  loginUrl: string;
  whatsappCadastro?: string | null;
}): string {
  const parts = [
    `Registro: ${opts.registro}`,
    `Senha (6 digitos do CPF): ${opts.senha}`,
    `Link: ${opts.loginUrl}`,
  ];
  const wa = String(opts.whatsappCadastro || "").replace(/\D/g, "");
  if (wa.length >= 10) {
    parts.push(`WhatsApp cadastro: ${wa}`);
  }
  return parts.join(" · ");
}

async function alreadyNotifiedRecently(
  sb: SupabaseClient,
  tenantId: string,
  filhoIdOrPhone: string,
  tipoEnvio: string
): Promise<boolean> {
  const since = new Date(Date.now() - resolveDedupMs()).toISOString();
  let query = sb
    .from("whatsapp_logs")
    .select("id")
    .eq("tenant_id", tenantId)
    .in("tipo", [TIPO_ACESSO, TIPO_GERAL])
    .in("status", ["sent", "delivered", "read"])
    .gte("created_at", since);

  if (filhoIdOrPhone.includes("-")) {
    query = query.eq("filho_id", filhoIdOrPhone);
  } else {
    query = query.ilike("mensagem", `%${filhoIdOrPhone}%`);
  }

  const { data } = await query.limit(1);
  return Boolean(data?.length);
}

export type FalhaEntregaMembroOpts = {
  tenantId: string;
  filhoId?: string | null;
  telefoneFilho?: string | null;
  tipo: string;
  metaError?: string | null;
  sourceExternalId?: string | null;
  mensagemOriginal?: string | null;
};

/**
 * Dispara aviso ao zelador no WhatsApp quando qualquer mensagem importante a um médium falhar na Meta.
 * Idempotente por filho/telefone em janela de 3h.
 */
export async function notifyZeladorFalhaEntregaMembro(
  sb: SupabaseClient,
  opts: FalhaEntregaMembroOpts
): Promise<{ sent: boolean; reason?: string }> {
  const tenantId = String(opts.tenantId || "").trim();
  const filhoId = opts.filhoId ? String(opts.filhoId).trim() : null;
  const rawPhone = opts.telefoneFilho ? normalizeBrazilMsisdn(String(opts.telefoneFilho)) : "";

  if (!tenantId || (!filhoId && !rawPhone)) {
    return { sent: false, reason: "missing-ids" };
  }

  const dedupKey = filhoId || rawPhone;
  if (await alreadyNotifiedRecently(sb, tenantId, dedupKey, opts.tipo)) {
    return { sent: false, reason: "dedup" };
  }

  // Busca dados do filho de santo
  let filho: any = null;
  if (filhoId) {
    const { data } = await sb
      .from("filhos_de_santo")
      .select("id, nome, cpf, whatsapp_phone, data_entrada, tenant_id, lider_id")
      .eq("id", filhoId)
      .maybeSingle();
    filho = data;
  }
  if (!filho && rawPhone) {
    const cleanDigits = rawPhone.replace(/\D/g, "");
    const last8 = cleanDigits.slice(-8);
    const { data } = await sb
      .from("filhos_de_santo")
      .select("id, nome, cpf, whatsapp_phone, data_entrada, tenant_id, lider_id")
      .or(`tenant_id.eq.${tenantId},lider_id.eq.${tenantId}`)
      .ilike("whatsapp_phone", `%${last8}%`)
      .limit(1);
    if (data && data.length > 0) filho = data[0];
  }

  const contact = await resolveZeladorContact(sb, tenantId);
  if (!contact) {
    return { sent: false, reason: "no-zelador-phone" };
  }

  const filhoPhone = normalizeBrazilMsisdn(
    String(rawPhone || filho?.whatsapp_phone || "")
  );

  // Evita alertar o zelador no próprio número caso seja teste pessoal
  if (filhoPhone && filhoPhone === contact.phone) {
    return { sent: false, reason: "same-phone-as-zelador" };
  }

  const isDadosAcesso = String(opts.tipo || "").toLowerCase() === "dados_acesso";
  const tipoLabel = humanizeTipoMensagem(opts.tipo);
  const motivoAmigavel = humanizeMetaFailureReason(opts.metaError);
  const nomeFilho = String(filho?.nome || "Membro da casa").trim() || "Membro";
  const loginUrl = resolveFilhoLoginPublicUrl();

  const cpfDigits = String(filho?.cpf || "").replace(/\D/g, "");
  const hasValidCpf = isValidFilhoCpfCadastro(cpfDigits);
  const senha = hasValidCpf ? filhoSenhaFromCpf(cpfDigits) || "" : "";
  const registro = filho?.id ? formatFilhoMatricula(String(filho.id), filho.data_entrada) : "";
  const waCadastro = filhoPhone || String(filho?.whatsapp_phone || "");

  const dadosManuaisCurto =
    registro && senha
      ? `Registro: ${registro} · Senha (6 digitos do CPF): ${senha} · Link: ${loginUrl}`
      : `Link de entrada: ${loginUrl}`;

  const { isMetaCloudDirectConfigured, sendMetaCloudTemplate } = await import("./metaCloudSend.js");
  const {
    buildMetaTemplateComponents,
    buildFalhaAcessoMembroZeladorComponents,
    resolveMetaTemplateLanguage,
    resolveFalhaAcessoMembroZeladorTemplateName,
  } = await import("./whatsappMetaCloud.js");

  if (!isMetaCloudDirectConfigured()) {
    return { sent: false, reason: "meta-not-configured" };
  }

  let messageId: string | undefined;

  // Montagem do texto detalhado para entrega via WhatsApp
  const lines: string[] = [
    `Olá, ${contact.nome}! Axé! 🙏`,
    "",
    `⚠️ Aviso de entrega: a mensagem de ${tipoLabel} não pôde ser entregue no WhatsApp de um médium.`,
    "",
    `• Médium: ${nomeFilho}`,
    waCadastro ? `• Telefone: ${formatPhoneBr(waCadastro)}` : null,
    `• Motivo: ${motivoAmigavel}`,
  ];

  if (isDadosAcesso && registro && senha) {
    lines.push("");
    lines.push("🔑 Dados para você passar manualmente ao médium:");
    lines.push(`• Registro: ${registro}`);
    lines.push(`• Senha: ${senha} (6 primeiros dígitos do CPF)`);
    lines.push(`• Link: ${loginUrl}`);
  } else if (motivoAmigavel.includes("131049")) {
    lines.push("");
    lines.push("💡 Como resolver: Peça para o médium mandar um 'Oi' para o WhatsApp oficial do AxéCloud e salvar o número na agenda. Isso libera os envios na hora!");
  } else if (motivoAmigavel.includes("131026")) {
    lines.push("");
    lines.push("💡 Como resolver: Verifique o DDD e o número no cadastro do médium na aba Filhos de Santo.");
  } else {
    lines.push("");
    lines.push("💡 Você pode passar o aviso diretamente a ele na casa ou conferir os dados no painel.");
  }

  const organizedText = lines.filter((l) => l !== null).join("\n");

  // 1. Se for dados_acesso e houver template dedicado aprovado, tenta usá-lo
  if (isDadosAcesso && hasValidCpf && registro && senha) {
    const dedicated = resolveFalhaAcessoMembroZeladorTemplateName();
    const dedicatedOk =
      dedicated &&
      dedicated !== "aviso_geral_axecloud" &&
      !/novo_cadastro|ops_alert|ops_axecloud/i.test(dedicated);

    if (dedicatedOk) {
      try {
        const out = await sendMetaCloudTemplate(
          contact.phone,
          dedicated,
          resolveMetaTemplateLanguage(),
          buildFalhaAcessoMembroZeladorComponents({
            nome_zelador: contact.nome,
            nome_filho: nomeFilho,
            whatsapp_cadastro: waCadastro,
            registro,
            senha,
            dados_manuais: dadosManuaisCurto,
          })
        );
        messageId = out.messageId;
      } catch (err: unknown) {
        console.warn(
          `[falha-entrega-zelador] template dedicado ${dedicated} falhou:`,
          err instanceof Error ? err.message : err
        );
      }
    }
  }

  // 2. Tenta enviar como texto livre organizado (caso haja janela 24h ativa com o zelador)
  if (!messageId) {
    try {
      const { sendMetaCloudText } = await import("./metaCloudSend.js");
      const out = await sendMetaCloudText(contact.phone, organizedText);
      messageId = out.messageId;
      console.log(`[falha-entrega-zelador] enviado via texto livre para ${contact.phone.slice(0, 4)}…`);
    } catch {
      /* fallback para template geral */
    }
  }

  // 3. Fallback garantido: template universal aprovado aviso_geral_axecloud
  if (!messageId) {
    try {
      const packed = isDadosAcesso && registro && senha
        ? `Falha WhatsApp acesso ${nomeFilho}: Registro ${registro} · Senha ${senha} · Link ${loginUrl}. Motivo: ${motivoAmigavel}`
        : `Falha WhatsApp (${tipoLabel}) para ${nomeFilho}: ${motivoAmigavel}. Passe o comunicado diretamente na casa.`;

      const out = await sendMetaCloudTemplate(
        contact.phone,
        "aviso_geral_axecloud",
        resolveMetaTemplateLanguage(),
        buildMetaTemplateComponents(contact.nome, packed)
      );
      messageId = out.messageId;
      console.log(`[falha-entrega-zelador] enviado via aviso_geral_axecloud para ${contact.phone.slice(0, 4)}…`);
    } catch (fallbackErr: unknown) {
      console.warn(
        "[falha-entrega-zelador] fallback aviso_geral falhou:",
        fallbackErr instanceof Error ? fallbackErr.message : fallbackErr
      );
    }
  }

  if (!messageId) {
    return { sent: false, reason: "send-failed" };
  }

  const logTipo = isDadosAcesso ? TIPO_ACESSO : TIPO_GERAL;
  const audit = [
    `Falha entrega ${tipoLabel} → avisar zelador: ${nomeFilho}`,
    filhoPhone ? `Tel ${filhoPhone}` : null,
    `Motivo: ${motivoAmigavel}`,
    opts.sourceExternalId ? `origem ${String(opts.sourceExternalId).slice(0, 30)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  try {
    await sb.from("whatsapp_logs").insert({
      tenant_id: tenantId,
      filho_id: filhoId || null,
      tipo: logTipo,
      telefone: contact.phone,
      mensagem: audit,
      status: "sent",
      external_id: messageId,
    });
  } catch (logErr: unknown) {
    console.warn(
      "[falha-entrega-zelador] log:",
      logErr instanceof Error ? logErr.message : logErr
    );
  }

  return { sent: true };
}

/**
 * Mantido para compatibilidade com chamadas legadas de dados_acesso.
 */
export async function notifyZeladorDadosAcessoFailed(
  sb: SupabaseClient,
  opts: {
    tenantId: string;
    filhoId: string;
    telefoneFilho?: string | null;
    metaError?: string | null;
    sourceExternalId?: string | null;
  }
): Promise<{ sent: boolean; reason?: string }> {
  return notifyZeladorFalhaEntregaMembro(sb, {
    ...opts,
    tipo: "dados_acesso",
  });
}
