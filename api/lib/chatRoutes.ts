import type { Express, Request, Response } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { S3Client } from "@aws-sdk/client-s3";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import webpush from "web-push";
import { requireAuthOrRespond } from "./requireAuth.js";
import {
  assertUserCanAccessTenant,
  assertZeladorOrGlobalAdmin,
  normalizeFilhoRequestTenantId,
  normalizeQueryTenantId,
  resolveFinanceiroTenantScope,
  resolveLeaderId,
  resolveTenantAccessForUser,
} from "./tenantAccess.js";
import { requireApiTenantRead } from "./routeAuthHelpers.js";
import { buildR2PublicUrlFromKey, resolvePublicMediaUrl } from "./r2PublicMedia.js";
import { safeErrorMessage } from "./safeError.js";
import { isConsoleGlobalAdmin } from "./consoleAdmin.js";

const CHAT_IMAGE_MAX = 20 * 1024 * 1024;
const CHAT_VIDEO_MAX = 200 * 1024 * 1024;
const CHAT_AUDIO_MAX = 50 * 1024 * 1024;

type Deps = {
  supabaseAdmin: SupabaseClient;
  r2Client: S3Client | null;
  bucketName: string | undefined;
  resolveLeaderIdFn: (sb: SupabaseClient, id: string) => Promise<string>;
};

type FilhoRow = {
  id: string;
  nome?: string | null;
  foto_url?: string | null;
  cargo?: string | null;
  user_id?: string | null;
  tenant_id?: string | null;
  lider_id?: string | null;
  status?: string | null;
  email?: string | null;
};

function slugifyFileName(str: string): string {
  return String(str || "file")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .slice(0, 120);
}

function buildFilhoFilhoDirectKey(a: string, b: string): string {
  const [x, y] = [a, b].sort();
  return `f:${x}:${y}`;
}

function buildFilhoZeladorDirectKey(filhoId: string): string {
  return `z:${filhoId}`;
}

function messagePreview(type: string, body: string | null): string {
  if (type === "image") return "📷 Foto";
  if (type === "video") return "🎬 Vídeo";
  if (type === "audio") return "🎤 Áudio";
  return String(body || "").trim().slice(0, 120) || "Mensagem";
}

async function loadFilhoForUser(
  supabaseAdmin: SupabaseClient,
  user: { id: string; email?: string | null }
): Promise<FilhoRow | null> {
  const cols = "id, nome, foto_url, cargo, user_id, tenant_id, lider_id, status, email";
  let { data: child } = await supabaseAdmin
    .from("filhos_de_santo")
    .select(cols)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!child) {
    const email = String(user.email || "").trim().toLowerCase();
    if (email) {
      const { data: byEmail } = await supabaseAdmin
        .from("filhos_de_santo")
        .select(cols)
        .ilike("email", email)
        .maybeSingle();
      child = byEmail;
    }
  }
  return child as FilhoRow | null;
}

function isFilhoAtivo(status: string | null | undefined): boolean {
  return String(status || "").toLowerCase() !== "inativo";
}

/** Lista filhos do terreiro — mesmo critério amplo de /api/children (lider_id / tenant_id). */
async function loadFilhosDaCorrente(
  supabaseAdmin: SupabaseClient,
  resolveLeaderIdFn: (sb: SupabaseClient, id: string) => Promise<string>,
  tenantId: string,
  leaderUserId: string
): Promise<FilhoRow[]> {
  const resolved = await resolveLeaderIdFn(supabaseAdmin, tenantId);
  const cols = "id, nome, foto_url, cargo, user_id, tenant_id, lider_id, status, email";
  const orParts = [
    `tenant_id.eq.${tenantId}`,
    `tenant_id.eq.${resolved}`,
    `lider_id.eq.${tenantId}`,
    `lider_id.eq.${resolved}`,
    `lider_id.eq.${leaderUserId}`,
  ];
  const { data, error } = await supabaseAdmin
    .from("filhos_de_santo")
    .select(cols)
    .or(orParts.join(","))
    .order("nome", { ascending: true });
  if (error) throw error;

  const seen = new Set<string>();
  const rows: FilhoRow[] = [];
  for (const row of data || []) {
    const f = row as FilhoRow;
    if (!isFilhoAtivo(f.status)) continue;
    if (seen.has(f.id)) continue;
    seen.add(f.id);
    rows.push(f);
  }
  return rows;
}

