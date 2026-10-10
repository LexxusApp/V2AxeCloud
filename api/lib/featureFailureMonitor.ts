/**
 * Monitor de falhas de funções usadas pelos terreiros.
 * Grava em `tenant_feature_failures` (+ access_logs best-effort).
 */
import { createHash } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { logEvent } from "./auditLog.js";
import { createRateLimit } from "./rateLimit.js";

export type FeatureFailureInput = {
  tenantId?: string | null;
  feature?: string | null;
  route?: string | null;
  httpStatus?: number | null;
  source?: string;
  errorMessage?: string | null;
  metadata?: Record<string, unknown> | null;
  userId?: string | null;
  userEmail?: string | null;
  req?: any;
};

const DEDUP_MS = 15 * 60 * 1000;
const recentFingerprints = new Map<string, number>();
const telemetryRateLimit = createRateLimit({
  windowMs: 60 * 1000,
  max: 20,
  keyPrefix: "feature-telemetry",
  message: { error: "Limite de registros de falha excedido." },
});

function pruneDedup(now: number) {
  for (const [k, ts] of recentFingerprints) {
    if (now - ts > DEDUP_MS) recentFingerprints.delete(k);
  }
}

export function classifyFeatureFromRoute(route: string): string {
  const p = String(route || "").toLowerCase();
  if (/whatsapp|wa\.|meta.?cloud|evolution/.test(p)) return "whatsapp";
  if (/upload|foto|photo|gallery|galeria|image/.test(p)) return "fotos";
  if (/library|biblioteca|pdf-proxy|fundamento/.test(p)) return "biblioteca";
  if (/mensalidade|financeiro|transaction|pix|cobranca|efi/.test(p)) return "financeiro";
  if (/calendario|gira|evento|events|convite|rsvp/.test(p)) return "agenda";
  if (/filho|membros|children|corrente|child/.test(p)) return "membros";
  if (/preceito|obrigacao/.test(p)) return "preceito";
  if (/settings|configuracoes|config/.test(p)) return "configuracoes";
  if (/store|loja/.test(p)) return "conteudo";
  if (/auth|login|password|senha|otp/.test(p)) return "acesso";
  if (/diretorio|claim|register|onboarding|tenant/.test(p)) return "cadastro";
  return "api";
}

function fingerprintOf(input: {
  tenantId?: string | null;
  feature: string;
  route?: string | null;
  httpStatus?: number | null;
  errorMessage?: string | null;
}): string {
  const raw = [
    input.tenantId || "-",
    input.feature,
    input.route || "-",
    String(input.httpStatus || 0),
    String(input.errorMessage || "")
      .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, "{id}")
      .replace(/\d+/g, "#")
      .slice(0, 180),
  ].join("|");
  return createHash("sha1").update(raw).digest("hex").slice(0, 24);
}

function extractErrorMessage(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const msg = b.error || b.message || b.detail || b.msg;
  if (typeof msg === "string" && msg.trim()) return msg.trim().slice(0, 500);
  return null;
}

function extractTenantId(req: Request, body: unknown): string | null {
  const q = req.query || {};
  const fromQuery = typeof q.tenantId === "string" ? q.tenantId : "";
  if (fromQuery.trim()) return fromQuery.trim();
  const b = (req.body || {}) as Record<string, unknown>;
  const fromBody = String(b.tenantId || b.tenant_id || "").trim();
  if (fromBody) return fromBody;
  if (body && typeof body === "object") {
    const ob = body as Record<string, unknown>;
    const t = String(ob.tenantId || ob.tenant_id || "").trim();
    if (t) return t;
  }
  const hdr = String(req.headers["x-tenant-id"] || "").trim();
  return hdr || null;
}

