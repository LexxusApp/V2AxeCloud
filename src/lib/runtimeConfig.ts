export type RuntimePublicConfig = {
  supabaseUrl: string;
  supabaseAnonKey: string;
  vapidPublicKey: string;
};

declare global {
  interface Window {
    __AXECLOUD_RUNTIME__?: Partial<RuntimePublicConfig>;
  }
}

function fromWindow(): Partial<RuntimePublicConfig> {
  if (typeof window === 'undefined') return {};
  return window.__AXECLOUD_RUNTIME__ ?? {};
}

export function getRuntimeSupabaseUrl(): string {
  const runtime = fromWindow().supabaseUrl?.trim();
  if (runtime) return runtime;
  return String(import.meta.env.VITE_SUPABASE_URL || '').trim();
}

export function getRuntimeSupabaseAnonKey(): string {
  const runtime = fromWindow().supabaseAnonKey?.trim();
  if (runtime) return runtime;
  return String(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();
}

export function getRuntimeVapidPublicKey(): string {
  const runtime = fromWindow().vapidPublicKey?.trim();
  if (runtime) return runtime;
  return String(import.meta.env.VITE_VAPID_PUBLIC_KEY || '').trim();
}
