import type { Express, Request, Response } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import { apiReadRateLimit, publicFormRateLimit } from "./rateLimit.js";
import { requireAuthOrRespond } from "./requireAuth.js";
import { getFounderHouseStatusForLeader } from "./founderProgramAdmin.js";

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
  app.get("/api/v1/founder-program/me", apiReadRateLimit, async (req: Request, res: Response) => {
    try {
      const user = await requireAuthOrRespond(supabaseAdmin, req, res);
      if (!user) return;
      const status = await getFounderHouseStatusForLeader(supabaseAdmin, user.id);
      res.json(status);
    } catch (err: unknown) {
      console.error("[founder-program/me]", err);
      res.status(500).json({ error: "Não foi possível carregar o status do programa fundador." });
    }
  });

  app.get("/api/v1/landing/founder-houses", apiReadRateLimit, async (_req: Request, res: Response) => {
    try {
      const { data, error } = await supabaseAdmin
        .from("founder_applications")
        .select(
          "id, nome_casa, cidade, estado, tradicao, nome_contato, depoimento_texto, depoimento_publicado, leader_id"
        )
        .eq("status", "accepted")
        .eq("autoriza_perfil_publico", true)
        .order("created_at", { ascending: true })
        .limit(24);

      if (error) {
        console.warn("[landing/founder-houses]", error.message);
        return res.json({ items: [] });
      }

      const tradicaoLabel: Record<string, string> = {
        umbanda: "Umbanda",
        candomble: "Candomblé",
        jurema: "Jurema",
        mista: "Tradição mista",
        outra: "Casa de axé",
      };

      const leaderIds = [
        ...new Set(
          (data || [])
            .map((row) => String(row.leader_id || "").trim())
            .filter((id) => id.length > 0),
        ),
      ];

      const leaderMetaById = new Map<string, { portalSlug?: string; fotoUrl?: string }>();
      if (leaderIds.length > 0) {
        const { data: leaders } = await supabaseAdmin
          .from("perfil_lider")
          .select("id, public_slug, portal_consulente_ativo, foto_url")
          .in("id", leaderIds)
          .is("deleted_at", null);

        for (const leader of leaders || []) {
          const id = String(leader.id);
          const slug =
            leader.portal_consulente_ativo && String(leader.public_slug || "").trim()
              ? String(leader.public_slug).trim()
              : undefined;
          const fotoUrl = String(leader.foto_url || "").trim() || undefined;
          leaderMetaById.set(id, { portalSlug: slug, fotoUrl });
        }
      }

      const items = (data || []).map((row) => {
        const quotePublished =
          row.depoimento_publicado && String(row.depoimento_texto || "").trim().length >= 12
            ? String(row.depoimento_texto).trim()
            : undefined;
        const leaderId = String(row.leader_id || "").trim();
        const leaderMeta = leaderId ? leaderMetaById.get(leaderId) : undefined;
        return {
          id: String(row.id),
          houseName: String(row.nome_casa || "").trim(),
          city: String(row.cidade || "").trim(),
          state: String(row.estado || "").trim(),
          tradition: tradicaoLabel[String(row.tradicao || "").toLowerCase()] || "Casa de axé",
          contactName: String(row.nome_contato || "").trim() || undefined,
          quote: quotePublished,
          portalSlug: leaderMeta?.portalSlug,
          fotoUrl: leaderMeta?.fotoUrl,
        };
      });

      res.json({ items });
    } catch (err: unknown) {
      console.error("[landing/founder-houses]", err);
      res.json({ items: [] });
    }
  });

  app.get("/api/v1/landing/testimonials", apiReadRateLimit, async (_req: Request, res: Response) => {
    try {
      const { data, error } = await supabaseAdmin
        .from("founder_applications")
        .select("id, depoimento_texto, nome_contato, nome_casa, cidade, estado, tradicao")
        .eq("depoimento_publicado", true)
        .not("depoimento_texto", "is", null)
        .order("created_at", { ascending: false })
        .limit(9);

      if (error) {
        console.warn("[landing/testimonials]", error.message);
        return res.json({ items: [] });
      }

      const tradicaoLabel: Record<string, string> = {
        umbanda: "Umbanda",
        candomble: "Candomblé",
        jurema: "Jurema",
        mista: "Mista",
        outra: "Outra",
      };

      const items = (data || [])
        .map((row) => {
          const quote = String(row.depoimento_texto || "").trim();
          if (quote.length < 12) return null;
          const authorName = String(row.nome_contato || row.nome_casa || "Dirigente").trim();
          return {
            id: String(row.id),
            quote,
            authorName,
            houseName: String(row.nome_casa || "").trim() || undefined,
            authorRole: tradicaoLabel[String(row.tradicao || "").toLowerCase()] || undefined,
            city: String(row.cidade || "").trim(),
            state: String(row.estado || "").trim(),
          };
        })
        .filter(Boolean);

      res.json({ items });
    } catch (err: unknown) {
      console.error("[landing/testimonials]", err);
      res.json({ items: [] });
    }
  });

  app.get("/api/v1/founder-program/stats", apiReadRateLimit, async (_req: Request, res: Response) => {
    try {
      const used = await countActiveApplications(supabaseAdmin);
      const remaining = Math.max(0, FOUNDER_MAX_SLOTS - used);

      const { count: acceptedHouses, error: acceptedErr } = await supabaseAdmin
        .from("founder_applications")
        .select("id", { count: "exact", head: true })
        .eq("status", "accepted")
        .eq("autoriza_perfil_publico", true);

      if (acceptedErr) {
        console.warn("[founder-program/stats] accepted count:", acceptedErr.message);
      }

      res.json({
        maxSlots: FOUNDER_MAX_SLOTS,
        usedSlots: used,
        remainingSlots: remaining,
        acceptingApplications: remaining > 0,
        acceptedHouses: acceptedHouses ?? 0,
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
      const { resolveLeaderIdByEmail } = await import("./founderProgramAdmin.js");
      const existingLeaderId = await resolveLeaderIdByEmail(supabaseAdmin, email);

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
          leader_id: existingLeaderId,
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
