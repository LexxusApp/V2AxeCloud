import { Container } from "@cloudflare/containers";
import { env as runtimeEnv } from "cloudflare:workers";
import { createClient } from "@supabase/supabase-js";
import { handlePixWebhookEdge } from "./pixWebhookEdge.js";

type AxeCloudBindings = {
  AXECLOUD_API_CONTAINER: DurableObjectNamespace<AxeCloudApiContainer>;
  APP_ASSETS: Fetcher;
  PROSPECT_API?: Fetcher;
  AXECLOUD_STAGING_TOKEN?: string;
  CRON_SECRET?: string;
  VITE_SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  SUPABASE_URL?: string;
  WA_META_TOKEN?: string;
  WA_PHONE_NUMBER_ID?: string;
  WA_BUSINESS_VERSION?: string;
  WA_META_TEMPLATE_DADOS_ACESSO?: string;
  [name: string]: unknown;
};

const PRODUCTION_HOST = "axecloud.com.br";
const RETIRED_SITEMAP_RE = /^\/sitemap-terreiros(?:-\d+)?\.xml$/;
const PRODUCTION_PUBLIC_EXACT_PATHS = new Set([
  "/sitemap.xml",
  "/.well-known/api-catalog",
  "/openapi.json",
  "/auth.md",
  "/.well-known/auth.md",
  "/sitemap-terreiros.xml",
  "/api/health-check",
  "/api/ping",
  "/api/public-config",
  "/api/v1/app-build",
  "/api/plans",
  "/api/tenant-info",
  "/api/auth/audit-log",
  "/api/auth/filho-login",
  "/api/metrics/public-visit",
  "/api/metrics/conversion-event",
]);

const PRODUCTION_APP_PREFIXES = [
  "/api/admin/",
  "/api/admin-console/",
  "/api/metrics/",
  "/api/children",
  "/api/events",
  "/api/notices",
  "/api/inventory",
  "/api/transactions",
  "/api/loja-pedidos",
  "/api/library",
  "/api/notifications",
  "/api/event-guests",
  "/api/push-subscribe",
  "/api/push-broadcast",
  "/api/push-direct",
  "/api/v1/cron/",
  "/api/v1/checkout/",
  "/api/v1/subscription/",
  "/api/v1/financeiro/",
  "/api/webhooks/",
  "/api/whatsapp/",
  "/api/cron",
  "/api/test-db",
  "/webhook/",
  "/api/v1/filho/",
  "/api/v1/financial/",
  "/api/v1/library/",
  "/api/v1/gallery/",
  "/api/v1/preceitos",
  "/api/v1/fundamentos",
  "/api/v1/events/",
  "/api/v1/participacoes",
  "/api/v1/frequencia",
  "/api/v1/atendimentos/",
  "/api/v1/chat/",
  "/api/v1/gestao/",
  "/api/v1/settings/",
  "/api/v1/profile/",
  "/api/v1/account/",
  "/api/v1/support",
  "/api/v1/store/",
  "/api/store/",
  "/api/v1/obrigacao-pdf/",
  "/api/v1/event-banner",
  "/api/v1/legal/",
  "/api/v1/onboarding/",
  "/api/v1/founder-program/",
];

function isProductionPublicRequest(url: URL): boolean {
  if (url.hostname !== PRODUCTION_HOST) return false;
  // Todo endpoint HTTP de producao pertence ao Container. A autorizacao e as
  // permissoes continuam sendo aplicadas pela propria API Express.
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/webhook/") ||
    url.pathname.startsWith("/sitemap-terreiros-")
  ) return true;
  if (PRODUCTION_PUBLIC_EXACT_PATHS.has(url.pathname)) return true;
  return (
    url.pathname.startsWith("/api/v1/public/") ||
    url.pathname.startsWith("/api/v1/landing/") ||
    url.pathname.startsWith("/api/v1/auth/") ||
    PRODUCTION_APP_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))
  );
}

function stringBindings(bindings: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(bindings).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
}

export class AxeCloudApiContainer extends Container {
  defaultPort = 3000;
  sleepAfter = "10m";
  envVars = stringBindings(runtimeEnv as unknown as Record<string, unknown>);

  override onStart() {
    console.log("[axecloud-api] container iniciado");
  }

  override onStop() {
    console.log("[axecloud-api] container suspenso");
  }

  override onError(error: unknown) {
    console.error("[axecloud-api] erro no container", error);
  }
}


async function resolveSmartFilhoLoginRequest(
  request: Request,
  env: AxeCloudBindings,
): Promise<{ forwardedRequest?: Request; directResponse?: Response }> {
  let body: any;
  try {
    body = await request.clone().json();
  } catch {
    return { forwardedRequest: request };
  }

  const rawIdentifier = String(body?.identifier || body?.childId || body?.child_id || "").trim();
  const rawCpf = String(body?.cpfPrefix || body?.cpf || "").trim();
  const cpfDigits = rawCpf.replace(/\D/g, "").slice(0, 6);

  if (!rawIdentifier || !cpfDigits) {
    return { forwardedRequest: request };
  }

  const isEmail = rawIdentifier.includes("@");
  const isPhone =
    !isEmail &&
    /^\+?[\d\s().-]{8,22}$/.test(rawIdentifier) &&
    !/^AXC/i.test(rawIdentifier);

  if (!isEmail && !isPhone) {
    const normalizedBody = { ...body, childId: rawIdentifier, cpfPrefix: cpfDigits };
    const forwardedHeaders = new Headers(request.headers);
    forwardedHeaders.set("content-type", "application/json");
    return {
      forwardedRequest: new Request(request.url, {
        method: "POST",
        headers: forwardedHeaders,
        body: JSON.stringify(normalizedBody),
      }),
    };
  }

  const sbUrl = String(env.VITE_SUPABASE_URL || env.SUPABASE_URL || "").trim().replace(/\/$/, "");
  const sbKey = String(env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!sbUrl || !sbKey) {
    return { forwardedRequest: request };
  }

  try {
    let matchedChild: {
      id: string;
      data_entrada?: string | null;
      created_at?: string | null;
      cpf?: string | null;
    } | null = null;

    if (isEmail) {
      const emailParam = rawIdentifier.toLowerCase();
      const qs = new URLSearchParams({
        select: "id,nome,cpf,email,data_entrada,created_at",
        email: `ilike.${emailParam}`,
        limit: "10",
      });
      const res = await fetch(`${sbUrl}/rest/v1/filhos_de_santo?${qs}`, {
        headers: {
          apikey: sbKey,
          Authorization: `Bearer ${sbKey}`,
          Accept: "application/json",
        },
      });
      if (res.ok) {
        const rows = (await res.json()) as any[];
        matchedChild =
          rows.find((r) =>
            String(r.cpf || "").replace(/\D/g, "").startsWith(cpfDigits)
          ) || null;
      }
    } else if (isPhone) {
      let cleanPhone = rawIdentifier.replace(/\D/g, "");
      if (cleanPhone.startsWith("55") && cleanPhone.length >= 12) {
        cleanPhone = cleanPhone.slice(2);
      }
      if (cleanPhone.startsWith("0") && cleanPhone.length >= 11) {
        cleanPhone = cleanPhone.replace(/^0+/, "");
      }
      const last8 = cleanPhone.slice(-8);

      const qs = new URLSearchParams({
        select: "id,nome,cpf,whatsapp_phone,data_entrada,created_at",
        whatsapp_phone: `ilike.%${last8}%`,
        limit: "20",
      });
      const res = await fetch(`${sbUrl}/rest/v1/filhos_de_santo?${qs}`, {
        headers: {
          apikey: sbKey,
          Authorization: `Bearer ${sbKey}`,
          Accept: "application/json",
        },
      });
      if (res.ok) {
        const rows = (await res.json()) as any[];
        const matchingCpf = rows.filter((r) =>
          String(r.cpf || "").replace(/\D/g, "").startsWith(cpfDigits)
        );
        matchedChild =
          matchingCpf.find((r) => {
            const dbDigits = String(r.whatsapp_phone || "").replace(/\D/g, "").replace(/^55/, "").replace(/^0+/, "");
            return dbDigits === cleanPhone;
          }) || matchingCpf[0] || null;
      }
    }

    if (!matchedChild) {
      return {
        directResponse: Response.json(
          { error: "Registro ou CPF incorretos.", code: "INVALID_CREDENTIALS" },
          {
            status: 401,
            headers: {
              "content-type": "application/json",
              "x-axecloud-runtime": "cloudflare-edge",
            },
          }
        ),
      };
    }

    const entryDate = matchedChild.data_entrada || matchedChild.created_at;
    const year = entryDate
      ? new Date(entryDate).getFullYear()
      : new Date().getFullYear();
    const matricula = `AXC-${year}-${matchedChild.id.substring(0, 4).toUpperCase()}`;

    const rewrittenBody = {
      ...body,
      childId: matricula,
      cpfPrefix: cpfDigits,
    };

    const forwardedHeaders = new Headers(request.headers);
    forwardedHeaders.set("content-type", "application/json");

    return {
      forwardedRequest: new Request(request.url, {
        method: "POST",
        headers: forwardedHeaders,
        body: JSON.stringify(rewrittenBody),
      }),
    };
  } catch (err) {
    console.error("[axecloud-api-worker] Erro ao resolver login inteligente:", err);
    return { forwardedRequest: request };
  }
}