async function resolveTenantIdForRequest(
  supabaseAdmin: SupabaseClient,
  user: { id: string; email?: string | null },
  tenantIdRaw: unknown
): Promise<string> {
  const normalized = await normalizeFilhoRequestTenantId(
    supabaseAdmin,
    user,
    normalizeQueryTenantId(tenantIdRaw)
  );
  if (normalized) return normalized;
  const access = await resolveTenantAccessForUser(supabaseAdmin, user.id, user.email);
  return access.tenantId;
}

async function assertParticipant(
  supabaseAdmin: SupabaseClient,
  conversationId: string,
  userId: string
): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("chat_participants")
    .select("id")
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
    .maybeSingle();
  return !!data;
}

async function loadLeaderUserId(
  supabaseAdmin: SupabaseClient,
  resolveLeaderIdFn: (sb: SupabaseClient, id: string) => Promise<string>,
  tenantId: string
): Promise<string> {
  const leaderId = await resolveLeaderIdFn(supabaseAdmin, tenantId);
  const { data } = await supabaseAdmin
    .from("perfil_lider")
    .select("id")
    .or(`id.eq.${leaderId},tenant_id.eq.${tenantId}`)
    .limit(1)
    .maybeSingle();
  return String(data?.id || leaderId);
}

async function enrichParticipants(
  supabaseAdmin: SupabaseClient,
  rows: Array<{
    user_id: string;
    participant_type: string;
    filho_id?: string | null;
  }>
) {
  const filhoIds = rows.map((r) => r.filho_id).filter(Boolean) as string[];
  const adminIds = rows.filter((r) => r.participant_type === "admin").map((r) => r.user_id);

  const filhosMap = new Map<string, FilhoRow>();
  if (filhoIds.length > 0) {
    const { data: filhos } = await supabaseAdmin
      .from("filhos_de_santo")
      .select("id, nome, foto_url, cargo, user_id")
      .in("id", filhoIds);
    for (const f of filhos || []) filhosMap.set(f.id, f as FilhoRow);
  }

  const leaderMap = new Map<string, { nome: string; foto_url: string | null; cargo: string | null }>();
  if (adminIds.length > 0) {
    const { data: leaders } = await supabaseAdmin
      .from("perfil_lider")
      .select("id, nome_terreiro, foto_url, cargo")
      .in("id", adminIds);
    for (const l of leaders || []) {
      leaderMap.set(l.id, {
        nome: String(l.cargo || "Zelador(a)"),
        foto_url: l.foto_url,
        cargo: l.cargo,
      });
    }
  }

  return rows.map((r) => {
    if (r.participant_type === "filho" && r.filho_id) {
      const f = filhosMap.get(r.filho_id);
      return {
        userId: r.user_id,
        participantType: "filho" as const,
        filhoId: r.filho_id,
        nome: f?.nome || "Filho de Santo",
        fotoUrl: f?.foto_url || null,
        cargo: f?.cargo || null,
      };
    }
    const leader = leaderMap.get(r.user_id);
    return {
      userId: r.user_id,
      participantType: "admin" as const,
      filhoId: null,
      nome: leader?.nome || "Zelador(a)",
      fotoUrl: leader?.foto_url || null,
      cargo: leader?.cargo || null,
    };
  });
}

async function sendChatPushToUsers(
  supabaseAdmin: SupabaseClient,
  userIds: string[],
  payload: { title: string; body: string; url: string },
  excludeUserId?: string
): Promise<void> {
  const targets = [...new Set(userIds.filter((id) => id && id !== excludeUserId))];
  if (targets.length === 0) return;

  const { data: subs } = await supabaseAdmin
    .from("push_subscriptions")
    .select("subscription_object")
    .in("user_id", targets);

  const json = JSON.stringify(payload);
  await Promise.all(
    (subs || []).map((sub: { subscription_object: webpush.PushSubscription }) =>
      webpush.sendNotification(sub.subscription_object, json).catch((err: { statusCode?: number }) => {
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          const endpoint = (sub.subscription_object as { endpoint?: string })?.endpoint;
          if (endpoint) {
            return supabaseAdmin
              .from("push_subscriptions")
              .delete()
              .eq("subscription_object->>endpoint", endpoint);
          }
        }
      })
    )
  );
}