export async function reportFeatureFailure(
  sb: { from: (t: string) => any },
  input: FeatureFailureInput
): Promise<{ saved: boolean; deduped?: boolean }> {
  const route = String(input.route || "").slice(0, 240);
  const feature = String(input.feature || classifyFeatureFromRoute(route) || "api").slice(0, 64);
  const errorMessage = String(input.errorMessage || "erro").slice(0, 500);
  const httpStatus = Number(input.httpStatus || 0) || null;
  const source = String(input.source || "api").slice(0, 40);
  const tenantId = String(input.tenantId || "").trim() || null;
  const fp = fingerprintOf({ tenantId, feature, route, httpStatus, errorMessage });

  const now = Date.now();
  pruneDedup(now);
  const dedupKey = `${tenantId || "global"}:${fp}`;
  if (recentFingerprints.has(dedupKey)) {
    return { saved: false, deduped: true };
  }
  recentFingerprints.set(dedupKey, now);

  try {
    const { error } = await sb.from("tenant_feature_failures").insert({
      tenant_id: tenantId,
      feature,
      route: route || null,
      http_status: httpStatus,
      source,
      error_message: errorMessage,
      error_fingerprint: fp,
      metadata: input.metadata || {},
    });
    if (error) {
      console.warn("[feature-monitor] insert falhou:", error.message);
      return { saved: false };
    }
  } catch (err: unknown) {
    console.warn(
      "[feature-monitor] insert exceção:",
      err instanceof Error ? err.message : err
    );
    return { saved: false };
  }

  void logEvent(sb, {
    eventType: "feature.failure",
    userId: input.userId || null,
    userEmail: input.userEmail || null,
    tenantId,
    targetType: "feature",
    targetId: feature,
    description: `Falha em ${feature}: ${errorMessage}`.slice(0, 280),
    metadata: {
      route,
      httpStatus,
      source,
      fingerprint: fp,
      ...(input.metadata || {}),
    },
    req: input.req,
  });

  return { saved: true };
}

/**
 * Middleware: quando a API responde 4xx/5xx com JSON de erro, registra a falha.
 * Ignora 401/404 ruidosos e rotas públicas de health.
 */
