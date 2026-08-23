import { randomBytes } from "crypto";
import type { Express, Request, Response } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import { apiReadRateLimit, publicFormRateLimit, sensitiveActionRateLimit } from "./rateLimit.js";
import { requireAuthOrRespond } from "./requireAuth.js";
import { assertZeladorTenantAccess, normalizeQueryTenantId } from "./tenantAccess.js";
import { notifyFielPedidoAceito, notifyZeladorNovoPedidoReza } from "./pedidosRezaNotify.js";
import { isPlausibleDiretorioCoordinate, parseGoogleMapsCoordinates } from "../../lib/diretorioCoordinates.js";
import { slugifyCidadeOnly } from "./diretorioSlug.js";
import { slugifyBairro } from "../../lib/diretorioBairro.js";
import { assertSafeImageBuffer } from "./imageUpload.js";
import { safeErrorMessage } from "./safeError.js";

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

function validGoogleMapsUrl(raw: unknown): string | null {
  const value = String(raw || "").trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    const allowed =
      url.protocol === "https:" &&
      (host === "maps.app.goo.gl" ||
        host === "goo.gl" ||
        host === "google.com" ||
        host === "google.com.br" ||
        host.endsWith(".google.com") ||
        host.endsWith(".google.com.br"));
    return allowed ? url.toString() : null;
  } catch {
    return null;
  }
}

function validInstagramUrl(raw: unknown): string | null {
  const value = String(raw || "").trim();
  if (!value) return null;
  try {
    const url = new URL(value.startsWith("http") ? value : `https://${value}`);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    const handle = url.pathname.split("/").filter(Boolean)[0]?.replace(/^@/, "") || "";
    if (host !== "instagram.com" || !/^[a-z0-9._]{1,30}$/i.test(handle)) return null;
    return `https://www.instagram.com/${handle}/`;
  } catch {
    return null;
  }
}

