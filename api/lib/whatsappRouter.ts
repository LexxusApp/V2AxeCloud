import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getOfficialWhatsAppStatus,
  WHATSAPP_INITIALIZING_MESSAGE_PT,
} from "../../src/services/evolution.service.js";
import { normalizeWhatsAppTemplates } from "../../src/constants/whatsappTemplates.js";
import {
  broadcastWhatsAppForTenant,
  buildWhatsAppMessage,
  logAndSendWhatsApp,
  resolveTerreiroWhatsAppContext,
  resendDadosAcessoWhatsAppForTenant,
  sendWhatsAppForTenant,
} from "./whatsappSendCore.js";
import { getDiscreteSupabaseAdmin, sendJson } from "./discreteSupabase.js";
import { getBearerToken } from "./requireAuth.js";
import { verifyUser } from "./verifyUser.js";
import { verifyWhatsAppWebhook } from "./secureRoutes.js";
import { consumeRateLimit } from "./rateLimit.js";
import { validateWhatsAppOutboundMessage } from "./whatsappSendGuards.js";
import { getEvolutionQueueStats } from "./evolutionSendQueue.js";
import { isWithinAllowedSendWindow } from "./whatsappAntiSpam.js";
import { getPersistentQuotaSnapshot } from "./whatsappPersistentLimits.js";
import { assertZeladorTenantAccess } from "./tenantAccess.js";
import { safeErrorMessage } from "./safeError.js";
import {
  handleMetaWebhookChallenge,
  isMetaCloudWebhookPayload,
  processMetaCloudWebhook,
  verifyMetaWebhookSignature,
} from "./whatsappMetaWebhook.js";
import { rawBodyForSignature } from "./rawBody.js";

