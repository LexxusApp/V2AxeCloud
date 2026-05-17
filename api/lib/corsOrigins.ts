/** Origens permitidas para CORS (produção, preview Vercel e dev local). */
export const STATIC_ALLOWED_ORIGINS: readonly string[] = [
  "https://axecloud.com.br",
  "https://www.axecloud.com.br",
  "https://axecloud.app",
  "https://www.axecloud.app",
  "https://axecloud-app.vercel.app",
  "https://v2-axe-cloud.vercel.app",
  "http://localhost:3000",
  "http://localhost:4173",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
];

export const STATIC_ALLOWED_ORIGIN_SET = new Set<string>(STATIC_ALLOWED_ORIGINS);

/** Previews e deploys na Vercel (*.vercel.app). */
export const VERCEL_PREVIEW_REGEX = /^https:\/\/[a-z0-9-]+\.vercel\.app$/i;

export const CORS_ALLOWED_METHODS =
  "GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS";

export const CORS_ALLOWED_HEADERS =
  "Authorization, Content-Type, Accept, apikey, X-Client-Info, X-Requested-With, X-Supabase-Api-Version, Range";

export const CORS_EXPOSE_HEADERS =
  "Content-Length, Content-Type, Content-Range, X-Request-Id";

export function isAllowedCorsOrigin(origin: string | undefined | null): boolean {
  if (!origin) return true;
  return STATIC_ALLOWED_ORIGIN_SET.has(origin) || VERCEL_PREVIEW_REGEX.test(origin);
}

/** CORS para rotas serverless isoladas (tenant-info, filho-login, etc.). */
export function applyDiscreteRouteCors(req: any, res: any): boolean {
  const origin = (req.headers && req.headers.origin) || "";
  const existingVary = res.getHeader && res.getHeader("Vary");
  const varyValue = existingVary
    ? Array.from(new Set(`${existingVary}, Origin`.split(/\s*,\s*/))).join(", ")
    : "Origin";
  res.setHeader("Vary", varyValue);
  if (origin && isAllowedCorsOrigin(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }
  res.setHeader("Access-Control-Allow-Methods", CORS_ALLOWED_METHODS);
  res.setHeader("Access-Control-Allow-Headers", CORS_ALLOWED_HEADERS);
  res.setHeader("Access-Control-Expose-Headers", CORS_EXPOSE_HEADERS);
  res.setHeader("Access-Control-Max-Age", "86400");
  if ((req.method || "").toUpperCase() === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return true;
  }
  return false;
}
