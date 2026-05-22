/**
 * Variáveis Supabase no servidor (Vercel/Node).
 * Ordem alinhada a api/public (tenant-info): VITE_* costuma ser a fonte correta no deploy.
 */
export function getSupabaseServerUrl(): string | undefined {
  return (
    process.env.VITE_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL
  );
}

export function getSupabaseServerAnonKey(): string | undefined {
  return (
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export function getSupabaseServerServiceKey(): string | undefined {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_SERVICE_KEY
  );
}

export function isValidSupabaseHttpUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function getSupabaseProjectRef(url?: string): string | null {
  const u = url || getSupabaseServerUrl() || "";
  const m = u.match(/https?:\/\/([^.]+)\.supabase\.co/i);
  return m?.[1] || null;
}
