import { Container } from "@cloudflare/containers";
import { env as runtimeEnv } from "cloudflare:workers";

type AxeCloudBindings = {
  AXECLOUD_API_CONTAINER: DurableObjectNamespace<AxeCloudApiContainer>;
  APP_ASSETS: Fetcher;
  PROSPECT_API?: Fetcher;
  AXECLOUD_STAGING_TOKEN?: string;
  CRON_SECRET?: string;
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

export default {
  async fetch(request: Request, env: AxeCloudBindings): Promise<Response> {
    const url = new URL(request.url);

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
    if (url.pathname === "/_worker/health") {
      return Response.json({ status: "ok", service: "axecloud-api-container-worker" });
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

    const forwarded = new Request(request, { headers });
    const container = env.AXECLOUD_API_CONTAINER.getByName("primary");

    try {
      const response = await container.fetch(forwarded);
      const responseHeaders = new Headers(response.headers);
      responseHeaders.set("x-axecloud-runtime", "cloudflare-container");
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });
    } catch (error) {
      console.error("[axecloud-api] falha ao encaminhar requisicao", error);
      return Response.json(
        { status: "error", message: "API temporariamente indisponivel" },
        { status: 503, headers: { "retry-after": "5" } },
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