async function syncChildEmail(
  request: Request,
  response: Response,
  url: URL,
  env: AxeCloudBindings,
  childEmailToSync: string | null | undefined
): Promise<Response> {
  if (childEmailToSync === undefined || !response.ok) {
    return response;
  }
  const isChildrenPost = url.pathname === "/api/children" && request.method === "POST";
  const isChildrenPut = /^\/api\/children\/[a-zA-Z0-9-]+$/i.test(url.pathname) && request.method === "PUT";
  if (!isChildrenPost && !isChildrenPut) {
    return response;
  }

  const sbUrl = String(env.VITE_SUPABASE_URL || env.SUPABASE_URL || "").trim().replace(/\/$/, "");
  const sbKey = String(env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!sbUrl || !sbKey) return response;

  try {
    let resJson: any = null;
    let childId: string | null = null;
    try {
      resJson = await response.clone().json();
      childId = resJson?.data?.id || resJson?.id || (isChildrenPut ? url.pathname.split("/").pop() : null);
    } catch {}

    if (childId) {
      const emailValue = childEmailToSync ? childEmailToSync.trim().toLowerCase() : null;
      await fetch(`${sbUrl}/rest/v1/filhos_de_santo?id=eq.${encodeURIComponent(childId)}`, {
        method: "PATCH",
        headers: {
          apikey: sbKey,
          Authorization: `Bearer ${sbKey}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({ email: emailValue }),
      });

      if (resJson && typeof resJson === "object") {
        if (resJson.data && typeof resJson.data === "object") {
          resJson.data.email = emailValue;
        } else {
          resJson.email = emailValue;
        }
        const resHeaders = new Headers(response.headers);
        resHeaders.set("x-axecloud-runtime", "cloudflare-edge-sync");
        return Response.json(resJson, { status: response.status, headers: resHeaders });
      }
    }
  } catch (err) {
    console.error("[axecloud-api-worker] Erro ao sincronizar email de filho:", err);
  }

  return response;
}

function isCantinaTenantAllowed(tenantId: string, email?: string | null): boolean {
  // Cantina liberada globalmente para todos os terreiros autenticados
  return Boolean(tenantId || email);
}

async function handleCantinaEdgeRequest(request: Request, env: AxeCloudBindings): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/v1/cantina/")) return null;

  const sbUrl = String(env.VITE_SUPABASE_URL || env.SUPABASE_URL || "").trim().replace(/\/$/, "");
  const sbKey = String(env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!sbUrl || !sbKey) {
    return Response.json({ error: "Configuração de banco indisponível" }, { status: 500 });
  }

  const supabase = createClient(sbUrl, sbKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const authHeader = request.headers.get("authorization") || request.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return Response.json({ error: "Não autorizado" }, { status: 401 });
  }

  let user: { id: string; email?: string } | null = null;
  try {
    const { data: { user: authUser }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !authUser) {
      return Response.json({ error: "Sessão inválida" }, { status: 401 });
    }
    user = { id: authUser.id, email: authUser.email };
  } catch {
    return Response.json({ error: "Erro ao validar sessão" }, { status: 401 });
  }

  // GET /api/v1/cantina/data
  if (url.pathname === "/api/v1/cantina/data" && request.method === "GET") {
    const tenantIdRaw = url.searchParams.get("tenantId") || "";
    if (!tenantIdRaw) {
      return Response.json({ error: "tenantId é obrigatório" }, { status: 400 });
    }

    const { data: leaderRow } = await supabase
      .from("perfil_lider")
      .select("id")
      .or(`id.eq.${tenantIdRaw},tenant_id.eq.${tenantIdRaw}`)
      .maybeSingle();
    const tenantPk = leaderRow?.id || tenantIdRaw;

    if (!isCantinaTenantAllowed(tenantPk, user.email)) {
      return Response.json({ error: "Módulo Cantina disponível apenas no ambiente de testes autorizado." }, { status: 403 });
    }

    try {
      const { data: filhos, error: fErr } = await supabase
        .from("filhos_de_santo")
        .select("id, nome, foto_url, cargo, whatsapp_phone, limite_lojinha, bloquear_fiado_loja, status")
        .or(`tenant_id.eq.${tenantPk},lider_id.eq.${tenantPk}`)
        .order("nome", { ascending: true });
      if (fErr) throw fErr;

      const { data: transacoes, error: tErr } = await supabase
        .from("financeiro")
        .select("id, data, descricao, valor, status, categoria, tipo, filho_id, created_at")
        .or(`tenant_id.eq.${tenantPk},lider_id.eq.${tenantPk}`)
        .in("categoria", ["Cantina", "Loja"])
        .order("data", { ascending: false });
      if (tErr) throw tErr;

      const { data: produtos } = await supabase
        .from("produtos")
        .select("id, nome, preco, categoria, estoque_atual")
        .eq("tenant_id", tenantPk)
        .order("nome", { ascending: true });

      const today = new Date().toISOString().slice(0, 10);
      const currentMonthPrefix = today.slice(0, 7);
      const validTx = (transacoes || []).filter(
        (r: any) => String(r.status || "").toLowerCase() !== "excluido"
      );

      const txByFilho = new Map<string, any[]>();
      for (const tx of validTx) {
        if (!tx.filho_id) continue;
        const fid = String(tx.filho_id);
        const list = txByFilho.get(fid) || [];
        list.push(tx);
        txByFilho.set(fid, list);
      }

      let totalPendenteGeral = 0;
      let totalRecebidoMesGeral = 0;
      let totalVendasMesGeral = 0;
      let filhosComPendenciaCount = 0;

      const filhosCards = (filhos || []).map((f: any) => {
        const fTx = txByFilho.get(f.id) || [];
        const pendentes = fTx.filter((t: any) => String(t.status || "").toLowerCase() === "pendente");
        const pagosMes = fTx.filter(
          (t: any) =>
            String(t.status || "").toLowerCase() === "pago" &&
            String(t.data || "").startsWith(currentMonthPrefix)
        );

        const saldoPendente = pendentes.reduce((sum: number, t: any) => sum + (Number(t.valor) || 0), 0);
        const totalPagoMes = pagosMes.reduce((sum: number, t: any) => sum + (Number(t.valor) || 0), 0);
        const limite = Number(f.limite_lojinha !== undefined && f.limite_lojinha !== null ? f.limite_lojinha : 100);
        const disponivel = Math.max(0, limite - saldoPendente);
        const bloqueado = Boolean(f.bloquear_fiado_loja || (saldoPendente >= limite && limite > 0));

        totalPendenteGeral += saldoPendente;
        totalRecebidoMesGeral += totalPagoMes;
        if (saldoPendente > 0) filhosComPendenciaCount++;

        return {
          id: f.id,
          nome: f.nome || "Sem nome",
          foto_url: f.foto_url || null,
          cargo: f.cargo || "Filho de Santo",
          whatsapp_phone: f.whatsapp_phone || null,
          limite_lojinha: limite,
          bloquear_fiado_loja: Boolean(f.bloquear_fiado_loja),
          saldo_pendente: Number(saldoPendente.toFixed(2)),
          saldo_disponivel: Number(disponivel.toFixed(2)),
          total_pago_mes: Number(totalPagoMes.toFixed(2)),
          bloqueado,
          pedidos_pendentes: pendentes.slice(0, 10).map((t: any) => ({
            id: t.id,
            data: t.data,
            descricao: t.descricao,
            valor: Number(t.valor) || 0,
            status: t.status,
          })),
        };
      });

      const txMes = validTx.filter((t: any) => String(t.data || "").startsWith(currentMonthPrefix));
      totalVendasMesGeral = txMes.reduce((sum: number, t: any) => sum + (Number(t.valor) || 0), 0);

      return Response.json({
        filhos: filhosCards,
        stats: {
          total_pendente: Number(totalPendenteGeral.toFixed(2)),
          total_recebido_mes: Number(totalRecebidoMesGeral.toFixed(2)),
          total_vendas_mes: Number(totalVendasMesGeral.toFixed(2)),
          filhos_com_pendencia: filhosComPendenciaCount,
          total_filhos: (filhos || []).length,
        },
        transactions: validTx.slice(0, 30),
        produtos: produtos || [],
      }, {
        headers: { "x-axecloud-runtime": "cloudflare-edge-cantina" }
      });
    } catch (e: any) {
      console.error("[cantina edge GET]", e);
      return Response.json({ error: e.message || "Erro ao carregar dados da cantina." }, { status: 500 });
    }
  }

  // POST /api/v1/cantina/consumo
  if (url.pathname === "/api/v1/cantina/consumo" && request.method === "POST") {
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Corpo da requisição inválido" }, { status: 400 });
    }

    const { tenantId, filhoId, descricao, valor, formaPagamento, itens } = body;
    if (!tenantId || !filhoId) {
      return Response.json({ error: "tenantId e filhoId são obrigatórios" }, { status: 400 });
    }

    const valorNum = Number(valor);
    if (!Number.isFinite(valorNum) || valorNum <= 0) {
      return Response.json({ error: "Valor inválido" }, { status: 400 });
    }

    const { data: leaderRow } = await supabase
      .from("perfil_lider")
      .select("id")
      .or(`id.eq.${tenantId},tenant_id.eq.${tenantId}`)
      .maybeSingle();
    const tenantPk = leaderRow?.id || tenantId;

    if (!isCantinaTenantAllowed(tenantPk, user.email)) {
      return Response.json({ error: "Módulo Cantina disponível apenas no ambiente de testes autorizado." }, { status: 403 });
    }

    const descStr = String(descricao || "").trim() || "Consumo na Cantina";
    const payMode = formaPagamento === "pago" ? "pago" : "fiado";

    try {
      const { data: filho, error: fErr } = await supabase
        .from("filhos_de_santo")
        .select("id, nome, limite_lojinha, bloquear_fiado_loja")
        .eq("id", filhoId)
        .or(`tenant_id.eq.${tenantPk},lider_id.eq.${tenantPk}`)
        .maybeSingle();

      if (fErr || !filho) {
        return Response.json({ error: "Filho de santo não encontrado" }, { status: 404 });
      }

      if (payMode === "fiado") {
        if (filho.bloquear_fiado_loja) {
          return Response.json({
            error: `O médium ${filho.nome} está bloqueado para compras a prazo na cantina/lojinha.`,
          }, { status: 400 });
        }

        const limite = Number(filho.limite_lojinha !== undefined && filho.limite_lojinha !== null ? filho.limite_lojinha : 100);

        const { data: pendingRows } = await supabase
          .from("financeiro")
          .select("valor")
          .eq("tenant_id", tenantPk)
          .eq("filho_id", filhoId)
          .in("categoria", ["Cantina", "Loja"])
          .eq("status", "pendente");

        const saldoAtual = (pendingRows || []).reduce((sum: number, r: any) => sum + (Number(r.valor) || 0), 0);
        if (saldoAtual + valorNum > limite) {
          const disponivel = Math.max(0, limite - saldoAtual);
          return Response.json({
            error: `Limite de crédito na cantina atingido para ${filho.nome}! Limite: R$ ${limite.toFixed(2)}, em aberto: R$ ${saldoAtual.toFixed(2)}, disponível: R$ ${disponivel.toFixed(2)}. Não é possível lançar R$ ${valorNum.toFixed(2)}.`,
          }, { status: 400 });
        }
      }

      const statusGravacao = payMode === "pago" ? "pago" : "pendente";
      const txDate = new Date().toISOString().slice(0, 10);

      const financeRow: Record<string, unknown> = {
        tipo: "entrada",
        valor: Number(valorNum.toFixed(2)),
        categoria: "Cantina",
        data: txDate,
        descricao: `Cantina - ${filho.nome} - ${descStr} (ID:${filhoId})`,
        tenant_id: tenantPk,
        lider_id: user.id,
        filho_id: filhoId,
        status: statusGravacao,
      };

      const { data: insertedTx, error: insErr } = await supabase
        .from("financeiro")
        .insert([financeRow])
        .select("*")
        .single();
      if (insErr) throw insErr;

      const resumoItens = Array.isArray(itens) && itens.length > 0
        ? itens.map((i: any) => `${i.quantidade || 1}× ${i.nome || "item"}`).join(", ")
        : descStr;

      await supabase.from("loja_pedidos").insert({
        tenant_id: tenantPk,
        filho_id: filhoId,
        filho_nome: filho.nome,
        tipo: "cantina",
        metodo_pagamento: payMode === "pago" ? "balcao_pago" : "marcar_conta",
        resumo_itens: resumoItens,
        valor_total: Number(valorNum.toFixed(2)),
      });

      return Response.json({
        success: true,
        transaction: insertedTx,
        status: statusGravacao,
      }, {
        headers: { "x-axecloud-runtime": "cloudflare-edge-cantina" }
      });
    } catch (e: any) {
      console.error("[cantina edge consumo]", e);
      return Response.json({ error: e.message || "Erro ao registrar consumo na cantina." }, { status: 500 });
    }
  }

  // POST /api/v1/cantina/liquidar
  if (url.pathname === "/api/v1/cantina/liquidar" && request.method === "POST") {
    let body: any = {};
    try { body = await request.json(); } catch { return Response.json({ error: "Corpo inválido" }, { status: 400 }); }
    const { tenantId, filhoId, transactionId } = body;
    if (!tenantId) return Response.json({ error: "tenantId é obrigatório" }, { status: 400 });

    const { data: leaderRow } = await supabase
      .from("perfil_lider")
      .select("id")
      .or(`id.eq.${tenantId},tenant_id.eq.${tenantId}`)
      .maybeSingle();
    const tenantPk = leaderRow?.id || tenantId;

    if (!isCantinaTenantAllowed(tenantPk, user.email)) {
      return Response.json({ error: "Módulo Cantina disponível apenas no ambiente de testes autorizado." }, { status: 403 });
    }

    try {
      const paymentDate = new Date().toISOString().slice(0, 10);
      if (transactionId) {
        const { error } = await supabase
          .from("financeiro")
          .update({ status: "pago", data: paymentDate })
          .eq("id", transactionId)
          .eq("tenant_id", tenantPk);
        if (error) throw error;
        return Response.json({ success: true, count: 1 }, { headers: { "x-axecloud-runtime": "cloudflare-edge-cantina" } });
      }

      if (filhoId) {
        const { data: updated, error } = await supabase
          .from("financeiro")
          .update({ status: "pago", data: paymentDate })
          .eq("tenant_id", tenantPk)
          .eq("filho_id", filhoId)
          .in("categoria", ["Cantina", "Loja"])
          .eq("status", "pendente")
          .select("id");
        if (error) throw error;
        return Response.json({ success: true, count: (updated || []).length }, { headers: { "x-axecloud-runtime": "cloudflare-edge-cantina" } });
      }

      return Response.json({ error: "filhoId ou transactionId é obrigatório" }, { status: 400 });
    } catch (e: any) {
      console.error("[cantina edge liquidar]", e);
      return Response.json({ error: e.message || "Erro ao quitar consumo." }, { status: 500 });
    }
  }

  // POST /api/v1/cantina/estornar
  if (url.pathname === "/api/v1/cantina/estornar" && request.method === "POST") {
    let body: any = {};
    try { body = await request.json(); } catch { return Response.json({ error: "Corpo inválido" }, { status: 400 }); }
    const { tenantId, transactionId } = body;
    if (!tenantId || !transactionId) return Response.json({ error: "tenantId e transactionId são obrigatórios" }, { status: 400 });

    const { data: leaderRow } = await supabase
      .from("perfil_lider")
      .select("id")
      .or(`id.eq.${tenantId},tenant_id.eq.${tenantId}`)
      .maybeSingle();
    const tenantPk = leaderRow?.id || tenantId;

    if (!isCantinaTenantAllowed(tenantPk, user.email)) {
      return Response.json({ error: "Módulo Cantina disponível apenas no ambiente de testes autorizado." }, { status: 403 });
    }

    try {
      const { error } = await supabase
        .from("financeiro")
        .update({ status: "pendente" })
        .eq("id", transactionId)
        .eq("tenant_id", tenantPk);
      if (error) throw error;
      return Response.json({ success: true }, { headers: { "x-axecloud-runtime": "cloudflare-edge-cantina" } });
    } catch (e: any) {
      console.error("[cantina edge estornar]", e);
      return Response.json({ error: e.message || "Erro ao estornar pagamento." }, { status: 500 });
    }
  }

  // PATCH /api/v1/cantina/limite
  if (url.pathname === "/api/v1/cantina/limite" && request.method === "PATCH") {
    let body: any = {};
    try { body = await request.json(); } catch { return Response.json({ error: "Corpo inválido" }, { status: 400 }); }
    const { tenantId, filhoId, limite_lojinha, bloquear_fiado_loja } = body;
    if (!tenantId || !filhoId) return Response.json({ error: "tenantId e filhoId são obrigatórios" }, { status: 400 });

    const { data: leaderRow } = await supabase
      .from("perfil_lider")
      .select("id")
      .or(`id.eq.${tenantId},tenant_id.eq.${tenantId}`)
      .maybeSingle();
    const tenantPk = leaderRow?.id || tenantId;

    if (!isCantinaTenantAllowed(tenantPk, user.email)) {
      return Response.json({ error: "Módulo Cantina disponível apenas no ambiente de testes autorizado." }, { status: 403 });
    }

    try {
      const updateData: Record<string, unknown> = {};
      if (limite_lojinha !== undefined) {
        updateData.limite_lojinha = Math.max(0, Number(limite_lojinha) || 0);
      }
      if (bloquear_fiado_loja !== undefined) {
        updateData.bloquear_fiado_loja = Boolean(bloquear_fiado_loja);
      }

      const { data, error } = await supabase
        .from("filhos_de_santo")
        .update(updateData)
        .eq("id", filhoId)
        .or(`tenant_id.eq.${tenantPk},lider_id.eq.${tenantPk}`)
        .select("id, nome, limite_lojinha, bloquear_fiado_loja")
        .single();
      if (error) throw error;

      return Response.json({ success: true, filho: data }, { headers: { "x-axecloud-runtime": "cloudflare-edge-cantina" } });
    } catch (e: any) {
      console.error("[cantina edge limite]", e);
      return Response.json({ error: e.message || "Erro ao atualizar limite." }, { status: 500 });
    }
  }

  return null;
}

async function sendMetaDadosAcessoDirect(
  env: AxeCloudBindings,
  supabase: any,
  params: {
    toPhone: string;
    nomeFilho: string;
    nomeTerreiro: string;
    registro: string;
    email?: string | null;
    cpfPrefix?: string | null;
    filhoId?: string | null;
    tenantId?: string | null;
  }
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const metaToken = String(env.WA_META_TOKEN || "").trim();
  const phoneId = String(env.WA_PHONE_NUMBER_ID || "").trim();
  if (!metaToken || !phoneId) {
    return { success: false, error: "Meta WhatsApp token/phoneId não configurados" };
  }

  let cleanPhone = String(params.toPhone || "").replace(/\D/g, "");
  if (!cleanPhone.startsWith("55") && (cleanPhone.length === 10 || cleanPhone.length === 11)) {
    cleanPhone = `55${cleanPhone}`;
  }

  const email = params.email ? String(params.email).trim() : "";
  const registro = String(params.registro || "").trim();
  const nomeFilho = String(params.nomeFilho || "Membro").trim();
  const nomeTerreiro = String(params.nomeTerreiro || "AxéCloud").trim();
  const cleanCpfDigits = String(params.cpfPrefix || "").replace(/\D/g, "");
  const senhaValue = cleanCpfDigits.length >= 6 ? cleanCpfDigits.slice(0, 6) : "6 primeiros dígitos do CPF";

  const loginDetail = email
    ? `Login: seu E-mail (${email}), WhatsApp ou Registro (${registro || "-"})`
    : `Login: seu WhatsApp ou Registro (${registro || "-"})`;

  const credencialText = `${loginDetail} · Senha: ${senhaValue} · Link: https://axecloud.com.br/entrar?modo=filho`;

  const metaVersion = String(env.WA_BUSINESS_VERSION || "v21.0").trim();
  const templateName = String(env.WA_META_TEMPLATE_DADOS_ACESSO || "conta_membro_cadastro_axc").trim();

  const payload = {
    messaging_product: "whatsapp",
    to: cleanPhone,
    type: "template",
    template: {
      name: templateName,
      language: { code: "pt_BR" },
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: nomeFilho.slice(0, 60) },
            { type: "text", text: nomeTerreiro.slice(0, 80) },
            { type: "text", text: credencialText.slice(0, 512) },
          ],
        },
      ],
    },
  };

  try {
    const res = await fetch(`https://graph.facebook.com/${metaVersion}/${phoneId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${metaToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const resJson: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("[axecloud-edge-whatsapp] Erro Meta Cloud API:", resJson);
      return { success: false, error: resJson?.error?.message || "Falha ao enviar mensagem Meta" };
    }

    const messageId = resJson?.messages?.[0]?.id;

    if (params.tenantId) {
      try {
        await supabase.from("whatsapp_logs").insert({
          tenant_id: params.tenantId,
          filho_id: params.filhoId || null,
          tipo: "dados_acesso",
          telefone: cleanPhone,
          mensagem: credencialText,
          status: "sent",
          external_id: messageId || null,
        });
      } catch (logErr) {
        console.error("[axecloud-edge-whatsapp] Erro ao gravar log:", logErr);
      }
    }

    return { success: true, messageId };
  } catch (err: any) {
    console.error("[axecloud-edge-whatsapp] Exceção:", err);
    return { success: false, error: err?.message || "Erro de conexão Meta" };
  }
}

async function sendMetaAvisoGiraDirect(
  env: AxeCloudBindings,
  supabase: any,
  params: {
    toPhone: string;
    nomeFilho: string;
    quando: string;
    nomeTerreiro: string;
    tituloGira: string;
    hora: string;
    filhoId?: string | null;
    tenantId?: string | null;
  }
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const metaToken = String(env.WA_META_TOKEN || "").trim();
  const phoneId = String(env.WA_PHONE_NUMBER_ID || "").trim();
  if (!metaToken || !phoneId) {
    return { success: false, error: "Meta WhatsApp token/phoneId não configurados" };
  }

  let cleanPhone = String(params.toPhone || "").replace(/\D/g, "");
  if (!cleanPhone.startsWith("55") && (cleanPhone.length === 10 || cleanPhone.length === 11)) {
    cleanPhone = `55${cleanPhone}`;
  }

  const metaVersion = String(env.WA_BUSINESS_VERSION || "v21.0").trim();
  const templateName = "aviso_gira_lembrete_botoes_axecloud";

  const payload = {
    messaging_product: "whatsapp",
    to: cleanPhone,
    type: "template",
    template: {
      name: templateName,
      language: { code: "pt_BR" },
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: params.nomeFilho.slice(0, 60) },
            { type: "text", text: params.quando.slice(0, 60) },
            { type: "text", text: params.nomeTerreiro.slice(0, 80) },
            { type: "text", text: params.tituloGira.slice(0, 80) },
            { type: "text", text: params.hora.slice(0, 30) },
          ],
        },
      ],
    },
  };

  try {
    const res = await fetch(`https://graph.facebook.com/${metaVersion}/${phoneId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${metaToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const resJson: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("[axecloud-edge-gira-whatsapp] Erro Meta Cloud API:", resJson);
      return { success: false, error: resJson?.error?.message || "Falha ao enviar mensagem Meta" };
    }

    const messageId = resJson?.messages?.[0]?.id;

    if (params.tenantId) {
      try {
        await supabase.from("whatsapp_logs").insert({
          tenant_id: params.tenantId,
          filho_id: params.filhoId || null,
          tipo: "aviso_gira",
          telefone: cleanPhone,
          mensagem: `${params.tituloGira} - ${params.quando} às ${params.hora} (${params.nomeTerreiro})`,
          status: "sent",
          external_id: messageId || null,
        });
      } catch (logErr) {
        console.error("[axecloud-edge-gira-whatsapp] Erro ao gravar log:", logErr);
      }
    }

    return { success: true, messageId };
  } catch (err: any) {
    console.error("[axecloud-edge-gira-whatsapp] Exceção:", err);
    return { success: false, error: err?.message || "Erro de conexão Meta" };
  }
}


async function sendMetaCobrancaCantinaDirect(
  env: AxeCloudBindings,
  supabase: any,
  params: {
    toPhone: string;
    nomeFilho: string;
    nomeTerreiro: string;
    valor: string;
    chavePix: string;
    filhoId?: string | null;
    tenantId?: string | null;
  }
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const metaToken = String(env.WA_META_TOKEN || "").trim();
  const phoneId = String(env.WA_PHONE_NUMBER_ID || "").trim();
  if (!metaToken || !phoneId) {
    return { success: false, error: "Meta WhatsApp token/phoneId não configurados" };
  }

  let cleanPhone = String(params.toPhone || "").replace(/\D/g, "");
  if (!cleanPhone.startsWith("55") && (cleanPhone.length === 10 || cleanPhone.length === 11)) {
    cleanPhone = `55${cleanPhone}`;
  }

  const metaVersion = String(env.WA_BUSINESS_VERSION || "v21.0").trim();
  const templateName = "cobranca_cantina_axecloud";

  const payload = {
    messaging_product: "whatsapp",
    to: cleanPhone,
    type: "template",
    template: {
      name: templateName,
      language: { code: "pt_BR" },
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: params.nomeFilho.slice(0, 60) },
            { type: "text", text: params.nomeTerreiro.slice(0, 80) },
            { type: "text", text: params.valor.slice(0, 30) },
            { type: "text", text: params.chavePix.slice(0, 80) },
          ],
        },
      ],
    },
  };

  try {
    const res = await fetch(`https://graph.facebook.com/${metaVersion}/${phoneId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${metaToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const resJson: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("[axecloud-edge-cantina-whatsapp] Erro Meta Cloud API:", resJson);
      return { success: false, error: resJson?.error?.message || "Falha ao enviar mensagem Meta" };
    }

    const messageId = resJson?.messages?.[0]?.id;

    if (params.tenantId) {
      try {
        await supabase.from("whatsapp_logs").insert({
          tenant_id: params.tenantId,
          filho_id: params.filhoId || null,
          tipo: "cobranca_cantina",
          telefone: cleanPhone,
          mensagem: `Cobrança cantina R$ ${params.valor} - ${params.nomeTerreiro}`,
          status: "sent",
          external_id: messageId || null,
        });
      } catch (logErr) {
        console.error("[axecloud-edge-cantina-whatsapp] Erro ao gravar log:", logErr);
      }
    }

    return { success: true, messageId };
  } catch (err: any) {
    console.error("[axecloud-edge-cantina-whatsapp] Exceção:", err);
    return { success: false, error: err?.message || "Erro de conexão Meta" };
  }
}

async function sendMetaCobrancaMensalidadeDirect(
  env: AxeCloudBindings,
  supabase: any,
  params: {
    toPhone: string;
    nomeFilho: string;
    referencia: string;
    valor: string;
    nomeTerreiro: string;
    filhoId?: string | null;
    tenantId?: string | null;
  }
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const metaToken = String(env.WA_META_TOKEN || "").trim();
  const phoneId = String(env.WA_PHONE_NUMBER_ID || "").trim();
  if (!metaToken || !phoneId) {
    return { success: false, error: "Meta WhatsApp token/phoneId não configurados" };
  }

  let cleanPhone = String(params.toPhone || "").replace(/\D/g, "");
  if (!cleanPhone.startsWith("55") && (cleanPhone.length === 10 || cleanPhone.length === 11)) {
    cleanPhone = `55${cleanPhone}`;
  }

  const metaVersion = String(env.WA_BUSINESS_VERSION || "v21.0").trim();
  const templateName = "cobranca_mensalidade_axecloud";

  const payload = {
    messaging_product: "whatsapp",
    to: cleanPhone,
    type: "template",
    template: {
      name: templateName,
      language: { code: "pt_BR" },
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: params.nomeFilho.slice(0, 60) },
            { type: "text", text: params.referencia.slice(0, 30) },
            { type: "text", text: params.valor.slice(0, 30) },
            { type: "text", text: params.nomeTerreiro.slice(0, 80) },
          ],
        },
      ],
    },
  };

  try {
    const res = await fetch(`https://graph.facebook.com/${metaVersion}/${phoneId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${metaToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const resJson: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("[axecloud-edge-mensalidade-whatsapp] Erro Meta Cloud API:", resJson);
      return { success: false, error: resJson?.error?.message || "Falha ao enviar mensagem Meta" };
    }

    const messageId = resJson?.messages?.[0]?.id;

    if (params.tenantId) {
      try {
        await supabase.from("whatsapp_logs").insert({
          tenant_id: params.tenantId,
          filho_id: params.filhoId || null,
          tipo: "cobranca_mensalidade",
          telefone: cleanPhone,
          mensagem: `Mensalidade ${params.referencia} R$ ${params.valor} - ${params.nomeTerreiro}`,
          status: "sent",
          external_id: messageId || null,
        });
      } catch (logErr) {
        console.error("[axecloud-edge-mensalidade-whatsapp] Erro ao gravar log:", logErr);
      }
    }

    return { success: true, messageId };
  } catch (err: any) {
    console.error("[axecloud-edge-mensalidade-whatsapp] Exceção:", err);
    return { success: false, error: err?.message || "Erro de conexão Meta" };
  }
}

