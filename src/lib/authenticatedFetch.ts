import { supabase } from "./supabase";

export async function getAccessToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) return session.access_token;
  const { data: refreshed } = await supabase.auth.refreshSession();
  return refreshed?.session?.access_token ?? null;
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
  return fetch(input, { ...init, headers });
}
