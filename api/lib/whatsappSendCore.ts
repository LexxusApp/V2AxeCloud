import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEvolutionTextMessage } from "../../src/services/evolution.service.js";
import { resolveWhatsAppTemplate } from "../../src/constants/whatsappTemplates.js";
import { assertZeladorTenantAccess } from "./tenantAccess.js";

export type WhatsAppSendInput = {
  tenantId: string;
  tipo: string;
  filhoId?: string | null;
  forcePhone?: string | null;
  variables?: Record<string, string | number>;
};

function normalizeBrPhone(raw: string): string {
  let digits = String(raw).replace(/\D/g, "");
  if (!digits.startsWith("55")) digits = `55${digits}`;
  return digits;
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

export async function resolveWhatsAppDestinationPhone(
  sb: SupabaseClient,
  userId: string,
  input: Pick<WhatsAppSendInput, "filhoId" | "forcePhone">
): Promise<string | null> {
  let phone = input.forcePhone ? String(input.forcePhone).trim() : undefined;
  if (!phone && input.filhoId) {
    const { data: filho } = await sb
      .from("filhos_de_santo")
      .select("whatsapp_phone, tenant_id, lider_id")
      .eq("id", input.filhoId)
      .single();
    const tenantRef = String(filho?.tenant_id || filho?.lider_id || userId);
    const ok = filho && (await assertZeladorTenantAccess(sb, userId, tenantRef));
    if (!ok) {
      const err = new Error("Filho não pertence ao seu terreiro") as Error & { statusCode?: number };
      err.statusCode = 403;
      throw err;
    }
    phone = filho?.whatsapp_phone;
  }
  if (!phone) return null;
  return normalizeBrPhone(phone);
}

export async function logAndSendWhatsApp(
  sb: SupabaseClient,
  input: WhatsAppSendInput & { phone: string; message: string }
): Promise<{ messageId?: string; externalId: string }> {
  const { tenantId, filhoId, tipo, phone, message } = input;
  const { messageId } = await sendEvolutionTextMessage(tenantId, phone, message);
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
  const phone = await resolveWhatsAppDestinationPhone(sb, input.tenantId, input);
  if (!phone) {
    const err = new Error("Telefone não encontrado") as Error & { statusCode?: number };
    err.statusCode = 400;
    throw err;
  }
  const { data: config } = await sb
    .from("whatsapp_config")
    .select("templates")
    .eq("tenant_id", input.tenantId)
    .maybeSingle();
  const message = buildWhatsAppMessage(config?.templates, input.tipo, input.variables);
  const { externalId } = await logAndSendWhatsApp(sb, { ...input, phone, message });
  return { success: true, externalId };
}
