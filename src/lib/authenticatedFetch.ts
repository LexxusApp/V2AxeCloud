import {
  isRefreshFailureFatal,
  notifySessionExpired,
  purgeLocalAuthSession,
  supabase,
} from "./supabase";
import { reportFeatureFailureClient, type ClientFeatureType } from "./telemetryClient";

function classifyFeatureFromUrl(url: string): ClientFeatureType {
  const p = url.toLowerCase();
  if (/upload|foto|photo|gallery|galeria|image/.test(p)) return 'fotos';
  if (/gira|evento|calendar|calendario|rsvp/.test(p)) return 'agenda';
  if (/filho|membro|children|corrente/.test(p)) return 'membros';
  if (/financeiro|mensalidade|transacao|pix|cobranca/.test(p)) return 'financeiro';
  if (/settings|configuracoes|perfil/.test(p)) return 'configuracoes';
  if (/auth|login|senha|recuperar/.test(p)) return 'acesso';
  return 'geral';
}

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

  const trackFailureIfNeeded = (res: Response) => {
    if (res.status >= 400 && res.status !== 401 && res.status !== 404) {
      const urlStr = typeof input === "string" ? input : input instanceof URL ? input.toString() : "";
      if (!urlStr.includes("/telemetry/failure")) {
        const method = (init.method || "GET").toUpperCase();
        res.clone().json().then((json) => {
          const errMsg = json?.error || json?.message || `HTTP ${res.status}`;
          void reportFeatureFailureClient({
            feature: classifyFeatureFromUrl(urlStr),
            action: `${method} ${urlStr}`.slice(0, 120),
            error: errMsg,
            httpStatus: res.status,
            metadata: { method, url: urlStr },
          });
        }).catch(() => {
          void reportFeatureFailureClient({
            feature: classifyFeatureFromUrl(urlStr),
            action: `${method} ${urlStr}`.slice(0, 120),
            error: `HTTP ${res.status}`,
            httpStatus: res.status,
            metadata: { method, url: urlStr },
          });
        });
      }
    }
  };

  if (response.status !== 401) {
    trackFailureIfNeeded(response);
    return response;
  }

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
  } else {
    trackFailureIfNeeded(response);
  }
  return response;
}
