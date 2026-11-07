import fs from 'fs';

const targetPath = 'c:/Users/Lucas A/Desktop/AxecloudV2/AxecloudV2/cloudflare/api-container-worker.ts';
let content = fs.readFileSync(targetPath, 'utf8').replace(/\r\n/g, '\n');

// 1. Update AxeCloudBindings
const oldBindings = `type AxeCloudBindings = {
  AXECLOUD_API_CONTAINER: DurableObjectNamespace<AxeCloudApiContainer>;
  APP_ASSETS: Fetcher;
  PROSPECT_API?: Fetcher;
  AXECLOUD_STAGING_TOKEN?: string;
  CRON_SECRET?: string;
  [name: string]: unknown;
};`;

const newBindings = `type AxeCloudBindings = {
  AXECLOUD_API_CONTAINER: DurableObjectNamespace<AxeCloudApiContainer>;
  APP_ASSETS: Fetcher;
  PROSPECT_API?: Fetcher;
  AXECLOUD_STAGING_TOKEN?: string;
  CRON_SECRET?: string;
  VITE_SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  SUPABASE_URL?: string;
  [name: string]: unknown;
};`;

if (!content.includes(oldBindings)) {
  console.error('Bindings match failed');
  process.exit(1);
}
content = content.replace(oldBindings, newBindings);

// 2. Add helper functions
const helpers = `
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
  const cpfDigits = rawCpf.replace(/\\D/g, "").slice(0, 6);

  if (!rawIdentifier || !cpfDigits) {
    return { forwardedRequest: request };
  }

  const isEmail = rawIdentifier.includes("@");
  const isPhone =
    !isEmail &&
    /^\\+?[\\d\\s().-]{8,20}$/.test(rawIdentifier) &&
    !/^AXC/i.test(rawIdentifier);

  if (!isEmail && !isPhone) {
    const normalizedBody = { ...body, childId: rawIdentifier, cpfPrefix: cpfDigits };
    return {
      forwardedRequest: new Request(request, {
        body: JSON.stringify(normalizedBody),
        headers: {
          ...Object.fromEntries(request.headers.entries()),
          "content-type": "application/json",
        },
      }),
    };
  }

  const sbUrl = String(env.VITE_SUPABASE_URL || env.SUPABASE_URL || "").trim().replace(/\\/$/, "");
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
        email: \`ilike.\${emailParam}\`,
        limit: "10",
      });
      const res = await fetch(\`\${sbUrl}/rest/v1/filhos_de_santo?\${qs}\`, {
        headers: {
          apikey: sbKey,
          Authorization: \`Bearer \${sbKey}\`,
          Accept: "application/json",
        },
      });
      if (res.ok) {
        const rows = (await res.json()) as any[];
        matchedChild =
          rows.find((r) =>
            String(r.cpf || "").replace(/\\D/g, "").startsWith(cpfDigits)
          ) || null;
      }
    } else if (isPhone) {
      const cleanPhone = rawIdentifier.replace(/\\D/g, "");
      const national = cleanPhone.replace(/^55/, "");
      const last8 = national.slice(-8);

      const qs = new URLSearchParams({
        select: "id,nome,cpf,whatsapp_phone,data_entrada,created_at",
        whatsapp_phone: \`ilike.%\${last8}%\`,
        limit: "20",
      });
      const res = await fetch(\`\${sbUrl}/rest/v1/filhos_de_santo?\${qs}\`, {
        headers: {
          apikey: sbKey,
          Authorization: \`Bearer \${sbKey}\`,
          Accept: "application/json",
        },
      });
      if (res.ok) {
        const rows = (await res.json()) as any[];
        matchedChild =
          rows.find((r) =>
            String(r.cpf || "").replace(/\\D/g, "").startsWith(cpfDigits)
          ) || null;
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
    const matricula = \`AXC-\${year}-\${matchedChild.id.substring(0, 4).toUpperCase()}\`;

    const rewrittenBody = {
      ...body,
      childId: matricula,
      cpfPrefix: cpfDigits,
    };

    return {
      forwardedRequest: new Request(request, {
        body: JSON.stringify(rewrittenBody),
        headers: {
          ...Object.fromEntries(request.headers.entries()),
          "content-type": "application/json",
        },
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
  const isChildrenPut = /^\\/api\\/children\\/[a-zA-Z0-9-]+$/i.test(url.pathname) && request.method === "PUT";
  if (!isChildrenPost && !isChildrenPut) {
    return response;
  }

  const sbUrl = String(env.VITE_SUPABASE_URL || env.SUPABASE_URL || "").trim().replace(/\\/$/, "");
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
      await fetch(\`\${sbUrl}/rest/v1/filhos_de_santo?id=eq.\${encodeURIComponent(childId)}\`, {
        method: "PATCH",
        headers: {
          apikey: sbKey,
          Authorization: \`Bearer \${sbKey}\`,
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
`;

content = content.replace('export default {', helpers + '\nexport default {');

// 3. Intercept and wrap forwarding in fetch
const oldForward = `    const forwarded = new Request(request, { headers });
    const container = env.AXECLOUD_API_CONTAINER.getByName("primary");

    try {
      const response = await container.fetch(forwarded);
      const responseHeaders = new Headers(response.headers);
      responseHeaders.set("x-axecloud-runtime", "cloudflare-container");
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });`;

const newForward = `    let activeRequest = request;
    if (url.pathname === "/api/auth/filho-login" && request.method === "POST") {
      const smart = await resolveSmartFilhoLoginRequest(request, env);
      if (smart.directResponse) return smart.directResponse;
      if (smart.forwardedRequest) activeRequest = smart.forwardedRequest;
    }

    const isChildrenPost = url.pathname === "/api/children" && request.method === "POST";
    const isChildrenPut = /^\\/api\\/children\\/[a-zA-Z0-9-]+$/i.test(url.pathname) && request.method === "PUT";
    let childEmailToSync: string | null | undefined = undefined;
    if ((isChildrenPost || isChildrenPut) && request.headers.get("content-type")?.includes("application/json")) {
      try {
        const clonedJson = await request.clone().json();
        if ("email" in clonedJson) {
          childEmailToSync = typeof clonedJson.email === "string" ? clonedJson.email.trim().toLowerCase() : null;
        }
      } catch {}
    }

    const forwarded = new Request(activeRequest, { headers });
    const container = env.AXECLOUD_API_CONTAINER.getByName("primary");

    try {
      let response = await container.fetch(forwarded);
      if (childEmailToSync !== undefined && response.ok) {
        return await syncChildEmail(request, response, url, env, childEmailToSync);
      }
      const responseHeaders = new Headers(response.headers);
      responseHeaders.set("x-axecloud-runtime", "cloudflare-container");
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });`;

if (!content.includes(oldForward)) {
  console.error('Forward match failed');
  process.exit(1);
}
content = content.replace(oldForward, newForward);

fs.writeFileSync(targetPath, content, 'utf8');
console.log('Successfully patched cloudflare/api-container-worker.ts');
