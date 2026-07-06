import {
  isRefreshFailureFatal,
  notifySessionExpired,
  purgeLocalAuthSession,
  supabase,
} from "./supabase";

async function refreshAccessToken(): Promise<string | null> {
  const { data: refreshed, error } = await supabase.auth.refreshSession();
  if (error) {
    if (isRefreshFailureFatal(error)) {
      await purgeLocalAuthSession();
      notifySessionExpired("refresh_fatal");
    }
    return null;
  }
  return refreshed?.session?.access_token ?? null;
}

export async function getAccessToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    const exp = session.expires_at;
    if (exp == null || Number(exp) * 1000 > Date.now() + 30_000) {
      return session.access_token;
    }
  }
  if (!session?.refresh_token) return null;
  return refreshAccessToken();
}

/** Renova sessão antes de rajadas de API (ex.: voltar à aba após idle). */
export async function ensureFreshAccessToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.refresh_token) return null;
  const exp = session.expires_at;
  const needsRefresh =
    exp == null || !Number.isFinite(Number(exp)) || Number(exp) * 1000 < Date.now() + 120_000;
  if (needsRefresh) return refreshAccessToken();
  return session.access_token ?? null;
}

export async function authHeaders(extra?: HeadersInit, explicitToken?: string | null): Promise<Headers> {
  const headers = new Headers(extra || undefined);
  const token = explicitToken ?? (await getAccessToken());
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return headers;
}

/** fetch com Authorization automático quando há sessão Supabase. */
export async function authFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
  explicitToken?: string | null
): Promise<Response> {
  const headers = await authHeaders(init.headers, explicitToken);
  let response = await fetch(input, { ...init, headers });

  if (response.status !== 401) return response;

  const hadAuth = headers.has("Authorization");
  if (!hadAuth && !explicitToken) return response;

  const freshToken = await refreshAccessToken();
  if (!freshToken) {
    if (hadAuth || explicitToken) notifySessionExpired("auth_fetch_no_token_after_401");
    return response;
  }

  const usedToken = (explicitToken ?? headers.get("Authorization") ?? "")
    .replace(/^Bearer\s+/i, "")
    .trim();
  if (usedToken && freshToken === usedToken) {
    notifySessionExpired("auth_fetch_retry_401");
    return response;
  }

  const retryHeaders = await authHeaders(init.headers, freshToken);
  response = await fetch(input, { ...init, headers: retryHeaders });
  if (response.status === 401) {
    notifySessionExpired("auth_fetch_retry_401");
  }
  return response;
}
