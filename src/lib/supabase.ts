/// <reference types="vite/client" />
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getRuntimeSupabaseAnonKey, getRuntimeSupabaseUrl } from './runtimeConfig';

// --- Supabase React StrictMode Lock Warning/Error Mitigation ---
// React StrictMode double-mounts components in development, causing Supabase GoTrue to
// attempt concurrent lock acquisitions. This inherently triggers benign timeout and steal logs.
// See: https://github.com/supabase/supabase-js/issues/873
const originalWarn = console.warn;
const originalError = console.error;

console.warn = (...args) => {
  const msg = typeof args[0] === 'string' ? args[0] : '';
  if (
    msg &&
    (msg.includes('Lock') || msg.includes('lock')) &&
    (msg.includes('stole it') || msg.includes('acquisition timed out') || msg.includes('was not released within'))
  ) {
    return;
  }
  // Recharts antes do ResizeObserver (stack aponta para este arquivo por causa do patch)
  if (msg && msg.includes('width(-1) and height(-1) of chart')) {
    return;
  }
  // Falha benigna ao fechar Realtime antes do handshake (StrictMode / troca de rota)
  if (
    msg &&
    msg.includes('WebSocket connection to') &&
    msg.includes('supabase.co') &&
    (msg.includes('failed') || msg.includes('closed before the connection is established'))
  ) {
    return;
  }
  originalWarn(...args);
};

console.error = (...args) => {
  const msg = typeof args[0] === 'string' ? args[0] : '';
  if (
    msg &&
    (msg.includes('Lock') || msg.includes('lock')) &&
    (msg.includes('stole it') || msg.includes('acquisition timed out') || msg.includes('steal'))
  ) {
    return;
  }
  if (
    msg &&
    msg.includes('WebSocket connection to') &&
    msg.includes('supabase.co') &&
    (msg.includes('failed') || msg.includes('closed before the connection is established'))
  ) {
    return;
  }
  // Allow GoTrue's unhandled rejection to be swallowed if it's the specific lock error
  if (args[0] && (args[0] as { isAcquireTimeout?: boolean }).isAcquireTimeout) {
    return;
  }
  const errMsg = String(
    typeof args[0] === 'string'
      ? args[0]
      : (args[0] as { message?: string })?.message || '',
  ).toLowerCase();
  if (
    errMsg.includes('invalid refresh token') ||
    errMsg.includes('refresh token not found') ||
    (errMsg.includes('authapierror') && errMsg.includes('refresh'))
  ) {
    return;
  }
  originalError(...args);
};
// ----------------------------------------------------------------

const supabaseUrl = getRuntimeSupabaseUrl();
const supabaseAnonKey = getRuntimeSupabaseAnonKey();

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials missing. Verifique .env ou __AXECLOUD_RUNTIME__ no servidor.');
}

const nativeFetch = globalThis.fetch.bind(globalThis);
const SESSION_EXPIRED_EVENT = 'axecloud:session-expired';

function isJwtExpiredMessage(value: unknown): boolean {
  const msg = String((value as { message?: string })?.message || value || '').toLowerCase();
  return msg.includes('jwt') && msg.includes('expir');
}

const AUTH_STORAGE_KEY = 'axecloud-auth-token';

/** Remove storage órfão antes do GoTrue tentar refresh com token inválido/ausente. */
function sanitizeAuthStorageBeforeInit(): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const refresh =
      parsed?.refresh_token ??
      (parsed?.currentSession as { refresh_token?: string } | undefined)?.refresh_token ??
      (parsed?.session as { refresh_token?: string } | undefined)?.refresh_token;
    if (typeof refresh !== 'string' || !refresh.trim()) {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }
  } catch {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  }
}

sanitizeAuthStorageBeforeInit();

/** Só força logout global em erros de refresh claramente fatais — rede/lock não podem apagar sessão. */
export function isRefreshFailureFatal(value: unknown): boolean {
  if (isJwtExpiredMessage(value)) return true;
  const msg = String((value as { message?: string })?.message || value || '').toLowerCase();
  const code = String((value as { code?: string })?.code || '').toLowerCase();
  if (msg.includes('invalid_grant')) return true;
  if (msg.includes('invalid refresh')) return true;
  if (msg.includes('refresh token not found')) return true;
  if (msg.includes('session not found')) return true;
  if (code === 'bad_jwt' || code === 'invalid_jwt') return true;
  return false;
}

function emitSessionExpired(reason: string) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT, { detail: { reason } }));
}

/** Dispara fluxo global de sessão expirada (tela de re-login em App.tsx). */
export function notifySessionExpired(reason: string): void {
  emitSessionExpired(reason);
}

/** Limpa sessão local sem chamar a API (útil em /login com refresh token revogado). */
export async function purgeLocalAuthSession(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    await supabase.auth.signOut({ scope: 'local' });
  } catch {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  }
}

async function purgeLocalAuthIfRefreshTokenRejected(
  getClient: () => SupabaseClient,
  response: Response,
  urlStr: string,
): Promise<void> {
  if (!urlStr.includes('/auth/v1/token') || response.status !== 400) return;
  if (!urlStr.includes('grant_type=refresh_token')) return;
  try {
    const body = (await response.clone().json()) as {
      error_description?: string;
      msg?: string;
      error?: string;
    };
    const msg = String(
      body?.error_description || body?.msg || body?.error || '',
    ).toLowerCase();
    if (
      msg.includes('refresh') ||
      msg.includes('invalid_grant') ||
      msg.includes('not found')
    ) {
      await getClient().auth.signOut({ scope: 'local' });
    }
  } catch {
    /* ignore */
  }
}

