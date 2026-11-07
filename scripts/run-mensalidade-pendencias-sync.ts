import { createClient } from "@supabase/supabase-js";
import { syncAllMensalidadePendenciasForCron } from "../api/lib/mensalidadePendenciasCron.ts";

async function main() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("missing supabase env");
  const sb = createClient(url, key, { auth: { persistSession: false } });
  const out = await syncAllMensalidadePendenciasForCron(sb);
  console.log(JSON.stringify(out));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
