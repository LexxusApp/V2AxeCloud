import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { isDiretorioListingPublishable } from "../lib/diretorioQuality.js";
import { resolveDiretorioWhatsapp } from "../lib/diretorioWhatsapp.js";

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
if (!url || !key) throw new Error("Faltam as credenciais administrativas do Supabase.");

const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
const pageSize = 1000;
let offset = 0;
const result = { rows: 0, publicTerreiros: 0, explicitWhatsapp: 0, inferredMobile: 0, withoutWhatsapp: 0 };

while (true) {
  const { data, error } = await supabase
    .from("terreiros_diretorio")
    .select("nome,slug,cidade,estado,endereco,telefone,whatsapp_atendimento,foto_url,owner_photo_url,link_maps,tipo,verified_at")
    .range(offset, offset + pageSize - 1);
  if (error) throw error;
  const rows = data || [];
  for (const row of rows) {
    result.rows += 1;
    if (!isDiretorioListingPublishable(row) || String(row.tipo || "terreiro") !== "terreiro") continue;
    result.publicTerreiros += 1;
    const explicit = resolveDiretorioWhatsapp(row.whatsapp_atendimento, null);
    const resolved = resolveDiretorioWhatsapp(row.whatsapp_atendimento, row.telefone);
    if (explicit) result.explicitWhatsapp += 1;
    else if (resolved) result.inferredMobile += 1;
    else result.withoutWhatsapp += 1;
  }
  if (rows.length < pageSize) break;
  offset += pageSize;
}

console.log(JSON.stringify({
  ...result,
  eligibleWhatsapp: result.explicitWhatsapp + result.inferredMobile,
}, null, 2));