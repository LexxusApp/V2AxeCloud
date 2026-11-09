import {resolveDelegatedModuleTenant} from './delegatedAccess.js';
import { parseDiretorioSlugVariants } from "./diretorioSlug.js";
import type { Express, Request, Response } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import { apiReadRateLimit, sensitiveActionRateLimit } from "./rateLimit.js";
import { requireAuthOrRespond } from "./requireAuth.js";

type Deps = { supabaseAdmin: SupabaseClient; resolveLeaderId?: (id: string) => Promise<string> };

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

async function resolveTerreiro(sb: SupabaseClient, userId: string, resolveLeaderId?: (id: string) => Promise<string>, level: 'visualizar'|'gerenciar'='visualizar', create=false) {
  const managementTenant=await resolveDelegatedModuleTenant(sb,userId,'radar',level);
  const leaderId = resolveLeaderId ? await resolveLeaderId(managementTenant) : managementTenant;
  let { data, error } = await sb
    .from("terreiros_diretorio")
    .select("id, whatsapp_atendimento, telefone")
    .eq("claimed_by_tenant_id", leaderId)
    .order("verified_at", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data && create) {
    const { data: leader } = await sb
      .from("perfil_lider")
      .select("nome_terreiro, cidade_publica, estado_publico, public_slug, whatsapp_publico")
      .eq("id", leaderId)
      .maybeSingle();
    if (leader) {
      const baseSlug = String(leader.nome_terreiro || "terreiro").toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const newSlug = leader.public_slug || `${baseSlug}-${leaderId.replace(/-/g, "").slice(0, 8)}`;
      const { data: created } = await sb
        .from("terreiros_diretorio")
        .insert({
          nome: leader.nome_terreiro || "Terreiro",
          cidade: leader.cidade_publica || "São Paulo",
          estado: leader.estado_publico || "SP",
          tipo: "terreiro",
          slug: newSlug,
          claimed_by_tenant_id: leaderId,
          publicacao_status: "rascunho",
        })
        .select("id, whatsapp_atendimento, telefone")
        .maybeSingle();
      if (created) data = created;
    }
  }
  return data;
}

export function registerTerreiroServicosRoutes(app: Express, deps: Deps) {
  const { supabaseAdmin: sb, resolveLeaderId } = deps;
  // ─── Público: listar serviços disponíveis de um terreiro pelo slug ────────
  app.get(
    "/api/v1/public/diretorio/terreiro/:slug/servicos",
    apiReadRateLimit,
    async (req: Request, res: Response) => {
      try {
        const variants = parseDiretorioSlugVariants(String(req.params.slug || ""));
        if (!variants.length) return res.status(400).json({ error: "Slug inválido." });

        const { data: terreiro, error: tErr } = await sb
          .from("terreiros_diretorio")
          .select("id, telefone, whatsapp_atendimento, publicacao_status")
          .in("slug", variants)
          .limit(1)
          .maybeSingle();
        if (tErr) throw tErr;
        if (!terreiro) return res.status(404).json({ error: "Terreiro não encontrado." });
        if (String(terreiro.publicacao_status || "publicado") !== "publicado") {
          return res.status(404).json({ error: "Terreiro não encontrado." });
        }

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
        const terreiro = await resolveTerreiro(sb, user.id, resolveLeaderId);
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
        const managementTenant=await resolveDelegatedModuleTenant(sb,user.id,'radar','gerenciar');
        const leaderId = resolveLeaderId ? await resolveLeaderId(managementTenant) : managementTenant;
        const body = req.body && typeof req.body === "object" ? req.body : {};
        const raw = String(body.whatsappAtendimento || "").replace(/\D/g, "").slice(0, 15);
        const whatsappAtendimento = raw.length >= 10 ? raw : null;

        const { error } = await sb
          .from("terreiros_diretorio")
          .update({ whatsapp_atendimento: whatsappAtendimento })
          .eq("claimed_by_tenant_id", leaderId);
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
        const terreiro = await resolveTerreiro(sb, user.id, resolveLeaderId,'gerenciar',true);
        if (!terreiro) return res.status(403).json({ error: "Nenhum perfil da casa nesta conta." });

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

        const terreiro = await resolveTerreiro(sb, user.id, resolveLeaderId,'gerenciar');
        if (!terreiro) return res.status(403).json({ error: "Nenhum perfil da casa nesta conta." });

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

        const terreiro = await resolveTerreiro(sb, user.id, resolveLeaderId,'gerenciar');
        if (!terreiro) return res.status(403).json({ error: "Nenhum perfil da casa nesta conta." });

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
