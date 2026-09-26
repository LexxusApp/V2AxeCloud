import { Container } from "@cloudflare/containers";
import { env as runtimeEnv } from "cloudflare:workers";

type AxeCloudBindings = {
  AXECLOUD_API_CONTAINER: DurableObjectNamespace<AxeCloudApiContainer>;
  AXECLOUD_STAGING_TOKEN?: string;
  [name: string]: unknown;
};

const PRODUCTION_HOST = "axecloud.com.br";
const PRODUCTION_PUBLIC_EXACT_PATHS = new Set([
  "/api/health-check",
  "/api/ping",
  "/api/public-config",
  "/api/plans",
  "/api/tenant-info",
  "/api/auth/audit-log",
  "/api/auth/filho-login",
  "/api/metrics/public-visit",
  "/api/metrics/conversion-event",
]);

const PRODUCTION_APP_PREFIXES = [
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

    if (url.pathname === "/_worker/health") {
      return Response.json({ status: "ok", service: "axecloud-api-container-worker" });
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
    const container = env.AXECLOUD_API_CONTAINER.getByName("primary");
    ctx.waitUntil(
      container
        .fetch(new Request("http://axecloud-container/api/health-check"))
        .then((response) => {
          if (!response.ok) console.error("[axecloud-api] aquecimento falhou", response.status);
        })
        .catch((error) => console.error("[axecloud-api] aquecimento indisponivel", error)),
    );
  },
} satisfies ExportedHandler<AxeCloudBindings>;
