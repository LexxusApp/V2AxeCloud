import type { Express, Request, Response } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import { apiReadRateLimit, publicFormRateLimit } from "./rateLimit.js";

const FOUNDER_MAX_SLOTS = 20;
const TRADICOES = new Set(["umbanda", "candomble", "jurema", "mista", "outra"]);

type Deps = {
  supabaseAdmin: SupabaseClient;
};

function normalizeWhatsapp(raw: string): string {
  return String(raw || "").replace(/\D/g, "");
}

function clientMeta(req: Request) {
  const xf = req.headers["x-forwarded-for"];
  const ip = String(Array.isArray(xf) ? xf[0] : xf || req.socket?.remoteAddress || "").split(",")[0].trim();
  const userAgent = String(req.headers["user-agent"] || "").slice(0, 512);
  return { ip: ip || null, userAgent: userAgent || null };
}

async function countActiveApplications(supabaseAdmin: SupabaseClient): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from("founder_applications")
    .select("id", { count: "exact", head: true })
    .in("status", ["pending", "contacted", "accepted"]);

  if (error) {
    console.warn("[founder-program] count failed:", error.message);
    return 0;
  }
  return count ?? 0;
}

export function registerFounderProgramRoutes(app: Express, { supabaseAdmin }: Deps) {
  app.get("/api/v1/founder-program/stats", apiReadRateLimit, async (_req: Request, res: Response) => {
    try {
      const used = await countActiveApplications(supabaseAdmin);
      const remaining = Math.max(0, FOUNDER_MAX_SLOTS - used);
      res.json({
        maxSlots: FOUNDER_MAX_SLOTS,
        usedSlots: used,
        remainingSlots: remaining,
        acceptingApplications: remaining > 0,
      });
    } catch (err: unknown) {
      console.error("[founder-program/stats]", err);
      res.status(500).json({ error: "Não foi possível carregar vagas do programa." });
    }
  });

  app.post("/api/v1/founder-program/apply", publicFormRateLimit, async (req: Request, res: Response) => {
    try {
      const body = req.body || {};
      const nome_casa = String(body.nome_casa || "").trim();
      const cidade = String(body.cidade || "").trim();
      const estado = String(body.estado || "").trim().toUpperCase().slice(0, 2);
      const tradicao = String(body.tradicao || "").trim().toLowerCase();
      const whatsapp = normalizeWhatsapp(String(body.whatsapp || ""));
      const nome_contato = String(body.nome_contato || "").trim() || null;
      const email = String(body.email || "").trim().toLowerCase();
      const mensagem = String(body.mensagem || "").trim().slice(0, 2000) || null;
      const autoriza_perfil_publico = Boolean(body.autoriza_perfil_publico);
      const autoriza_depoimento = Boolean(body.autoriza_depoimento);

      if (!nome_casa || nome_casa.length < 2) {
        return res.status(400).json({ error: "Informe o nome da casa ou terreiro." });
      }
      if (!cidade || cidade.length < 2) {
        return res.status(400).json({ error: "Informe a cidade." });
      }
      if (!/^[A-Z]{2}$/.test(estado)) {
        return res.status(400).json({ error: "Informe o estado (UF) com 2 letras." });
      }
      if (!TRADICOES.has(tradicao)) {
        return res.status(400).json({ error: "Selecione uma tradição válida." });
      }
      if (whatsapp.length < 10 || whatsapp.length > 13) {
        return res.status(400).json({ error: "Informe um WhatsApp válido com DDD." });
      }
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({
          error: "Informe o e-mail do zelador — usamos esse endereço para criar o acesso ao painel.",
        });
      }
      if (!autoriza_perfil_publico) {
        return res.status(400).json({
          error: "É necessário autorizar o perfil público futuro para participar do programa.",
        });
      }

      const used = await countActiveApplications(supabaseAdmin);
      if (used >= FOUNDER_MAX_SLOTS) {
        return res.status(409).json({ error: "As vagas do Programa Fundador estão esgotadas no momento." });
      }

      const { data: duplicate } = await supabaseAdmin
        .from("founder_applications")
        .select("id, status")
        .eq("whatsapp", whatsapp)
        .in("status", ["pending", "contacted", "accepted"])
        .maybeSingle();

      if (duplicate) {
        return res.status(409).json({
          error: "Já recebemos uma inscrição com este WhatsApp. Entraremos em contato em breve.",
        });
      }

      const meta = clientMeta(req);
      const { data, error } = await supabaseAdmin
        .from("founder_applications")
        .insert({
          nome_casa,
          cidade,
          estado,
          tradicao,
          whatsapp,
          nome_contato,
          email,
          mensagem,
          autoriza_perfil_publico,
          autoriza_depoimento,
          status: "pending",
          ip: meta.ip,
          user_agent: meta.userAgent,
        })
        .select("id")
        .single();

      if (error) {
        console.error("[founder-program/apply]", error.message);
        return res.status(500).json({ error: "Não foi possível enviar a inscrição. Tente novamente." });
      }

      const remaining = Math.max(0, FOUNDER_MAX_SLOTS - used - 1);
      res.status(201).json({
        success: true,
        id: data.id,
        remainingSlots: remaining,
        message: "Inscrição recebida! Entraremos em contato pelo WhatsApp em até 48 horas.",
      });
    } catch (err: unknown) {
      console.error("[founder-program/apply]", err);
      res.status(500).json({ error: "Erro ao processar inscrição." });
    }
  });
}