async function geocodeDirectoryAddress(address: string, city: string, state: string) {
  const cep = address.match(/\b\d{5}-?\d{3}\b/)?.[0] || "";
  const queries = [
    `${address}, ${city}, ${state}, Brasil`,
    cep ? `${cep}, ${city}, ${state}, Brasil` : "",
    `${city}, ${state}, Brasil`,
  ].filter(Boolean);
  for (const query of queries) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4500);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=br&q=${encodeURIComponent(query)}`;
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { "User-Agent": "AxeCloudDirectory/1.0 (https://axecloud.com.br)" },
      });
      if (!response.ok) continue;
      const rows = (await response.json()) as Array<{ lat?: string; lon?: string }>;
      const lat = Number(rows[0]?.lat);
      const lng = Number(rows[0]?.lon);
      if (isPlausibleDiretorioCoordinate(lat, lng)) return { lat, lng };
    } catch {
      // O zelador ainda pode informar as coordenadas manualmente.
    } finally {
      clearTimeout(timeout);
    }
  }
  return null;
}

function newAcessoToken(): string {
  return randomBytes(24).toString("base64url");
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

  app.get("/api/v1/settings/directory-profile", apiReadRateLimit, async (req: Request, res: Response) => {
    const user = await requireAuthOrRespond(sb, req, res);
    if (!user) return;
    try {
      const { data, error } = await sb
        .from("terreiros_diretorio")
        .select("id, nome, endereco, telefone, owner_photo_url, link_maps, instagram_url, cidade, estado, slug, bairro, latitude, longitude, verified_at, updated_at")
        .eq("claimed_by_tenant_id", user.id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return res.json({ claimed: false, profile: null });
      const { data: identity } = await sb
        .from("perfil_lider")
        .select("foto_url")
        .eq("id", user.id)
        .maybeSingle();
      return res.json({
        claimed: true,
        identityPhotoUrl: identity?.foto_url || null,
        profile: {
          id: data.id,
          nome: data.nome,
          endereco: data.endereco,
          telefone: data.telefone,
          ownerPhotoUrl: data.owner_photo_url,
          linkMaps: data.link_maps,
          instagramUrl: data.instagram_url,
          cidade: data.cidade,
          estado: data.estado,
          slug: data.slug,
          bairro: data.bairro,
          latitude: data.latitude,
          longitude: data.longitude,
          verificada: Boolean(data.verified_at),
          updatedAt: data.updated_at,
          perfilUrl: data.slug ? `/terreiro/${data.slug}` : null,
        },
      });
    } catch (error: unknown) {
      console.error("[settings/directory-profile/get]", error);
      res.status(500).json({ error: "Erro ao carregar o perfil reivindicado." });
    }
  });

  app.post("/api/v1/settings/directory-profile", sensitiveActionRateLimit, async (req: Request, res: Response) => {
    const user = await requireAuthOrRespond(sb, req, res);
    if (!user) return;
    try {
      const { data: current, error: currentError } = await sb
        .from("terreiros_diretorio")
        .select("id, latitude, longitude, owner_photo_url")
        .eq("claimed_by_tenant_id", user.id)
        .maybeSingle();
      if (currentError) throw currentError;
      if (!current) return res.status(403).json({ error: "Esta conta ainda não possui um perfil reivindicado." });

      const body = req.body && typeof req.body === "object" ? req.body : {};
      const nome = String(body.nome || "").trim().slice(0, 180);
      const endereco = String(body.endereco || "").trim().slice(0, 400);
      const telefone = normalizeWhatsapp(String(body.telefone || "")).slice(0, 15) || null;
      const cidade = String(body.cidade || "").trim().slice(0, 120);
      const estado = String(body.estado || "").trim().toUpperCase().slice(0, 2);
      const bairro = String(body.bairro || "").trim().slice(0, 120) || null;
      const linkMaps = validGoogleMapsUrl(body.linkMaps);
      const instagramUrl = validInstagramUrl(body.instagramUrl);
      if (nome.length < 3) return res.status(400).json({ error: "Informe o nome público da casa." });
      if (endereco.length < 8) return res.status(400).json({ error: "Informe o endereço completo." });
      if (cidade.length < 2) return res.status(400).json({ error: "Informe a cidade." });
      if (!/^[A-Z]{2}$/.test(estado)) return res.status(400).json({ error: "Informe uma UF válida." });
      if (body.linkMaps && !linkMaps) return res.status(400).json({ error: "Informe um link válido do Google Maps." });
      if (body.instagramUrl && !instagramUrl) return res.status(400).json({ error: "Informe um perfil válido do Instagram." });

      let latitude = Number(body.latitude);
      let longitude = Number(body.longitude);
      let coordinateSource = "owner_settings";
      if (!isPlausibleDiretorioCoordinate(latitude, longitude)) {
        const parsed = parseGoogleMapsCoordinates(linkMaps);
        latitude = parsed?.lat ?? Number(current.latitude);
        longitude = parsed?.lng ?? Number(current.longitude);
        coordinateSource = parsed ? "owner_google_maps_url" : "owner_settings_address";
      }
      if (!isPlausibleDiretorioCoordinate(latitude, longitude)) {
        const geocoded = await geocodeDirectoryAddress(endereco, cidade, estado);
        latitude = geocoded?.lat ?? Number.NaN;
        longitude = geocoded?.lng ?? Number.NaN;
        coordinateSource = geocoded ? "owner_address_geocoded" : "owner_settings_address";
      }

      const photoSourceRaw = String(body.photoSource || "").trim().toLowerCase();
      const photoSource =
        photoSourceRaw === "identity" || photoSourceRaw === "custom" || photoSourceRaw === "none"
          ? photoSourceRaw
          : body.useIdentityPhoto === true
            ? "identity"
            : body.useIdentityPhoto === false
              ? "none"
              : "custom";

      let ownerPhotoUrl: string | null = current.owner_photo_url ? String(current.owner_photo_url) : null;
      if (photoSource === "identity") {
        const { data: identity, error: identityError } = await sb
          .from("perfil_lider")
          .select("foto_url")
          .eq("id", user.id)
          .maybeSingle();
        if (identityError) throw identityError;
        ownerPhotoUrl = identity?.foto_url ? String(identity.foto_url) : null;
        if (!ownerPhotoUrl) return res.status(400).json({ error: "Adicione primeiro uma foto em Conta e Casa." });
      } else if (photoSource === "none") {
        ownerPhotoUrl = null;
      } else {
        const requested = String(body.ownerPhotoUrl || "").trim();
        if (requested) {
          let parsed: URL;
          try {
            parsed = new URL(requested);
          } catch {
            return res.status(400).json({ error: "URL da foto do diretório inválida." });
          }
          if (parsed.protocol !== "https:") {
            return res.status(400).json({ error: "A foto do diretório precisa usar HTTPS." });
          }
          ownerPhotoUrl = requested.slice(0, 800);
        } else if (!ownerPhotoUrl) {
          return res.status(400).json({ error: "Envie uma foto para o diretório ou escolha outra opção." });
        }
      }

      const update: Record<string, unknown> = {
        nome,
        endereco,
        telefone,
        cidade,
        estado,
        cidade_slug: slugifyCidadeOnly(cidade),
        bairro,
        bairro_slug: bairro ? slugifyBairro(bairro) : null,
        link_maps: linkMaps,
        instagram_url: instagramUrl,
        owner_photo_url: ownerPhotoUrl,
      };
      const hasCoordinates = isPlausibleDiretorioCoordinate(latitude, longitude);
      if (hasCoordinates) {
        update.latitude = latitude;
        update.longitude = longitude;
        update.coordinate_source = coordinateSource;
      }

      const { data: saved, error: saveError } = await sb
        .from("terreiros_diretorio")
        .update(update)
        .eq("id", current.id)
        .eq("claimed_by_tenant_id", user.id)
        .select("slug, updated_at, owner_photo_url")
        .single();
      if (saveError) throw saveError;
      return res.json({
        success: true,
        perfilUrl: saved?.slug ? `/terreiro/${saved.slug}` : null,
        updatedAt: saved?.updated_at || new Date().toISOString(),
        ownerPhotoUrl: saved?.owner_photo_url || null,
        warning: hasCoordinates ? null : "Dados salvos, mas a posição no mapa precisa de latitude e longitude.",
      });
    } catch (error: unknown) {
      console.error("[settings/directory-profile/post]", error);
      res.status(500).json({ error: "Erro ao atualizar o perfil do diretório." });
    }
  });

  app.post("/api/v1/settings/directory-profile/upload-photo", sensitiveActionRateLimit, async (req: Request, res: Response) => {
    const user = await requireAuthOrRespond(sb, req, res);
    if (!user) return;
    try {
      const { data: current, error: currentError } = await sb
        .from("terreiros_diretorio")
        .select("id")
        .eq("claimed_by_tenant_id", user.id)
        .maybeSingle();
      if (currentError) throw currentError;
      if (!current) return res.status(403).json({ error: "Esta conta ainda não possui um perfil reivindicado." });

      const fileData = String(req.body?.fileData || "");
      const fileName = String(req.body?.fileName || "").trim();
      const contentType = String(req.body?.contentType || "image/jpeg");
      if (!fileData || !fileName) return res.status(400).json({ error: "Dados da imagem ausentes." });

      const ext = (fileName.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
      const safeName = `diretorio/${user.id}-${Date.now()}.${ext}`.slice(0, 160);
      const buffer = Buffer.from(fileData, "base64");
      const safeContentType = assertSafeImageBuffer(buffer, contentType);
      if (buffer.length > 5 * 1024 * 1024) {
        return res.status(400).json({ error: "Imagem maior que 5 MB." });
      }

      const { error: uploadError } = await sb.storage.from("perfil_fotos").upload(safeName, buffer, {
        contentType: safeContentType,
        upsert: true,
      });
      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = sb.storage.from("perfil_fotos").getPublicUrl(safeName);

      return res.json({ publicUrl });
    } catch (error: unknown) {
      console.error("[settings/directory-profile/upload-photo]", error);
      res.status(500).json({ error: safeErrorMessage(error, "Erro ao enviar foto do diretório.") });
    }
  });

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
        terreiroUrl: slug && data.portal_publico_ativo ? `/terreiro/${slug}` : null,
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
        terreiroUrl: finalSlug && savedPublico ? `/terreiro/${finalSlug}` : null,
        listagemPedidosUrl:
          savedAtivo && finalSlug ? `/espaco-do-fiel?casa=${encodeURIComponent(finalSlug)}` : null,
      });
    } catch (e: unknown) {
      console.error("[settings/portal-consulente/post]", e);
      res.status(500).json({ error: "Erro ao guardar portal." });
    }
  });
}
