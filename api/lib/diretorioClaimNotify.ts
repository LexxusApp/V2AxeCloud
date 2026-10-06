import type { SupabaseClient } from "@supabase/supabase-js";
import { isMetaCloudDirectConfigured, sendMetaCloudTemplate } from "./metaCloudSend.js";
import { normalizeBrazilMsisdn } from "./welcomeMessage.js";
import {
  buildReivindicacaoAprovadaComponents,
  resolveMetaTemplateLanguage,
} from "./whatsappMetaCloud.js";
import { resolveDirectoryClaimTemplateName } from "./directoryClaimMetaTemplates.js";


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
type ClaimNotificationKind = "approval" | "reminder_24h" | "reminder_72h" | "manual_resend";

async function claimTemplateName(linked: boolean, kind: ClaimNotificationKind): Promise<string> {
  if (linked) {
    return String(process.env.WA_META_TEMPLATE_REIVINDICACAO_CONECTADA || "").trim() ||
      CLAIM_CONNECTED_TEMPLATE;
  }
  if (kind === "reminder_24h" || kind === "reminder_72h") {
    return resolveDirectoryClaimTemplateName(kind);
  }
  return resolveDirectoryClaimTemplateName("approval");
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
    requestedBy?: string | null;
    notificationKind?: ClaimNotificationKind;
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
  const notificationKind = input.notificationKind || "approval";
  const tipo = linked ? "reivindicacao_conectada" : "reivindicacao_aprovada";
  const templateName = await claimTemplateName(linked, notificationKind);
  const nome = directoryClaimFirstName(input.requesterName);
  const terreiro = String(input.terreiroNome || "Terreiro").trim() || "Terreiro";
  const approvalComponents = buildReivindicacaoAprovadaComponents(nome, terreiro, claimId);
  const components = linked ? approvalComponents.slice(0, 1) : approvalComponents;

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
        requestedBy: input.requestedBy || null,
        idempotencyKey: notificationKind === "manual_resend"
          ? "directory-claim-manual:" + claimId + ":" + Date.now()
          : "directory-claim-" + notificationKind + ":" + claimId,
        metadata: { terreiroNome: terreiro, linked, notificationKind },
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
