import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function main() {
  if (!url || !key) {
    console.error("Faltam VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }
  const sb = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const full = await sb.from("global_settings").select("*").eq("id", "plans").maybeSingle();
  console.log(JSON.stringify(full, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
