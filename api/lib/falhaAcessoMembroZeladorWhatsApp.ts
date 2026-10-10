/**
 * Avisa o zelador no WhatsApp quando o dados_acesso do filho falha na Meta
 * (ex.: #131026 undeliverable), com registro/senha/link para passar manualmente.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { formatFilhoMatricula } from "../../lib/filhoMatricula.js";
import { filhoSenhaFromCpf, isValidFilhoCpfCadastro } from "../../lib/brCpf.js";
import { normalizeBrazilMsisdn } from "./welcomeMessage.js";
import { resolveFilhoLoginPublicUrl } from "./whatsappMetaCloud.js";

const TIPO = "falha_acesso_membro_zelador";
const DEDUP_MS = Number(process.env.WA_FALHA_ACESSO_ZELADOR_DEDUP_MS || 6 * 60 * 60 * 1000);

function resolveDedupMs(): number {
  if (!Number.isFinite(DEDUP_MS) || DEDUP_MS <= 0) return 6 * 60 * 60 * 1000;
  return Math.min(Math.max(DEDUP_MS, 60_000), 48 * 60 * 60 * 1000);
}

async function resolveZeladorContact(
  sb: SupabaseClient,
  leaderId: string
): Promise<{ nome: string; phone: string } | null> {
  const { data, error } = await sb.auth.admin.getUserById(leaderId);
  if (error) {
    console.warn("[falha-acesso-zelador] auth user:", error.message);
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
  filhoId: string
): Promise<boolean> {
  const since = new Date(Date.now() - resolveDedupMs()).toISOString();
  const { data } = await sb
    .from("whatsapp_logs")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("filho_id", filhoId)
    .eq("tipo", TIPO)
    .in("status", ["sent", "delivered", "read"])
    .gte("created_at", since)
    .limit(1);
  return Boolean(data?.length);
}

/**
 * Dispara aviso ao zelador após falha de entrega de dados_acesso.
 * Idempotente por filho (janela WA_FALHA_ACESSO_ZELADOR_DEDUP_MS, default 6h).
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
  const tenantId = String(opts.tenantId || "").trim();
  const filhoId = String(opts.filhoId || "").trim();
  if (!tenantId || !filhoId) {
    return { sent: false, reason: "missing-ids" };
  }

  if (await alreadyNotifiedRecently(sb, tenantId, filhoId)) {
    return { sent: false, reason: "dedup" };
  }

  const { data: filho, error: filhoErr } = await sb
    .from("filhos_de_santo")
    .select("id, nome, cpf, whatsapp_phone, data_entrada, tenant_id, lider_id")
    .eq("id", filhoId)
    .maybeSingle();

  if (filhoErr) {
    console.warn("[falha-acesso-zelador] filho:", filhoErr.message);
    return { sent: false, reason: "filho-query" };
  }
  if (!filho) {
    return { sent: false, reason: "filho-not-found" };
  }

  const contact = await resolveZeladorContact(sb, tenantId);
  if (!contact) {
    return { sent: false, reason: "no-zelador-phone" };
  }

  const filhoPhone = normalizeBrazilMsisdn(
    String(opts.telefoneFilho || filho.whatsapp_phone || "")
  );
  if (filhoPhone && filhoPhone === contact.phone) {
    return { sent: false, reason: "same-phone-as-zelador" };
  }

  const cpfDigits = String(filho.cpf || "").replace(/\D/g, "");
  if (!isValidFilhoCpfCadastro(cpfDigits)) {
    return { sent: false, reason: "invalid-cpf" };
  }
  const senha = filhoSenhaFromCpf(cpfDigits) || "";
  if (!senha) {
    return { sent: false, reason: "no-senha" };
  }

  const registro = formatFilhoMatricula(String(filho.id), filho.data_entrada);
  const loginUrl = resolveFilhoLoginPublicUrl();
  const waCadastro = filhoPhone || String(filho.whatsapp_phone || "");
  const dadosManuaisCurto =
    `Registro: ${registro} · Senha (6 digitos do CPF): ${senha} · Link: ${loginUrl}`;
  const dados = buildFalhaAcessoDadosManuais({
    registro,
    senha,
    loginUrl,
    whatsappCadastro: waCadastro,
  });
  const nomeFilho = String(filho.nome || "Membro").trim() || "Membro";

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

  const dedicated = resolveFalhaAcessoMembroZeladorTemplateName();
  // Nunca usar template de ops/novo terreiro aqui — copy errada para o zelador.
  if (/novo_cadastro|ops_alert|ops_axecloud/i.test(dedicated)) {
    console.error(
      `[falha-acesso-zelador] template inválido bloqueado: ${dedicated} (use conta_membro_aviso_zelador_axc)`
    );
  }
  const legacy = "aviso_geral_axecloud";
  let messageId: string | undefined;

  const organizedText = [
    `Ola, ${contact.nome}!`,
    "",
    "Nao foi possivel entregar o WhatsApp de acesso ao membro.",
    "",
    `Membro: ${nomeFilho}`,
    waCadastro ? `WhatsApp cadastro: ${String(waCadastro).replace(/\D/g, "")}` : null,
    `Registro: ${registro}`,
    `Senha (6 digitos do CPF): ${senha}`,
    "",
    "Passe esses dados manualmente para ele.",
    `Link: ${loginUrl}`,
  ]
    .filter((line) => line !== null)
    .join("\n");

  const dedicatedOk =
    dedicated &&
    dedicated !== legacy &&
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
        `[falha-acesso-zelador] template ${dedicated} falhou:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  // Preferir texto livre organizado (quebras de linha) quando houver janela 24h.
  if (!messageId) {
    try {
      const { sendMetaCloudText } = await import("./metaCloudSend.js");
      const out = await sendMetaCloudText(contact.phone, organizedText);
      messageId = out.messageId;
      console.log("[falha-acesso-zelador] enviado via texto livre organizado");
    } catch (textErr: unknown) {
      console.warn(
        "[falha-acesso-zelador] texto livre falhou:",
        textErr instanceof Error ? textErr.message : textErr
      );
    }
  }

  if (!messageId) {
    try {
      const packed = `Falha WhatsApp acesso ${nomeFilho}: ${dados}`;
      const out = await sendMetaCloudTemplate(
        contact.phone,
        legacy,
        resolveMetaTemplateLanguage(),
        buildMetaTemplateComponents(contact.nome, packed)
      );
      messageId = out.messageId;
    } catch (fallbackErr: unknown) {
      console.warn(
        "[falha-acesso-zelador] fallback aviso_geral falhou:",
        fallbackErr instanceof Error ? fallbackErr.message : fallbackErr
      );
    }
  }

  if (!messageId) {
    return { sent: false, reason: "send-failed" };
  }

  const errHint = String(opts.metaError || "").trim();
  const audit = [
    `Falha entrega acesso → avisar zelador: ${nomeFilho}`,
    `Registro ${registro}`,
    errHint ? `Meta: ${errHint}` : null,
    opts.sourceExternalId ? `origem ${String(opts.sourceExternalId).slice(0, 40)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  try {
    await sb.from("whatsapp_logs").insert({
      tenant_id: tenantId,
      filho_id: filhoId,
      tipo: TIPO,
      telefone: contact.phone,
      mensagem: audit,
      status: "sent",
      external_id: messageId,
    });
  } catch (logErr: unknown) {
    console.warn(
      "[falha-acesso-zelador] log:",
      logErr instanceof Error ? logErr.message : logErr
    );
  }

  console.log(
    `[falha-acesso-zelador] enviado → ${contact.phone.slice(0, 4)}… filho=${filhoId.slice(0, 8)}`
  );
  return { sent: true };
}