function whatsappInitializingResponse(res: any, _err?: unknown) {
  return sendJson(res, 503, { error: WHATSAPP_INITIALIZING_MESSAGE_PT, code: "WHATSAPP_INITIALIZING" });
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
    if (act === "webhook" && method === "GET") {
      const challenge = handleMetaWebhookChallenge((req.query || {}) as Record<string, unknown>);
      if (!challenge.ok || !challenge.challenge) {
        return sendJson(res, challenge.status, { error: "Verify token inválido." });
      }
      res.status(200).send(challenge.challenge);
      return;
    }

    if (act === "webhook" && method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};

      if (isMetaCloudWebhookPayload(body)) {
        const raw = rawBodyForSignature(req, body);
        if (!verifyMetaWebhookSignature(raw, req.headers?.["x-hub-signature-256"])) {
          return sendJson(res, 401, { error: "Assinatura Meta inválida." });
        }
        await processMetaCloudWebhook(sb, body);
        res.status(200).send("OK");
        return;
      }

      if (!verifyWhatsAppWebhook(req)) {
        return sendJson(res, 401, { error: "Webhook não autorizado" });
      }
      const { data } = body;
      const externalId = data?.key?.id;
      const status = data?.status;
      if (externalId) {
        let mappedStatus = "sent";
        if (status === "DELIVERY_ACK") mappedStatus = "delivered";
        if (status === "READ") mappedStatus = "read";
        if (status === "ERROR" || status === "FAILED") mappedStatus = "failed";
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
            channel: "official",
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
        channel: "official",
      });
    }

    if (act === "config" && method === "POST") {
      const zeladorOk = await assertZeladorTenantAccess(sb, user.id, user.id);
      if (!zeladorOk) return sendJson(res, 403, { error: "Acesso negado" });

      const config = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
      const safeTemplates = normalizeWhatsAppTemplates(config?.templates);
      const { data: existing } = await sb
        .from("whatsapp_config")
        .select("metadata")
        .eq("tenant_id", user.id)
        .maybeSingle();
      const prevMeta = (existing?.metadata && typeof existing.metadata === "object" ? existing.metadata : {}) as Record<string, unknown>;
      const nextMeta: Record<string, unknown> = { ...prevMeta, channel: "official" };
      if (config?.preferences && typeof config.preferences === "object") {
        nextMeta.preferences = { ...defaultPreferences(), ...config.preferences };
      }
      const { error } = await sb.from("whatsapp_config").upsert({
        templates: safeTemplates,
        metadata: nextMeta,
        id: user.id,
        tenant_id: user.id,
        status: "CONNECTED",
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      return sendJson(res, 200, { success: true });
    }

    if (act === "logs" && method === "GET") {
      const requestUrl = new URL(req.url || "/api/whatsapp/logs", "http://localhost");
      const requestedLimit = Number(requestUrl.searchParams.get("limit") || 12);
      const logLimit = Number.isFinite(requestedLimit) ? Math.min(Math.max(Math.trunc(requestedLimit), 1), 20) : 12;
      const { data, error } = await sb
        .from("whatsapp_logs")
        .select("id, telefone, mensagem, tipo, status, created_at")
        .eq("tenant_id", user.id)
        .order("created_at", { ascending: false })
        .limit(logLimit);
      if (error) throw error;
      return sendJson(res, 200, { success: true, logs: data || [] });
    }

    if (act === "resend-dados-acesso" && method === "POST") {
      const zeladorOk = await assertZeladorTenantAccess(sb, user.id, user.id);
      if (!zeladorOk) return sendJson(res, 403, { error: "Acesso negado" });

      const rl = consumeRateLimit(req, { windowMs: 60 * 60 * 1000, max: 3, keyPrefix: "wa-resend-dados-acesso" });
      if (!rl.allowed) {
        return sendJson(res, 429, { error: "Limite de reenvio de dados de acesso excedido. Tente mais tarde." });
      }

      try {
        const result = await resendDadosAcessoWhatsAppForTenant(sb, user.id);
        if (!result.total && result.skippedNoPhone > 0 && !result.sent) {
          return sendJson(res, 400, {
            error: "Nenhum filho com WhatsApp e CPF cadastrados para envio de acesso.",
            ...result,
          });
        }
        if (!result.sent && result.failed > 0) {
          return sendJson(res, 502, {
            error: result.lastError || "Não foi possível enviar os dados de acesso.",
            ...result,
          });
        }
        return sendJson(res, 200, {
          success: true,
          message: "Dados de acesso enfileirados com sucesso.",
          ...result,
        });
      } catch (err: unknown) {
        const e = err as { statusCode?: number; message?: string; code?: string };
        if (e.code === "WHATSAPP_INITIALIZING") return whatsappInitializingResponse(res, err);
        const status = e.statusCode === 429 ? 429 : 500;
        return sendJson(res, status, { error: safeErrorMessage(e, "Erro ao reenviar dados de acesso.") });
      }
    }

    if (act === "broadcast" && method === "POST") {
      const zeladorOk = await assertZeladorTenantAccess(sb, user.id, user.id);
      if (!zeladorOk) return sendJson(res, 403, { error: "Acesso negado" });

      const rl = consumeRateLimit(req, { windowMs: 60 * 60 * 1000, max: 4, keyPrefix: "wa-broadcast" });
      if (!rl.allowed) {
        return sendJson(res, 429, { error: "Limite de transmissões excedido. Tente mais tarde." });
      }
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
      let message: string;
      try {
        message = validateWhatsAppOutboundMessage(String(body.message || ""));
      } catch (err: unknown) {
        const e = err as { statusCode?: number; message?: string };
        return sendJson(res, e.statusCode || 400, { error: safeErrorMessage(e, "Mensagem inválida.") });
      }

      const { sent, failed, total, lastError } = await broadcastWhatsAppForTenant(sb, user.id, message);
      if (!total) {
        return sendJson(res, 400, { error: "Nenhum filho de santo com WhatsApp cadastrado." });
      }
      if (!sent) {
        return sendJson(res, 502, {
          error: lastError || "Não foi possível enviar para nenhum destinatário.",
          sent,
          failed,
          total,
        });
      }

      return sendJson(res, 200, {
        success: true,
        sent,
        failed,
        total,
        destino: `Corrente Geral (${total} médiuns)`,
      });
    }

    if (act === "send" && method === "POST") {
      const rl = consumeRateLimit(req, { windowMs: 60 * 60 * 1000, max: 25, keyPrefix: "wa-send" });
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
        const e = err as { statusCode?: number; message?: string; code?: string };
        if (e.code === "WHATSAPP_INITIALIZING") {
          return whatsappInitializingResponse(res, err);
        }
        const status =
          e.statusCode === 403 ? 403 : e.statusCode === 400 ? 400 : e.statusCode === 429 ? 429 : 500;
        return sendJson(res, status, { error: safeErrorMessage(e, "Erro ao enviar mensagem") });
      }
    }

    if ((act === "start" || act === "connect" || act === "logout") && method === "POST") {
      return sendJson(res, 410, {
        error: "Conexão por QR/pareamento foi descontinuada. As notificações saem pelo WhatsApp oficial do AxéCloud.",
        channel: "official",
      });
    }

    if (act === "test-message" && method === "POST") {
      const rl = consumeRateLimit(req, { windowMs: 60 * 60 * 1000, max: 3, keyPrefix: "wa-test" });
      if (!rl.allowed) {
        return sendJson(res, 429, { error: "Limite de testes WhatsApp excedido. Tente mais tarde." });
      }
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
      const { phone } = body;
      if (!phone) return sendJson(res, 400, { error: "Telefone é obrigatório." });
      const ctx = await resolveTerreiroWhatsAppContext(sb, user.id, user.id);
      try {
        const result = await sendWhatsAppForTenant(sb, {
          tenantId: user.id,
          tipo: "teste",
          forcePhone: phone,
          variables: {
            nome_filho: "Teste",
            nome_terreiro: ctx.nomeTerreiro,
            comunicado:
              "Se você recebeu esta mensagem, o canal oficial do AxéCloud está funcionando corretamente.",
          },
        });
        return sendJson(res, 200, { success: true, message: "Mensagem enviada com sucesso!", externalId: result.externalId });
      } catch (err: unknown) {
        const e = err as { code?: string; message?: string };
        if (e.code === "WHATSAPP_INITIALIZING") return whatsappInitializingResponse(res, err);
        throw err;
      }
    }

    if (act === "status" && method === "GET") {
      const official = await getOfficialWhatsAppStatus();
      const queue = getEvolutionQueueStats();
      const quota = await getPersistentQuotaSnapshot(sb);
      return sendJson(res, 200, {
        status: official.status,
        qrcode: null,
        channel: "official",
        pairingCode: null,
        antiSpam: {
          sendWindowOpen: isWithinAllowedSendWindow(),
          queuePending: queue.pending,
          sentLastHour: quota.sentLastHour,
          sentToday: quota.sentToday,
          hourlyMax: quota.hourlyMax,
          dailyMax: quota.dailyMax,
        },
        message:
          official.status === "CONNECTED"
            ? "Canal oficial AxéCloud ativo. Suas notificações serão enviadas pelo número verificado da plataforma."
            : WHATSAPP_INITIALIZING_MESSAGE_PT,
      });
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
    sendJson(res, 500, { error: safeErrorMessage(e, "Erro interno") });
  }
}
