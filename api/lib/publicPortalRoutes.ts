import { createHash } from "crypto";
import type { Express, Request, Response } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import { apiReadRateLimit, publicFormRateLimit } from "./rateLimit.js";
import { slugifyPublicSlug } from "./consulentePortalRoutes.js";
import { parseCitySlug, slugifyCity } from "./portalCitySlug.js";
import { requireAuthOrRespond } from "./requireAuth.js";
import { resolvePublicMediaUrl } from "./r2PublicMedia.js";
import { newPublicToken, emitirSenhaVisitante, sendSenhaVisitanteWhatsApp } from "./giraOperationsRoutes.js";

function buildEventoPublicPagePath(token: string): string {
  return `/evento/${encodeURIComponent(token)}`;
}

type Deps = { supabaseAdmin: SupabaseClient };

const TERREIRO_PUBLIC_SELECT =
  "id, nome_terreiro, foto_url, tradicao, public_slug, portal_consulente_ativo, portal_consulente_mensagem, descricao_publica, cidade_publica, estado_publico, bairro_publico, whatsapp_publico, casa_verificada, portal_destaque, portal_publico_ativo";

function hashIp(req: Request): string {
  const ip = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown").split(",")[0].trim();
  const salt = process.env.PORTAL_VIEW_SALT || "axecloud-portal";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 20);
}

function mapTerreiroRow(row: Record<string, unknown>) {
  const slug = String(row.public_slug || "").trim();
  const cidade = String(row.cidade_publica || "").trim();
  const estado = String(row.estado_publico || "").trim();
  return {
    slug,
    nome: String(row.nome_terreiro || "Terreiro").trim(),
    fotoUrl: row.foto_url ? String(row.foto_url) : null,
    tradicao: String(row.tradicao || "mista"),
    descricao: row.descricao_publica ? String(row.descricao_publica) : null,
    cidade: cidade || null,
    estado: estado || null,
    bairro: row.bairro_publico ? String(row.bairro_publico) : null,
    whatsapp: row.whatsapp_publico ? String(row.whatsapp_publico) : null,
    verificada: Boolean(row.casa_verificada),
    destaque: Boolean(row.portal_destaque),
    pedidosAtivos: Boolean(row.portal_consulente_ativo),
    mensagemPedidos: row.portal_consulente_mensagem ? String(row.portal_consulente_mensagem) : null,
    perfilUrl: slug ? `/terreiros/${slug}` : null,
    pedidosUrl: slug && row.portal_consulente_ativo ? `/espaco-do-fiel?casa=${encodeURIComponent(slug)}` : null,
    cidadeSlug: cidade ? slugifyCity(cidade, estado) : null,
  };
}

