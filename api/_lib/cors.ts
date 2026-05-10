// Helper compartilhado de CORS para handlers Vercel discretos (NÃO é endpoint público
// porque Vercel ignora arquivos/pastas com prefixo "_").
//
// Origens permitidas:
//   - Domínio canônico de produção
//   - Aliases www / staging
//   - Previews automáticos *.vercel.app
//   - Localhost dev (Vite, Express, preview)
//
// Auth: o app usa JWT do Supabase no header Authorization (não cookie), mas mantemos
// Allow-Credentials=true defensivamente para futuro uso de session cookies sem regredir.

const STATIC_ALLOWED_ORIGINS = new Set<string>([
  "https://axecloud.app",
  "https://www.axecloud.app",
  "https://axecloud-app.vercel.app",
  "http://localhost:3000",
  "http://localhost:4173",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

const VERCEL_PREVIEW_REGEX = /^https:\/\/[a-z0-9-]+\.vercel\.app$/i;

const ALLOWED_METHODS = "GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS";
const ALLOWED_HEADERS = [
  "Authorization",
  "Content-Type",
  "Accept",
  "apikey",
  "X-Client-Info",
  "X-Requested-With",
  "X-Supabase-Api-Version",
  "Range",
].join(", ");
const EXPOSED_HEADERS = "Content-Length, Content-Type, Content-Range, X-Request-Id";
const MAX_AGE_SECONDS = "86400";

export function isOriginAllowed(origin: string | null | undefined): boolean {
  if (!origin) return false;
  if (STATIC_ALLOWED_ORIGINS.has(origin)) return true;
  if (VERCEL_PREVIEW_REGEX.test(origin)) return true;
  return false;
}

/**
 * Aplica headers CORS na resposta e trata o preflight OPTIONS.
 * Retorna `true` quando a request foi um preflight já respondido (caller deve `return`).
 */
export function applyCors(req: { method?: string; headers?: any }, res: any): boolean {
  const origin = (req.headers?.origin as string | undefined) || "";

  // Vary: Origin é obrigatório quando o header CORS depende da Origin (anti cache-poisoning).
  const existingVary = (res.getHeader && res.getHeader("Vary")) as string | undefined;
  const varyValue = existingVary
    ? Array.from(new Set(`${existingVary}, Origin`.split(/\s*,\s*/))).join(", ")
    : "Origin";
  res.setHeader("Vary", varyValue);

  if (isOriginAllowed(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }

  res.setHeader("Access-Control-Allow-Methods", ALLOWED_METHODS);
  res.setHeader("Access-Control-Allow-Headers", ALLOWED_HEADERS);
  res.setHeader("Access-Control-Expose-Headers", EXPOSED_HEADERS);
  res.setHeader("Access-Control-Max-Age", MAX_AGE_SECONDS);

  if ((req.method || "").toUpperCase() === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return true;
  }
  return false;
}
