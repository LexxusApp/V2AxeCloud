import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const envText = fs.readFileSync('.env', 'utf8');
const envVars = {};
for (const line of envText.split('\n')) {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
    const [k, ...v] = trimmed.split('=');
    envVars[k.trim()] = v.join('=').trim().replace(/^["']|["']$/g, '');
  }
}

const url = envVars.VITE_SUPABASE_URL || envVars.SUPABASE_URL;
const key = envVars.SUPABASE_SERVICE_ROLE_KEY || envVars.VITE_SUPABASE_ANON_KEY;
const sb = createClient(url, key);

async function run() {
  console.log("=== AUDITORIA COMPLETA DOS TERREIROS ATIVOS NO AXÉCLOUD ===");

  // 1. Buscar todos os perfis de lideres (tenants)
  const { data: leaders, error: errLeaders } = await sb
    .from('perfil_lider')
    .select('*')
    .order('created_at', { ascending: false });

  if (errLeaders) {
    console.error("Erro ao listar lideres:", errLeaders);
    return;
  }

  console.log(`Total de líderes/tenants cadastrados: ${leaders?.length}`);

  const results = [];

  for (const leader of leaders || []) {
    const tenantId = leader.tenant_id || leader.id;

    // A. Contagem de Filhos de Santo (Corrente)
    const { count: totalFilhos } = await sb
      .from('filhos_de_santo')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId);

    // B. Contagem de Giras / Eventos Liturgicos
    const { count: totalGiras } = await sb
      .from('eventos_liturgicos')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId);

    // C. Disparos de WhatsApp emitidos pelo terreiro
    const { count: totalWaLogs } = await sb
      .from('whatsapp_logs')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId);

    // D. Configurações Financeiras (Pix cadastrado?)
    let pixConfigurado = false;
    try {
      const { data: fin } = await sb
        .from('financial_configs')
        .select('pix_key, chave_pix')
        .eq('tenant_id', tenantId)
        .maybeSingle();
      if (fin?.pix_key || fin?.chave_pix) pixConfigurado = true;
    } catch {
      // tabela pode variar
    }

    // E. Ultimo login / atividade em audit_logs ou auth
    const { data: lastLog } = await sb
      .from('audit_logs')
      .select('created_at, action')
      .eq('terreiro_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(1);

    // F. Status da conta
    const isRestored = Boolean(leader.terms_accepted_at);
    const hasPhoto = Boolean(leader.foto_url);

    results.push({
      id: tenantId,
      nomeTerreiro: leader.nome_terreiro || 'Sem Nome',
      zelador: leader.cargo || leader.zelador || 'Zelador',
      email: leader.email,
      whatsapp: leader.whatsapp_publico || leader.whatsapp,
      createdAt: leader.created_at,
      updatedAt: leader.updated_at,
      termsAccepted: isRestored,
      totalFilhos: totalFilhos || 0,
      totalGiras: totalGiras || 0,
      totalWaLogs: totalWaLogs || 0,
      pixConfigurado,
      hasPhoto,
      lastAction: lastLog?.[0]?.action || 'none',
      lastActionAt: lastLog?.[0]?.created_at || leader.updated_at
    });
  }

  // Salvar resultado detalhado em json
  fs.writeFileSync('scripts/_audit_active_tenants.json', JSON.stringify(results, null, 2), 'utf8');
  console.log(`Auditoria gravada em scripts/_audit_active_tenants.json com ${results.length} terreiros.`);

  // Sumarizar perfis de conversão
  let highProb = [];
  let medProb = [];
  let lowProb = [];

  for (const r of results) {
    let score = 0;
    if (r.totalFilhos >= 5) score += 35;
    else if (r.totalFilhos >= 1) score += 20;

    if (r.totalGiras >= 1) score += 20;
    if (r.totalWaLogs >= 2) score += 20;
    if (r.hasPhoto) score += 10;
    if (r.termsAccepted) score += 15;

    r.score = score;
    if (score >= 60) highProb.push(r);
    else if (score >= 30) medProb.push(r);
    else lowProb.push(r);
  }

  console.log("\n============================================================");
  console.log(`ALTA CHANCE DE CONTINUAR (Score >= 60): ${highProb.length}`);
  for (const h of highProb) {
    console.log(`- ${h.nomeTerreiro} (${h.zelador}) | Filhos: ${h.totalFilhos} | Giras: ${h.totalGiras} | WA: ${h.totalWaLogs} | Score: ${h.score}`);
  }

  console.log(`\nMÉDIA CHANCE DE CONTINUAR (Score 30-59): ${medProb.length}`);
  for (const m of medProb) {
    console.log(`- ${m.nomeTerreiro} (${m.zelador}) | Filhos: ${m.totalFilhos} | Giras: ${m.totalGiras} | WA: ${m.totalWaLogs} | Score: ${m.score}`);
  }

  console.log(`\nBAIXA CHANCE / TESTE PARADO (Score < 30): ${lowProb.length}`);
  for (const l of lowProb) {
    console.log(`- ${l.nomeTerreiro} (${l.zelador}) | Filhos: ${l.totalFilhos} | Giras: ${l.totalGiras} | Score: ${l.score}`);
  }
}

run();
