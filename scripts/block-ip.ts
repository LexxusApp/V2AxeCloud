/**
 * Uso (container app / raiz com env):
 *   ./node_modules/.bin/tsx scripts/block-ip.ts 189.28.151.13 "motivo"
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { addBlockedIp } from "../api/lib/ipBlocklist.js";

function getUrl(): string | undefined {
  return process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
}

function getServiceKey(): string | undefined {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_SERVICE_KEY
  );
}

async function main() {
  const ip = (process.argv[2] || "").trim();
  const note = (process.argv[3] || "").trim() || undefined;
  if (!ip) {
    console.error("Uso: tsx scripts/block-ip.ts <ip> [nota]");
    process.exit(1);
  }
  const url = getUrl();
  const key = getServiceKey();
  if (!url || !key) {
    console.error("Faltam SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }
  const sb = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const result = await addBlockedIp(sb, ip, note);
  console.log(JSON.stringify({ ok: true, ...result }, null, 2));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
