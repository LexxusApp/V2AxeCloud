import type { Express, Request, Response } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import { apiReadRateLimit, publicFormRateLimit } from "./rateLimit.js";
import { requireAuthOrRespond } from "./requireAuth.js";
import { getFounderHouseStatusForLeader } from "./founderProgramAdmin.js";

type Deps = {
  supabaseAdmin: SupabaseClient;
};

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
    res.status(410).json({
      error: "Inscrições públicas encerradas. Cadastre seu terreiro em /register — 30 dias grátis.",
      acceptingApplications: false,
    });
  });

  app.post("/api/v1/founder-program/apply", publicFormRateLimit, async (_req: Request, res: Response) => {
    res.status(410).json({
      error: "Inscrições públicas encerradas. Cadastre seu terreiro em /register — 30 dias grátis do plano Premium.",
    });
  });
}
