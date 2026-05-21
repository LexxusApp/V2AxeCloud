import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { getSupabaseServerServiceKey, getSupabaseServerUrl } from "./supabaseServerEnv.js";

dotenv.config();

export function getDiscreteSupabaseAdmin(): SupabaseClient | null {
  const url = getSupabaseServerUrl();
  const key = getSupabaseServerServiceKey();
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