export function registerChatRoutes(app: Express, deps: Deps) {
  const { supabaseAdmin, r2Client, bucketName, resolveLeaderIdFn } = deps;

  app.get("/api/v1/chat/contacts", async (req: Request, res: Response) => {
    const user = await requireAuthOrRespond(supabaseAdmin, req, res);
    if (!user) return;
    try {
      const tenantIdFromQuery = normalizeQueryTenantId(req.query.tenantId);
      const userRoleQ = String(req.query.userRole || "");
      const tenantId =
        (await resolveFinanceiroTenantScope(
          supabaseAdmin,
          user.id,
          userRoleQ || undefined,
          tenantIdFromQuery
        )) || (await resolveTenantIdForRequest(supabaseAdmin, user, tenantIdFromQuery));

      if (!tenantId) return res.status(400).json({ error: "tenantId inválido" });
      const ok = await assertUserCanAccessTenant(supabaseAdmin, user, tenantId);
      if (!ok) return res.status(403).json({ error: "Acesso negado" });

      const selfFilho = await loadFilhoForUser(supabaseAdmin, user);
      const leaderId = await resolveLeaderIdFn(supabaseAdmin, tenantId);
      const leaderUserId = await loadLeaderUserId(supabaseAdmin, resolveLeaderIdFn, tenantId);

      const filhos = await loadFilhosDaCorrente(
        supabaseAdmin,
        resolveLeaderIdFn,
        tenantId,
        leaderUserId || user.id
      );

      const contacts = filhos
        .filter((f) => !selfFilho || f.id !== selfFilho.id)
        .map((f) => ({
          filhoId: f.id,
          userId: f.user_id,
          nome: f.nome,
          fotoUrl: f.foto_url,
          cargo: f.cargo,
          status: f.status,
          canChat: !!f.user_id,
        }));

      res.json({ contacts, leaderId });
    } catch (error: unknown) {
      console.error("[CHAT] contacts:", error);
      res.status(500).json({ error: safeErrorMessage(error, "Erro ao listar contatos") });
    }
  });

  app.get("/api/v1/chat/conversations", async (req: Request, res: Response) => {
    const user = await requireAuthOrRespond(supabaseAdmin, req, res);
    if (!user) return;
    try {
      const tenantId = await resolveTenantIdForRequest(supabaseAdmin, user, req.query.tenantId);
      if (!tenantId) return res.status(400).json({ error: "tenantId inválido" });
      const ok = await assertUserCanAccessTenant(supabaseAdmin, user, tenantId);
      if (!ok) return res.status(403).json({ error: "Acesso negado" });

      const { data: memberships, error: memErr } = await supabaseAdmin
        .from("chat_participants")
        .select("conversation_id, last_read_at")
        .eq("user_id", user.id)
        .eq("tenant_id", tenantId);
      if (memErr) throw memErr;

      const convIds = (memberships || []).map((m) => m.conversation_id);
      if (convIds.length === 0) return res.json({ conversations: [] });

      const readMap = new Map(
        (memberships || []).map((m) => [m.conversation_id, m.last_read_at as string | null])
      );

      const { data: convs, error: convErr } = await supabaseAdmin
        .from("chat_conversations")
        .select("id, type, title, tenant_id, last_message_at")
        .in("id", convIds)
        .order("last_message_at", { ascending: false, nullsFirst: false });
      if (convErr) throw convErr;

      const { data: allParticipants } = await supabaseAdmin
        .from("chat_participants")
        .select("conversation_id, user_id, participant_type, filho_id")
        .in("conversation_id", convIds);

      const participantsByConv = new Map<string, typeof allParticipants>();
      for (const p of allParticipants || []) {
        const list = participantsByConv.get(p.conversation_id) || [];
        list.push(p);
        participantsByConv.set(p.conversation_id, list);
      }

      const { data: lastMessages } = await supabaseAdmin
        .from("chat_messages")
        .select("conversation_id, body, message_type, created_at")
        .in("conversation_id", convIds)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      const lastMsgMap = new Map<string, { body: string | null; message_type: string; created_at: string }>();
      for (const m of lastMessages || []) {
        if (!lastMsgMap.has(m.conversation_id)) lastMsgMap.set(m.conversation_id, m);
      }

      const conversations = [];
      for (const c of convs || []) {
        const partRows = participantsByConv.get(c.id) || [];
        const participants = await enrichParticipants(supabaseAdmin, partRows);
        const peer = participants.find((p) => p.userId !== user.id) || null;

        const lastRead = readMap.get(c.id);
        let unreadCount = 0;
        const { count } = await supabaseAdmin
          .from("chat_messages")
          .select("id", { count: "exact", head: true })
          .eq("conversation_id", c.id)
          .neq("sender_user_id", user.id)
          .is("deleted_at", null)
          .gt("created_at", lastRead || "1970-01-01T00:00:00Z");
        unreadCount = count || 0;

        const last = lastMsgMap.get(c.id);
        conversations.push({
          id: c.id,
          type: c.type,
          title: c.title,
          tenantId: c.tenant_id,
          lastMessageAt: c.last_message_at || last?.created_at || null,
          lastMessagePreview: last ? messagePreview(last.message_type, last.body) : null,
          lastMessageType: last?.message_type || null,
          unreadCount,
          participants,
          peer: c.type === "group" ? null : peer,
        });
      }

      res.json({ conversations });
    } catch (error: unknown) {
      console.error("[CHAT] conversations:", error);
      res.status(500).json({ error: safeErrorMessage(error, "Erro ao listar conversas") });
    }
  });

  app.post("/api/v1/chat/conversations", async (req: Request, res: Response) => {
    const user = await requireAuthOrRespond(supabaseAdmin, req, res);
    if (!user) return;
    try {
      const { tenantId: rawTenant, targetFilhoId, withZelador, type, title } = req.body || {};
      const tenantId = await resolveTenantIdForRequest(supabaseAdmin, user, rawTenant);
      if (!tenantId) return res.status(400).json({ error: "tenantId inválido" });
      const ok = await assertUserCanAccessTenant(supabaseAdmin, user, tenantId);
      if (!ok) return res.status(403).json({ error: "Acesso negado" });

      const selfFilho = await loadFilhoForUser(supabaseAdmin, user);
      const isZelador = await assertZeladorOrGlobalAdmin(supabaseAdmin, user, tenantId);
      const leaderUserId = await loadLeaderUserId(supabaseAdmin, resolveLeaderIdFn, tenantId);

      if (type === "group") {
        if (!isZelador) return res.status(403).json({ error: "Apenas zeladores podem criar grupos" });
        const groupTitle = String(title || "Corrente").trim() || "Corrente";

        const { data: existing } = await supabaseAdmin
          .from("chat_conversations")
          .select("id")
          .eq("tenant_id", tenantId)
          .eq("type", "group")
          .eq("title", groupTitle)
          .maybeSingle();

        if (existing) return res.json({ conversationId: existing.id, created: false });

        const { data: conv, error: convErr } = await supabaseAdmin
          .from("chat_conversations")
          .insert({
            tenant_id: tenantId,
            type: "group",
            title: groupTitle,
            created_by: user.id,
          })
          .select("id")
          .single();
        if (convErr) throw convErr;

        const filhos = await loadFilhosDaCorrente(
          supabaseAdmin,
          resolveLeaderIdFn,
          tenantId,
          leaderUserId || user.id
        );

        const participantRows = [
          {
            conversation_id: conv.id,
            tenant_id: tenantId,
            participant_type: "admin",
            filho_id: null,
            user_id: leaderUserId,
          },
          ...(filhos || [])
            .filter((f) => f.user_id)
            .map((f) => ({
              conversation_id: conv.id,
              tenant_id: tenantId,
              participant_type: "filho",
              filho_id: f.id,
              user_id: f.user_id,
            })),
        ];

        const { error: partErr } = await supabaseAdmin.from("chat_participants").insert(participantRows);
        if (partErr) throw partErr;

        return res.json({ conversationId: conv.id, created: true });
      }

      let directKey: string;
      const participants: Array<{
        conversation_id?: string;
        tenant_id: string;
        participant_type: string;
        filho_id: string | null;
        user_id: string;
      }> = [];

      if (withZelador) {
        if (!selfFilho) return res.status(403).json({ error: "Apenas filhos podem abrir chat com o zelador" });
        if (String(selfFilho.status || "").toLowerCase() === "inativo") {
          return res.status(403).json({ error: "Conta inativa" });
        }
        directKey = buildFilhoZeladorDirectKey(selfFilho.id);
        participants.push(
          {
            tenant_id: tenantId,
            participant_type: "filho",
            filho_id: selfFilho.id,
            user_id: user.id,
          },
          {
            tenant_id: tenantId,
            participant_type: "admin",
            filho_id: null,
            user_id: leaderUserId,
          }
        );
      } else if (targetFilhoId) {
        const targetId = String(targetFilhoId).trim();
        const { data: target } = await supabaseAdmin
          .from("filhos_de_santo")
          .select("id, user_id, tenant_id, lider_id, status, nome")
          .eq("id", targetId)
          .maybeSingle();
        if (!target?.user_id) return res.status(404).json({ error: "Filho não encontrado ou sem login" });
        if (String(target.status || "").toLowerCase() === "inativo") {
          return res.status(403).json({ error: "Este filho está inativo" });
        }
        const targetTenant = String(target.tenant_id || target.lider_id || "");
        const targetOk = await assertUserCanAccessTenant(supabaseAdmin, user, targetTenant);
        if (!targetOk) return res.status(403).json({ error: "Filho de outro terreiro" });

        if (isZelador) {
          directKey = buildFilhoZeladorDirectKey(target.id);
          participants.push(
            {
              tenant_id: tenantId,
              participant_type: "admin",
              filho_id: null,
              user_id: user.id,
            },
            {
              tenant_id: tenantId,
              participant_type: "filho",
              filho_id: target.id,
              user_id: target.user_id,
            }
          );
        } else {
          if (!selfFilho) return res.status(403).json({ error: "Acesso negado" });
          if (target.id === selfFilho.id) return res.status(400).json({ error: "Não é possível conversar consigo" });
          directKey = buildFilhoFilhoDirectKey(selfFilho.id, target.id);
          participants.push(
            {
              tenant_id: tenantId,
              participant_type: "filho",
              filho_id: selfFilho.id,
              user_id: user.id,
            },
            {
              tenant_id: tenantId,
              participant_type: "filho",
              filho_id: target.id,
              user_id: target.user_id,
            }
          );
        }
      } else {
        return res.status(400).json({ error: "Informe targetFilhoId, withZelador ou type=group" });
      }

      const { data: existing } = await supabaseAdmin
        .from("chat_conversations")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("direct_key", directKey)
        .maybeSingle();

      if (existing) return res.json({ conversationId: existing.id, created: false });

      const { data: conv, error: convErr } = await supabaseAdmin
        .from("chat_conversations")
        .insert({
          tenant_id: tenantId,
          type: "direct",
          direct_key: directKey,
          created_by: user.id,
        })
        .select("id")
        .single();
      if (convErr) throw convErr;

      const rows = participants.map((p) => ({ ...p, conversation_id: conv.id }));
      const { error: partErr } = await supabaseAdmin.from("chat_participants").insert(rows);
      if (partErr) throw partErr;

      res.json({ conversationId: conv.id, created: true });
    } catch (error: unknown) {
      console.error("[CHAT] create conversation:", error);
      res.status(500).json({ error: safeErrorMessage(error, "Erro ao criar conversa") });
    }
  });

  app.get("/api/v1/chat/conversations/:id/messages", async (req: Request, res: Response) => {
    const user = await requireAuthOrRespond(supabaseAdmin, req, res);
    if (!user) return;
    const conversationId = String(req.params.id || "").trim();
    if (!conversationId) return res.status(400).json({ error: "conversationId inválido" });

    try {
      const isMember = await assertParticipant(supabaseAdmin, conversationId, user.id);
      if (!isMember && !(await isConsoleGlobalAdmin(supabaseAdmin, user))) {
        return res.status(403).json({ error: "Acesso negado" });
      }

      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
      const before = String(req.query.before || "").trim();

      let query = supabaseAdmin
        .from("chat_messages")
        .select(
          "id, conversation_id, tenant_id, sender_user_id, sender_filho_id, body, message_type, media_url, media_mime, media_duration_sec, created_at"
        )
        .eq("conversation_id", conversationId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (before) query = query.lt("created_at", before);

      const { data: rows, error } = await query;
      if (error) throw error;

      const filhoIds = [...new Set((rows || []).map((r) => r.sender_filho_id).filter(Boolean))] as string[];
      const filhosMap = new Map<string, FilhoRow>();
      if (filhoIds.length > 0) {
        const { data: filhos } = await supabaseAdmin
          .from("filhos_de_santo")
          .select("id, nome, foto_url")
          .in("id", filhoIds);
        for (const f of filhos || []) filhosMap.set(f.id, f as FilhoRow);
      }

      const adminSenderIds = (rows || [])
        .filter((r) => !r.sender_filho_id)
        .map((r) => r.sender_user_id);
      const leaderMap = new Map<string, string>();
      if (adminSenderIds.length > 0) {
        const { data: leaders } = await supabaseAdmin
          .from("perfil_lider")
          .select("id, cargo")
          .in("id", adminSenderIds);
        for (const l of leaders || []) leaderMap.set(l.id, String(l.cargo || "Zelador(a)"));
      }

      const messages = (rows || [])
        .map((r) => {
          const filho = r.sender_filho_id ? filhosMap.get(r.sender_filho_id) : null;
          const senderNome = filho?.nome || leaderMap.get(r.sender_user_id) || "Zelador(a)";
          return {
            id: r.id,
            conversationId: r.conversation_id,
            tenantId: r.tenant_id,
            senderUserId: r.sender_user_id,
            senderFilhoId: r.sender_filho_id,
            senderNome,
            senderFotoUrl: filho?.foto_url || null,
            body: r.body,
            messageType: r.message_type,
            mediaUrl: resolvePublicMediaUrl(r.media_url) || r.media_url,
            mediaMime: r.media_mime,
            mediaDurationSec: r.media_duration_sec,
            createdAt: r.created_at,
            isOwn: r.sender_user_id === user.id,
          };
        })
        .reverse();

      res.json({ messages, hasMore: (rows || []).length === limit });
    } catch (error: unknown) {
      console.error("[CHAT] messages:", error);
      res.status(500).json({ error: safeErrorMessage(error, "Erro ao carregar mensagens") });
    }
  });

  app.post("/api/v1/chat/conversations/:id/read", async (req: Request, res: Response) => {
    const user = await requireAuthOrRespond(supabaseAdmin, req, res);
    if (!user) return;
    const conversationId = String(req.params.id || "").trim();
    try {
      const { error } = await supabaseAdmin
        .from("chat_participants")
        .update({ last_read_at: new Date().toISOString() })
        .eq("conversation_id", conversationId)
        .eq("user_id", user.id);
      if (error) throw error;
      res.json({ success: true });
    } catch (error: unknown) {
      res.status(500).json({ error: safeErrorMessage(error, "Erro ao marcar como lida") });
    }
  });

  app.post("/api/v1/chat/upload-url", async (req: Request, res: Response) => {
    const { tenantId: rawTenant, conversationId, fileName, contentType, sizeBytes } = req.body || {};
    if (!conversationId || !fileName || !contentType || !sizeBytes) {
      return res.status(400).json({ error: "Dados incompletos" });
    }
    if (!r2Client || !bucketName) {
      return res.status(500).json({ error: "R2 não configurado" });
    }

    try {
      const access = await requireApiTenantRead(supabaseAdmin, req, res, rawTenant);
      if (!access) return;
      const { user } = access;

      const isMember = await assertParticipant(supabaseAdmin, String(conversationId), user.id);
      if (!isMember) return res.status(403).json({ error: "Acesso negado" });

      const normalizedType = String(contentType).toLowerCase();
      const numericSize = Number(sizeBytes);
      if (!Number.isFinite(numericSize) || numericSize <= 0) {
        return res.status(400).json({ error: "Tamanho inválido" });
      }

      let maxSize = CHAT_IMAGE_MAX;
      let messageType = "image";
      if (normalizedType.startsWith("video/")) {
        maxSize = CHAT_VIDEO_MAX;
        messageType = "video";
      } else if (normalizedType.startsWith("audio/")) {
        maxSize = CHAT_AUDIO_MAX;
        messageType = "audio";
      } else if (!normalizedType.startsWith("image/")) {
        return res.status(400).json({ error: "Tipo de arquivo não suportado" });
      }

      if (numericSize > maxSize) {
        return res.status(400).json({ error: `Arquivo muito grande (máx. ${Math.round(maxSize / 1024 / 1024)}MB)` });
      }

      const tenantId = access.tenantId;
      const storageKey = `chat/${tenantId}/${conversationId}/${Date.now()}_${slugifyFileName(fileName)}`;
      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: storageKey,
        ContentType: normalizedType,
      });
      const uploadUrl = await getSignedUrl(r2Client, command, { expiresIn: 300 });
      const publicUrl = buildR2PublicUrlFromKey(storageKey);

      res.json({ uploadUrl, storageKey, publicUrl, messageType, contentType: normalizedType });
    } catch (error: unknown) {
      console.error("[CHAT] upload-url:", error);
      res.status(500).json({ error: safeErrorMessage(error, "Erro ao preparar upload") });
    }
  });

  app.post("/api/v1/chat/conversations/:id/messages", async (req: Request, res: Response) => {
    const user = await requireAuthOrRespond(supabaseAdmin, req, res);
    if (!user) return;
    const conversationId = String(req.params.id || "").trim();

    try {
      const isMember = await assertParticipant(supabaseAdmin, conversationId, user.id);
      if (!isMember) return res.status(403).json({ error: "Acesso negado" });

      const {
        body,
        messageType = "text",
        mediaUrl,
        mediaPath,
        mediaMime,
        mediaSizeBytes,
        mediaDurationSec,
      } = req.body || {};

      const type = String(messageType || "text");
      const textBody = body != null ? String(body).trim() : "";
      if (type === "text" && !textBody) return res.status(400).json({ error: "Mensagem vazia" });
      if (type !== "text" && !mediaUrl) return res.status(400).json({ error: "mediaUrl obrigatório" });

      const selfFilho = await loadFilhoForUser(supabaseAdmin, user);
      if (selfFilho && String(selfFilho.status || "").toLowerCase() === "inativo") {
        return res.status(403).json({ error: "Conta inativa" });
      }

      const { data: conv } = await supabaseAdmin
        .from("chat_conversations")
        .select("tenant_id")
        .eq("id", conversationId)
        .maybeSingle();
      if (!conv) return res.status(404).json({ error: "Conversa não encontrada" });

      const now = new Date().toISOString();
      const { data: msg, error: msgErr } = await supabaseAdmin
        .from("chat_messages")
        .insert({
          conversation_id: conversationId,
          tenant_id: conv.tenant_id,
          sender_user_id: user.id,
          sender_filho_id: selfFilho?.id || null,
          body: textBody || null,
          message_type: type,
          media_url: mediaUrl || null,
          media_path: mediaPath || null,
          media_mime: mediaMime || null,
          media_size_bytes: mediaSizeBytes ? Number(mediaSizeBytes) : null,
          media_duration_sec: mediaDurationSec ? Number(mediaDurationSec) : null,
          created_at: now,
        })
        .select("id, created_at")
        .single();
      if (msgErr) throw msgErr;

      await supabaseAdmin
        .from("chat_conversations")
        .update({ last_message_at: now })
        .eq("id", conversationId);

      await supabaseAdmin
        .from("chat_participants")
        .update({ last_read_at: now })
        .eq("conversation_id", conversationId)
        .eq("user_id", user.id);

      const { data: participants } = await supabaseAdmin
        .from("chat_participants")
        .select("user_id, muted")
        .eq("conversation_id", conversationId)
        .neq("user_id", user.id);

      const senderName = selfFilho?.nome || "Zelador(a)";
      const preview = messagePreview(type, textBody || null);
      const notifyIds = (participants || []).filter((p) => !p.muted).map((p) => p.user_id);

      void sendChatPushToUsers(
        supabaseAdmin,
        notifyIds,
        {
          title: senderName,
          body: preview,
          url: `/chat?conversation=${conversationId}`,
        },
        user.id
      );

      res.json({
        message: {
          id: msg.id,
          createdAt: msg.created_at,
        },
      });
    } catch (error: unknown) {
      console.error("[CHAT] send message:", error);
      res.status(500).json({ error: safeErrorMessage(error, "Erro ao enviar mensagem") });
    }
  });
}
