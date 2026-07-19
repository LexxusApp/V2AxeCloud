import { createClient } from "@supabase/supabase-js";
import { getSupabaseServerAnonKey, getSupabaseServerUrl } from "./supabaseServerEnv.js";

export async function verifyUserPassword(email: string, password: string): Promise<boolean> {
  const url = getSupabaseServerUrl();
  const anon = getSupabaseServerAnonKey();
  if (!url || !anon) throw new Error("Supabase não configurado no servidor.");
  const client = createClient(url, anon, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error } = await client.auth.signInWithPassword({ email, password });
  return !error;
}
