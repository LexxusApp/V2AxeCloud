/**
 * Checa se o tenant só cadastrou ou já usou o sistema.
 *   node scripts/check-tenant-usage.mjs [tenantId|email]
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

const arg = String(process.argv[2] || "hermogenesmailson04@gmail.com").trim();
const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const sb = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

let tenantId = arg;
let email = null;
if (arg.includes("@")) {
  email = arg.toLowerCase();
  const { data: profileByEmail } = await sb
    .from("perfil_lider")
    .select("id, email, nome_terreiro, cargo, created_at, updated_at, casa_verificada, whatsapp_publico, foto_url")
    .ilike("email", email)
    .maybeSingle();
  if (!profileByEmail?.id) {
    console.log(JSON.stringify({ error: "perfil não encontrado", email }, null, 2));
    process.exit(1);
  }
  tenantId = profileByEmail.id;
}

const { data: profile } = await sb
  .from("perfil_lider")
  .select("id, email, nome_terreiro, cargo, created_at, updated_at, casa_verificada, whatsapp_publico, foto_url")
  .eq("id", tenantId)
  .maybeSingle();
email = String(profile?.email || email || "").toLowerCase();

const { data: authData } = await sb.auth.admin.getUserById(tenantId);
const authUser = authData?.user || null;

async function countByTenant(table, tenantCols = ["tenant_id", "terreiro_id", "perfil_id"]) {
  for (const col of tenantCols) {
    const { count, error } = await sb.from(table).select("id", { count: "exact", head: true }).eq(col, tenantId);
    if (!error) {
      const { data } = await sb.from(table).select("id, created_at").eq(col, tenantId).order("created_at", { ascending: false }).limit(3);
      return { table, col, count: count ?? 0, latest: data || [] };
    }
  }
  return { table, count: null, error: "coluna/tabela indisponível" };
}

const entityTables = [
  "filhos_de_santo",
  "membros",
  "pessoas",
  "eventos",
  "consultas",
  "agendamentos",
  "gira_registros",
  "giras",
  "financeiro_lancamentos",
  "caixa_movimentos",
  "notas",
  "tarefas",
  "lembretes",
  "mensagens",
  "whatsapp_logs",
  "documentos",
  "media_assets",
];

const entities = [];
for (const table of entityTables) {
  entities.push(await countByTenant(table));
}

const { data: access } = await sb
  .from("access_logs")
  .select("event_type, description, created_at, metadata, terreiro_id, target_id, actor_id")
  .or(`terreiro_id.eq.${tenantId},target_id.eq.${tenantId},actor_id.eq.${tenantId}`)
  .order("created_at", { ascending: false })
  .limit(40);

const { data: sub } = await sb.from("subscriptions").select("id, status, plan, expires_at, created_at, updated_at").eq("id", tenantId).maybeSingle();

const createdAt = authUser?.created_at || profile?.created_at;
const lastSignIn = authUser?.last_sign_in_at || null;
const createdMs = createdAt ? Date.parse(createdAt) : null;
const signInMs = lastSignIn ? Date.parse(lastSignIn) : null;
const signedInAfterRegister =
  createdMs != null && signInMs != null ? signInMs - createdMs > 60_000 : null;

const nonEmptyEntities = entities.filter((e) => typeof e.count === "number" && e.count > 0);
const loginish = (access || []).filter((r) => /login|session|auth|dashboard|register|welcome|claim/i.test(String(r.event_type || "")));

console.log(
  JSON.stringify(
    {
      tenantId,
      email,
      profile,
      subscription: sub,
      auth: authUser
        ? {
            id: authUser.id,
            created_at: authUser.created_at,
            last_sign_in_at: authUser.last_sign_in_at,
            email_confirmed_at: authUser.email_confirmed_at,
          }
        : null,
      usage: {
        signedInAfterRegister,
        lastSignIn,
        entitiesWithData: nonEmptyEntities,
        entityScan: entities.filter((e) => e.count !== null || e.error),
        accessEvents: access || [],
        loginishEvents: loginish,
      },
    },
    null,
    2,
  ),
);