async function handleGiraNotificationEdgeRequest(
  request: Request,
  env: AxeCloudBindings,
  eventId: string
): Promise<Response | null> {
  const sbUrl = String(env.VITE_SUPABASE_URL || env.SUPABASE_URL || "").trim().replace(/\/$/, "");
  const sbKey = String(env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!sbUrl || !sbKey) return null;

  const supabase = createClient(sbUrl, sbKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const authHeader = request.headers.get("authorization") || request.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return Response.json({ error: "Não autorizado" }, { status: 401 });
  }

  let user: { id: string; email?: string } | null = null;
  try {
    const { data: { user: authUser }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !authUser) {
      return Response.json({ error: "Sessão inválida" }, { status: 401 });
    }
    user = { id: authUser.id, email: authUser.email };
  } catch {
    return Response.json({ error: "Erro ao validar sessão" }, { status: 401 });
  }

  const { data: leaderProfile } = await supabase
    .from("perfil_lider")
    .select("id, tenant_id, role, is_admin_global, nome_terreiro")
    .eq("id", user.id)
    .maybeSingle();

  if (leaderProfile?.role === "filho") {
    return Response.json({ error: "Acesso negado para membro" }, { status: 403 });
  }

  const { data: event, error: eventErr } = await supabase
    .from("calendario_axe")
    .select("id, titulo, data, hora, banner_url, tenant_id, lider_id")
    .eq("id", eventId)
    .maybeSingle();

  if (eventErr || !event) {
    return Response.json({ error: "Evento não encontrado" }, { status: 404 });
  }

  const tenantId = String(event.tenant_id || event.lider_id || leaderProfile?.tenant_id || user.id);
  const isGlobalAdmin = Boolean(leaderProfile?.is_admin_global);
  if (!isGlobalAdmin && tenantId !== leaderProfile?.tenant_id && event.lider_id !== user.id) {
    return Response.json({ error: "Acesso negado a este evento" }, { status: 403 });
  }

  const eventYmd = String(event.data || "").trim().slice(0, 10);
  const eventHora = String(event.hora || "").trim().slice(0, 5) || "Horário a confirmar";
  const terreiroNome = String(leaderProfile?.nome_terreiro || "Terreiro").trim();
  const tituloGira = String(event.titulo || "Gira").trim();

  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  let quando = "";
  if (eventYmd === todayStr) {
    quando = "hoje";
  } else {
    try {
      const [y, m, d] = eventYmd.split("-").map(Number);
      const evDate = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
      const diaSemana = new Intl.DateTimeFormat("pt-BR", { weekday: "long", timeZone: "America/Sao_Paulo" }).format(evDate);
      const dataBr = `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
      quando = `nesta ${diaSemana} (${dataBr})`;
    } catch {
      quando = `no dia ${eventYmd}`;
    }
  }

  const { data: filhos } = await supabase
    .from("filhos_de_santo")
    .select("id, nome, whatsapp_phone, status")
    .or(`tenant_id.eq.${tenantId},lider_id.eq.${tenantId}`);

  const eligible = (filhos || []).filter((f: any) => {
    const st = String(f.status || "Ativo").trim().toLowerCase();
    if (st === "inativo" || st === "desligado" || st === "falecido") return false;
    const phone = String(f.whatsapp_phone || "").replace(/\D/g, "");
    return phone.length >= 10;
  });

  if (eligible.length === 0) {
    return Response.json({
      success: true,
      message: "Nenhum membro ativo com WhatsApp cadastrado para envio.",
      sent: 0,
      total: 0,
    }, {
      headers: { "x-axecloud-runtime": "cloudflare-edge-gira-notify" },
    });
  }

  let sent = 0;
  let errors = 0;
  for (const filho of eligible) {
    const phone = String(filho.whatsapp_phone || "").replace(/\D/g, "");
    const res = await sendMetaAvisoGiraDirect(env, supabase, {
      toPhone: phone,
      nomeFilho: String(filho.nome || "Membro").trim(),
      quando,
      nomeTerreiro: terreiroNome,
      tituloGira,
      hora: eventHora,
      filhoId: filho.id,
      tenantId,
    });
    if (res.success) {
      sent++;
    } else {
      errors++;
    }
  }

  return Response.json({
    success: true,
    sent,
    errors,
    total: eligible.length,
    message: `${sent} ${sent === 1 ? 'aviso enviado' : 'avisos enviados'} para a corrente.`,
  }, {
    headers: { "x-axecloud-runtime": "cloudflare-edge-gira-notify" },
  });
}

async function handleChildrenEdgeRequest(
  request: Request,
  env: AxeCloudBindings
): Promise<Response | null> {
  const url = new URL(request.url);
  const cleanPath = url.pathname.replace(/\/$/, "");
  const isChildrenCollection = cleanPath === "/api/children" || cleanPath === "/api/v1/children";
  const childIdMatch = cleanPath.match(/^\/api\/(?:v1\/)?children\/([0-9a-fA-F-]+)$/);
  const childId = childIdMatch ? childIdMatch[1] : null;

  if (!isChildrenCollection && !childId) {
    return null;
  }

  const sbUrl = String(env.VITE_SUPABASE_URL || env.SUPABASE_URL || "").trim().replace(/\/$/, "");
  const sbKey = String(env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!sbUrl || !sbKey) {
    return Response.json({ error: "Configuração de banco indisponível" }, { status: 500 });
  }

  const supabase = createClient(sbUrl, sbKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const authHeader = request.headers.get("authorization") || request.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return Response.json({ error: "Não autorizado" }, { status: 401 });
  }

  let user: { id: string; email?: string } | null = null;
  try {
    const { data: { user: authUser }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !authUser) {
      return Response.json({ error: "Sessão inválida" }, { status: 401 });
    }
    user = { id: authUser.id, email: authUser.email };
  } catch {
    return Response.json({ error: "Erro ao validar sessão" }, { status: 401 });
  }

  const { data: leaderProfile } = await supabase
    .from("perfil_lider")
    .select("id, tenant_id, role, is_admin_global, nome_terreiro")
    .eq("id", user.id)
    .maybeSingle();

  const allowedTenants = new Set<string>([user.id]);
  if (leaderProfile?.tenant_id) allowedTenants.add(leaderProfile.tenant_id);
  if (leaderProfile?.id) allowedTenants.add(leaderProfile.id);

  const queryTenant = url.searchParams.get("tenantId");
  if (queryTenant && (allowedTenants.has(queryTenant) || leaderProfile?.is_admin_global)) {
    allowedTenants.add(queryTenant);
  }

  const edgeHeaders = {
    "content-type": "application/json",
    "x-axecloud-runtime": "cloudflare-edge-children",
  };

  // 1. GET /api/children/:id
  if (childId && request.method === "GET") {
    try {
      const { data: child, error: childErr } = await supabase
        .from("filhos_de_santo")
        .select("*")
        .eq("id", childId)
        .maybeSingle();

      if (childErr || !child) {
        return Response.json({ error: "Filho não encontrado ou acesso negado" }, { status: 404, headers: edgeHeaders });
      }

      const childTenant = String(child.tenant_id || "");
      const childLeader = String(child.lider_id || "");
      const childUserId = String(child.user_id || "");

      const isAllowed =
        allowedTenants.has(childTenant) ||
        allowedTenants.has(childLeader) ||
        childUserId === user.id ||
        Boolean(leaderProfile?.is_admin_global);

      if (!isAllowed) {
        return Response.json({ error: "Filho não encontrado ou acesso negado" }, { status: 404, headers: edgeHeaders });
      }

      return Response.json(
        { success: true, data: child },
        {
          status: 200,
          headers: {
            ...edgeHeaders,
            "cache-control": "private, max-age=10, stale-while-revalidate=60",
          },
        }
      );
    } catch (err: any) {
      console.error("[children edge GET]", err);
      return Response.json({ error: err?.message || "Erro ao consultar filho de santo" }, { status: 500, headers: edgeHeaders });
    }
  }

  // 2. PUT /api/children/:id
  if (childId && request.method === "PUT") {
    try {
      const { data: existingChild, error: verifyErr } = await supabase
        .from("filhos_de_santo")
        .select("id, tenant_id, lider_id")
        .eq("id", childId)
        .maybeSingle();

      if (verifyErr || !existingChild) {
        return Response.json({ error: "Filho não encontrado ou acesso negado" }, { status: 404, headers: edgeHeaders });
      }

      const childTenant = String(existingChild.tenant_id || "");
      const childLeader = String(existingChild.lider_id || "");
      const isAllowed =
        allowedTenants.has(childTenant) ||
        allowedTenants.has(childLeader) ||
        Boolean(leaderProfile?.is_admin_global);

      if (!isAllowed) {
        return Response.json({ error: "Acesso negado" }, { status: 403, headers: edgeHeaders });
      }

      let body: any = {};
      try {
        body = await request.json();
      } catch {
        return Response.json({ error: "Corpo da requisição inválido" }, { status: 400, headers: edgeHeaders });
      }

      const updatePayload: Record<string, unknown> = { ...body };
      delete updatePayload.id;
      delete updatePayload.lider_id;
      delete updatePayload.tenant_id;
      delete updatePayload.created_at;

      if (updatePayload.data_nascimento === "") updatePayload.data_nascimento = null;
      if (updatePayload.data_entrada === "") updatePayload.data_entrada = null;
      if (updatePayload.data_feitura === "") updatePayload.data_feitura = null;
      if ("email" in updatePayload) {
        updatePayload.email = updatePayload.email ? String(updatePayload.email).trim().toLowerCase() : null;
      }
      if ("whatsapp_phone" in updatePayload) {
        updatePayload.whatsapp_phone = updatePayload.whatsapp_phone ? String(updatePayload.whatsapp_phone).trim() : null;
      }
      if ("cpf" in updatePayload) {
        updatePayload.cpf = updatePayload.cpf ? String(updatePayload.cpf).trim() : null;
      }

      const { data: updatedChild, error: updateErr } = await supabase
        .from("filhos_de_santo")
        .update(updatePayload)
        .eq("id", childId)
        .select()
        .single();

      if (updateErr) {
        console.error("[children edge PUT]", updateErr);
        return Response.json({ error: "Erro ao atualizar filho de santo" }, { status: 500, headers: edgeHeaders });
      }

      return Response.json({ success: true, data: updatedChild }, { status: 200, headers: edgeHeaders });
    } catch (err: any) {
      console.error("[children edge PUT]", err);
      return Response.json({ error: err?.message || "Erro ao atualizar filho de santo" }, { status: 500, headers: edgeHeaders });
    }
  }

  // 3. DELETE /api/children/:id
  if (childId && request.method === "DELETE") {
    try {
      const { data: existingChild, error: verifyErr } = await supabase
        .from("filhos_de_santo")
        .select("id, tenant_id, lider_id")
        .eq("id", childId)
        .maybeSingle();

      if (verifyErr || !existingChild) {
        return Response.json({ error: "Filho não encontrado ou acesso negado" }, { status: 404, headers: edgeHeaders });
      }

      const childTenant = String(existingChild.tenant_id || "");
      const childLeader = String(existingChild.lider_id || "");
      const isAllowed =
        allowedTenants.has(childTenant) ||
        allowedTenants.has(childLeader) ||
        Boolean(leaderProfile?.is_admin_global);

      if (!isAllowed) {
        return Response.json({ error: "Acesso negado" }, { status: 403, headers: edgeHeaders });
      }

      const { error: delErr } = await supabase
        .from("filhos_de_santo")
        .delete()
        .eq("id", childId);

      if (delErr) {
        console.error("[children edge DELETE]", delErr);
        return Response.json({ error: "Erro ao excluir filho de santo" }, { status: 500, headers: edgeHeaders });
      }

      return Response.json({ success: true }, { status: 200, headers: edgeHeaders });
    } catch (err: any) {
      console.error("[children edge DELETE]", err);
      return Response.json({ error: err?.message || "Erro ao excluir filho de santo" }, { status: 500, headers: edgeHeaders });
    }
  }

  // 4. GET /api/children
  if (isChildrenCollection && request.method === "GET") {
    try {
      const tenantList = Array.from(allowedTenants).filter(Boolean);
      let query = supabase.from("filhos_de_santo").select("*").order("nome", { ascending: true });

      if (tenantList.length > 0) {
        const orFilter = tenantList
          .flatMap((t) => [`tenant_id.eq.${t}`, `lider_id.eq.${t}`])
          .join(",");
        query = query.or(orFilter);
      } else {
        query = query.eq("lider_id", user.id);
      }

      const { data: childrenList, error: listErr } = await query;
      if (listErr) {
        console.error("[children edge GET list]", listErr);
        return Response.json({ error: "Erro ao buscar filhos de santo" }, { status: 500, headers: edgeHeaders });
      }

      return Response.json(
        { success: true, data: childrenList || [] },
        {
          status: 200,
          headers: {
            ...edgeHeaders,
            "cache-control": "private, max-age=10, stale-while-revalidate=60",
          },
        }
      );
    } catch (err: any) {
      console.error("[children edge GET list]", err);
      return Response.json({ error: err?.message || "Erro ao buscar filhos de santo" }, { status: 500, headers: edgeHeaders });
    }
  }

  // 5. POST /api/children
  if (isChildrenCollection && request.method === "POST") {
    try {
      let body: any = {};
      try {
        body = await request.json();
      } catch {
        return Response.json({ error: "Corpo da requisição inválido" }, { status: 400, headers: edgeHeaders });
      }

      const childData = body.childData || body;
      const effectiveTenantId = leaderProfile?.tenant_id || user.id;

      const dataToInsert: any = {
        ...childData,
        lider_id: user.id,
        tenant_id: effectiveTenantId,
      };

      if (dataToInsert.data_nascimento === "") dataToInsert.data_nascimento = null;
      if (dataToInsert.data_entrada === "") dataToInsert.data_entrada = null;
      if (dataToInsert.data_feitura === "") dataToInsert.data_feitura = null;
      if ("email" in dataToInsert) {
        dataToInsert.email = dataToInsert.email ? String(dataToInsert.email).trim().toLowerCase() : null;
      }
      if ("whatsapp_phone" in dataToInsert) {
        dataToInsert.whatsapp_phone = dataToInsert.whatsapp_phone ? String(dataToInsert.whatsapp_phone).trim() : null;
      }
      if ("cpf" in dataToInsert) {
        dataToInsert.cpf = dataToInsert.cpf ? String(dataToInsert.cpf).trim() : null;
      }

      const { data: insertedChild, error: insErr } = await supabase
        .from("filhos_de_santo")
        .insert([dataToInsert])
        .select()
        .single();

      if (insErr) {
        console.error("[children edge POST]", insErr);
        return Response.json({ error: "Erro ao cadastrar filho de santo" }, { status: 500, headers: edgeHeaders });
      }

      // Se possui WhatsApp e CPF, envia template Meta diretamente via Edge
      const rawPhone = String(insertedChild.whatsapp_phone || "").replace(/\D/g, "");
      const rawCpf = String(insertedChild.cpf || "").replace(/\D/g, "");
      if (rawPhone.length >= 10 && rawCpf.length >= 6) {
        const entryDate = insertedChild.data_entrada || insertedChild.created_at;
        const year = entryDate ? new Date(entryDate).getFullYear() : new Date().getFullYear();
        const matricula = `AXC-${year}-${insertedChild.id.substring(0, 4).toUpperCase()}`;

        try {
          await sendMetaDadosAcessoDirect(env, supabase, {
            toPhone: rawPhone,
            nomeFilho: insertedChild.nome || "Membro",
            nomeTerreiro: leaderProfile?.nome_terreiro || "AxéCloud",
            registro: matricula,
            email: insertedChild.email || null,
            cpfPrefix: rawCpf.slice(0, 6),
            filhoId: insertedChild.id,
            tenantId: effectiveTenantId,
          });
        } catch (waErr) {
          console.error("[children edge POST] Erro ao disparar WhatsApp de boas-vindas:", waErr);
        }
      }

      return Response.json({ success: true, data: insertedChild }, { status: 200, headers: edgeHeaders });
    } catch (err: any) {
      console.error("[children edge POST]", err);
      return Response.json({ error: err?.message || "Erro ao cadastrar filho de santo" }, { status: 500, headers: edgeHeaders });
    }
  }

  return null;
}

async function handleWhatsAppEdgeRequest(
  request: Request,
  env: AxeCloudBindings
): Promise<Response | null> {
  const url = new URL(request.url);
  const cleanPath = url.pathname.replace(/\/$/, "");
  const isSend = (cleanPath === "/api/whatsapp/send" || cleanPath === "/api/v1/whatsapp/send") && request.method === "POST";
  const isResend = (cleanPath === "/api/whatsapp/resend-dados-acesso" || cleanPath === "/api/v1/whatsapp/resend-dados-acesso") && request.method === "POST";

  if (!isSend && !isResend) return null;

  const sbUrl = String(env.VITE_SUPABASE_URL || env.SUPABASE_URL || "").trim().replace(/\/$/, "");
  const sbKey = String(env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!sbUrl || !sbKey) return null;

  const supabase = createClient(sbUrl, sbKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const authHeader = request.headers.get("authorization") || request.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return Response.json({ error: "Não autorizado" }, { status: 401 });
  }

  let user: { id: string; email?: string } | null = null;
  try {
    const { data: { user: authUser }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !authUser) {
      return Response.json({ error: "Sessão inválida" }, { status: 401 });
    }
    user = { id: authUser.id, email: authUser.email };
  } catch {
    return Response.json({ error: "Erro ao validar sessão" }, { status: 401 });
  }

  const { data: leaderProfile } = await supabase
    .from("perfil_lider")
    .select("id, tenant_id, role, is_admin_global, nome_terreiro")
    .eq("id", user.id)
    .maybeSingle();

  if (isSend) {
    let body: any = {};
    try {
      body = await request.clone().json();
    } catch {
      return null;
    }

    const tipoStr = String(body?.tipo || "").toLowerCase();
    const isDadosAcessoTipo = tipoStr === "dados_acesso" || tipoStr === "acesso" || tipoStr === "boas_vindas";
    const isCantinaTipo = tipoStr === "cobranca_cantina" || tipoStr === "cantina";
    const isMensalidadeTipo = tipoStr === "cobranca_mensalidade" || tipoStr === "mensalidade";
    const targetFilhoId = body?.filhoId || body?.filho_id || body?.childId;

    if ((!isDadosAcessoTipo && !isCantinaTipo && !isMensalidadeTipo) || !targetFilhoId) {
      // Outros tipos continuam para o container
      return null;
    }

    if (isCantinaTipo) {
      const { data: child } = await supabase
        .from("filhos_de_santo")
        .select("id, nome, whatsapp_phone, tenant_id, lider_id")
        .eq("id", targetFilhoId)
        .maybeSingle();

      if (!child) {
        return Response.json({ error: "Filho de santo não encontrado" }, { status: 404 });
      }

      const rawPhone = String(child.whatsapp_phone || "").replace(/\D/g, "");
      if (rawPhone.length < 10) {
        return Response.json({ error: "Filho não possui número de WhatsApp cadastrado." }, { status: 400 });
      }

      const effectiveTerreiro = body?.variables?.nome_terreiro || leaderProfile?.nome_terreiro || "Terreiro";
      const valor = String(body?.variables?.valor || "0,00").replace(/^R\$\s*/i, "").trim();
      const chavePix = String(body?.variables?.chave_pix || body?.variables?.chavePix || "Consulte a zeladoria").trim();

      const res = await sendMetaCobrancaCantinaDirect(env, supabase, {
        toPhone: rawPhone,
        nomeFilho: child.nome || "Membro",
        nomeTerreiro: effectiveTerreiro,
        valor,
        chavePix,
        filhoId: child.id,
        tenantId: child.tenant_id || leaderProfile?.tenant_id || user.id,
      });

      if (!res.success) {
        return Response.json({ error: res.error || "Não foi possível enviar a cobrança da cantina." }, { status: 502 });
      }

      return Response.json({ success: true, messageId: res.messageId }, {
        headers: { "x-axecloud-runtime": "cloudflare-edge-whatsapp" },
      });
    }

    if (isMensalidadeTipo) {
      const { data: child } = await supabase
        .from("filhos_de_santo")
        .select("id, nome, whatsapp_phone, tenant_id, lider_id")
        .eq("id", targetFilhoId)
        .maybeSingle();

      if (!child) {
        return Response.json({ error: "Filho de santo não encontrado" }, { status: 404 });
      }

      const rawPhone = String(child.whatsapp_phone || "").replace(/\D/g, "");
      if (rawPhone.length < 10) {
        return Response.json({ error: "Filho não possui número de WhatsApp cadastrado." }, { status: 400 });
      }

      const effectiveTerreiro = body?.variables?.nome_terreiro || leaderProfile?.nome_terreiro || "Terreiro";
      const valor = String(body?.variables?.valor || "0,00").replace(/^R\$\s*/i, "").trim();
      const referencia = String(body?.variables?.mes_ano || body?.variables?.referencia || "").trim() || "mensalidade";

      const res = await sendMetaCobrancaMensalidadeDirect(env, supabase, {
        toPhone: rawPhone,
        nomeFilho: child.nome || "Membro",
        referencia,
        valor,
        nomeTerreiro: effectiveTerreiro,
        filhoId: child.id,
        tenantId: child.tenant_id || leaderProfile?.tenant_id || user.id,
      });

      if (!res.success) {
        return Response.json({ error: res.error || "Não foi possível enviar a cobrança de mensalidade." }, { status: 502 });
      }

      return Response.json({ success: true, messageId: res.messageId }, {
        headers: { "x-axecloud-runtime": "cloudflare-edge-whatsapp" },
      });
    }

    const { data: child } = await supabase
      .from("filhos_de_santo")
      .select("id, nome, whatsapp_phone, cpf, data_entrada, created_at, email, tenant_id, lider_id")
      .eq("id", targetFilhoId)
      .maybeSingle();

    if (!child) {
      return Response.json({ error: "Filho de santo não encontrado" }, { status: 404 });
    }

    const rawPhone = String(child.whatsapp_phone || "").replace(/\D/g, "");
    if (rawPhone.length < 10) {
      return Response.json({ error: "Filho não possui número de WhatsApp cadastrado." }, { status: 400 });
    }

    const rawCpf = String(child.cpf || "").replace(/\D/g, "");
    const entryDate = child.data_entrada || child.created_at;
    const year = entryDate ? new Date(entryDate).getFullYear() : new Date().getFullYear();
    const matricula = `AXC-${year}-${child.id.substring(0, 4).toUpperCase()}`;

    const effectiveEmail = child.email || body?.variables?.email_filho || null;
    const effectiveTerreiro = body?.variables?.nome_terreiro || leaderProfile?.nome_terreiro || "AxéCloud";

    const res = await sendMetaDadosAcessoDirect(env, supabase, {
      toPhone: rawPhone,
      nomeFilho: child.nome || "Membro",
      nomeTerreiro: effectiveTerreiro,
      registro: matricula,
      email: effectiveEmail,
      cpfPrefix: rawCpf.length >= 6 ? rawCpf.slice(0, 6) : null,
      filhoId: child.id,
      tenantId: child.tenant_id || leaderProfile?.tenant_id || user.id,
    });

    if (!res.success) {
      return Response.json({ error: res.error || "Não foi possível enviar o acesso." }, { status: 502 });
    }

    return Response.json({ success: true, messageId: res.messageId }, {
      headers: { "x-axecloud-runtime": "cloudflare-edge-whatsapp" },
    });
  }

  if (isResend) {
    const tenantPk = leaderProfile?.tenant_id || user.id;
    const { data: filhos } = await supabase
      .from("filhos_de_santo")
      .select("id, nome, whatsapp_phone, cpf, data_entrada, created_at, email, status")
      .or(`tenant_id.eq.${tenantPk},lider_id.eq.${tenantPk}`);

    let sent = 0;
    let failed = 0;
    let skippedNoPhone = 0;
    let skippedNoCpf = 0;

    const list = (filhos || []).filter((f) => {
      const st = String(f.status || "Ativo").trim().toLowerCase();
      return st !== "inativo" && st !== "desligado" && st !== "falecido";
    });

    for (const f of list) {
      const phoneDigits = String(f.whatsapp_phone || "").replace(/\D/g, "");
      if (phoneDigits.length < 10) {
        skippedNoPhone++;
        continue;
      }
      const cpfDigits = String(f.cpf || "").replace(/\D/g, "");
      if (cpfDigits.length < 6) {
        skippedNoCpf++;
        continue;
      }

      const entryDate = f.data_entrada || f.created_at;
      const year = entryDate ? new Date(entryDate).getFullYear() : new Date().getFullYear();
      const matricula = `AXC-${year}-${f.id.substring(0, 4).toUpperCase()}`;

      const res = await sendMetaDadosAcessoDirect(env, supabase, {
        toPhone: phoneDigits,
        nomeFilho: f.nome || "Membro",
        nomeTerreiro: leaderProfile?.nome_terreiro || "AxéCloud",
        registro: matricula,
        email: f.email || null,
        cpfPrefix: cpfDigits.slice(0, 6),
        filhoId: f.id,
        tenantId: tenantPk,
      });

      if (res.success) {
        sent++;
      } else {
        failed++;
      }
    }

    return Response.json({
      success: true,
      sent,
      failed,
      skippedNoPhone,
      skippedNoCpf,
      total: list.length,
    }, {
      headers: { "x-axecloud-runtime": "cloudflare-edge-whatsapp" },
    });
  }

  return null;
}

export default {
  async fetch(request: Request, env: AxeCloudBindings): Promise<Response> {
    const url = new URL(request.url);

    if (
      request.method === "POST" &&
      (url.pathname === "/api/webhooks/efi" ||
        url.pathname === "/webhook/efi" ||
        url.pathname.startsWith("/api/webhooks/efi"))
    ) {
      const pixResponse = await handlePixWebhookEdge(
        await request.clone().text(),
        url,
        request.method,
        env,
        {
          sourceIp: request.headers.get("cf-connecting-ip"),
          suppliedSecret:
            url.searchParams.get("hmac") ||
            request.headers.get("x-efi-webhook-secret") ||
            request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
            null,
        },
      );
      if (pixResponse) return pixResponse;
    }

    if (url.pathname.startsWith("/api/v1/cantina/")) {
      const cantinaRes = await handleCantinaEdgeRequest(request, env);
      if (cantinaRes) return cantinaRes;
    }

    if (url.pathname === "/api/children" || url.pathname.startsWith("/api/children/")) {
      const childrenRes = await handleChildrenEdgeRequest(request, env);
      if (childrenRes) return childrenRes;
    }

    if (url.pathname === "/api/whatsapp/send" || url.pathname === "/api/whatsapp/resend-dados-acesso") {
      const waRes = await handleWhatsAppEdgeRequest(request, env);
      if (waRes) return waRes;
    }

    const eventNotifyMatch = url.pathname.match(/^\/api\/events\/([a-zA-Z0-9-]+)\/notify-whatsapp\/?$/);
    if (eventNotifyMatch && request.method === "POST") {
      const giraRes = await handleGiraNotificationEdgeRequest(request, env, eventNotifyMatch[1]);
      if (giraRes) return giraRes;
    }

    // Defesa no edge para clientes antigos: não chega ao container nem à Meta.
    if (/^\/api\/whatsapp\/test-message\/?$/i.test(url.pathname)) {
      return Response.json(
        { error: "Envio de teste removido do painel do zelador.", code: "WHATSAPP_TEST_DISABLED" },
        { status: 410, headers: { "cache-control": "no-store", "x-axecloud-runtime": "cloudflare-container" } },
      );
    }

    if (url.hostname === PRODUCTION_HOST && RETIRED_SITEMAP_RE.test(url.pathname)) {
      return new Response("Sitemap antigo removido. Use https://axecloud.com.br/sitemap.xml", {
        status: 410,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "public, max-age=86400, s-maxage=86400",
          Link: '<https://axecloud.com.br/sitemap.xml>; rel="sitemap"',
        },
      });
    }

    if (url.pathname === "/api/v1/app-build") {
      const buildUrl = new URL("/build-info.json", request.url);
      const response = await env.APP_ASSETS.fetch(new Request(buildUrl, request));
      const headers = new Headers(response.headers);
      headers.set("x-axecloud-runtime", "cloudflare-app-assets");
      headers.set("cache-control", "no-store, no-cache, must-revalidate");
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }
    if (
      url.pathname === "/_worker/health" ||
      url.pathname === "/api/health-check" ||
      url.pathname === "/api/health" ||
      url.pathname === "/api/ping"
    ) {
      return Response.json(
        { status: "ok", time: new Date().toISOString(), service: "axecloud-api" },
        { headers: { "cache-control": "no-store", "x-axecloud-runtime": "cloudflare-edge" } }
      );
    }
    if (url.pathname.startsWith("/api/prospecting/") && env.PROSPECT_API) {
      return env.PROSPECT_API.fetch(request);
    }

    if (!isProductionPublicRequest(url)) {
      const stagingToken = env.AXECLOUD_STAGING_TOKEN;
      if (!stagingToken || request.headers.get("x-axecloud-staging-token") !== stagingToken) {
        return new Response("Not Found", { status: 404 });
      }
    }

    const headers = new Headers(request.headers);
    headers.delete("x-axecloud-staging-token");
    headers.delete("x-axecloud-client-ip");
    const clientIp = request.headers.get("cf-connecting-ip");
    if (clientIp) headers.set("x-axecloud-client-ip", clientIp);
    headers.set("x-forwarded-host", url.host);
    headers.set("x-forwarded-proto", url.protocol.replace(":", ""));
    headers.set("x-axecloud-runtime", "cloudflare-container");

    let activeRequest = request;
    if (url.pathname === "/api/auth/filho-login" && request.method === "POST") {
      const smart = await resolveSmartFilhoLoginRequest(request, env);
      if (smart.directResponse) return smart.directResponse;
      if (smart.forwardedRequest) activeRequest = smart.forwardedRequest;
    }

    const isChildrenPost = url.pathname === "/api/children" && request.method === "POST";
    const isChildrenPut = /^\/api\/children\/[a-zA-Z0-9-]+$/i.test(url.pathname) && request.method === "PUT";
    let childEmailToSync: string | null | undefined = undefined;
    if ((isChildrenPost || isChildrenPut) && request.headers.get("content-type")?.includes("application/json")) {
      try {
        const clonedJson = await request.clone().json();
        if ("email" in clonedJson) {
          childEmailToSync = typeof clonedJson.email === "string" ? clonedJson.email.trim().toLowerCase() : null;
        }
      } catch {}
    }

    let forwarded: Request;
    if (activeRequest === request) {
      forwarded = new Request(request, { headers });
    } else {
      for (const [k, v] of headers.entries()) {
        activeRequest.headers.set(k, v);
      }
      forwarded = activeRequest;
    }
    const container = env.AXECLOUD_API_CONTAINER.getByName("primary");

    let response: Response | null = null;
    let fetchError: unknown = null;

    const maxAttempts = (request.method === "GET" || request.method === "HEAD") ? 3 : 1;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const reqToFetch = attempt === 1 ? forwarded : new Request(forwarded.url, {
          method: forwarded.method,
          headers: forwarded.headers,
        });
        response = await container.fetch(reqToFetch);
        if (response && (response.ok || response.status < 500 || attempt === maxAttempts)) {
          fetchError = null;
          break;
        }
        if (response && response.status >= 500 && attempt < maxAttempts) {
          console.warn(`[axecloud-api] status ${response.status} na tentativa ${attempt}, aguardando container...`);
          await response.body?.cancel().catch(() => {});
          await new Promise((resolve) => setTimeout(resolve, attempt * 500));
          continue;
        }
      } catch (err) {
        fetchError = err;
        console.warn(`[axecloud-api] tentativa ${attempt} ao container falhou:`, err);
        if (attempt < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, attempt * 500));
        }
      }
    }

    if (!response || fetchError) {
      console.error("[axecloud-api] falha ao encaminhar requisicao apos retry", fetchError);
      return Response.json(
        { status: "error", message: "API temporariamente indisponivel" },
        { status: 503, headers: { "retry-after": "2" } },
      );
    }

    try {
      if (childEmailToSync !== undefined && response.ok) {
        return await syncChildEmail(request, response, url, env, childEmailToSync);
      }
      if (!response.ok) {
        const contentType = response.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) {
          const rawText = await response.text().catch(() => "");
          return Response.json(
            { error: rawText || "Serviço em inicialização, tente novamente em instantes.", status: response.status },
            {
              status: response.status,
              headers: {
                "content-type": "application/json",
                "x-axecloud-runtime": "cloudflare-container-fallback",
              },
            }
          );
        }
      }
      const responseHeaders = new Headers(response.headers);
      responseHeaders.set("x-axecloud-runtime", "cloudflare-container");
      const hasNullBody = response.status === 204 || response.status === 205 || response.status === 304;
      return new Response(hasNullBody ? null : response.body, {
        status: response.status,
        headers: responseHeaders,
      });
    } catch (postError) {
      console.error("[axecloud-api] erro ao processar resposta do container:", postError);
      if (response) {
        return response;
      }
      return Response.json(
        { status: "error", message: "Erro ao processar resposta da API" },
        { status: 502 },
      );
    }
  },
  async scheduled(_controller: ScheduledController, env: AxeCloudBindings, ctx: ExecutionContext) {
    const secret = typeof env.CRON_SECRET === "string" ? env.CRON_SECRET.trim() : "";
    if (!secret) {
      console.error("[axecloud-api] CRON_SECRET ausente; reconciliacao nao executada");
      return;
    }

    const container = env.AXECLOUD_API_CONTAINER.getByName("primary");
    const runJob = async (
      job: "subscription-access" | "whatsapp-jobs" | "mensalidades" | "self-healing",
      options: { forceDisponivel?: boolean } = {},
    ) => {
      const query = new URLSearchParams({ job });
      if (options.forceDisponivel) query.set("forceDisponivel", "1");
      const request = new Request(`http://axecloud-container/api/cron?${query.toString()}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${secret}` },
      });
      try {
        const response = await container.fetch(request);
        if (!response.ok) {
          console.error(`[axecloud-api] cron ${job} falhou`, response.status, await response.text());
          return;
        }
        console.log(`[axecloud-api] cron ${job} concluido`, await response.text());
      } catch (error) {
        console.error(`[axecloud-api] cron ${job} indisponivel`, error);
      }
    };

    const hourInSaoPaulo = Number(new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(new Date()));
    const minuteInSaoPaulo = Number(new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Sao_Paulo",
      minute: "2-digit",
    }).format(new Date()));
    const dayInSaoPaulo = Number(new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
    }).format(new Date()));

    // Recuperação idempotente somente no dia 1: se o lote principal das 12h
    // falhar, uma nova tentativa exclusiva acontece às 13h. Nunca cobra em
    // outros dias automaticamente.
    const primaryWhatsAppWindow = hourInSaoPaulo === 12 && minuteInSaoPaulo < 5;
    const mensalidadeRecoveryWindow =
      dayInSaoPaulo === 1 && hourInSaoPaulo >= 13 && minuteInSaoPaulo % 15 < 5;

    // O gatilho roda a cada 5 min: executa subscription-access e self-healing contínuo.
    ctx.waitUntil(Promise.all([
      runJob("subscription-access"),
      runJob("self-healing"),
      ...(primaryWhatsAppWindow ? [runJob("whatsapp-jobs")] : []),
      ...(mensalidadeRecoveryWindow ? [runJob("mensalidades", { forceDisponivel: true })] : []),
    ]).then(() => undefined));
  },
} satisfies ExportedHandler<AxeCloudBindings>;