async function findPublicTerreiro(sb: SupabaseClient, slug: string) {
  const s = slugifyPublicSlug(slug);
  if (!s || s.length < 3) return null;
  const { data, error } = await sb
    .from("perfil_lider")
    .select(TERREIRO_PUBLIC_SELECT)
    .eq("portal_publico_ativo", true)
    .is("deleted_at", null)
    .ilike("public_slug", s)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

export function registerPublicPortalRoutes(app: Express, { supabaseAdmin: sb }: Deps) {
  app.get("/api/v1/public/terreiros", apiReadRateLimit, async (req: Request, res: Response) => {
    try {
      const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);
      const limit = Math.min(48, Math.max(1, parseInt(String(req.query.limit || "24"), 10) || 24));
      const offset = (page - 1) * limit;
      const q = String(req.query.q || "").trim().toLowerCase();
      const tradicao = String(req.query.tradicao || "").trim().toLowerCase();
      const cidadeSlug = String(req.query.cidade || "").trim().toLowerCase();

      let query = sb
        .from("perfil_lider")
        .select(TERREIRO_PUBLIC_SELECT, { count: "exact" })
        .eq("portal_publico_ativo", true)
        .is("deleted_at", null)
        .not("public_slug", "is", null)
        .order("portal_destaque", { ascending: false })
        .order("nome_terreiro", { ascending: true })
        .range(offset, offset + limit - 1);

      if (tradicao && tradicao !== "todas") query = query.eq("tradicao", tradicao);
      if (q) query = query.or(`nome_terreiro.ilike.%${q}%,cidade_publica.ilike.%${q}%,bairro_publico.ilike.%${q}%`);

      const { data, error, count } = await query;
      if (error) throw error;

      let items = (data || []).map((r) => mapTerreiroRow(r as Record<string, unknown>));
      if (cidadeSlug) {
        items = items.filter((t) => t.cidadeSlug === cidadeSlug);
      }

      res.json({
        page,
        limit,
        total: count ?? items.length,
        items,
      });
    } catch (e: unknown) {
      console.error("[public/terreiros]", e);
      res.status(500).json({ error: "Erro ao listar terreiros." });
    }
  });

  app.get("/api/v1/public/terreiros/cidades", apiReadRateLimit, async (_req: Request, res: Response) => {
    try {
      const { data, error } = await sb
        .from("perfil_lider")
        .select("cidade_publica, estado_publico")
        .eq("portal_publico_ativo", true)
        .is("deleted_at", null)
        .not("cidade_publica", "is", null);
      if (error) throw error;

      const map = new Map<string, { cidade: string; estado: string | null; count: number; slug: string }>();
      for (const row of data || []) {
        const cidade = String(row.cidade_publica || "").trim();
        if (!cidade) continue;
        const estado = row.estado_publico ? String(row.estado_publico).trim() : null;
        const slug = slugifyCity(cidade, estado);
        const cur = map.get(slug);
        if (cur) cur.count += 1;
        else map.set(slug, { cidade, estado, count: 1, slug });
      }

      const cidades = [...map.values()].sort((a, b) => b.count - a.count || a.cidade.localeCompare(b.cidade, "pt-BR"));
      res.json({ cidades });
    } catch (e: unknown) {
      console.error("[public/terreiros/cidades]", e);
      res.status(500).json({ error: "Erro ao listar cidades." });
    }
  });

  app.get("/api/v1/public/terreiros/cidade/:citySlug", apiReadRateLimit, async (req: Request, res: Response) => {
    try {
      const citySlug = String(req.params.citySlug || "").trim().toLowerCase();
      const { cityPart, state } = parseCitySlug(citySlug);

      const { data, error } = await sb
        .from("perfil_lider")
        .select(TERREIRO_PUBLIC_SELECT)
        .eq("portal_publico_ativo", true)
        .is("deleted_at", null)
        .not("public_slug", "is", null);
      if (error) throw error;

      const items = (data || [])
        .map((r) => mapTerreiroRow(r as Record<string, unknown>))
        .filter((t) => {
          if (t.cidadeSlug === citySlug) return true;
          if (!t.cidade) return false;
          const norm = t.cidade
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase();
          return norm.includes(cityPart.replace(/-/g, " ")) && (!state || t.estado?.toLowerCase() === state);
        });

      const first = items[0];
      res.json({
        slug: citySlug,
        cidade: first?.cidade || cityPart.replace(/-/g, " "),
        estado: first?.estado || state?.toUpperCase() || null,
        total: items.length,
        items,
      });
    } catch (e: unknown) {
      console.error("[public/terreiros/cidade]", e);
      res.status(500).json({ error: "Erro ao carregar cidade." });
    }
  });

  app.get("/api/v1/public/terreiros/:slug", apiReadRateLimit, async (req: Request, res: Response) => {
    try {
      const row = await findPublicTerreiro(sb, req.params.slug);
      if (!row) return res.status(404).json({ error: "Terreiro não encontrado no diretório público." });

      void sb
        .from("portal_profile_views")
        .insert({ leader_id: row.id, ip_hash: hashIp(req) })
        .then(({ error }) => {
          if (error) console.warn("[portal_profile_views]", error.message);
        });

      const { count } = await sb
        .from("portal_profile_views")
        .select("id", { count: "exact", head: true })
        .eq("leader_id", row.id);

      res.json({
        ...mapTerreiroRow(row as Record<string, unknown>),
        visualizacoes: count ?? 0,
      });
    } catch (e: unknown) {
      console.error("[public/terreiros/slug]", e);
      res.status(500).json({ error: "Erro ao carregar terreiro." });
    }
  });

  app.get("/api/v1/public/eventos", apiReadRateLimit, async (req: Request, res: Response) => {
    try {
      const limit = Math.min(60, Math.max(1, parseInt(String(req.query.limit || "30"), 10) || 30));
      const cidadeSlug = String(req.query.cidade || "").trim().toLowerCase();
      const today = new Date().toISOString().slice(0, 10);

      const { data: events, error } = await sb
        .from("calendario_axe")
        .select(
          "id, titulo, data, hora, tipo, descricao, banner_url, lider_id, tenant_id, evento_publico, evento_public_token, senhas_ativas, senhas_maximas"
        )
        .eq("evento_publico", true)
        .gte("data", today)
        .order("data", { ascending: true })
        .order("hora", { ascending: true })
        .limit(limit * 3);
      if (error) throw error;

      const leaderIds = [...new Set((events || []).map((e) => e.lider_id).filter(Boolean))];
      const { data: leaders } = await sb
        .from("perfil_lider")
        .select("id, nome_terreiro, public_slug, cidade_publica, estado_publico, portal_publico_ativo")
        .in("id", leaderIds.length ? leaderIds : ["00000000-0000-0000-0000-000000000000"]);

      const leaderMap = new Map((leaders || []).map((l) => [l.id, l]));

      let items = (events || [])
        .map((ev) => {
          const leader = leaderMap.get(ev.lider_id);
          if (!leader?.portal_publico_ativo || !leader.public_slug) return null;
          const cidade = leader.cidade_publica ? String(leader.cidade_publica) : null;
          const estado = leader.estado_publico ? String(leader.estado_publico) : null;
          return {
            id: ev.id,
            titulo: ev.titulo,
            data: ev.data,
            hora: ev.hora,
            tipo: ev.tipo,
            descricao: ev.descricao || "",
            bannerUrl: resolvePublicMediaUrl(ev.banner_url) || null,
            senhasAtivas: Boolean(ev.senhas_ativas),
            eventoPageUrl: ev.evento_public_token
              ? buildEventoPublicPagePath(String(ev.evento_public_token))
              : null,
            terreiro: {
              nome: leader.nome_terreiro,
              slug: leader.public_slug,
              cidade,
              estado,
              perfilUrl: `/terreiros/${leader.public_slug}`,
            },
            cidadeSlug: cidade ? slugifyCity(cidade, estado) : null,
          };
        })
        .filter(Boolean);

      if (cidadeSlug) {
        items = items.filter((i) => i && i.cidadeSlug === cidadeSlug);
      }

      res.json({ items: items.slice(0, limit) });
    } catch (e: unknown) {
      console.error("[public/eventos]", e);
      res.status(500).json({ error: "Erro ao listar eventos." });
    }
  });

  app.get("/api/v1/public/evento/:token", apiReadRateLimit, async (req: Request, res: Response) => {
    try {
      const token = String(req.params.token || "").trim();
      let { data: event, error } = await sb
        .from("calendario_axe")
        .select(
          "id, titulo, data, hora, tipo, descricao, banner_url, lider_id, tenant_id, evento_publico, evento_public_token, senhas_ativas, senhas_maximas, senhas_public_token"
        )
        .eq("evento_public_token", token)
        .maybeSingle();
      if (error) throw error;

      if (!event || (!event.evento_publico && !event.senhas_ativas)) {
        return res.status(404).json({ error: "Evento não encontrado ou não está público." });
      }

      if (!event.evento_public_token) {
        const newToken = newPublicToken();
        const { data: patched } = await sb
          .from("calendario_axe")
          .update({ evento_public_token: newToken })
          .eq("id", event.id)
          .select(
            "id, titulo, data, hora, tipo, descricao, banner_url, lider_id, tenant_id, evento_publico, evento_public_token, senhas_ativas, senhas_maximas, senhas_public_token"
          )
          .single();
        if (patched) event = patched;
      }

      const leaderId = String(event.lider_id || event.tenant_id || "");
      const { data: leader } = await sb
        .from("perfil_lider")
        .select("nome_terreiro, public_slug, cidade_publica, estado_publico, portal_publico_ativo")
        .eq("id", leaderId)
        .maybeSingle();

      if (!leader?.portal_publico_ativo || !leader.public_slug) {
        return res.status(404).json({ error: "Terreiro não disponível no portal." });
      }

      const { count } = await sb
        .from("evento_senhas")
        .select("id", { count: "exact", head: true })
        .eq("event_id", event.id);

      const emitidas = count ?? 0;
      const max =
        event.senhas_maximas != null && Number(event.senhas_maximas) > 0
          ? Number(event.senhas_maximas)
          : null;

      if (event.senhas_ativas && !event.senhas_public_token) {
        const senhasToken = newPublicToken();
        const { data: patchedSenhas } = await sb
          .from("calendario_axe")
          .update({ senhas_public_token: senhasToken })
          .eq("id", event.id)
          .select("senhas_public_token")
          .single();
        if (patchedSenhas?.senhas_public_token) {
          event.senhas_public_token = patchedSenhas.senhas_public_token;
        }
      }

      const cidade = leader.cidade_publica ? String(leader.cidade_publica) : null;
      const estado = leader.estado_publico ? String(leader.estado_publico) : null;

      res.setHeader("Cache-Control", "public, max-age=60");
      res.json({
        id: event.id,
        titulo: event.titulo,
        data: event.data,
        hora: event.hora,
        tipo: event.tipo,
        descricao: event.descricao || "",
        bannerUrl: resolvePublicMediaUrl(event.banner_url) || null,
        senhasAtivas: Boolean(event.senhas_ativas),
        senhasEmitidas: emitidas,
        senhasMaximas: max,
        senhasRestantes: max != null ? Math.max(0, max - emitidas) : null,
        esgotado: max != null && emitidas >= max,
        senhasPublicToken: event.senhas_public_token || null,
        terreiro: {
          nome: leader.nome_terreiro,
          slug: leader.public_slug,
          cidade,
          estado,
          perfilUrl: `/terreiros/${leader.public_slug}`,
        },
      });
    } catch (e: unknown) {
      console.error("[public/evento]", e);
      res.status(500).json({ error: "Erro ao carregar evento." });
    }
  });

  app.post("/api/v1/public/evento/:token/emitir-senha", apiReadRateLimit, async (req: Request, res: Response) => {
    try {
      const token = String(req.params.token || "").trim();
      const nome = String(req.body?.nome || "").trim();
      const telefone = String(req.body?.telefone || "").trim();
      if (!nome) return res.status(400).json({ error: "Nome obrigatório." });
      if (!telefone) return res.status(400).json({ error: "WhatsApp obrigatório." });

      const { data: event } = await sb
        .from("calendario_axe")
        .select("*")
        .eq("evento_public_token", token)
        .eq("evento_publico", true)
        .maybeSingle();
      if (!event || !event.senhas_ativas || !event.senhas_public_token) {
        return res.status(404).json({ error: "Emissão de senhas indisponível." });
      }

      let senhaRow: Record<string, unknown>;
      let numero: number;
      try {
        const result = await emitirSenhaVisitante(sb, event, nome, telefone);
        senhaRow = result.data;
        numero = result.numero;
      } catch (err: unknown) {
        const e = err as Error & { statusCode?: number };
        return res.status(e.statusCode || 500).json({ error: e.message || "Erro ao emitir senha." });
      }

      void sendSenhaVisitanteWhatsApp(sb, event, senhaRow);

      res.setHeader("Cache-Control", "private, no-store");
      res.json({
        success: true,
        senha: numero,
        nome: senhaRow.nome,
        eventTitle: event.titulo,
        whatsappEnviado: true,
      });
    } catch (e: unknown) {
      console.error("[public/evento emitir-senha]", e);
      res.status(500).json({ error: "Erro ao emitir senha." });
    }
  });

  app.get("/api/v1/public/widget/:slug", apiReadRateLimit, async (req: Request, res: Response) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    try {
      const row = await findPublicTerreiro(sb, req.params.slug);
      if (!row) return res.status(404).json({ error: "Terreiro não encontrado." });

      const { data: nextEvent } = await sb
        .from("calendario_axe")
        .select("titulo, data, hora, tipo")
        .eq("lider_id", row.id)
        .eq("evento_publico", true)
        .gte("data", new Date().toISOString().slice(0, 10))
        .order("data", { ascending: true })
        .limit(1)
        .maybeSingle();

      const mapped = mapTerreiroRow(row as Record<string, unknown>);
      res.json({
        ...mapped,
        proximoEvento: nextEvent || null,
        embedUrl: mapped.perfilUrl,
        pedidosUrl: mapped.pedidosUrl,
      });
    } catch (e: unknown) {
      console.error("[public/widget]", e);
      res.status(500).json({ error: "Erro no widget." });
    }
  });

  app.get("/api/v1/public/sitemap-paths", apiReadRateLimit, async (_req: Request, res: Response) => {
    try {
      const { data: terreiros } = await sb
        .from("perfil_lider")
        .select("public_slug, cidade_publica, estado_publico")
        .eq("portal_publico_ativo", true)
        .is("deleted_at", null)
        .not("public_slug", "is", null);

      const paths: string[] = ["/terreiros", "/eventos"];
      const citySlugs = new Set<string>();
      for (const t of terreiros || []) {
        const slug = String(t.public_slug || "").trim();
        if (slug) paths.push(`/terreiros/${slug}`);
        const cs = t.cidade_publica ? slugifyCity(String(t.cidade_publica), t.estado_publico) : "";
        if (cs) citySlugs.add(cs);
      }
      for (const cs of citySlugs) paths.push(`/terreiros/cidade/${cs}`);

      res.json({ paths });
    } catch (e: unknown) {
      console.error("[public/sitemap-paths]", e);
      res.status(500).json({ error: "Erro ao gerar paths." });
    }
  });

  app.post("/api/v1/public/newsletter/subscribe", publicFormRateLimit, async (req: Request, res: Response) => {
    const email = String(req.body?.email || "")
      .trim()
      .toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "E-mail inválido." });
    }
    const cidade = req.body?.cidade ? String(req.body.cidade).trim().slice(0, 120) : null;
    const estado = req.body?.estado ? String(req.body.estado).trim().slice(0, 2).toUpperCase() : null;
    try {
      const { error } = await sb.from("portal_newsletter").upsert(
        { email, cidade, estado },
        { onConflict: "email", ignoreDuplicates: false },
      );
      if (error) throw error;
      res.json({ success: true });
    } catch (e: unknown) {
      console.error("[public/newsletter]", e);
      res.status(500).json({ error: "Erro ao inscrever na newsletter." });
    }
  });

  app.post("/api/v1/public/denuncias", publicFormRateLimit, async (req: Request, res: Response) => {
    const motivo = String(req.body?.motivo || "").trim().slice(0, 200);
    const detalhe = req.body?.detalhe ? String(req.body.detalhe).trim().slice(0, 2000) : null;
    const email = req.body?.email ? String(req.body.email).trim().slice(0, 200) : null;
    const slug = req.body?.slug ? slugifyPublicSlug(String(req.body.slug)) : null;
    if (!motivo) return res.status(400).json({ error: "Informe o motivo da denúncia." });

    try {
      let leaderId: string | null = null;
      if (slug) {
        const row = await findPublicTerreiro(sb, slug);
        leaderId = row?.id ?? null;
      }
      const { error } = await sb.from("portal_denuncias").insert({
        leader_id: leaderId,
        motivo,
        detalhe,
        email_contacto: email,
      });
      if (error) throw error;
      res.json({ success: true });
    } catch (e: unknown) {
      console.error("[public/denuncias]", e);
      res.status(500).json({ error: "Erro ao registar denúncia." });
    }
  });

  app.get("/api/v1/settings/portal-stats", apiReadRateLimit, async (req: Request, res: Response) => {
    const user = await requireAuthOrRespond(sb, req, res);
    if (!user) return;
    try {
      const { count } = await sb
        .from("portal_profile_views")
        .select("id", { count: "exact", head: true })
        .eq("leader_id", user.id);
      const { data: profile } = await sb
        .from("perfil_lider")
        .select("portal_publico_ativo, casa_verificada")
        .eq("id", user.id)
        .maybeSingle();
      res.json({
        visualizacoes: count ?? 0,
        portalPublicoAtivo: Boolean(profile?.portal_publico_ativo),
        casaVerificada: Boolean(profile?.casa_verificada),
      });
    } catch (e: unknown) {
      console.error("[settings/portal-stats]", e);
      res.status(500).json({ error: "Erro ao carregar estatísticas." });
    }
  });
}
