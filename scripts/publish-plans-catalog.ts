/**
 * Grava o catálogo global_settings.plans (útil após editar preços no Supabase ou no console admin).
 * Uso: npx tsx scripts/publish-plans-catalog.ts
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { loadPlansCatalog, savePlansCatalog } from "../api/lib/plansCatalog.js";
import { getSupabaseProjectRef, getSupabaseServerServiceKey, getSupabaseServerUrl } from "../api/lib/supabaseServerEnv.js";

async function main() {
  const url = getSupabaseServerUrl();
  const key = getSupabaseServerServiceKey();
  if (!url || !key) {
    console.error("Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env");
    process.exit(1);
  }

  const sb = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const plans = await loadPlansCatalog(sb);
  await savePlansCatalog(sb, plans);

  console.log("OK — project:", getSupabaseProjectRef(url));
  console.log("premium:", plans.premium.price, "| vita:", plans.vita.price);
  console.log("Confira na Vercel: SUPABASE_URL deve ser o mesmo project acima.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
