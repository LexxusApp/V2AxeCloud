import type { Express, Request, Response } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import { apiReadRateLimit, publicFormRateLimit } from "./rateLimit.js";
import { requireAuthOrRespond } from "./requireAuth.js";
import { assertZeladorTenantAccess, normalizeQueryTenantId } from "./tenantAccess.js";

type Deps = {
  supabaseAdmin: SupabaseClient;
  resolveLeaderId: (tenantId: string) => Promise<string>;
};

const TRADICOES = new Set(["umbanda", "candomble", "jurema", "mista", "outra"]);
const PEDIDO_STATUSES = new Set(["pendente", "em_atendimento", "concluido", "cancelado"]);

export function slugifyPublicSlug(raw: string): string {
  return String(raw || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function normalizeWhatsapp(raw: string): string {
  return String(raw || "").replace(/\D/g, "");
}

async function findLeaderBySlug(sb: SupabaseClient, slug: string) {
  const s = slugifyPublicSlug(slug);
  if (!s || s.length < 3) return null;
  const { data, error } = await sb
    .from("perfil_lider")
    .select("id, tenant_id, nome_terreiro, foto_url, tradicao, portal_consulente_ativo, portal_consulente_mensagem, public_slug")
    .eq("portal_consulente_ativo", true)
    .is("deleted_at", null)
    .ilike("public_slug", s)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

export function registerConsulentePortalRoutes(app: Express, deps: Deps) {
  const { supabaseAdmin: sb, resolveLeaderId } = deps;

  app.get("/api/v1/public/consulente/:slug", apiReadRateLimit, async (req: Request, res: Response) => {
    try {
      const leader = await findLeaderBySlug(sb, String(req.params.slug || ""));
      if (!leader) return res.status(404).json({ error: "Portal não encontrado ou inactivo." });
      res.json({
        nomeTerreiro: leader.nome_terreiro,
        fotoUrl: leader.foto_url,
        tradicao: leader.tradicao,
        mensagem: leader.portal_consulente_mensagem,
        slug: leader.public_slug,
      });
    } catch (e: unknown) {
      console.error("[public/consulente]", e);
      res.status(500).json({ error: "Erro ao carregar portal." });
    }
  });

  app.post("/api/v1/public/consulente/:slug/pedidos-reza", publicFormRateLimit, async (req: Request, res: Response) => {
    try {
      const leader = await findLeaderBySlug(sb, String(req.params.slug || ""));
      if (!leader) return res.status(404).json({ error: "Portal não encontrado ou inactivo." });

      const body = req.body || {};
      const nome = String(body.nome || "").trim();
      const mensagem = String(body.mensagem || "").trim();
      const whatsapp = normalizeWhatsapp(String(body.whatsapp || ""));

      if (nome.length < 2) return res.status(400).json({ error: "Informe seu nome." });
      if (mensagem.length < 8) return res.status(400).json({ error: "Descreva seu pedido de reza." });
      if (whatsapp && (whatsapp.length < 10 || whatsapp.length > 13)) {
        return res.status(400).json({ error: "WhatsApp inválido." });
      }

      const tenantId = String(leader.tenant_id || leader.id);
      const liderId = String(leader.id);

      const { data, error } = await sb
        .from("pedidos_reza")
        .insert({
          tenant_id: tenantId,
          lider_id: liderId,
          nome,
          whatsapp: whatsapp || null,
          mensagem: mensagem.slice(0, 2000),
          status: "pendente",
        })
        .select("id")
        .single();

      if (error) throw error;
      res.status(201).json({ success: true, id: data.id, message: "Pedido recebido. A casa entrará em contacto em breve." });
    } catch (e: unknown) {
      console.error("[public/consulente/pedidos-reza]", e);
      res.status(500).json({ error: "Não foi possível enviar o pedido. Tente novamente." });
    }
  });

  app.get("/api/v1/atendimentos/pedidos-reza", apiReadRateLimit, async (req: Request, res: Response) => {
    const user = await requireAuthOrRespond(sb, req, res);
    if (!user) return;
    const tenantId = normalizeQueryTenantId(req.query.tenantId);
    if (!tenantId) return res.status(400).json({ error: "tenantId obrigatório" });
    const ok = await assertZeladorTenantAccess(sb, user.id, tenantId);
    if (!ok) return res.status(403).json({ error: "Acesso negado" });

    try {
      const leaderPk = await resolveLeaderId(tenantId);
      const { data, error } = await sb
        .from("pedidos_reza")
        .select("id, created_at, updated_at, nome, whatsapp, mensagem, status, observacao_interna")
        .or(`tenant_id.eq.${tenantId},lider_id.eq.${leaderPk}`)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      res.json({ items: data || [] });
    } catch (e: unknown) {
      console.error("[atendimentos/pedidos-reza]", e);
      res.status(500).json({ error: "Erro ao listar pedidos." });
    }
  });

  app.patch("/api/v1/atendimentos/pedidos-reza/:id", apiReadRateLimit, async (req: Request, res: Response) => {
    const user = await requireAuthOrRespond(sb, req, res);
    if (!user) return;
    const id = String(req.params.id || "").trim();
    const tenantId = normalizeQueryTenantId(req.body?.tenantId ?? req.query.tenantId);
    if (!id || !tenantId) return res.status(400).json({ error: "id e tenantId obrigatórios" });
    const ok = await assertZeladorTenantAccess(sb, user.id, tenantId);
    if (!ok) return res.status(403).json({ error: "Acesso negado" });

    const body = req.body || {};
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.status != null) {
      const status = String(body.status).trim().toLowerCase();
      if (!PEDIDO_STATUSES.has(status)) return res.status(400).json({ error: "Status inválido." });
      update.status = status;
    }
    if (body.observacao_interna !== undefined) {
      const obs = body.observacao_interna == null ? null : String(body.observacao_interna).trim().slice(0, 2000);
      update.observacao_interna = obs || null;
    }
    if (Object.keys(update).length <= 1) return res.status(400).json({ error: "Nada para actualizar." });

    try {
      const leaderPk = await resolveLeaderId(tenantId);
      const { data, error } = await sb
        .from("pedidos_reza")
        .update(update)
        .eq("id", id)
        .or(`tenant_id.eq.${tenantId},lider_id.eq.${leaderPk}`)
        .select("id, status, observacao_interna, updated_at")
        .maybeSingle();
      if (error) throw error;
      if (!data) return res.status(404).json({ error: "Pedido não encontrado." });
      res.json({ success: true, item: data });
    } catch (e: unknown) {
      console.error("[atendimentos/pedidos-reza/patch]", e);
      res.status(500).json({ error: "Erro ao actualizar pedido." });
    }
  });

  app.get("/api/v1/settings/portal-consulente", apiReadRateLimit, async (req: Request, res: Response) => {
    const user = await requireAuthOrRespond(sb, req, res);
    if (!user) return;
    try {
      const { data, error } = await sb
        .from("perfil_lider")
        .select("tradicao, public_slug, portal_consulente_ativo, portal_consulente_mensagem, nome_terreiro")
        .eq("id", user.id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return res.status(404).json({ error: "Perfil não encontrado." });
      res.json({
        tradicao: data.tradicao || "mista",
        publicSlug: data.public_slug,
        portalAtivo: Boolean(data.portal_consulente_ativo),
        mensagem: data.portal_consulente_mensagem,
        nomeTerreiro: data.nome_terreiro,
        portalUrl: data.public_slug ? `/consulente/${data.public_slug}` : null,
      });
    } catch (e: unknown) {
      console.error("[settings/portal-consulente/get]", e);
      res.status(500).json({ error: "Erro ao carregar portal." });
    }
  });

  app.post("/api/v1/settings/portal-consulente", apiReadRateLimit, async (req: Request, res: Response) => {
    const user = await requireAuthOrRespond(sb, req, res);
    if (!user) return;
    const body = req.body || {};
    const tradicao = String(body.tradicao || "").trim().toLowerCase();
    const portalAtivo = Boolean(body.portalAtivo);
    const mensagem =
      body.mensagem == null ? null : String(body.mensagem).trim().slice(0, 1200) || null;
    const slugRaw = body.publicSlug != null ? slugifyPublicSlug(String(body.publicSlug)) : undefined;

    if (tradicao && !TRADICOES.has(tradicao)) {
      return res.status(400).json({ error: "Tradição inválida." });
    }

    try {
      const update: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      if (tradicao) update.tradicao = tradicao;
      if (body.portalAtivo !== undefined) update.portal_consulente_ativo = portalAtivo;
      if (body.mensagem !== undefined) update.portal_consulente_mensagem = mensagem;
      if (slugRaw !== undefined) {
        if (portalAtivo && (!slugRaw || slugRaw.length < 3)) {
          return res.status(400).json({ error: "Defina um endereço público com pelo menos 3 caracteres." });
        }
        update.public_slug = slugRaw || null;
      }

      if (update.public_slug) {
        const { data: dup } = await sb
          .from("perfil_lider")
          .select("id")
          .ilike("public_slug", String(update.public_slug))
          .neq("id", user.id)
          .is("deleted_at", null)
          .maybeSingle();
        if (dup?.id) return res.status(409).json({ error: "Este endereço público já está em uso." });
      }

      const { error } = await sb.from("perfil_lider").update(update).eq("id", user.id);
      if (error) throw error;

      res.json({
        success: true,
        tradicao: update.tradicao,
        publicSlug: update.public_slug,
        portalAtivo: update.portal_consulente_ativo,
        portalUrl: update.public_slug ? `/consulente/${update.public_slug}` : null,
      });
    } catch (e: unknown) {
      console.error("[settings/portal-consulente/post]", e);
      res.status(500).json({ error: "Erro ao guardar portal." });
    }
  });
}
