const TOKEN_KEY = "axecloud_admin_access_token";

export const API_UNAVAILABLE = "API_UNAVAILABLE";

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

export async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  const t = getAccessToken();
  if (t) headers.set("Authorization", `Bearer ${t}`);
  if (!headers.has("Content-Type") && init?.body && typeof init.body === "string") {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(path, { ...init, headers });
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
    const err = body?.debug?.hint || body?.error || res.statusText || "Erro na API";
    throw new Error(err);
  }
  return data as T;
}