export function createFeatureFailureMiddleware(sb: { from: (t: string) => any }) {
  return function featureFailureMiddleware(req: Request, res: Response, next: NextFunction) {
    const path = String(req.path || req.url || "");
    if (!path.startsWith("/api")) return next();
    if (/\/health|\/webhook|\/public\//i.test(path)) return next();

    const originalJson = res.json.bind(res);
    res.json = ((body: unknown) => {
      try {
        const status = Number(res.statusCode || 200);
        const skip =
          status < 400 ||
          status === 401 ||
          status === 404 ||
          status === 429;
        if (!skip) {
          const errorMessage = extractErrorMessage(body) || `HTTP ${status}`;
          const tenantId = extractTenantId(req, body);
          void reportFeatureFailure(sb, {
            tenantId,
            feature: classifyFeatureFromRoute(path),
            route: `${req.method} ${path}`.slice(0, 240),
            httpStatus: status,
            source: "api",
            errorMessage,
            metadata: {
              method: req.method,
            },
            req,
          });
        }
      } catch (err: unknown) {
        console.warn(
          "[feature-monitor] middleware:",
          err instanceof Error ? err.message : err
        );
      }
      return originalJson(body);
    }) as typeof res.json;

    return next();
  };
}

export function registerFeatureFailureRoutes(
  app: any,
  deps: { supabaseAdmin: any; verifyUser?: (token: string) => Promise<{ user: any; error: any }> },
  requireAdmin?: (req: Request, res: Response) => Promise<{ user: any } | null>
) {
  // Rota pública/autenticada para o Frontend reportar qualquer falha de recurso
  app.post("/api/v1/telemetry/failure", telemetryRateLimit, async (req: Request, res: Response) => {
    try {
      let userId: string | null = null;
      let userEmail: string | null = null;
      let tenantId: string | null = null;

      const authHeader = String(req.headers.authorization || "").trim();
      const token = authHeader.replace(/^Bearer\s+/i, "").trim();

      if (token && deps.verifyUser) {
        try {
          const { user } = await deps.verifyUser(token);
          if (user) {
            userId = user.id;
            userEmail = user.email || null;
            // Busca tenant_id do líder se existir
            const { data: perfil } = await deps.supabaseAdmin
              .from("perfil_lider")
              .select("id, tenant_id")
              .eq("id", user.id)
              .maybeSingle();
            if (perfil) {
              tenantId = perfil.tenant_id || perfil.id;
            }
          }
        } catch {
          // Token pode estar expirado ou inválido; registra erro mesmo assim
        }
      }

      const body = (req.body || {}) as Record<string, unknown>;
      const feature = String(body.feature || "").trim().slice(0, 64) || "geral";
      const action = String(body.action || "").trim().slice(0, 120) || "acao_desconhecida";
      const errorMessage = String(body.errorMessage || body.error || "Erro no cliente").trim().slice(0, 500);
      const route = (String(body.route || body.path || "").trim() || action).slice(0, 240);
      // tenant_id e identidade só vêm de um token Supabase validado; não aceite
      // IDs/e-mails escolhidos pelo cliente em uma rota de telemetria pública.

      const rawMetadata = body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata)
        ? body.metadata as Record<string, unknown>
        : {};
      const metadata: Record<string, unknown> = {
        action,
        clientUserAgent: String(req.headers["user-agent"] || "").slice(0, 240) || null,
        clientIp: String(req.ip || req.headers["x-forwarded-for"] || "").slice(0, 80) || null,
        ...(typeof rawMetadata.isMobile === "boolean" ? { isMobile: rawMetadata.isMobile } : {}),
        ...(typeof rawMetadata.online === "boolean" ? { online: rawMetadata.online } : {}),
        ...(typeof rawMetadata.screen === "string" ? { screen: rawMetadata.screen.slice(0, 32) } : {}),
        ...(typeof rawMetadata.clientTimestamp === "string" ? { clientTimestamp: rawMetadata.clientTimestamp.slice(0, 40) } : {}),
      };

      const result = await reportFeatureFailure(deps.supabaseAdmin, {
        tenantId,
        feature,
        route,
        httpStatus: Number(body.httpStatus || 0) || null,
        source: "client_telemetry",
        errorMessage,
        metadata,
        userId,
        userEmail,
        req,
      });

      res.json({ ok: true, saved: result.saved, deduped: result.deduped });
    } catch (err: unknown) {
      console.warn("[feature-monitor] falha ao processar telemetria:", err);
      res.status(500).json({ error: "Falha ao registrar telemetria" });
    }
  });

  // Rotas Administrativas para o Painel de Controle (axecloud-admin)
  if (requireAdmin) {
    app.get("/api/admin-console/tenant-feature-failures", async (req: Request, res: Response) => {
      const ctx = await requireAdmin(req, res);
      if (!ctx) return;

      try {
        const feature = String(req.query.feature || "").trim();
        const tenantId = String(req.query.tenantId || "").trim();
        const status = String(req.query.status || "unresolved").trim(); // 'unresolved' | 'resolved' | 'all'
        const period = String(req.query.period || "today").trim(); // 'today' | '24h' | '7d' | '30d' | 'all'
        const limit = Math.min(200, Math.max(1, Number(req.query.limit || 50)));
        const offset = Math.max(0, Number(req.query.offset || 0));

        let sinceIso: string | null = null;
        const now = new Date();
        if (period === "today") {
          const brYmd = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(now);
          sinceIso = `${brYmd}T00:00:00-03:00`;
        } else if (period === "24h") {
          sinceIso = new Date(now.getTime() - 24 * 3600 * 1000).toISOString();
        } else if (period === "7d") {
          sinceIso = new Date(now.getTime() - 7 * 86400 * 1000).toISOString();
        } else if (period === "30d") {
          sinceIso = new Date(now.getTime() - 30 * 86400 * 1000).toISOString();
        }

        let q = deps.supabaseAdmin
          .from("tenant_feature_failures")
          .select("*", { count: "exact" });

        if (feature && feature !== "all") q = q.eq("feature", feature);
        if (tenantId) q = q.eq("tenant_id", tenantId);
        if (status === "unresolved") q = q.is("resolved_at", null);
        else if (status === "resolved") q = q.not("resolved_at", "is", null);
        if (sinceIso) q = q.gte("created_at", sinceIso);

        q = q.order("created_at", { ascending: false }).range(offset, offset + limit - 1);

        const { data: rows, count, error } = await q;
        if (error) throw error;

        // Contagens por recurso pendente respeitando o período filtrado
        let unresolvedQuery = deps.supabaseAdmin
          .from("tenant_feature_failures")
          .select("feature")
          .is("resolved_at", null);
        if (sinceIso) {
          unresolvedQuery = unresolvedQuery.gte("created_at", sinceIso);
        }
        const { data: unresolvedRows } = await unresolvedQuery;

        const byFeature: Record<string, number> = {};
        for (const row of unresolvedRows || []) {
          const f = String(row.feature || "outros");
          byFeature[f] = (byFeature[f] || 0) + 1;
        }

        // Enriquece os terreiros com nome e zelador
        const tenantIds = [...new Set((rows || []).map((r: any) => r.tenant_id).filter(Boolean))];
        let terreiroMap: Record<string, { nome: string; zelador: string; email: string }> = {};

        if (tenantIds.length > 0) {
          const { data: terreiros } = await deps.supabaseAdmin
            .from("perfil_lider")
            .select("id, nome_terreiro, cargo, email")
            .in("id", tenantIds);

          for (const t of terreiros || []) {
            terreiroMap[t.id] = {
              nome: t.nome_terreiro || "Terreiro sem nome",
              zelador: t.cargo || "Zelador",
              email: t.email || "",
            };
          }
        }

        const enrichedRows = (rows || []).map((r: any) => {
          const info = r.tenant_id ? terreiroMap[r.tenant_id] : null;
          return {
            ...r,
            terreiro_nome: info?.nome || null,
            zelador_nome: info?.zelador || null,
            terreiro_email: info?.email || null,
          };
        });

        res.json({
          rows: enrichedRows,
          total: count || 0,
          unresolvedCount: (unresolvedRows || []).length,
          byFeature,
        });
      } catch (err: unknown) {
        console.error("[feature-monitor] erro ao listar falhas:", err);
        res.status(500).json({ error: "Erro ao consultar falhas de recursos" });
      }
    });

    app.post("/api/admin-console/tenant-feature-failures/:id/resolve", async (req: Request, res: Response) => {
      const ctx = await requireAdmin(req, res);
      if (!ctx) return;

      try {
        const { id } = req.params;
        const now = new Date().toISOString();
        const { error } = await deps.supabaseAdmin
          .from("tenant_feature_failures")
          .update({ resolved_at: now })
          .eq("id", id);

        if (error) throw error;
        res.json({ ok: true });
      } catch (err: unknown) {
        res.status(500).json({ error: "Erro ao resolver falha" });
      }
    });

    app.post("/api/admin-console/tenant-feature-failures/resolve-all", async (req: Request, res: Response) => {
      const ctx = await requireAdmin(req, res);
      if (!ctx) return;

      try {
        const feature = req.body?.feature ? String(req.body.feature).trim() : null;
        let q = deps.supabaseAdmin
          .from("tenant_feature_failures")
          .update({ resolved_at: new Date().toISOString() })
          .is("resolved_at", null);

        if (feature && feature !== "all") q = q.eq("feature", feature);
        const { error } = await q;
        if (error) throw error;

        res.json({ ok: true });
      } catch (err: unknown) {
        res.status(500).json({ error: "Erro ao resolver falhas em lote" });
      }
    });

    app.post("/api/admin-console/tenant-feature-failures/auto-heal", async (req: Request, res: Response) => {
      const ctx = await requireAdmin(req, res);
      if (!ctx) return;

      try {
        const { runSelfHealingTick } = await import("./selfHealing.js");
        const result = await runSelfHealingTick(deps.supabaseAdmin);
        res.json({ ok: true, ...result });
      } catch (err: unknown) {
        console.error("[feature-monitor] auto-heal erro:", err);
        res.status(500).json({ error: "Erro ao executar ciclo de auto-cura" });
      }
    });
  }
}
