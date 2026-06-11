import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createInstanceWithQrCode,
  createInstanceWithPairingCode,
  evolutionInstanceName,
  getAxeEvolutionStatusAndQr,
  logoutEvolutionInstance,
  sendEvolutionTextMessage,
  WHATSAPP_INITIALIZING_MESSAGE_PT,
} from "../../src/services/evolution.service.js";
import { normalizeWhatsAppTemplates } from "../../src/constants/whatsappTemplates.js";
import { sendWhatsAppForTenant } from "./whatsappSendCore.js";
import { getDiscreteSupabaseAdmin, sendJson } from "./discreteSupabase.js";
import { getBearerToken } from "./requireAuth.js";
import { verifyUser } from "./verifyUser.js";
import { verifyWhatsAppWebhook } from "./secureRoutes.js";
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

    const defaultPreferences = () => ({
      notifGiras: true,
      notifFinanceiro: true,
      notifReza: true,
      notifAniversarios: true,
    });

    if (act === "config" && method === "GET") {
      const { data, error } = await sb
        .from("whatsapp_config")
        .select("templates, metadata, phone_number")
        .eq("tenant_id", user.id)
        .maybeSingle();
      if (error) {
        const msg = String(error.message || "");
        const code = String((error as { code?: string }).code || "");
        if (code === "PGRST205" || code === "42P01" || /schema cache|whatsapp_config/i.test(msg)) {
          return sendJson(res, 200, {
            success: true,
            templates: normalizeWhatsAppTemplates(null),
            preferences: defaultPreferences(),
            phoneNumber: null,
            warning: "WHATSAPP_TABLE_NOT_READY",
          });
        }
        throw error;
      }
      const meta = (data?.metadata && typeof data.metadata === "object" ? data.metadata : {}) as Record<string, unknown>;
      const prefs = (meta.preferences && typeof meta.preferences === "object" ? meta.preferences : {}) as Record<string, boolean>;
      return sendJson(res, 200, {
        success: true,
        templates: normalizeWhatsAppTemplates(data?.templates),
        preferences: { ...defaultPreferences(), ...prefs },
        phoneNumber: data?.phone_number || null,
      });
    }

    if (act === "config" && method === "POST") {
      const config = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
      const safeTemplates = normalizeWhatsAppTemplates(config?.templates);
      const { data: existing } = await sb
        .from("whatsapp_config")
        .select("metadata")
        .eq("tenant_id", user.id)
        .maybeSingle();
      const prevMeta = (existing?.metadata && typeof existing.metadata === "object" ? existing.metadata : {}) as Record<string, unknown>;
      const nextMeta = { ...prevMeta };
      if (config?.preferences && typeof config.preferences === "object") {
        nextMeta.preferences = { ...defaultPreferences(), ...config.preferences };
      }
      const { error } = await sb.from("whatsapp_config").upsert({
        instance_name: config?.instance_name,
        evolution_api_url: config?.evolution_api_url,
        templates: safeTemplates,
        metadata: nextMeta,
        id: user.id,
        tenant_id: user.id,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      return sendJson(res, 200, { success: true });
    }

    if (act === "logs" && method === "GET") {
      const { data, error } = await sb
        .from("whatsapp_logs")
        .select("id, telefone, mensagem, tipo, status, created_at")
        .eq("tenant_id", user.id)
        .order("created_at", { ascending: false })
        .limit(40);
      if (error) throw error;
      return sendJson(res, 200, { success: true, logs: data || [] });
    }

    if (act === "broadcast" && method === "POST") {
      const rl = consumeRateLimit(req, { windowMs: 60 * 60 * 1000, max: 10, keyPrefix: "wa-broadcast" });
      if (!rl.allowed) {
        return sendJson(res, 429, { error: "Limite de transmissões excedido. Tente mais tarde." });
      }
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
      const message = String(body.message || "").trim();
      if (!message) return sendJson(res, 400, { error: "Mensagem obrigatória." });

      const access = await sb.from("perfil_lider").select("tenant_id").eq("id", user.id).maybeSingle();
      const tenantScope = String(access.data?.tenant_id || user.id);

      const { data: filhos, error: filhosErr } = await sb
        .from("filhos_de_santo")
        .select("id, nome, whatsapp_phone")
        .or(`tenant_id.eq.${tenantScope},lider_id.eq.${user.id}`)
        .not("whatsapp_phone", "is", null);
      if (filhosErr) throw filhosErr;

      const targets = (filhos || []).filter((f) => String(f.whatsapp_phone || "").replace(/\D/g, "").length >= 10);
      if (!targets.length) {
        return sendJson(res, 400, { error: "Nenhum filho de santo com WhatsApp cadastrado." });
      }

      let sent = 0;
      let failed = 0;
      for (const filho of targets) {
        try {
          let phoneDigits = String(filho.whatsapp_phone).replace(/\D/g, "");
          if (!phoneDigits.startsWith("55")) phoneDigits = `55${phoneDigits}`;
          await sendEvolutionTextMessage(user.id, phoneDigits, message);
          sent += 1;
        } catch {
          failed += 1;
        }
      }

      if (sent > 0) {
        await sb.from("whatsapp_logs").insert({
          tenant_id: user.id,
          tipo: "teste",
          telefone: "corrente_geral",
          mensagem: message,
          status: failed > 0 ? "partial" : "sent",
          external_id: `broadcast_${Date.now()}`,
        });
      }

      return sendJson(res, 200, {
        success: true,
        sent,
        failed,
        total: targets.length,
        destino: `Corrente Geral (${targets.length} médiuns)`,
      });
    }

    if (act === "send" && method === "POST") {
      const rl = consumeRateLimit(req, { windowMs: 60 * 60 * 1000, max: 40, keyPrefix: "wa-send" });
      if (!rl.allowed) {
        return sendJson(res, 429, { error: "Limite de envios WhatsApp excedido. Tente mais tarde." });
      }
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
      const { tipo, filhoId, variables, forcePhone } = body;
      try {
        const result = await sendWhatsAppForTenant(sb, {
          tenantId: user.id,
          tipo: String(tipo || ""),
          filhoId,
          forcePhone,
          variables,
        });
        return sendJson(res, 200, { success: true, message: "Mensagem enviada com sucesso", externalId: result.externalId });
      } catch (err: unknown) {
        const e = err as { statusCode?: number; message?: string };
        const status = e.statusCode === 403 ? 403 : e.statusCode === 400 ? 400 : 500;
        return sendJson(res, status, { error: e.message || "Erro ao enviar mensagem" });
      }
    }

    if ((act === "start" || act === "connect") && method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
      const merged = await getAxeEvolutionStatusAndQr(user.id);
      if (merged.status === "CONNECTED") {
        return sendJson(res, 200, { message: "WhatsApp já está conectado." });
      }
      const phone = String(body.phone || body.number || "").trim();
      const mode = String(body.mode || "").trim().toLowerCase();
      if (phone && mode !== "qrcode") {
        const out = await createInstanceWithPairingCode(evolutionInstanceName(user.id), phone);
        return sendJson(res, 200, {
          message: "Use o código ou escaneie o QR no WhatsApp em até 60 segundos.",
          pairingCode: out.pairingCode,
          qrcode: out.qrcode,
          mode: "pairing",
        });
      }
      const qrcode = await createInstanceWithQrCode(user.id);
      return sendJson(res, 200, { message: "Escaneie o QR Code no WhatsApp.", qrcode, mode: "qrcode" });
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
