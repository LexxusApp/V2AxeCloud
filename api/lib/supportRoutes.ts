import type { SupabaseClient } from "@supabase/supabase-js";
import type { Express, Request, Response } from "express";
import { resolveAuthenticatedFilho } from "./tenantAccess.js";
import { requireApiUser } from "./routeAuthHelpers.js";
import { createRateLimit } from "./rateLimit.js";
import { safeErrorMessage } from "./safeError.js";
import { sendSupportTicketEmail, supportMailConfigured } from "./supportMail.js";

type Deps = { supabaseAdmin: SupabaseClient };

const supportTicketRateLimit = createRateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  keyPrefix: "support-ticket",
  message: { error: "Limite de pedidos de suporte excedido. Tente novamente mais tarde." },
});

function digitsOnly(value: string): string {
  return String(value || "").replace(/\D/g, "");
}

function normalizeWhatsApp(raw: string): string | null {
  const digits = digitsOnly(raw);
  if (digits.length < 10 || digits.length > 13) return null;
  return digits;
}

export function registerSupportRoutes(app: Express, { supabaseAdmin }: Deps) {
  app.post("/api/v1/support", supportTicketRateLimit, async (req: Request, res: Response) => {
    try {
      const user = await requireApiUser(supabaseAdmin, req, res);
      if (!user) return;

      const filho = await resolveAuthenticatedFilho(supabaseAdmin, user.id);
      if (filho) {
        return res.status(403).json({ error: "Apenas zeladores podem enviar pedidos de suporte por este canal." });
      }

      if (!supportMailConfigured()) {
        return res.status(503).json({
          error: "Canal de suporte temporariamente indisponível. Tente novamente em alguns minutos.",
        });
      }

      const body = req.body || {};
      const nomeZelador = String(body.nomeZelador || "").trim();
      const nomeTerreiro = String(body.nomeTerreiro || "").trim();
      const mensagem = String(body.mensagem || "").trim();
      const whatsapp = normalizeWhatsApp(String(body.whatsapp || ""));

      if (!nomeZelador || nomeZelador.length < 2) {
        return res.status(400).json({ error: "Informe o nome do zelador(a)." });
      }
      if (!nomeTerreiro || nomeTerreiro.length < 2) {
        return res.status(400).json({ error: "Informe o nome do terreiro." });
      }
      if (!whatsapp) {
        return res.status(400).json({ error: "WhatsApp obrigatório. Use DDD + número." });
      }
      if (!mensagem || mensagem.length < 10) {
        return res.status(400).json({ error: "Descreva o problema com pelo menos 10 caracteres." });
      }
      if (mensagem.length > 4000) {
        return res.status(400).json({ error: "Mensagem muito longa (máximo 4000 caracteres)." });
      }

      const { data: profile } = await supabaseAdmin
        .from("perfil_lider")
        .select("id, tenant_id, nome_terreiro, zelador, whatsapp_publico, email")
        .eq("id", user.id)
        .maybeSingle();

      const result = await sendSupportTicketEmail({
        nomeZelador,
        nomeTerreiro,
        whatsapp,
        mensagem,
        accountEmail: String(user.email || profile?.email || "").trim() || null,
        userId: user.id,
        tenantId: String(profile?.tenant_id || profile?.id || "").trim() || null,
      });

      return res.json({ ok: true, messageId: result.messageId });
    } catch (err) {
      console.error("[support] falha ao enviar:", err);
      return res.status(500).json({
        error: safeErrorMessage(err, "Não foi possível enviar o pedido de suporte."),
      });
    }
  });
}
