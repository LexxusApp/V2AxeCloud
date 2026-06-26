import { randomBytes } from "crypto";
import type { Express, Request, Response } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import { apiReadRateLimit, publicFormRateLimit } from "./rateLimit.js";
import { requireAuthOrRespond } from "./requireAuth.js";
import { assertZeladorTenantAccess, normalizeQueryTenantId } from "./tenantAccess.js";
import { notifyFielPedidoAceito, notifyZeladorNovoPedidoReza } from "./pedidosRezaNotify.js";

type Deps = {
  supabaseAdmin: SupabaseClient;
  resolveLeaderId: (tenantId: string) => Promise<string>;
};

const TRADICOES = new Set(["umbanda", "candomble", "jurema", "mista", "outra"]);
const PEDIDO_STATUSES = new Set(["pendente", "aceito", "em_oracao", "concluido", "cancelado"]);
const VELAS = new Set(["Branca", "Vermelha", "Azul", "Verde", "Amarela", "Preta", "Nenhuma"]);

const PEDIDO_SELECT =
  "id, created_at, updated_at, nome, whatsapp, mensagem, status, observacao_interna, categoria, linha, vela, nome_terreiro, acesso_token";

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

function newAcessoToken(): string {
  return randomBytes(24).toString("base64url");
}

async function findLeaderBySlug(sb: SupabaseClient, slug: string) {
  const s = slugifyPublicSlug(slug);
  if (!s || s.length < 3) return null;
  const { data, error } = await sb
    .from("perfil_lider")
    .select("id, tenant_id, nome_terreiro, foto_url, tradicao, portal_consulente_ativo, portal_consulente_mensagem, public_slug, nome")
    .eq("portal_consulente_ativo", true)
    .is("deleted_at", null)
    .ilike("public_slug", s)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

async function findPedidoByToken(sb: SupabaseClient, token: string) {
  const t = String(token || "").trim();
  if (!t || t.length < 16) return null;
  const { data, error } = await sb
    .from("pedidos_reza")
    .select(PEDIDO_SELECT)
    .eq("acesso_token", t)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

async function assertPedidoTenantAccess(
  sb: SupabaseClient,
  tenantId: string,
  pedidoId: string,
  resolveLeaderId: (tenantId: string) => Promise<string>,
) {
  const leaderPk = await resolveLeaderId(tenantId);
  const { data, error } = await sb
    .from("pedidos_reza")
    .select("id, status, vela, tenant_id, lider_id")
    .eq("id", pedidoId)
    .or(`tenant_id.eq.${tenantId},lider_id.eq.${leaderPk}`)
    .maybeSingle();
  if (error) throw error;
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

  app.get("/api/v1/landing/terreiros-pedidos-reza", apiReadRateLimit, async (_req: Request, res: Response) => {
    try {
      const { data: leaders, error } = await sb
        .from("perfil_lider")
        .select("id, nome_terreiro, public_slug, foto_url, tradicao")
        .eq("portal_consulente_ativo", true)
        .not("public_slug", "is", null)
        .is("deleted_at", null)
        .order("nome_terreiro", { ascending: true })
        .limit(48);
      if (error) throw error;

      const leaderIds = (leaders || []).map((row) => String(row.id));
      const cityByLeader = new Map<string, { cidade: string; estado: string }>();
      if (leaderIds.length > 0) {
        const { data: founders } = await sb
          .from("founder_applications")
          .select("leader_id, cidade, estado")
          .in("leader_id", leaderIds)
          .eq("status", "accepted");
        for (const row of founders || []) {
          const lid = String(row.leader_id || "");
          if (!lid) continue;
          cityByLeader.set(lid, {
            cidade: String(row.cidade || "Brasil"),
            estado: String(row.estado || ""),
          });
        }
      }

      res.json({
        items: (leaders || [])
          .filter((row) => {
            const slug = String(row.public_slug || "").trim();
            return slug.length >= 3;
          })
          .map((row) => {
            const loc = cityByLeader.get(String(row.id));
            return {
              id: row.id,
              nome: row.nome_terreiro,
              slug: row.public_slug,
              cidade: loc?.cidade || "Brasil",
              estado: loc?.estado || "",
              fotoUrl: row.foto_url,
              tradicao: row.tradicao,
            };
          }),
      });
    } catch (e: unknown) {
      console.error("[landing/terreiros-pedidos-reza]", e);
      res.json({ items: [] });
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
      const categoria = String(body.categoria || "").trim().slice(0, 120) || null;
      const linha = String(body.linha || "").trim().slice(0, 120) || null;
      const velaRaw = String(body.vela || "Nenhuma").trim();
      const vela = VELAS.has(velaRaw as never) ? velaRaw : "Nenhuma";

      if (nome.length < 2) return res.status(400).json({ error: "Informe seu nome." });
      if (mensagem.length < 8) return res.status(400).json({ error: "Descreva seu pedido de reza." });
      if (!whatsapp || whatsapp.length < 10 || whatsapp.length > 13) {
        return res.status(400).json({ error: "Informe um WhatsApp válido com DDD." });
      }

      const tenantId = String(leader.tenant_id || leader.id);
      const liderId = String(leader.id);
      const acessoToken = newAcessoToken();

      const { data, error } = await sb
        .from("pedidos_reza")
        .insert({
          tenant_id: tenantId,
          lider_id: liderId,
          nome,
          whatsapp,
          mensagem: mensagem.slice(0, 2000),
          status: "pendente",
          categoria,
          linha,
          vela,
          nome_terreiro: leader.nome_terreiro,
          acesso_token: acessoToken,
        })
        .select("id, acesso_token")
        .single();

      if (error) throw error;

      void notifyZeladorNovoPedidoReza(sb, resolveLeaderId, {
        tenantId,
        liderId,
        pedido: { id: data.id, nome, categoria, mensagem },
        nomeTerreiro: String(leader.nome_terreiro || "Terreiro"),
      });

      res.status(201).json({
        success: true,
        id: data.id,
        acessoToken: data.acesso_token,
        message: "Pedido recebido. Você será avisado no WhatsApp quando o zelador aceitar.",
      });
    } catch (e: unknown) {
      console.error("[public/consulente/pedidos-reza]", e);
      res.status(500).json({ error: "Não foi possível enviar o pedido. Tente novamente." });
    }
  });

  app.get("/api/v1/public/pedidos-reza/:token", apiReadRateLimit, async (req: Request, res: Response) => {
    try {
      const pedido = await findPedidoByToken(sb, String(req.params.token || ""));
      if (!pedido) return res.status(404).json({ error: "Pedido não encontrado." });
      res.json({ item: { ...pedido, acesso_token: undefined }, mensagens: [] });
    } catch (e: unknown) {
      console.error("[public/pedidos-reza/get]", e);
      res.status(500).json({ error: "Erro ao carregar pedido." });
    }
  });

  app.post("/api/v1/public/pedidos-reza/:token/mensagens", publicFormRateLimit, (_req: Request, res: Response) => {
    res.status(410).json({ error: "O chat de pedidos de reza foi descontinuado. Acompanhe pelo altar virtual e WhatsApp." });
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
        .select(PEDIDO_SELECT)
        .or(`tenant_id.eq.${tenantId},lider_id.eq.${leaderPk}`)
        .in("status", ["pendente", "aceito", "em_oracao", "em_atendimento"])
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      res.json({ items: data || [] });
    } catch (e: unknown) {
      console.error("[atendimentos/pedidos-reza]", e);
      res.status(500).json({ error: "Erro ao listar pedidos." });
    }
  });

  app.get("/api/v1/atendimentos/pedidos-reza/:id", apiReadRateLimit, async (req: Request, res: Response) => {
    const user = await requireAuthOrRespond(sb, req, res);
    if (!user) return;
    const id = String(req.params.id || "").trim();
    const tenantId = normalizeQueryTenantId(req.query.tenantId);
    if (!id || !tenantId) return res.status(400).json({ error: "id e tenantId obrigatórios" });
    const ok = await assertZeladorTenantAccess(sb, user.id, tenantId);
    if (!ok) return res.status(403).json({ error: "Acesso negado" });

    try {
      const pedido = await assertPedidoTenantAccess(sb, tenantId, id, resolveLeaderId);
      if (!pedido) return res.status(404).json({ error: "Pedido não encontrado." });
      const { data, error } = await sb.from("pedidos_reza").select(PEDIDO_SELECT).eq("id", id).maybeSingle();
      if (error) throw error;
      if (!data) return res.status(404).json({ error: "Pedido não encontrado." });
      res.json({ item: data, mensagens: [] });
    } catch (e: unknown) {
      console.error("[atendimentos/pedidos-reza/get]", e);
      res.status(500).json({ error: "Erro ao carregar pedido." });
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
    let newStatus: string | null = null;

    if (body.status != null) {
      const status = String(body.status).trim().toLowerCase();
      if (!PEDIDO_STATUSES.has(status)) return res.status(400).json({ error: "Status inválido." });
      update.status = status;
      newStatus = status;
    }
    if (body.observacao_interna !== undefined) {
      const obs = body.observacao_interna == null ? null : String(body.observacao_interna).trim().slice(0, 2000);
      update.observacao_interna = obs || null;
    }
    if (Object.keys(update).length <= 1) return res.status(400).json({ error: "Nada para actualizar." });

    try {
      const existing = await assertPedidoTenantAccess(sb, tenantId, id, resolveLeaderId);
      if (!existing) return res.status(404).json({ error: "Pedido não encontrado." });

      const leaderPk = await resolveLeaderId(tenantId);
      const { data, error } = await sb
        .from("pedidos_reza")
        .update(update)
        .eq("id", id)
        .or(`tenant_id.eq.${tenantId},lider_id.eq.${leaderPk}`)
        .select(PEDIDO_SELECT)
        .maybeSingle();
      if (error) throw error;
      if (!data) return res.status(404).json({ error: "Pedido não encontrado." });

      if (newStatus === "aceito") {
        const leaderPk = await resolveLeaderId(tenantId);
        void notifyFielPedidoAceito(sb, resolveLeaderId, {
          tenantId,
          liderId: leaderPk,
          pedido: {
            nome: data.nome,
            whatsapp: data.whatsapp,
            vela: data.vela,
            categoria: data.categoria,
          },
          nomeTerreiro: String(data.nome_terreiro || "Terreiro"),
        });
      }

      res.json({ success: true, item: data, mensagens: [] });
    } catch (e: unknown) {
      console.error("[atendimentos/pedidos-reza/patch]", e);
      res.status(500).json({ error: "Erro ao actualizar pedido." });
    }
  });

  app.post("/api/v1/atendimentos/pedidos-reza/:id/mensagens", apiReadRateLimit, (_req: Request, res: Response) => {
    res.status(410).json({ error: "O chat de pedidos de reza foi descontinuado. Use o WhatsApp do fiel se necessário." });
  });

  app.get("/api/v1/settings/portal-consulente", apiReadRateLimit, async (req: Request, res: Response) => {
    const user = await requireAuthOrRespond(sb, req, res);
    if (!user) return;
    try {
      const { data, error } = await sb
        .from("perfil_lider")
        .select(
          "tradicao, public_slug, portal_consulente_ativo, portal_consulente_mensagem, nome_terreiro, portal_publico_ativo, cidade_publica, estado_publico, bairro_publico, whatsapp_publico, descricao_publica, casa_verificada",
        )
        .eq("id", user.id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return res.status(404).json({ error: "Perfil não encontrado." });
      const slug = data.public_slug ? String(data.public_slug).trim() : "";
      const portalAtivo = Boolean(data.portal_consulente_ativo);
      const { count: viewCount } = await sb
        .from("portal_profile_views")
        .select("id", { count: "exact", head: true })
        .eq("leader_id", user.id);
      res.json({
        tradicao: data.tradicao || "mista",
        publicSlug: data.public_slug,
        portalAtivo,
        mensagem: data.portal_consulente_mensagem,
        nomeTerreiro: data.nome_terreiro,
        portalPublicoAtivo: Boolean(data.portal_publico_ativo),
        cidadePublica: data.cidade_publica,
        estadoPublico: data.estado_publico,
        bairroPublico: data.bairro_publico,
        whatsappPublico: data.whatsapp_publico,
        descricaoPublica: data.descricao_publica,
        casaVerificada: Boolean(data.casa_verificada),
        visualizacoes: viewCount ?? 0,
        portalUrl: slug ? `/consulente/${slug}` : null,
        terreiroUrl: slug && data.portal_publico_ativo ? `/terreiros/${slug}` : null,
        listagemPedidosUrl: portalAtivo && slug ? `/espaco-do-fiel?casa=${encodeURIComponent(slug)}` : null,
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
    const portalPublicoAtivo = body.portalPublicoAtivo !== undefined ? Boolean(body.portalPublicoAtivo) : undefined;
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
      if (portalPublicoAtivo !== undefined) update.portal_publico_ativo = portalPublicoAtivo;
      if (body.cidadePublica !== undefined) {
        update.cidade_publica = String(body.cidadePublica || "").trim().slice(0, 120) || null;
      }
      if (body.estadoPublico !== undefined) {
        update.estado_publico = String(body.estadoPublico || "").trim().slice(0, 2).toUpperCase() || null;
      }
      if (body.bairroPublico !== undefined) {
        update.bairro_publico = String(body.bairroPublico || "").trim().slice(0, 120) || null;
      }
      if (body.whatsappPublico !== undefined) {
        update.whatsapp_publico = String(body.whatsappPublico || "").replace(/\D/g, "").slice(0, 15) || null;
      }
      if (body.descricaoPublica !== undefined) {
        update.descricao_publica = String(body.descricaoPublica || "").trim().slice(0, 2000) || null;
      }
      if (slugRaw !== undefined) {
        const needsSlug = portalAtivo || portalPublicoAtivo;
        if (needsSlug && (!slugRaw || slugRaw.length < 3)) {
          return res.status(400).json({ error: "Defina um endereço público com pelo menos 3 caracteres." });
        }
        update.public_slug = slugRaw || null;
      }

      if (portalPublicoAtivo && update.cidade_publica === undefined) {
        const { data: cur } = await sb
          .from("perfil_lider")
          .select("cidade_publica")
          .eq("id", user.id)
          .maybeSingle();
        const cidadeOk = cur?.cidade_publica || update.cidade_publica;
        if (portalPublicoAtivo && !cidadeOk && body.cidadePublica === undefined) {
          return res.status(400).json({ error: "Informe a cidade para aparecer no diretório público." });
        }
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

      const savedSlug = update.public_slug != null ? String(update.public_slug).trim() : slugRaw || "";
      const { data: saved } = await sb
        .from("perfil_lider")
        .select("public_slug, portal_consulente_ativo, portal_publico_ativo")
        .eq("id", user.id)
        .maybeSingle();
      const finalSlug = saved?.public_slug ? String(saved.public_slug).trim() : savedSlug;
      const savedAtivo = Boolean(saved?.portal_consulente_ativo);
      const savedPublico = Boolean(saved?.portal_publico_ativo);
      res.json({
        success: true,
        tradicao: update.tradicao,
        publicSlug: finalSlug || null,
        portalAtivo: savedAtivo,
        portalPublicoAtivo: savedPublico,
        portalUrl: finalSlug ? `/consulente/${finalSlug}` : null,
        terreiroUrl: finalSlug && savedPublico ? `/terreiros/${finalSlug}` : null,
        listagemPedidosUrl:
          savedAtivo && finalSlug ? `/espaco-do-fiel?casa=${encodeURIComponent(finalSlug)}` : null,
      });
    } catch (e: unknown) {
      console.error("[settings/portal-consulente/post]", e);
      res.status(500).json({ error: "Erro ao guardar portal." });
    }
  });
}
