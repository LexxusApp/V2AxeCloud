import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envContent = fs.readFileSync('.env', 'utf-8');
const map = {};
envContent.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const idx = trimmed.indexOf('=');
    if (idx > 0) {
      map[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
    }
  }
});

const url = map['VITE_SUPABASE_URL'];
const key = map['SUPABASE_SERVICE_ROLE_KEY'];
const sb = createClient(url, key);

const tenantId = "4b167a21-d208-4f36-8b97-692f9c8e44a3";

async function run() {
  console.log("=== 1. Test resolveLeaderId ===");
  const { data: leaderRows, error: leaderErr } = await sb
    .from('perfil_lider')
    .select('id, email, tenant_id')
    .or(`id.eq.${tenantId},tenant_id.eq.${tenantId}`)
    .limit(1);
  console.log("Leader rows:", leaderRows, "Leader err:", leaderErr);

  const resolvedId = leaderRows && leaderRows.length > 0 ? leaderRows[0].id : tenantId;
  console.log("resolvedId:", resolvedId);

  const ids = Array.from(new Set([tenantId, resolvedId].filter(Boolean)));
  const tenantFilters = ids.flatMap((id) => [`tenant_id.eq.${id}`, `lider_id.eq.${id}`]).join(',');
  console.log("tenantFilters:", tenantFilters);

  console.log("\n=== 2. Test GET /api/events query ===");
  try {
    let query = sb
      .from('calendario_axe')
      .select('*')
      .or(tenantFilters)
      .order('data', { ascending: true });
    
    // scope === 'calendar'
    query = query.neq('tipo', 'Obrigação');
    query = query.gte('data', '2026-10-10');
    query = query.lte('data', '2026-10-17');

    const { data: events, error: evErr } = await query;
    console.log("Events count:", events?.length, "Error:", evErr);
  } catch (e) {
    console.error("Events catch:", e);
  }

  console.log("\n=== 3. Test GET /api/v1/atendimentos/pedidos-reza ===");
  try {
    // Check PEDIDO_SELECT
    const PEDIDO_SELECT = `
      id, tenant_id, lider_id, consulente_id, tipo, canal, status, prioridade,
      nome, whatsapp, telefone, email, descricao, observacoes_internas,
      data_limite, data_conclusao, data_atendimento, atendido_por,
      created_at, updated_at
    `.replace(/\s+/g, ' ').trim();

    const { data: pedidos, error: pedErr } = await sb
      .from('pedidos_reza')
      .select(PEDIDO_SELECT)
      .or(`tenant_id.eq.${tenantId},lider_id.eq.${resolvedId}`);
    console.log("Pedidos count:", pedidos?.length, "Error:", pedErr);
  } catch (e) {
    console.error("Pedidos catch:", e);
  }

  console.log("\n=== 4. Check user profile for tenant ===");
  const { data: profiles, error: profErr } = await sb
    .from('profiles')
    .select('id, email, role, tenant_id')
    .eq('tenant_id', tenantId);
  console.log("Profiles:", profiles, "Error:", profErr);
}

run();
