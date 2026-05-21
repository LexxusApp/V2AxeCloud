const TOKEN_KEY = "axecloud_admin_access_token";

export const API_UNAVAILABLE = "API_UNAVAILABLE";

/** Em previews Vercel do admin, a API vive em axecloud.com.br (evita api/index pesado no mesmo deploy). */
export function resolveApiBaseUrl(): string {
  const fromEnv = String(import.meta.env.VITE_API_BASE_URL || "").trim().replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  if (import.meta.env.PROD && typeof window !== "undefined") {
    const host = window.location.hostname.toLowerCase();
    if (host.endsWith(".vercel.app") && !host.includes("axecloud.com.br")) {
      return "https://axecloud.com.br";
    }
  }
  return "";
}

function apiUrl(path: string): string {
  const base = resolveApiBaseUrl();
  return base ? `${base}${path.startsWith("/") ? path : `/${path}`}` : path;
}

/** Browser fetch falha ou o proxy Vite devolve 502 quando a API (ex. :3000) não está a aceitar ligações. */
export function isApiUnreachable(e: unknown): boolean {
  if (e instanceof TypeError) return true;
  const m = e instanceof Error ? e.message : String(e);
  if (m === API_UNAVAILABLE) return true;
  return /\b(failed to fetch|networkerror|load failed|bad gateway|gateway timeout)\b/i.test(m);
}

export function getAccessToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAccessToken(token: string | null) {
  try {
    if (!token) localStorage.removeItem(TOKEN_KEY);
    else localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* ignore */
  }
}

/** Regista login no audit_logs (best-effort; não bloqueia o fluxo). */
export async function postAuthAuditLog(
  payload: {
    action: "auth.login_success" | "auth.login_failed";
    status: "success" | "failed";
    terreiroId?: string | null;
    details?: Record<string, unknown>;
  },
  accessToken?: string | null
): Promise<void> {
  try {
    const headers = new Headers({ "Content-Type": "application/json" });
    const t = accessToken ?? getAccessToken();
    if (t) headers.set("Authorization", `Bearer ${t}`);
    await fetch(apiUrl("/api/auth/audit-log"), {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
  } catch {
    /* auditoria não deve impedir login */
  }
}

export async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  const t = getAccessToken();
  if (t) headers.set("Authorization", `Bearer ${t}`);
  if (!headers.has("Content-Type") && init?.body && typeof init.body === "string") {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(apiUrl(path), { ...init, headers });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const body = data as { error?: string; debug?: { hint?: string } } | null;
    const rawLower = text.toLowerCase();
    const proxyDown =
      res.status === 502 ||
      res.status === 503 ||
      res.status === 504 ||
      (res.status === 500 &&
        (!text ||
          rawLower.includes("econnrefused") ||
          rawLower.includes("proxy error") ||
          rawLower.includes("internal server error")));
    if (proxyDown) {
      throw new Error(API_UNAVAILABLE);
    }
    const err =
      body?.debug?.hint ||
      body?.error ||
      (res.status === 403 ? "Sem permissão para o console administrativo." : null) ||
      res.statusText ||
      "Erro na API";
    throw new Error(err);
  }
  return data as T;
}
