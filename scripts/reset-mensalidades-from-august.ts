/**
 * Reset de mensalidades: remove cobranças com vencimento/data anteriores a 2026-08-01
 * e regenera pendências do mês atual (agosto).
 *
 * Uso (raiz AxecloudV2, com .env):
 *   npx tsx scripts/reset-mensalidades-from-august.ts --tenant <tenantId>
 *   npx tsx scripts/reset-mensalidades-from-august.ts --find "Clayton Santos"
 *   npx tsx scripts/reset-mensalidades-from-august.ts --all   # TODOS os terreiros
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { format } from "date-fns";
import { childEligibleForDueMonth, clampDayInMonth } from "../api/lib/mensalidadeEligibility.js";

const CUTOFF = "2026-08-01";

function getUrl(): string | undefined {
  return (
    process.env.VITE_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL
  );
}

function getServiceKey(): string | undefined {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
  );
}

function parseArgs(argv: string[]) {
  const out: { tenant?: string; find?: string; all?: boolean; dry?: boolean } = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--tenant") out.tenant = String(argv[++i] || "").trim();
    else if (a === "--find") out.find = String(argv[++i] || "").trim();
    else if (a === "--all") out.all = true;
    else if (a === "--dry") out.dry = true;
  }
  return out;
}

function rowYmd(row: { data_vencimento?: string | null; data?: string | null }): string | null {
  const raw = row.data_vencimento || row.data;
  if (!raw) return null;
  const s = String(raw).trim();
  const iso = /^(\d{4}-\d{2}-\d{2})/.exec(s);
  if (iso) return iso[1];
  const dmy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s);
  if (dmy) {
    return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  }
  return null;
}

async function findTenantByChildName(admin: ReturnType<typeof createClient>, namePart: string) {
  const { data, error } = await admin
    .from("filhos_de_santo")
    .select("id, nome, tenant_id, lider_id")
    .ilike("nome", `%${namePart}%`)
    .limit(20);
  if (error) throw error;
  return data || [];
}

async function deletePreCutoffMensalidades(
  admin: ReturnType<typeof createClient>,
  tenantIds: string[],
  dry: boolean
) {
  let deleted = 0;
  const pageSize = 500;
  for (const tid of tenantIds) {
    for (;;) {
      // Produção pode não ter data_vencimento — usa só `data`.
      const { data, error } = await admin
        .from("financeiro")
        .select("id, data, status, descricao, valor")
        .or(`tenant_id.eq.${tid},lider_id.eq.${tid}`)
        .eq("categoria", "Mensalidade")
        .lt("data", CUTOFF)
        .limit(pageSize);
      if (error) throw error;
      const rows = data || [];
      if (rows.length === 0) break;

      const ids = rows.map((r) => r.id);
      if (dry) {
        console.log(`[dry] tenant=${tid} would delete ${ids.length} (data < ${CUTOFF})`);
        deleted += ids.length;
        break;
      }
      const { error: dErr } = await admin.from("financeiro").delete().in("id", ids);
      if (dErr) throw dErr;
      deleted += ids.length;
      if (rows.length < pageSize) break;
    }
  }
  return deleted;
}

async function syncAugustForTenant(
  admin: ReturnType<typeof createClient>,
  tenantId: string,
  dry: boolean
) {
  const resolvedTenant = tenantId;
  let dia = 10;
  let valorPadrao = 89.9;
  const { data: pix } = await admin
    .from("configuracoes_pix")
    .select("valor_mensalidade, dia_vencimento, mensalidade_ativa")
    .or(`terreiro_id.eq.${resolvedTenant},terreiro_id.eq.${tenantId}`)
    .maybeSingle();
  if (pix) {
    dia = parseInt(String((pix as any).dia_vencimento), 10) || 10;
    valorPadrao = Number((pix as any).valor_mensalidade) || valorPadrao;
    if ((pix as any).mensalidade_ativa === false) {
      console.log(`[skip] tenant=${tenantId} mensalidade_ativa=false`);
      return 0;
    }
  }

  const { data: children, error } = await admin
    .from("filhos_de_santo")
    .select("id, nome, tenant_id, lider_id, created_at, data_entrada, status")
    .or(
      [
        `tenant_id.eq.${tenantId}`,
        `lider_id.eq.${tenantId}`,
      ].join(",")
    );
  if (error) throw error;

  const ref = new Date();
  const y = ref.getFullYear();
  const m0 = ref.getMonth();
  const dueStr = format(clampDayInMonth(y, m0, dia), "yyyy-MM-dd");
  let created = 0;

  for (const child of children || []) {
    const stFilho = String((child as any).status || "Ativo").trim().toLowerCase();
    if (stFilho === "inativo" || stFilho === "desligado" || stFilho === "falecido") continue;
    const fid = child.id as string;
    if (!childEligibleForDueMonth(child, dueStr, dia)) continue;

    const { data: existing } = await admin
      .from("financeiro")
      .select("id, status, descricao, data")
      .or(`tenant_id.eq.${tenantId},lider_id.eq.${tenantId}`)
      .eq("categoria", "Mensalidade")
      .eq("filho_id", fid)
      .gte("data", CUTOFF)
      .limit(20);

    const hasOpenOrPaidAug = (existing || []).some((r) => {
      const ymd = rowYmd(r);
      if (!ymd || ymd < CUTOFF) return false;
      const st = String((r as any).status || "").toLowerCase();
      if (st === "pago" || st === "paid" || st === "confirmado") return true;
      if (st === "pendente" || st === "pending" || st === "atrasado" || st === "overdue") return true;
      return String((r as any).descricao || "").toLowerCase().includes("(vencimento");
    });
    if (hasOpenOrPaidAug) continue;

    const nome = String((child as any).nome || "Filho").trim() || "Filho";
    const insert: Record<string, unknown> = {
      tipo: "entrada",
      valor: valorPadrao,
      categoria: "Mensalidade",
      data: dueStr,
      descricao: `Mensalidade - ${nome} (vencimento ${dueStr}) (ID:${fid})`,
      tenant_id: tenantId,
      lider_id: (child as any).lider_id || tenantId,
      filho_id: fid,
      status: "pendente",
    };
    if (dry) {
      console.log(`[dry] would create agosto for ${nome} due=${dueStr}`);
      created += 1;
      continue;
    }
    let { error: insErr } = await admin.from("financeiro").insert([insert]);
    if (insErr && String(insErr.message || "").includes("filho_id")) {
      delete insert.filho_id;
      const r2 = await admin.from("financeiro").insert([insert]);
      insErr = r2.error;
    }
    if (insErr && String(insErr.message || "").toLowerCase().includes("status")) {
      delete insert.status;
      const r3 = await admin.from("financeiro").insert([insert]);
      insErr = r3.error;
    }
    if (insErr) {
      console.warn(`[warn] insert falhou ${nome}:`, insErr.message);
      continue;
    }
    created += 1;
  }
  return created;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const url = getUrl();
  const key = getServiceKey();
  if (!url || !key) {
    console.error("Faltam VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env");
    process.exit(1);
  }
  if (!args.tenant && !args.find && !args.all) {
    console.error(
      "Informe --tenant <id>, --find \"Nome do filho\" ou --all\nEx.: npx tsx scripts/reset-mensalidades-from-august.ts --find \"Clayton Santos\""
    );
    process.exit(1);
  }

  const admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let tenantIds: string[] = [];

  if (args.all) {
    const { data: fins, error } = await admin
      .from("financeiro")
      .select("tenant_id")
      .eq("categoria", "Mensalidade")
      .not("tenant_id", "is", null)
      .limit(5000);
    if (error) throw error;
    tenantIds = [...new Set((fins || []).map((r) => String(r.tenant_id)).filter(Boolean))];
    console.log(`[reset] --all: ${tenantIds.length} tenants com mensalidade`);
  } else if (args.find) {
    const hits = await findTenantByChildName(admin, args.find);
    if (hits.length === 0) {
      console.error(`Nenhum filho encontrado com nome contendo: ${args.find}`);
      process.exit(1);
    }
    console.log("[reset] filhos encontrados:");
    for (const h of hits) {
      console.log(`  - ${h.nome} tenant=${h.tenant_id || h.lider_id}`);
    }
    tenantIds = [
      ...new Set(
        hits.map((h) => String(h.tenant_id || h.lider_id || "").trim()).filter(Boolean)
      ),
    ];
  } else if (args.tenant) {
    tenantIds = [args.tenant];
  }

  if (tenantIds.length === 0) {
    console.error("Nenhum tenant para processar");
    process.exit(1);
  }

  console.log(`[reset] cutoff=${CUTOFF} dry=${Boolean(args.dry)} tenants=${tenantIds.join(",")}`);

  const deleted = await deletePreCutoffMensalidades(admin, tenantIds, Boolean(args.dry));
  console.log(`[reset] removidas (julho e anteriores): ${deleted}`);

  let createdTotal = 0;
  for (const tid of tenantIds) {
    const c = await syncAugustForTenant(admin, tid, Boolean(args.dry));
    console.log(`[reset] tenant=${tid} criadas agosto: ${c}`);
    createdTotal += c;
  }
  console.log(`[reset] ok. deleted=${deleted} created_august=${createdTotal}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
