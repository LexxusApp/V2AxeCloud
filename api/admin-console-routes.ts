import type { Express, Request, Response } from "express";
import { ListObjectsV2Command, type S3Client } from "@aws-sdk/client-s3";
import { isConsoleGlobalAdmin } from "./lib/consoleAdmin.js";
import {
  CONSOLE_ADMIN_INSTANCE_NAME,
  createInstanceWithPairingCode,
  getConsoleInstanceStatus,
  logoutEvolutionInstanceByName,
  sendEvolutionTextByInstance,
} from "../src/services/evolution.service.js";
import {
  loadWelcomeMessageConfig,
  normalizeBrazilMsisdn,
  renderWelcomeMessage,
  saveWelcomeMessageConfig,
  WELCOME_MESSAGE_DEFAULT,
} from "./lib/welcomeMessage.js";
import { logEvent } from "./lib/auditLog.js";

type VerifyUser = (token: string) => Promise<{ user: any; error: any }>;

/** PostgREST: tabela inexistente ou cache de schema desactualizado */
function isMissingOrUnknownTable(err: { message?: string; details?: string; code?: string } | null | undefined, tableHint: string): boolean {
  const m = `${String(err?.message || "")} ${String(err?.details || "")}`.toLowerCase();
  const t = tableHint.toLowerCase().replace(/^public\./, "");
  if (!m.includes(t)) return false;
  return (
    /schema cache|does not exist|could not find|undefined relation|unknown table|not find the table|pgrst/i.test(m) ||
    String(err?.code || "") === "PGRST205"
  );
}

export type AdminConsoleRouteDeps = {
  verifyUser: VerifyUser;
  supabaseAdmin: any;
  r2Client: S3Client | null;
  r2Bucket: string | undefined;
};

async function requireConsoleAdmin(
  deps: AdminConsoleRouteDeps,
  req: Request,
  res: Response
): Promise<{ user: any } | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.status(401).json({ error: "Não autorizado" });
    return null;
  }
  const token = authHeader.replace("Bearer ", "");
  if (!token || token === "undefined" || token === "null") {
    res.status(401).json({ error: "Token inválido" });
    return null;
  }
  const { user, error: authError } = await deps.verifyUser(token);
  if (authError || !user) {
    res.status(401).json({ error: "Sessão inválida" });
    return null;
  }
  const ok = await isConsoleGlobalAdmin(deps.supabaseAdmin, user);
  if (!ok) {
    const allow = (process.env.ADMIN_CONSOLE_EMAILS || process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    const userEmail = String(user.email || "").trim().toLowerCase();
    console.warn(
      `[admin-console] ACESSO NEGADO | userId=${user.id} | userEmail="${userEmail}" | allowlist=[${allow.join(", ")}] | path=${req.path}`
    );
    res.status(403).json({
      error: "Acesso negado ao console administrativo",
      debug: {
        userEmail,
        allowlistCount: allow.length,
        allowlistSample: allow.slice(0, 3),
        hint:
          allow.length === 0
            ? "ADMIN_CONSOLE_EMAILS está vazio no .env do servidor. Pare o npm run dev e inicie de novo após ajustar o .env."
            : !allow.includes(userEmail)
              ? `O email "${userEmail}" não está em ADMIN_CONSOLE_EMAILS. Adicione-o e reinicie o backend.`
              : "O email está na allowlist mas isConsoleGlobalAdmin retornou false (cheque perfil_lider).",
      },
    });
    return null;
  }
  return { user };
}

