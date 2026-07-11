/**
 * Executa SQL no projeto Supabase remoto via Management API.
 * Uso: node scripts/supabase-run-sql.mjs [arquivo.sql]
 * Requer SUPABASE_ACCESS_TOKEN (env ou ~/.supabase/access-token).
 */
import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

const PROJECT_REF = String(process.env.SUPABASE_PROJECT_REF || "vlaojhfwhqmwudqsumpi").trim();

function readAccessToken() {
  if (process.env.SUPABASE_ACCESS_TOKEN?.trim()) {
    return process.env.SUPABASE_ACCESS_TOKEN.trim();
  }
  const candidates = [
    join(process.env.APPDATA || "", "supabase", "access-token"),
    join(homedir(), ".supabase", "access-token"),
    join(homedir(), "AppData", "Roaming", "supabase", "access-token"),
  ];
  for (const path of candidates) {
    if (existsSync(path)) {
      return readFileSync(path, "utf8").trim();
    }
  }
  throw new Error(
    "SUPABASE_ACCESS_TOKEN não encontrado. Gere em https://supabase.com/dashboard/account/tokens e defina no .env"
  );
}

async function runSql(query) {
  const token = readAccessToken();
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Supabase SQL falhou (${res.status}): ${text.slice(0, 800)}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function main() {
  const fileArg = process.argv[2];
  if (!fileArg) {
    console.error("Uso: node scripts/supabase-run-sql.mjs <arquivo.sql>");
    process.exit(1);
  }
  const sqlPath = resolve(fileArg);
  const query = readFileSync(sqlPath, "utf8");
  console.log(`[supabase] project=${PROJECT_REF} file=${sqlPath}`);
  const out = await runSql(query);
  console.log("[supabase] OK");
  if (out) console.log(typeof out === "string" ? out : JSON.stringify(out, null, 2));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
