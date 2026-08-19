import type { SupabaseClient, User } from "@supabase/supabase-js";

const TOKEN_CACHE_MS = 20_000;
const TOKEN_CACHE_MAX = 200;
const tokenUserCache = new Map<string, { user: User; exp: number }>();

function readCachedUser(token: string): User | null {
  const hit = tokenUserCache.get(token);
  if (!hit) return null;
  if (hit.exp <= Date.now()) {
    tokenUserCache.delete(token);
    return null;
  }
  return hit.user;
}

function writeCachedUser(token: string, user: User): void {
  if (tokenUserCache.size >= TOKEN_CACHE_MAX) {
    const now = Date.now();
    for (const [key, value] of tokenUserCache) {
      if (value.exp <= now) tokenUserCache.delete(key);
      if (tokenUserCache.size < TOKEN_CACHE_MAX) break;
    }
    if (tokenUserCache.size >= TOKEN_CACHE_MAX) {
      const first = tokenUserCache.keys().next().value;
      if (first) tokenUserCache.delete(first);
    }
  }
  tokenUserCache.set(token, { user, exp: Date.now() + TOKEN_CACHE_MS });
}

/** Valida JWT Supabase via getUser — sem fallback inseguro. */
export async function verifyUser(
  supabaseAdmin: SupabaseClient,
  token: string
): Promise<{ user: User | null; error: Error | null }> {
  if (!token || token === "undefined" || token === "null") {
    return { user: null, error: new Error("Token inválido ou ausente") };
  }

  const cached = readCachedUser(token);
  if (cached) return { user: cached, error: null };

  try {
    const auth = supabaseAdmin.auth.getUser(token);
    const timed = await Promise.race([
      auth,
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("Tempo esgotado a validar a sessão")), 8_000);
      }),
    ]);
    const { data: { user }, error } = timed;
    if (user && !error) {
      writeCachedUser(token, user);
      return { user, error: null };
    }
    return { user: null, error: error || new Error("Usuário não encontrado") };
  } catch (err) {
    return { user: null, error: err instanceof Error ? err : new Error(String(err)) };
  }
}
