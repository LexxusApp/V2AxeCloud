/**
 * Variáveis Supabase no servidor (Vercel/Node).
 * Preferir SUPABASE_* — VITE_* é para o bundle do browser e pode apontar para outro projeto.
 */
export function getSupabaseServerUrl(): string | undefined {
  return (
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL
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

export function getSupabaseProjectRef(url?: string): string | null {
  const u = url || getSupabaseServerUrl() || "";
  const m = u.match(/https?:\/\/([^.]+)\.supabase\.co/i);
  return m?.[1] || null;
}
