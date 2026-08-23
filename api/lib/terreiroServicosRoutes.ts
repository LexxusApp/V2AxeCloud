import type { Express, Request, Response } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import { apiReadRateLimit, sensitiveActionRateLimit } from "./rateLimit.js";
import { requireAuthOrRespond } from "./requireAuth.js";

type Deps = { supabaseAdmin: SupabaseClient };

const MAX_SERVICOS = 20;

function parseServico(body: Record<string, unknown>) {
  const nome = String(body.nome || "").trim().slice(0, 120);
  const descricao = String(body.descricao || "").trim().slice(0, 600) || null;
  const duracaoMinutos = body.duracao_minutos != null ? Math.max(0, Math.min(999, Number(body.duracao_minutos) || 0)) : null;
  const valorMin = body.valor_min != null && body.valor_min !== "" ? Math.max(0, Number(body.valor_min) || 0) : null;
  const valorMax = body.valor_max != null && body.valor_max !== "" ? Math.max(0, Number(body.valor_max) || 0) : null;
  const disponivel = body.disponivel !== false && body.disponivel !== "false";
  const ordem = typeof body.ordem === "number" ? Math.max(0, Math.min(9999, body.ordem)) : 0;
  return { nome, descricao, duracaoMinutos, valorMin, valorMax, disponivel, ordem };
}

function isValidUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function registerTerreiroServicosRoutes(app: Express, { supabaseAdmin: sb }: Deps) {
  // ─── Público: listar serviços disponíveis de um terreiro pelo slug ────────
  app.get(
    "/api/v1/public/diretorio/terreiro/:slug/servicos",
    apiReadRateLimit,
    async (req: Request, res: Response) => {
      try {
        const slug = String(req.params.slug || "").trim().toLowerCase().slice(0, 200);
        if (!slug) return res.status(400).json({ error: "Slug inválido." });

        const { data: terreiro, error: tErr } = await sb
          .from("terreiros_diretorio")
          .select("id, telefone, whatsapp_atendimento")
          .eq("slug", slug)
          .maybeSingle();
        if (tErr) throw tErr;
        if (!terreiro) return res.status(404).json({ error: "Terreiro não encontrado." });

        const { data: servicos, error: sErr } = await sb
          .from("terreiro_servicos")
          .select("id, nome, descricao, duracao_minutos, valor_min, valor_max, ordem")
          .eq("terreiro_id", terreiro.id)
          .eq("disponivel", true)
          .order("ordem", { ascending: true })
          .order("created_at", { ascending: true })
          .limit(MAX_SERVICOS);
        if (sErr) throw sErr;

        return res.json({
          servicos: servicos || [],
          whatsappAtendimento: terreiro.whatsapp_atendimento || terreiro.telefone || null,
        });
      } catch (error: unknown) {
        console.error("[public/diretorio/terreiro/servicos/get]", error);
        return res.status(500).json({ error: "Erro ao carregar atendimentos." });
      }
    },
  );

  // ─── Autenticado: listar TODOS os serviços do zelador (incluindo indisponíveis) ─
  app.get(
    "/api/v1/settings/terreiro-servicos",
    apiReadRateLimit,
    async (req: Request, res: Response) => {
      const user = await requireAuthOrRespond(sb, req, res);
      if (!user) return;
      try {
        const { data: terreiro, error: tErr } = await sb
          .from("terreiros_diretorio")
          .select("id, whatsapp_atendimento, telefone")
          .eq("claimed_by_tenant_id", user.id)
          .maybeSingle();
        if (tErr) throw tErr;
        if (!terreiro) return res.json({ claimed: false, servicos: [], whatsappAtendimento: null });

        const { data: servicos, error: sErr } = await sb
          .from("terreiro_servicos")
          .select("id, nome, descricao, duracao_minutos, valor_min, valor_max, disponivel, ordem, created_at")
          .eq("terreiro_id", terreiro.id)
          .order("ordem", { ascending: true })
          .order("created_at", { ascending: true })
          .limit(MAX_SERVICOS);
        if (sErr) throw sErr;

        return res.json({
          claimed: true,
          servicos: servicos || [],
          whatsappAtendimento: terreiro.whatsapp_atendimento || terreiro.telefone || null,
        });
      } catch (error: unknown) {
        console.error("[settings/terreiro-servicos/get]", error);
        return res.status(500).json({ error: "Erro ao carregar atendimentos." });
      }
    },
  );

  // ─── Autenticado: atualizar whatsapp_atendimento ──────────────────────────
  app.patch(
    "/api/v1/settings/terreiro-whatsapp-atendimento",
    sensitiveActionRateLimit,
    async (req: Request, res: Response) => {
      const user = await requireAuthOrRespond(sb, req, res);
      if (!user) return;
      try {
        const body = req.body && typeof req.body === "object" ? req.body : {};
        const raw = String(body.whatsappAtendimento || "").replace(/\D/g, "").slice(0, 15);
        const whatsappAtendimento = raw.length >= 10 ? raw : null;

        const { error } = await sb
          .from("terreiros_diretorio")
          .update({ whatsapp_atendimento: whatsappAtendimento })
          .eq("claimed_by_tenant_id", user.id);
        if (error) throw error;
        return res.json({ success: true, whatsappAtendimento });
      } catch (error: unknown) {
        console.error("[settings/terreiro-whatsapp-atendimento/patch]", error);
        return res.status(500).json({ error: "Erro ao salvar WhatsApp de atendimento." });
      }
    },
  );

  // ─── Autenticado: criar serviço ───────────────────────────────────────────
  app.post(
    "/api/v1/settings/terreiro-servicos",
    sensitiveActionRateLimit,
    async (req: Request, res: Response) => {
      const user = await requireAuthOrRespond(sb, req, res);
      if (!user) return;
      try {
        const { data: terreiro, error: tErr } = await sb
          .from("terreiros_diretorio")
          .select("id")
          .eq("claimed_by_tenant_id", user.id)
          .maybeSingle();
        if (tErr) throw tErr;
        if (!terreiro) return res.status(403).json({ error: "Nenhum perfil reivindicado nesta conta." });

        const { count, error: countErr } = await sb
          .from("terreiro_servicos")
          .select("id", { count: "exact", head: true })
          .eq("terreiro_id", terreiro.id);
        if (countErr) throw countErr;
        if ((count || 0) >= MAX_SERVICOS) {
          return res.status(400).json({ error: `Limite de ${MAX_SERVICOS} atendimentos atingido.` });
        }

        const body = req.body && typeof req.body === "object" ? req.body : {};
        const parsed = parseServico(body);
        if (parsed.nome.length < 2) return res.status(400).json({ error: "Informe um nome para o atendimento." });

        const { data: novo, error: insErr } = await sb
          .from("terreiro_servicos")
          .insert({
            terreiro_id: terreiro.id,
            nome: parsed.nome,
            descricao: parsed.descricao,
            duracao_minutos: parsed.duracaoMinutos,
            valor_min: parsed.valorMin,
            valor_max: parsed.valorMax,
            disponivel: parsed.disponivel,
            ordem: parsed.ordem,
          })
          .select("id, nome, descricao, duracao_minutos, valor_min, valor_max, disponivel, ordem, created_at")
          .single();
        if (insErr) throw insErr;
        return res.status(201).json({ success: true, servico: novo });
      } catch (error: unknown) {
        console.error("[settings/terreiro-servicos/post]", error);
        return res.status(500).json({ error: "Erro ao criar atendimento." });
      }
    },
  );

  // ─── Autenticado: editar serviço ─────────────────────────────────────────
  app.patch(
    "/api/v1/settings/terreiro-servicos/:id",
    sensitiveActionRateLimit,
    async (req: Request, res: Response) => {
      const user = await requireAuthOrRespond(sb, req, res);
      if (!user) return;
      try {
        const servicoId = String(req.params.id || "");
        if (!isValidUuid(servicoId)) return res.status(400).json({ error: "ID inválido." });

        const { data: terreiro, error: tErr } = await sb
          .from("terreiros_diretorio")
          .select("id")
          .eq("claimed_by_tenant_id", user.id)
          .maybeSingle();
        if (tErr) throw tErr;
        if (!terreiro) return res.status(403).json({ error: "Nenhum perfil reivindicado nesta conta." });

        const body = req.body && typeof req.body === "object" ? req.body : {};
        const parsed = parseServico(body);
        if (parsed.nome.length < 2) return res.status(400).json({ error: "Informe um nome para o atendimento." });

        const { data: updated, error: updErr } = await sb
          .from("terreiro_servicos")
          .update({
            nome: parsed.nome,
            descricao: parsed.descricao,
            duracao_minutos: parsed.duracaoMinutos,
            valor_min: parsed.valorMin,
            valor_max: parsed.valorMax,
            disponivel: parsed.disponivel,
            ordem: parsed.ordem,
          })
          .eq("id", servicoId)
          .eq("terreiro_id", terreiro.id)
          .select("id, nome, descricao, duracao_minutos, valor_min, valor_max, disponivel, ordem, created_at")
          .single();
        if (updErr) throw updErr;
        if (!updated) return res.status(404).json({ error: "Atendimento não encontrado." });
        return res.json({ success: true, servico: updated });
      } catch (error: unknown) {
        console.error("[settings/terreiro-servicos/patch]", error);
        return res.status(500).json({ error: "Erro ao atualizar atendimento." });
      }
    },
  );

  // ─── Autenticado: excluir serviço ────────────────────────────────────────
  app.delete(
    "/api/v1/settings/terreiro-servicos/:id",
    sensitiveActionRateLimit,
    async (req: Request, res: Response) => {
      const user = await requireAuthOrRespond(sb, req, res);
      if (!user) return;
      try {
        const servicoId = String(req.params.id || "");
        if (!isValidUuid(servicoId)) return res.status(400).json({ error: "ID inválido." });

        const { data: terreiro, error: tErr } = await sb
          .from("terreiros_diretorio")
          .select("id")
          .eq("claimed_by_tenant_id", user.id)
          .maybeSingle();
        if (tErr) throw tErr;
        if (!terreiro) return res.status(403).json({ error: "Nenhum perfil reivindicado nesta conta." });

        const { error: delErr } = await sb
          .from("terreiro_servicos")
          .delete()
          .eq("id", servicoId)
          .eq("terreiro_id", terreiro.id);
        if (delErr) throw delErr;
        return res.json({ success: true });
      } catch (error: unknown) {
        console.error("[settings/terreiro-servicos/delete]", error);
        return res.status(500).json({ error: "Erro ao excluir atendimento." });
      }
    },
  );
}
