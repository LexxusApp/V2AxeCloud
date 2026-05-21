import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const viteEnv = (import.meta as any).env || {};

function getServerEnv(...keys: string[]) {
  for (const key of keys) {
    const value = process.env[key] || viteEnv[key];
    if (value) return value;
  }
  return undefined;
}

export function getDiscreteSupabaseAdmin(): SupabaseClient | null {
  const url = getServerEnv("VITE_SUPABASE_URL", "SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL");
  const key = getServerEnv(
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_SERVICE_KEY",
    "VITE_SUPABASE_SERVICE_ROLE_KEY",
    "VITE_SUPABASE_SERVICE_KEY"
  );
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function sendJson(res: any, status: number, body: Record<string, unknown>) {
  res.status(status).setHeader("Content-Type", "application/json");
  return res.end(JSON.stringify(body));
}

export function parseQuery(req: any): URLSearchParams {
  const raw = String(req.url || "");
  const q = raw.includes("?") ? raw.slice(raw.indexOf("?") + 1) : "";
  return new URLSearchParams(q);
}
