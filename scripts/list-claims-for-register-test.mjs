/**
 * Lista reivindicações recentes (só campos seguros) para teste de cadastro.
 *   node scripts/list-claims-for-register-test.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
for (const line of readFileSync(resolve(root, ".env"), "utf8").split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("=");
  if (i < 1) continue;
  const k = t.slice(0, i).trim();
  let v = t.slice(i + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  if (!(k in process.env)) process.env[k] = v;
}

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const sb = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

const { data, error } = await sb
  .from("terreiro_claim_requests")
  .select("id, status, requester_name, claimed_tenant_id, terreiro_id, created_at")
  .order("created_at", { ascending: false })
  .limit(8);
if (error) throw error;

const out = [];
for (const row of data || []) {
  const { data: t } = await sb.from("terreiros_diretorio").select("nome").eq("id", row.terreiro_id).maybeSingle();
  out.push({
    id: row.id,
    status: row.status,
    linked: Boolean(row.claimed_tenant_id),
    requester: row.requester_name,
    terreiro: t?.nome || null,
    registerUrl: `https://axecloud.com.br/register?claim=${row.id}`,
  });
}
console.log(JSON.stringify(out, null, 2));
