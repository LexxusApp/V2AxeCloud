import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createAxeInstance,
  createInstanceWithPairingCode,
  evolutionInstanceName,
  getAxeEvolutionStatusAndQr,
  logoutEvolutionInstance,
  sendEvolutionTextMessage,
  WHATSAPP_INITIALIZING_MESSAGE_PT,
} from "../../src/services/evolution.service.js";
import {
  normalizeWhatsAppTemplates,
  resolveWhatsAppTemplate,
} from "../../src/constants/whatsappTemplates.js";
import { getDiscreteSupabaseAdmin, sendJson } from "./discreteSupabase.js";
import { getBearerToken } from "./requireAuth.js";
import { verifyUser } from "./verifyUser.js";
import { verifyWhatsAppWebhook } from "./secureRoutes.js";
import { assertZeladorTenantAccess } from "./tenantAccess.js";
import { consumeRateLimit } from "./rateLimit.js";

function whatsappInitializingResponse(res: any, err?: unknown) {
  const msg =
    err && typeof err === "object" && "message" in err && String((err as { message?: string }).message)
      ? String((err as { message: string }).message)
      : WHATSAPP_INITIALIZING_MESSAGE_PT;
  return sendJson(res, 503, { error: msg, code: "WHATSAPP_INITIALIZING" });
}

async function requireAuthUser(
  sb: SupabaseClient,
  req: any,
  res: any
): Promise<{ id: string; email?: string | null } | null> {
  const token = getBearerToken(req);
  if (!token) {
    sendJson(res, 401, { error: "Unauthorized" });
    return null;
  }
  const { user, error: authError } = await verifyUser(sb, token);
  if (authError || !user) {
    sendJson(res, 401, { error: "Unauthorized" });
    return null;
  }
  return user;
}

