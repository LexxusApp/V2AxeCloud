import { createClient } from "@supabase/supabase-js";

export async function handleTenantFeatureFailuresEdge(
  request: Request,
  url: URL,
  env: {
    SUPABASE_SERVICE_ROLE_KEY?: string;
    VITE_SUPABASE_URL?: string;
    ADMIN_CONSOLE_EMAILS?: string;
    [k: string]: unknown;
  }
): Promise<Response | null> {
  const isFailuresRoute = url.pathname.startsWith("/api/admin-console/tenant-feature-failures");
  const isTelemetryRoute = url.pathname === "/api/v1/telemetry/failure";

  if (!isFailuresRoute && !isTelemetryRoute) {
    return null;
  }

  // Preflight CORS
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Authorization, Content-Type, x-tenant-id",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  const supabaseUrl = String(env.VITE_SUPABASE_URL || "").trim();
  const serviceKey = String(env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

  if (!supabaseUrl || !serviceKey) {
    return Response.json(
      { error: "Supabase credentials not configured in edge worker." },
      { status: 500 }
    );
  }

  const sb = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const corsHeaders = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store, no-cache, must-revalidate",
    "Access-Control-Allow-Origin": "*",
    "x-axecloud-runtime": "cloudflare-edge-failures",
  };

  // 1. Rota de Telemetria do Frontend (zelador / cliente reportando erro)
  if (isTelemetryRoute && request.method === "POST") {
    try {
      const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
      const feature = String(body.feature || "").trim() || "geral";
      const action = String(body.action || "").trim() || "acao_desconhecida";
      const errorMessage = String(body.errorMessage || body.error || "Erro no cliente").trim();
      const route = String(body.route || body.path || "").trim() || action;
      const tenantId = String(body.tenantId || "").trim() || null;
      const httpStatus = Number(body.httpStatus || 0) || null;

      const metadata = {
        action,
        clientUserAgent: request.headers.get("user-agent") || null,
        clientIp: request.headers.get("cf-connecting-ip") || null,
        clientTimestamp: new Date().toISOString(),
        ...(typeof body.metadata === "object" && body.metadata !== null ? (body.metadata as Record<string, unknown>) : {}),
      };

      const { error } = await sb.from("tenant_feature_failures").insert({
        tenant_id: tenantId,
        feature,
        route,
        http_status: httpStatus,
        source: "client_telemetry",
        error_message: errorMessage,
        metadata,
      });

      if (error) {
        console.warn("[edge-failures] insert error:", error);
      }

      return new Response(JSON.stringify({ ok: true, saved: !error }), {
        status: 200,
        headers: corsHeaders,
      });
    } catch {
      return new Response(JSON.stringify({ error: "Erro ao processar telemetria" }), {
        status: 500,
        headers: corsHeaders,
      });
    }
  }

  // 2. Rotas do Admin Console
  if (isFailuresRoute) {
    const authHeader = String(request.headers.get("authorization") || "").trim();
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();

    if (!token) {
      return new Response(JSON.stringify({ error: "Não autorizado: token ausente" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const { data: authData, error: authError } = await sb.auth.getUser(token);
    if (authError || !authData?.user) {
      return new Response(JSON.stringify({ error: "Sessão inválida ou expirada" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const user = authData.user;
    const userEmail = (user.email || "").toLowerCase().trim();
    const allowlist = String(env.ADMIN_CONSOLE_EMAILS || "")
      .toLowerCase()
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    let isAuthorized = allowlist.includes(userEmail);

    if (!isAuthorized) {
      const { data: perfil } = await sb
        .from("perfil_lider")
        .select("is_admin_global")
        .eq("id", user.id)
        .maybeSingle();
      if (perfil?.is_admin_global) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      return new Response(
        JSON.stringify({ error: "Acesso negado ao console administrativo." }),
        { status: 403, headers: corsHeaders }
      );
    }

    // Sub-rota: POST /resolve-all
    if (url.pathname === "/api/admin-console/tenant-feature-failures/resolve-all" && request.method === "POST") {
      const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
      const feature = String(body.feature || "").trim();

      let updateQuery = sb
        .from("tenant_feature_failures")
        .update({ resolved_at: new Date().toISOString() })
        .is("resolved_at", null);

      if (feature && feature !== "all") {
        updateQuery = updateQuery.eq("feature", feature);
      }

      const { error: updateErr } = await updateQuery;
      if (updateErr) {
        return new Response(JSON.stringify({ error: updateErr.message }), {
          status: 500,
          headers: corsHeaders,
        });
      }

      return new Response(JSON.stringify({ ok: true, success: true }), {
        status: 200,
        headers: corsHeaders,
      });
    }

    // Sub-rota: POST /:id/resolve
    const resolveMatch = url.pathname.match(
      /^\/api\/admin-console\/tenant-feature-failures\/([0-9a-fA-F-]+)\/resolve\/?$/
    );
    if (resolveMatch && request.method === "POST") {
      const id = resolveMatch[1];
      const { error: updateErr } = await sb
        .from("tenant_feature_failures")
        .update({ resolved_at: new Date().toISOString() })
        .eq("id", id);

      if (updateErr) {
        return new Response(JSON.stringify({ error: updateErr.message }), {
          status: 500,
          headers: corsHeaders,
        });
      }

      return new Response(JSON.stringify({ ok: true, success: true }), {
        status: 200,
        headers: corsHeaders,
      });
    }

    // Rota padrão: GET /api/admin-console/tenant-feature-failures
    if (request.method === "GET") {
      const feature = url.searchParams.get("feature") || "";
      const tenantId = url.searchParams.get("tenantId") || "";
      const status = url.searchParams.get("status") || "unresolved";
      const period = url.searchParams.get("period") || "today"; // 'today' | '24h' | '7d' | '30d' | 'all'
      const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") || 50)));

      let sinceIso: string | null = null;
      const now = new Date();
      if (period === "today") {
        // Início do dia de hoje no fuso horário do Brasil (UTC-3)
        const brYmd = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(now);
        sinceIso = `${brYmd}T00:00:00-03:00`;
      } else if (period === "24h") {
        sinceIso = new Date(now.getTime() - 24 * 3600 * 1000).toISOString();
      } else if (period === "7d") {
        sinceIso = new Date(now.getTime() - 7 * 86400 * 1000).toISOString();
      } else if (period === "30d") {
        sinceIso = new Date(now.getTime() - 30 * 86400 * 1000).toISOString();
      }

      let query = sb.from("tenant_feature_failures").select("*", { count: "exact" });

      if (feature && feature !== "all") query = query.eq("feature", feature);
      if (tenantId) query = query.eq("tenant_id", tenantId);
      if (status === "unresolved") query = query.is("resolved_at", null);
      else if (status === "resolved") query = query.not("resolved_at", "is", null);
      if (sinceIso) query = query.gte("created_at", sinceIso);

      query = query.order("created_at", { ascending: false }).limit(limit);

      const { data: rows, count, error } = await query;
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: corsHeaders,
        });
      }

      // Contagens por recurso pendente respeitando o período filtrado
      let unresolvedQuery = sb
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

      // Enriquecer dados dos terreiros
      const tenantIds = [...new Set((rows || []).map((r: any) => r.tenant_id).filter(Boolean))];
      let terreiroMap: Record<string, { nome: string; zelador: string; email: string }> = {};

      if (tenantIds.length > 0) {
        const { data: terreiros } = await sb
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

      return new Response(
        JSON.stringify({
          ok: true,
          rows: enrichedRows,
          total: count || 0,
          unresolvedCount: (unresolvedRows || []).length,
          byFeature,
        }),
        { status: 200, headers: corsHeaders }
      );
    }
  }

  return null;
}
