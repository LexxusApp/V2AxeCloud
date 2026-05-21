import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { getDiscreteR2Client } from "./r2ClientDiscrete.js";
import { getSupabaseServerServiceKey, getSupabaseServerUrl } from "./supabaseServerEnv.js";
import { verifyUser } from "./verifyUser.js";
import type { AdminConsoleRouteDeps } from "../admin-console-routes.js";

dotenv.config();

let supabaseAdmin: SupabaseClient | null = null;

function getSupabaseAdmin(): SupabaseClient | null {
  if (supabaseAdmin) return supabaseAdmin;
  const url = getSupabaseServerUrl();
  const key = getSupabaseServerServiceKey();
  if (!url || !key) return null;
  supabaseAdmin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return supabaseAdmin;
}

export function getAdminConsoleRouteDeps(): AdminConsoleRouteDeps | null {
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  const r2 = getDiscreteR2Client();
  return {
    verifyUser: (token: string) => verifyUser(sb, token),
    supabaseAdmin: sb,
    r2Client: r2?.client ?? null,
    r2Bucket: r2?.bucket,
  };
}