export async function handleWhatsappRoute(action: string, req: any, res: any): Promise<void> {
  const sb = getDiscreteSupabaseAdmin();
  if (!sb) {
    sendJson(res, 503, { error: "Supabase não configurado na função da Vercel." });
    return;
  }

  const act = action.toLowerCase().trim();
  const method = String(req.method || "GET").toUpperCase();

  try {
    if (act === "webhook" && method === "POST") {
      if (!verifyWhatsAppWebhook(req)) {
        return sendJson(res, 401, { error: "Webhook não autorizado" });
      }
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
      const { data } = body;
      const externalId = data?.key?.id;
      const status = data?.status;
      if (externalId) {
        let mappedStatus = "sent";
        if (status === "DELIVERY_ACK") mappedStatus = "delivered";
        if (status === "READ") mappedStatus = "read";
        await sb.from("whatsapp_logs").update({ status: mappedStatus }).eq("external_id", externalId);
      }
      res.status(200).send("OK");
      return;
    }

    const user = await requireAuthUser(sb, req, res);
    if (!user) return;

    if (act === "config" && method === "GET") {
      const { data, error } = await sb
        .from("whatsapp_config")
        .select("templates")
        .eq("tenant_id", user.id)
        .maybeSingle();
      if (error) {
        const msg = String(error.message || "");
        const code = String((error as { code?: string }).code || "");
        if (code === "PGRST205" || code === "42P01" || /schema cache|whatsapp_config/i.test(msg)) {
          return sendJson(res, 200, {
            success: true,
            templates: normalizeWhatsAppTemplates(null),
            warning: "WHATSAPP_TABLE_NOT_READY",
          });
        }
        throw error;
      }
      return sendJson(res, 200, { success: true, templates: normalizeWhatsAppTemplates(data?.templates) });
    }

    if (act === "config" && method === "POST") {
      const config = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
      const safeTemplates = normalizeWhatsAppTemplates(config?.templates);
      const { error } = await sb.from("whatsapp_config").upsert({
        instance_name: config?.instance_name,
        evolution_api_url: config?.evolution_api_url,
        templates: safeTemplates,
        id: user.id,
        tenant_id: user.id,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      return sendJson(res, 200, { success: true });
    }

    if (act === "send" && method === "POST") {
      const rl = consumeRateLimit(req, { windowMs: 60 * 60 * 1000, max: 40, keyPrefix: "wa-send" });
      if (!rl.allowed) {
        return sendJson(res, 429, { error: "Limite de envios WhatsApp excedido. Tente mais tarde." });
      }
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
      const { tipo, filhoId, variables } = body;
      const { data: config } = await sb.from("whatsapp_config").select("*").eq("tenant_id", user.id).single();
      let phone: string | undefined;
      if (filhoId) {
        const { data: filho } = await sb
          .from("filhos_de_santo")
          .select("whatsapp_phone, tenant_id, lider_id")
          .eq("id", filhoId)
          .single();
        const ok = filho && (await assertZeladorTenantAccess(sb, user.id, String(filho.tenant_id || filho.lider_id || user.id)));
        if (!ok) return sendJson(res, 403, { error: "Filho não pertence ao seu terreiro" });
        phone = filho?.whatsapp_phone;
      }
      if (!phone) return sendJson(res, 400, { error: "Telefone não encontrado" });
      phone = String(phone).replace(/\D/g, "");
      if (!phone.startsWith("55")) phone = `55${phone}`;

      let message = resolveWhatsAppTemplate(config?.templates, String(tipo || ""));
      Object.entries(variables || {}).forEach(([key, value]) => {
        message = message.replace(new RegExp(`{{${key}}}`, "g"), String(value));
      });
      if (message.includes("nota sigilosa") || message.includes("segredo")) {
        message = "Você tem uma nova atualização sigilosa no seu prontuário. Acesse o AxéCloud para conferir.";
      }

      const tenantId = user.id;
      const phoneFinal = phone;
      const messageFinal = message;
      setTimeout(async () => {
        try {
          const { messageId } = await sendEvolutionTextMessage(tenantId, phoneFinal, messageFinal);
          const externalId = messageId || `msg_${Math.random().toString(36).substr(2, 9)}`;
          await sb.from("whatsapp_logs").insert({
            tenant_id: tenantId,
            filho_id: filhoId,
            tipo,
            telefone: phoneFinal,
            mensagem: messageFinal,
            status: "sent",
            external_id: externalId,
          });
        } catch (err: unknown) {
          console.error(`[WHATSAPP - ${tenantId}] Evolution send Error:`, err);
        }
      }, 500);
      return sendJson(res, 200, { success: true, message: "Mensagem enfileirada para envio" });
    }

    if ((act === "start" || act === "connect") && method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
      const merged = await getAxeEvolutionStatusAndQr(user.id);
      if (merged.status === "CONNECTED") {
        return sendJson(res, 200, { message: "WhatsApp já está conectado." });
      }
      const phone = String(body.phone || body.number || "").trim();
      if (phone) {
        const out = await createInstanceWithPairingCode(evolutionInstanceName(user.id), phone);
        return sendJson(res, 200, {
          message: "Use o código no WhatsApp em até 60 segundos.",
          pairingCode: out.pairingCode,
          mode: "pairing",
        });
      }
      const qrcode = await createAxeInstance(user.id);
      return sendJson(res, 200, { message: "Iniciando conexão WhatsApp...", qrcode, mode: "qrcode" });
    }

    if (act === "test-message" && method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
      const { phone } = body;
      if (!phone) return sendJson(res, 400, { error: "Telefone é obrigatório." });
      const msg =
        "Axé! Este é um teste de conexão do AxéCloud. Se você recebeu isso, seu terreiro já está automatizado!";
      let phoneDigits = String(phone).replace(/\D/g, "");
      if (!phoneDigits.startsWith("55")) phoneDigits = `55${phoneDigits}`;
      await sendEvolutionTextMessage(user.id, phoneDigits, msg);
      return sendJson(res, 200, { success: true, message: "Mensagem enviada com sucesso!" });
    }

    if (act === "status" && method === "GET") {
      const merged = await getAxeEvolutionStatusAndQr(user.id);
      return sendJson(res, 200, { status: merged.status, qrcode: merged.qrcode });
    }

    if (act === "logout" && method === "POST") {
      await logoutEvolutionInstance(user.id);
      return sendJson(res, 200, { message: "Sessão WhatsApp encerrada na Evolution API." });
    }

    sendJson(res, 404, { error: "Ação WhatsApp não encontrada", action: act });
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string };
    if (e?.code === "WHATSAPP_INITIALIZING") {
      whatsappInitializingResponse(res, err);
      return;
    }
    if (act === "status") {
      whatsappInitializingResponse(res, new Error(WHATSAPP_INITIALIZING_MESSAGE_PT));
      return;
    }
    console.error(`[whatsapp/${act}]`, e?.message || err);
    sendJson(res, 500, { error: e?.message || "Erro interno" });
  }
}
