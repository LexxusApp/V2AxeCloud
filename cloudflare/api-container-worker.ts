import { Container } from "@cloudflare/containers";
import { env as runtimeEnv } from "cloudflare:workers";

type AxeCloudBindings = {
  AXECLOUD_API_CONTAINER: DurableObjectNamespace<AxeCloudApiContainer>;
  [name: string]: unknown;
};

function stringBindings(bindings: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(bindings).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
}

export class AxeCloudApiContainer extends Container {
  defaultPort = 3000;
  sleepAfter = "5m";
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

    const headers = new Headers(request.headers);
    headers.set("x-forwarded-host", url.host);
    headers.set("x-forwarded-proto", url.protocol.replace(":", ""));
    headers.set("x-axecloud-runtime", "cloudflare-container");

    const forwarded = new Request(request, { headers });
    const container = env.AXECLOUD_API_CONTAINER.getByName("primary");

    try {
      return await container.fetch(forwarded);
    } catch (error) {
      console.error("[axecloud-api] falha ao encaminhar requisicao", error);
      return Response.json(
        { status: "error", message: "API temporariamente indisponivel" },
        { status: 503, headers: { "retry-after": "5" } },
      );
    }
  },
} satisfies ExportedHandler<AxeCloudBindings>;