/** Rotas onde 401 indica sessão inválida e vale tentar refresh (não inclui /token para evitar recursão no fetch). */
function isSupabaseRecoverable401(urlStr: string): boolean {
  if (!supabaseUrl || !urlStr.includes(new URL(supabaseUrl).hostname)) return false;
  if (urlStr.includes('/auth/v1/token')) return false;
  return (
    urlStr.includes('/rest/v1/') ||
    urlStr.includes('/storage/v1/') ||
    urlStr.includes('/auth/v1/user')
  );
}

/**
 * Fetch resiliente: em 401 tenta refresh da sessão uma vez e refaz o request.
 * Se ainda falhar ou não houver sessão, força logout rápido (evita loading infinito no PWA).
 */
function createResilientFetch(getClient: () => SupabaseClient): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    let response: Response;
    try {
      response = await nativeFetch(input, init);
    } catch (err) {
      // Falha de rede / abort — repassa; App pode mostrar estado offline
      throw err;
    }

    const urlStr = typeof input === 'string' ? input : (input as Request).url;
    await purgeLocalAuthIfRefreshTokenRejected(getClient, response, urlStr);

    if (response.status !== 401) return response;

    if (!isSupabaseRecoverable401(urlStr)) return response;

    const supabase = getClient();

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      emitSessionExpired('session_missing_on_401');
      return response;
    }

    const { error: refreshErr } = await supabase.auth.refreshSession();
    if (refreshErr) {
      if (isRefreshFailureFatal(refreshErr)) {
        emitSessionExpired('refresh_fatal');
        return response;
      }
      return response;
    }

    try {
      response = await nativeFetch(input, init);
    } catch (err) {
      throw err;
    }

    if (response.status === 401) {
      emitSessionExpired('retry_401');
    }

    return response;
  };
}

const globalForSupabase = globalThis as unknown as { __AXECLOUD_SUPABASE__?: SupabaseClient };

/**
 * Lock resiliente para o GoTrue do Supabase.
 *
 * Default do supabase-js usa `navigator.locks.request(name, { mode: 'exclusive' }, fn)`.
 * Em alguns navegadores (Brave/Chrome) a lock fica órfã quando uma aba é fechada no
 * meio de um `getSession`/`refreshSession`, e a próxima aba esperaria indefinidamente,
 * causando "tela de loading eterna" ao reabrir o app.
 *
 * Aqui adquirimos a lock com timeout duro (3.5s). Se não conseguir nesse prazo,
 * a função é executada sem lock — pior cenário é um refresh duplicado, melhor que
 * UI travada. `acquireTimeout` enviado pelo GoTrue é respeitado como teto adicional.
 */
const SUPABASE_LOCK_TIMEOUT_MS = 3500;

async function resilientLock<R>(
  name: string,
  acquireTimeout: number,
  fn: () => Promise<R>
): Promise<R> {
  if (typeof navigator === 'undefined' || !navigator.locks) {
    return fn();
  }
  const timeoutMs = Math.min(
    SUPABASE_LOCK_TIMEOUT_MS,
    acquireTimeout > 0 ? acquireTimeout : SUPABASE_LOCK_TIMEOUT_MS
  );
  const controller = new AbortController();
  const timer = setTimeout(() => {
    try {
      controller.abort();
    } catch {
      /* noop */
    }
  }, timeoutMs);
  try {
    return await navigator.locks.request(
      name,
      { mode: 'exclusive', signal: controller.signal },
      async () => {
        clearTimeout(timer);
        return await fn();
      }
    );
  } catch (err: any) {
    clearTimeout(timer);
    if (err?.name === 'AbortError') {
      return fn();
    }
    throw err;
  }
}

function createAxecloudSupabaseClient(): SupabaseClient {
  return createClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseAnonKey || 'placeholder-key',
    {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        storageKey: AUTH_STORAGE_KEY,
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
        // Lock resiliente para evitar travamento eterno quando uma aba anterior
        // morreu segurando a lock (`navigator.locks` órfão).
        lock: resilientLock,
      } as any,
      global: {
        fetch: createResilientFetch(() => supabase),
      },
    }
  );
}

export const supabase: SupabaseClient =
  globalForSupabase.__AXECLOUD_SUPABASE__ ?? createAxecloudSupabaseClient();

if (typeof globalThis !== 'undefined') {
  globalForSupabase.__AXECLOUD_SUPABASE__ = supabase;
}

/** Abas em segundo plano pausam timers do browser — religa auto-refresh e renova token perto do fim ao voltar. */
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  const authExt = supabase.auth as {
    startAutoRefresh?: () => void;
    stopAutoRefresh?: () => void;
  };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      if (typeof authExt.stopAutoRefresh === 'function') {
        try {
          authExt.stopAutoRefresh();
        } catch {
          /* noop */
        }
      }
      return;
    }
    if (typeof authExt.startAutoRefresh === 'function') {
      try {
        authExt.startAutoRefresh();
      } catch {
        /* noop */
      }
    }
    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.refresh_token) return;
      const exp = session.expires_at;
      if (exp == null || !Number.isFinite(exp)) return;
      const expMs = Number(exp) * 1000;
      if (expMs < Date.now() + 120_000) {
        void supabase.auth.refreshSession();
      }
    });
  });
}