async function summarizeR2ByPrefix(
  client: S3Client,
  bucket: string,
  maxKeys: number
): Promise<{ prefixes: Record<string, { bytes: number; objects: number }>; keysScanned: number; truncated: boolean }> {
  const prefixes: Record<string, { bytes: number; objects: number }> = {};
  let keysScanned = 0;
  let truncated = false;
  let token: string | undefined;
  do {
    const out = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        ContinuationToken: token,
        MaxKeys: 1000,
      })
    );
    for (const o of out.Contents || []) {
      if (!o.Key) continue;
      keysScanned += 1;
      const seg = o.Key.split("/")[0] || "_root";
      if (!prefixes[seg]) prefixes[seg] = { bytes: 0, objects: 0 };
      prefixes[seg].bytes += o.Size || 0;
      prefixes[seg].objects += 1;
      if (keysScanned >= maxKeys) {
        truncated = !!out.IsTruncated;
        return { prefixes, keysScanned, truncated };
      }
    }
    token = out.IsTruncated ? out.NextContinuationToken : undefined;
    if (!token) break;
  } while (true);
  return { prefixes, keysScanned, truncated };
}

export function registerAdminConsoleRoutes(app: Express, deps: AdminConsoleRouteDeps) {
  app.get("/api/admin-console/session", async (req, res) => {
    const ctx = await requireConsoleAdmin(deps, req, res);
    if (!ctx) return;
    res.json({
      ok: true,
      user: { id: ctx.user.id, email: ctx.user.email },
    });
  });

  app.get("/api/admin-console/overview", async (req, res) => {
    const ctx = await requireConsoleAdmin(deps, req, res);
    if (!ctx) return;
    try {
      // 1) Perfis líder reais — exclui os auto-perfis "shadow" criados para filhos shadow.
      const { data: leaderRows, error: e1 } = await deps.supabaseAdmin
        .from("perfil_lider")
        .select("id, email")
        .is("deleted_at", null);
      if (e1) throw e1;

      // Filhos de santo: id de auth (user_id) usado pra excluir do conjunto de zeladores.
      const { data: filhosRows, error: e2 } = await deps.supabaseAdmin
        .from("filhos_de_santo")
        .select("user_id");
      if (e2) throw e2;
      const filhosCount = (filhosRows || []).length;
      const childUserIdSet = new Set<string>(
        (filhosRows || []).map((r: any) => String(r.user_id || "")).filter(Boolean)
      );

      const isShadowFilhoEmail = (email?: string | null) =>
        typeof email === "string" && /(^f_[a-f0-9-]{8,}@|@axecloud\.internal$)/i.test(email);

      const realLeaderIdSet = new Set<string>();
      for (const p of leaderRows || []) {
        const pid = String((p as any).id || "");
        const pem = (p as any).email as string | null | undefined;
        if (!pid) continue;
        if (childUserIdSet.has(pid)) continue;
        if (isShadowFilhoEmail(pem)) continue;
        realLeaderIdSet.add(pid);
      }
      const leadersCount = realLeaderIdSet.size;

      const { data: subs, error: e3 } = await deps.supabaseAdmin
        .from("subscriptions")
        .select("id, plan, status");
      if (e3) throw e3;

      // Histograma só conta subscriptions ligadas a terreiros reais.
      const planHistogram: Record<string, number> = {};
      let realSubscriptionsCount = 0;
      for (const row of subs || []) {
        const subId = String((row as any).id || "");
        if (subId && !realLeaderIdSet.has(subId)) continue;
        const p = String((row as any).plan || "unknown").toLowerCase();
        planHistogram[p] = (planHistogram[p] || 0) + 1;
        realSubscriptionsCount++;
      }

      let accessLast7d = 0;
      let accessLogsAvailable = true;
      const since = new Date();
      since.setDate(since.getDate() - 7);
      try {
        const { count: ac, error: e4 } = await deps.supabaseAdmin
          .from("access_logs")
          .select("*", { count: "exact", head: true })
          .gte("created_at", since.toISOString());
        if (e4 && isMissingOrUnknownTable(e4, "access_logs")) {
          accessLogsAvailable = false;
        } else if (e4) {
          throw e4;
        } else {
          accessLast7d = ac ?? 0;
        }
      } catch (accessCatch: any) {
        if (isMissingOrUnknownTable(accessCatch, "access_logs")) {
          accessLogsAvailable = false;
        } else {
          throw accessCatch;
        }
      }

      res.json({
        leadersCount,
        filhosCount: filhosCount ?? 0,
        subscriptionsCount: realSubscriptionsCount,
        planHistogram,
        accessLogsAvailable,
        accessEventsLast7Days: accessLast7d,
      });
    } catch (e: any) {
      console.error("[admin-console/overview]", e);
      res.status(500).json({ error: e?.message || "Erro interno" });
    }
  });

  /**
   * Detalhe completo de um terreiro: perfil + assinatura + filhos + uso de R2 (storage)
   * pelo prefixo do tenant. Usado pelo drawer do painel admin.
   */
  app.get("/api/admin-console/tenant/:id", async (req, res) => {
    const ctx = await requireConsoleAdmin(deps, req, res);
    if (!ctx) return;
    const id = String(req.params.id || "").trim();
    if (!id) return res.status(400).json({ error: "id obrigatório" });

    try {
      const [profileRes, subRes, authUser, childrenRes] = await Promise.all([
        deps.supabaseAdmin
          .from("perfil_lider")
          .select("id, tenant_id, email, nome_terreiro, cargo, role, is_admin_global, is_blocked, deleted_at, foto_url, updated_at")
          .eq("id", id)
          .maybeSingle(),
        deps.supabaseAdmin
          .from("subscriptions")
          .select("id, plan, status, expires_at")
          .eq("id", id)
          .maybeSingle(),
        deps.supabaseAdmin.auth.admin.getUserById(id).catch(() => ({ data: null, error: null })),
        deps.supabaseAdmin
          .from("filhos_de_santo")
          .select("id, nome, status, cargo, foto_url, data_entrada")
          .or(`lider_id.eq.${id},tenant_id.eq.${id}`)
          .limit(500),
      ]);

      if (profileRes.error) throw profileRes.error;
      if (subRes.error) throw subRes.error;
      if (childrenRes.error) throw childrenRes.error;

      const profile = profileRes.data;
      const sub = subRes.data;
      const authMeta = (authUser as any)?.data?.user ?? null;
      const children = childrenRes.data || [];

      // Uso de R2 pelo prefixo do tenant (apenas se R2 configurado).
      let storage: { configured: boolean; objects?: number; bytes?: number; mb?: number; truncated?: boolean } = {
        configured: false,
      };
      if (deps.r2Client && deps.r2Bucket) {
        try {
          let objects = 0;
          let bytes = 0;
          let token: string | undefined;
          let truncated = false;
          const prefix = `${id}/`;
          const HARD_CAP = 5000;
          do {
            const out = await deps.r2Client.send(
              new ListObjectsV2Command({
                Bucket: deps.r2Bucket,
                Prefix: prefix,
                MaxKeys: 1000,
                ContinuationToken: token,
              })
            );
            for (const o of out.Contents || []) {
              objects += 1;
              bytes += o.Size || 0;
              if (objects >= HARD_CAP) {
                truncated = !!out.IsTruncated;
                break;
              }
            }
            if (objects >= HARD_CAP) break;
            token = out.IsTruncated ? out.NextContinuationToken : undefined;
            if (!token) break;
          } while (true);
          storage = {
            configured: true,
            objects,
            bytes,
            mb: Math.round((bytes / (1024 * 1024)) * 100) / 100,
            truncated,
          };
        } catch (storageErr: any) {
          console.warn("[admin-console/tenant] storage lookup:", storageErr?.message || storageErr);
          storage = { configured: true, objects: 0, bytes: 0, mb: 0 };
        }
      }

      res.json({
        profile: profile
          ? {
              id: profile.id,
              tenant_id: profile.tenant_id,
              email: profile.email,
              nome_terreiro: profile.nome_terreiro,
              cargo: profile.cargo,
              role: profile.role,
              is_admin_global: profile.is_admin_global,
              is_blocked: profile.is_blocked,
              deleted_at: profile.deleted_at,
              foto_url: profile.foto_url,
              updated_at: profile.updated_at,
            }
          : null,
        auth: authMeta
          ? {
              id: authMeta.id,
              email: authMeta.email,
              phone: authMeta.phone,
              created_at: authMeta.created_at,
              last_sign_in_at: authMeta.last_sign_in_at,
              user_metadata: authMeta.user_metadata || {},
            }
          : null,
        subscription: sub
          ? {
              plan: sub.plan,
              status: sub.status,
              expires_at: sub.expires_at,
            }
          : null,
        childrenCount: children.length,
        children: children.slice(0, 50),
        storage,
      });
    } catch (e: any) {
      console.error("[admin-console/tenant detail]", e);
      res.status(500).json({ error: e?.message || "Erro ao buscar tenant" });
    }
  });

  /**
   * Regenera a senha de um terreiro. Como a senha original do Supabase Auth não pode ser
   * recuperada (é hash), o admin pode gerar uma nova senha numérica de 8 dígitos.
   * Útil quando o zelador perde a senha inicial.
   */
  app.post("/api/admin-console/tenant/:id/reset-password", async (req, res) => {
    const ctx = await requireConsoleAdmin(deps, req, res);
    if (!ctx) return;
    const id = String(req.params.id || "").trim();
    if (!id) return res.status(400).json({ error: "id obrigatório" });

    try {
      const bytes = new Uint8Array(8);
      try {
        // crypto global existe no Node 18+/runtime serverless da Vercel.
        (globalThis as any).crypto.getRandomValues(bytes);
      } catch {
        for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
      }
      const newPassword = Array.from(bytes, (b) => String((b ?? 0) % 10)).join("");

      const { error: updErr } = await deps.supabaseAdmin.auth.admin.updateUserById(id, {
        password: newPassword,
      });
      if (updErr) throw updErr;

      void logEvent(deps.supabaseAdmin, {
        eventType: "tenant.password-reset",
        userId: ctx.user.id,
        userEmail: ctx.user.email,
        targetType: "tenant",
        targetId: id,
        tenantId: id,
        description: `Senha do terreiro ${id} redefinida pelo admin.`,
        req,
      });

      res.json({ success: true, password: newPassword });
    } catch (e: any) {
      console.error("[admin-console/tenant reset-password]", e);
      res.status(500).json({ error: e?.message || "Erro ao redefinir senha" });
    }
  });

  app.get("/api/admin-console/access-logs", async (req, res) => {
    const ctx = await requireConsoleAdmin(deps, req, res);
    if (!ctx) return;
    const limit = Math.min(500, Math.max(1, Number(req.query.limit || 100)));
    const offset = Math.max(0, Number(req.query.offset || 0));
    const filterType = String(req.query.eventType || "").trim();
    const filterTenant = String(req.query.tenantId || "").trim();
    const filterUser = String(req.query.userId || "").trim();

    const FALLBACK_COLUMNS = "id, user_id, ip, city, region, country, user_agent, created_at";
    const FULL_COLUMNS =
      "id, created_at, event_type, user_id, user_email, target_type, target_id, description, ip, user_agent, city, region, country, metadata, tenant_id";

    try {
      let rows: any[] | null = [];
      let usingFullSchema = true;

      const runQuery = async (cols: string) => {
        let q = deps.supabaseAdmin.from("access_logs").select(cols);
        if (filterType) q = q.eq("event_type", filterType);
        if (filterTenant) q = q.eq("tenant_id", filterTenant);
        if (filterUser) q = q.eq("user_id", filterUser);
        return q.order("created_at", { ascending: false }).range(offset, offset + limit - 1);
      };

      try {
        const q = await runQuery(FULL_COLUMNS);
        if (q.error && isMissingOrUnknownTable(q.error, "access_logs")) {
          return res.json({
            rows: [],
            emailByUser: {},
            accessLogsAvailable: false,
            notice:
              "A tabela access_logs não existe neste projecto Supabase. Aplique supabase/migrations/20260513192500_access_logs.sql.",
          });
        }
        if (q.error) {
          const msg = String(q.error.message || "").toLowerCase();
          // Esquema antigo (sem event_type/description/etc.) — cai no fallback.
          if (/column .* does not exist|could not find the .* column/.test(msg)) {
            usingFullSchema = false;
          } else {
            throw q.error;
          }
        } else {
          rows = q.data;
        }
      } catch (readErr: any) {
        if (isMissingOrUnknownTable(readErr, "access_logs")) {
          return res.json({
            rows: [],
            emailByUser: {},
            accessLogsAvailable: false,
            notice:
              "A tabela access_logs não existe neste projecto Supabase. Aplique supabase/migrations/20260513192500_access_logs.sql.",
          });
        }
        const msg = String(readErr?.message || "").toLowerCase();
        if (/column .* does not exist|could not find the .* column/.test(msg)) {
          usingFullSchema = false;
        } else {
          throw readErr;
        }
      }

      if (!usingFullSchema) {
        const q = await runQuery(FALLBACK_COLUMNS);
        if (q.error) throw q.error;
        rows = q.data;
      }

      const ids = [...new Set((rows || []).map((r: any) => r.user_id).filter(Boolean))];
      let emailByUser: Record<string, string> = {};
      if (ids.length) {
        const { data: profs } = await deps.supabaseAdmin
          .from("perfil_lider")
          .select("id, email")
          .in("id", ids);
        for (const p of profs || []) {
          emailByUser[(p as any).id] = (p as any).email || "";
        }
      }

      // Lista de tipos disponíveis (para popular o filtro do front).
      let eventTypes: string[] = [];
      if (usingFullSchema) {
        try {
          const { data: distinct } = await deps.supabaseAdmin
            .from("access_logs")
            .select("event_type")
            .not("event_type", "is", null)
            .limit(1000);
          const set = new Set<string>();
          for (const r of distinct || []) set.add(String((r as any).event_type || ""));
          eventTypes = [...set].filter(Boolean).sort();
        } catch {
          eventTypes = [];
        }
      }

      res.json({
        rows: rows || [],
        emailByUser,
        accessLogsAvailable: true,
        schema: usingFullSchema ? "full" : "legacy",
        eventTypes,
      });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "Tabela access_logs indisponível ou erro ao ler." });
    }
  });

  app.get("/api/admin-console/r2-usage", async (req, res) => {
    const ctx = await requireConsoleAdmin(deps, req, res);
    if (!ctx) return;
    if (!deps.r2Client || !deps.r2Bucket) {
      return res.json({
        configured: false,
        message: "R2 não configurado (R2_S3_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME).",
      });
    }
    const cap = Math.min(50000, Math.max(500, Number(req.query.maxKeys || 8000)));
    try {
      const { prefixes, keysScanned, truncated } = await summarizeR2ByPrefix(deps.r2Client, deps.r2Bucket, cap);
      const list = Object.entries(prefixes)
        .map(([tenantPrefix, v]) => ({
          tenantPrefix,
          bytes: v.bytes,
          objects: v.objects,
          mb: Math.round((v.bytes / (1024 * 1024)) * 100) / 100,
        }))
        .sort((a, b) => b.bytes - a.bytes);
      res.json({ configured: true, keysScanned, truncated, tenants: list });
    } catch (e: any) {
      console.error("[admin-console/r2-usage]", e);
      res.status(500).json({ error: e?.message || "Erro ao listar R2" });
    }
  });

  app.post("/api/admin-console/create-demo", async (req, res) => {
    const ctx = await requireConsoleAdmin(deps, req, res);
    if (!ctx) return;
    const email = String((req.body || {}).email || "").trim().toLowerCase();
    const password = String((req.body || {}).password || "").trim();
    const nome_terreiro = String((req.body || {}).nome_terreiro || "Terreiro Demonstração").trim();
    const nome_zelador = String((req.body || {}).nome_zelador || "Zelador Demo").trim();
    if (!email || !password) {
      return res.status(400).json({ error: "email e password são obrigatórios" });
    }
    try {
      const demoDays = Math.min(90, Math.max(3, Number((req.body || {}).demoDays || 14)));
      const expires = new Date();
      expires.setDate(expires.getDate() + demoDays);

      const { data: created, error: cErr } = await deps.supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { nome_terreiro, nome_zelador, plan: "premium", observacao: "conta_demo" },
      });
      if (cErr) {
        if (!String(cErr.message || "").toLowerCase().includes("registered")) throw cErr;
        return res.status(409).json({ error: "E-mail já registado na Auth." });
      }
      const u = created!.user;

      await deps.supabaseAdmin.from("subscriptions").upsert(
        {
          id: u.id,
          plan: "premium",
          status: "active",
          expires_at: expires.toISOString(),
        },
        { onConflict: "id" }
      );

      await deps.supabaseAdmin.from("perfil_lider").upsert(
        {
          id: u.id,
          email,
          nome_terreiro,
          cargo: nome_zelador,
          role: "admin",
          tenant_id: u.id,
          is_blocked: false,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );

      void logEvent(deps.supabaseAdmin, {
        eventType: "demo.created",
        userId: ctx.user.id,
        userEmail: ctx.user.email,
        targetType: "tenant",
        targetId: u.id,
        tenantId: u.id,
        description: `Conta demo criada para ${email} (válida até ${expires.toISOString().split("T")[0]}).`,
        metadata: { email, nome_terreiro, nome_zelador, demoDays },
        req,
      });

      res.json({
        success: true,
        user: { id: u.id, email: u.email },
        demoExpiresAt: expires.toISOString(),
      });
    } catch (e: any) {
      console.error("[admin-console/create-demo]", e);
      res.status(500).json({ error: e?.message || "Erro ao criar demo" });
    }
  });

  // ============================================================================
  // WhatsApp do Console Admin — instância única "axecloud_console_admin", pareada
  // por CÓDIGO (sem QR). Usada para envios globais do administrador da plataforma.
  // ============================================================================
  app.get("/api/admin-console/whatsapp/status", async (req, res) => {
    const ctx = await requireConsoleAdmin(deps, req, res);
    if (!ctx) return;
    try {
      const out = await getConsoleInstanceStatus(CONSOLE_ADMIN_INSTANCE_NAME);
      res.json({ instanceName: CONSOLE_ADMIN_INSTANCE_NAME, ...out });
    } catch (e: any) {
      console.error("[admin-console/whatsapp/status]", e);
      res.status(500).json({ error: e?.message || "Erro ao consultar status" });
    }
  });

  app.post("/api/admin-console/whatsapp/connect", async (req, res) => {
    const ctx = await requireConsoleAdmin(deps, req, res);
    if (!ctx) return;
    const phone = String((req.body || {}).phone || "").trim();
    if (!phone || phone.replace(/\D/g, "").length < 10) {
      return res.status(400).json({ error: "Informe o número com DDD (ex.: 11 91234-5678)." });
    }
    try {
      const current = await getConsoleInstanceStatus(CONSOLE_ADMIN_INSTANCE_NAME);
      if (current.status === "CONNECTED") {
        return res.json({
          alreadyConnected: true,
          instanceName: CONSOLE_ADMIN_INSTANCE_NAME,
          number: current.number,
          message: "WhatsApp do console já está conectado.",
        });
      }
      const out = await createInstanceWithPairingCode(CONSOLE_ADMIN_INSTANCE_NAME, phone);
      void logEvent(deps.supabaseAdmin, {
        eventType: "whatsapp.connect-requested",
        userId: ctx.user.id,
        userEmail: ctx.user.email,
        targetType: "whatsapp",
        targetId: CONSOLE_ADMIN_INSTANCE_NAME,
        description: `Admin solicitou pareamento do WhatsApp para ${phone}.`,
        metadata: { phone },
        req,
      });
      res.json({ ...out, message: "Use o código abaixo no WhatsApp do dispositivo." });
    } catch (e: any) {
      console.error("[admin-console/whatsapp/connect]", e);
      res.status(500).json({ error: e?.message || "Erro ao gerar pairing code" });
    }
  });

  app.post("/api/admin-console/whatsapp/logout", async (req, res) => {
    const ctx = await requireConsoleAdmin(deps, req, res);
    if (!ctx) return;
    try {
      await logoutEvolutionInstanceByName(CONSOLE_ADMIN_INSTANCE_NAME);
      void logEvent(deps.supabaseAdmin, {
        eventType: "whatsapp.disconnect",
        userId: ctx.user.id,
        userEmail: ctx.user.email,
        targetType: "whatsapp",
        targetId: CONSOLE_ADMIN_INSTANCE_NAME,
        description: "Admin desconectou o WhatsApp do console.",
        req,
      });
      res.json({ ok: true });
    } catch (e: any) {
      console.error("[admin-console/whatsapp/logout]", e);
      res.status(500).json({ error: e?.message || "Erro ao desconectar" });
    }
  });

  // -------------- Boas-vindas automáticas (criar terreiro) --------------------
  app.get("/api/admin-console/welcome-message", async (req, res) => {
    const ctx = await requireConsoleAdmin(deps, req, res);
    if (!ctx) return;
    try {
      const cfg = await loadWelcomeMessageConfig(deps.supabaseAdmin);
      res.json({ ...cfg, defaults: WELCOME_MESSAGE_DEFAULT });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "Erro ao carregar mensagem" });
    }
  });

  app.post("/api/admin-console/welcome-message", async (req, res) => {
    const ctx = await requireConsoleAdmin(deps, req, res);
    if (!ctx) return;
    const body = (req.body || {}) as Record<string, unknown>;
    try {
      const saved = await saveWelcomeMessageConfig(deps.supabaseAdmin, {
        enabled: typeof body.enabled === "boolean" ? body.enabled : undefined,
        template: typeof body.template === "string" ? body.template : undefined,
        loginUrl: typeof body.loginUrl === "string" ? body.loginUrl : undefined,
        signature: typeof body.signature === "string" ? body.signature : undefined,
      });
      void logEvent(deps.supabaseAdmin, {
        eventType: "welcome-message.updated",
        userId: ctx.user.id,
        userEmail: ctx.user.email,
        targetType: "global_settings",
        targetId: "welcome_message",
        description: "Admin actualizou a mensagem de boas-vindas do WhatsApp.",
        metadata: {
          enabled: saved.enabled,
          loginUrl: saved.loginUrl,
          templatePreview: String(saved.template || "").slice(0, 120),
        },
        req,
      });
      res.json(saved);
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "Erro ao guardar mensagem" });
    }
  });

  app.post("/api/admin-console/welcome-message/test", async (req, res) => {
    const ctx = await requireConsoleAdmin(deps, req, res);
    if (!ctx) return;
    const body = (req.body || {}) as Record<string, unknown>;
    const phone = String(body.phone || "").trim();
    if (!phone) return res.status(400).json({ error: "Informe o número de destino." });
    const msisdn = normalizeBrazilMsisdn(phone);
    if (!msisdn) return res.status(400).json({ error: "Número inválido." });
    try {
      const cfg = await loadWelcomeMessageConfig(deps.supabaseAdmin);
      const text = renderWelcomeMessage(cfg.template, {
        nome_terreiro: String(body.nome_terreiro || "Terreiro Exemplo"),
        nome_zelador: String(body.nome_zelador || "Zelador Exemplo"),
        email: String(body.email || "exemplo@email.com"),
        senha: String(body.senha || "Senha-Demonstracao-123"),
        site: cfg.loginUrl,
        assinatura: cfg.signature,
      });
      const out = await sendEvolutionTextByInstance(CONSOLE_ADMIN_INSTANCE_NAME, msisdn, text);
      res.json({ success: true, msisdn, ...out });
    } catch (e: any) {
      console.error("[admin-console/welcome-message/test]", e);
      res.status(500).json({ error: e?.message || "Falha ao enviar teste" });
    }
  });

  app.post("/api/admin-console/whatsapp/test-message", async (req, res) => {
    const ctx = await requireConsoleAdmin(deps, req, res);
    if (!ctx) return;
    const rawPhone = String((req.body || {}).phone || "").trim();
    const text =
      String((req.body || {}).text || "").trim() ||
      "AxéCloud Console — teste de mensagem. Se você recebeu isto, o WhatsApp do administrador está conectado.";
    if (!rawPhone) return res.status(400).json({ error: "Informe o número de destino." });
    let phoneDigits = rawPhone.replace(/\D/g, "");
    if (!phoneDigits.startsWith("55")) phoneDigits = `55${phoneDigits}`;
    try {
      const out = await sendEvolutionTextByInstance(CONSOLE_ADMIN_INSTANCE_NAME, phoneDigits, text);
      void logEvent(deps.supabaseAdmin, {
        eventType: "whatsapp.test-message",
        userId: ctx.user.id,
        userEmail: ctx.user.email,
        targetType: "whatsapp",
        targetId: CONSOLE_ADMIN_INSTANCE_NAME,
        description: `Admin enviou mensagem de teste para ${phoneDigits}.`,
        metadata: { phone: phoneDigits, textPreview: text.slice(0, 120) },
        req,
      });
      res.json({ success: true, ...out });
    } catch (e: any) {
      console.error("[admin-console/whatsapp/test-message]", e);
      res.status(500).json({ error: e?.message || "Falha ao enviar mensagem" });
    }
  });

  app.get("/api/admin-console/activity", async (req, res) => {
    const ctx = await requireConsoleAdmin(deps, req, res);
    if (!ctx) return;
    try {
      const { data: childrenStats, error: childrenError } = await deps.supabaseAdmin
        .from("filhos_de_santo")
        .select("tenant_id");
      if (childrenError) throw childrenError;
      const childrenPerTenant: Record<string, number> = {};
      (childrenStats || []).forEach((c: any) => {
        const tid = c.tenant_id;
        if (tid) childrenPerTenant[tid] = (childrenPerTenant[tid] || 0) + 1;
      });

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      let accessLogs: any[] | null = [];
      let accessLogsAvailable = true;
      let accessLogsError: string | undefined;
      try {
        const q = await deps.supabaseAdmin
          .from("access_logs")
          .select("created_at, city, ll")
          .gte("created_at", thirtyDaysAgo.toISOString());
        if (q.error) {
          if (isMissingOrUnknownTable(q.error, "access_logs")) {
            accessLogsAvailable = false;
            accessLogsError = q.error.message;
          } else {
            throw q.error;
          }
        } else {
          accessLogs = q.data;
        }
      } catch (acErr: any) {
        if (isMissingOrUnknownTable(acErr, "access_logs")) {
          accessLogsAvailable = false;
          accessLogsError = acErr?.message;
        } else {
          throw acErr;
        }
      }

      if (!accessLogsAvailable) {
        return res.json({
          childrenPerTenant,
          dailyAccess: {},
          geoActivity: [],
          accessLogsAvailable: false,
          accessLogsError,
        });
      }

      const dailyAccess: Record<string, number> = {};
      (accessLogs || []).forEach((log: any) => {
        const date = String(log.created_at || "").split("T")[0];
        if (date) dailyAccess[date] = (dailyAccess[date] || 0) + 1;
      });
      res.json({
        childrenPerTenant,
        dailyAccess,
        geoActivity:
          accessLogs?.filter((l: any) => l.ll).map((l: any) => ({
            city: l.city,
            lat: l.ll[0],
            lon: l.ll[1],
          })) || [],
        accessLogsAvailable: true,
      });
    } catch (e: any) {
      console.error("[admin-console/activity]", e);
      res.status(500).json({ error: e?.message || "Erro interno" });
    }
  });
}
