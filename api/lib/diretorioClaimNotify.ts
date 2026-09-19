import type { SupabaseClient } from "@supabase/supabase-js";
import type { MetaTemplateComponent } from "../../src/services/evolution.service.js";
import { isMetaCloudDirectConfigured, sendMetaCloudTemplate } from "./metaCloudSend.js";
import { normalizeBrazilMsisdn } from "./welcomeMessage.js";
import { resolveMetaTemplateLanguage } from "./whatsappMetaCloud.js";


export type DiretorioClaimNotifyResult = {
  sent: boolean;
  channel?: "whatsapp";
  template?: string;
  phoneMasked?: string;
  registerUrl?: string;
  deliveryId?: string;
  reason?: "no_phone" | "meta_unconfigured" | "send_failed" | "missing_claim";
  error?: string;
};

const PUBLIC_SITE = "https://axecloud.com.br";
const CLAIM_APPROVED_TEMPLATE = "reivindicacao_aprovada_axecloud";
const CLAIM_CONNECTED_TEMPLATE = "reivindicacao_conectada_axecloud";

function claimTemplateName(linked: boolean): string {
  return linked
    ? String(process.env.WA_META_TEMPLATE_REIVINDICACAO_CONECTADA || "").trim() ||
        CLAIM_CONNECTED_TEMPLATE
    : String(process.env.WA_META_TEMPLATE_REIVINDICACAO_APROVADA || "").trim() ||
        CLAIM_APPROVED_TEMPLATE;
}

function textParam(value: string, max: number): { type: "text"; text: string } {
  return { type: "text", text: String(value || "").trim().slice(0, max) || "-" };
}

function claimComponents(
  linked: boolean,
  name: string,
  terreiro: string,
  claimId: string,
): MetaTemplateComponent[] {
  const body: MetaTemplateComponent = {
    type: "body",
    parameters: [textParam(name || "Zelador", 60), textParam(terreiro || "Terreiro", 80)],
  };
  if (linked) return [body];
  return [
    body,
    {
      type: "button",
      sub_type: "url",
      index: "0",
      parameters: [textParam(claimId, 80)],
    },
  ];
}

export function directoryClaimRegisterUrl(claimId: string): string {
  const id = String(claimId || "").trim();
  return `${PUBLIC_SITE}/register?claim=${encodeURIComponent(id)}`;
}

export function directoryClaimFirstName(fullName: string): string {
  const first = String(fullName || "")
    .trim()
    .split(/\s+/)
    .find(Boolean);
  if (!first) return "Zelador";
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

function maskPhone(digits: string): string {
  const d = digits.replace(/\D/g, "");
  if (d.length < 8) return d;
  return `+${d.slice(0, 2)} ${d.slice(2, -4).replace(/\d/g, "•")}${d.slice(-4)}`;
}

export async function notifyApprovedTerreiroClaim(
  sb: SupabaseClient,
  input: {
    claimId: string;
    requesterName: string;
    requesterPhone: string | null | undefined;
    terreiroNome: string;
    linkedTenantId: string | null;
  },
): Promise<DiretorioClaimNotifyResult> {
  const claimId = String(input.claimId || "").trim();
  if (!claimId) return { sent: false, reason: "missing_claim" };

  const msisdn = normalizeBrazilMsisdn(String(input.requesterPhone || ""));
  if (!msisdn) return { sent: false, reason: "no_phone" };

  if (!isMetaCloudDirectConfigured()) {
    return { sent: false, reason: "meta_unconfigured", phoneMasked: maskPhone(msisdn) };
  }

  const linked = Boolean(input.linkedTenantId);
  const tipo = linked ? "reivindicacao_conectada" : "reivindicacao_aprovada";
  const templateName = claimTemplateName(linked);
  const nome = directoryClaimFirstName(input.requesterName);
  const terreiro = String(input.terreiroNome || "Terreiro").trim() || "Terreiro";
  const components = claimComponents(linked, nome, terreiro, claimId);

  const registerUrl = linked ? `${PUBLIC_SITE}/entrar` : directoryClaimRegisterUrl(claimId);

  try {
    const out = await sendMetaCloudTemplate(
      msisdn,
      templateName,
      resolveMetaTemplateLanguage(),
      components,
      {
        tenantId: input.linkedTenantId,
        recipientName: input.requesterName,
        source: "directory_claim",
        sourceId: claimId,
        idempotencyKey: "directory-claim-approved:" + claimId,
        metadata: { terreiroNome: terreiro, linked },
      },
    );
    const externalId = out.messageId || `claim_${Date.now()}_${claimId.slice(0, 8)}`;
    if (input.linkedTenantId) {
      try {
        await sb.from("whatsapp_logs").insert({
          tenant_id: input.linkedTenantId,
          filho_id: null,
          tipo,
          telefone: msisdn,
          mensagem: linked
            ? `Reivindicação conectada: ${nome} · ${terreiro}`
            : `Reivindicação aprovada: ${nome} · ${terreiro} · ${registerUrl}`,
          status: "sent",
          external_id: externalId,
        });
      } catch (logError) {
        console.warn(
          "[diretorio-claim/notify] log:",
          logError instanceof Error ? logError.message : logError,
        );
      }
    }
    return {
      sent: true,
      channel: "whatsapp",
      template: templateName,
      phoneMasked: maskPhone(msisdn),
      registerUrl,
      deliveryId: out.deliveryId,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[diretorio-claim/notify]", message);
    return {
      sent: false,
      reason: "send_failed",
      error: message.slice(0, 280),
      phoneMasked: maskPhone(msisdn),
      registerUrl,
      template: templateName,
    };
  }
}
