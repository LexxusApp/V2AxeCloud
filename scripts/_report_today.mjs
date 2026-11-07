import fs from 'fs';

const envContent = fs.readFileSync('.env', 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const idx = trimmed.indexOf('=');
    if (idx > 0) env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
  }
});

const url = env['VITE_SUPABASE_URL'] || 'https://vlaojhfwhqmwudqsumpi.supabase.co';
const key = env['SUPABASE_SERVICE_ROLE_KEY'];

async function query(table, params = '') {
  const res = await fetch(`${url}/rest/v1/${table}?${params}`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json'
    }
  });
  if (!res.ok) {
    const text = await res.text();
    return { error: `${res.status} ${text}` };
  }
  return res.json();
}

async function run() {
  const todayIso = '2026-10-15T00:00:00Z';
  const yesterdayIso = '2026-10-14T00:00:00Z';

  // 1. Líderes / Terreiros cadastrados
  const lideres = await query('perfil_lider', 'select=id,tenant_id,nome,nome_terreiro,cidade,estado,telefone,email,created_at&order=created_at.desc');
  const subs = await query('subscriptions', 'select=id,tenant_id,status,expires_at,plan,is_blocked,block_reason,created_at&order=created_at.desc');
  const filhos = await query('filhos_de_santo', 'select=id,tenant_id,nome,created_at');
  const claims = await query('terreiro_claim_requests', 'select=id,nome,cidade,status,created_at&order=created_at.desc');

  console.log('====================================================');
  console.log('       RELATÓRIO OPERACIONAL AXÉCLOUD (15/10/2026)  ');
  console.log('====================================================\n');

  console.log('1. BASE DE TERREIROS & LÍDERES:');
  console.log(`• Total de líderes/terreiros cadastrados (perfil_lider): ${Array.isArray(lideres) ? lideres.length : 'Erro'}`);
  
  if (Array.isArray(lideres)) {
    const lideresHoje = lideres.filter(l => l.created_at >= todayIso);
    console.log(`• Novos líderes cadastrados HOJE (15/10): ${lideresHoje.length}`);
    lideresHoje.forEach(l => console.log(`   - ${l.nome} | ${l.nome_terreiro} (${l.cidade}/${l.estado || ''}) - Tel: ${l.telefone || 'N/A'}`));

    const lideresOntem = lideres.filter(l => l.created_at >= yesterdayIso && l.created_at < todayIso);
    console.log(`• Novos líderes cadastrados ONTEM (14/10): ${lideresOntem.length}`);
    lideresOntem.forEach(l => console.log(`   - ${l.nome} | ${l.nome_terreiro} (${l.cidade}/${l.estado || ''})`));
  }

  console.log('\n2. ASSINATURAS (SUBSCRIPTIONS):');
  if (Array.isArray(subs)) {
    const ativas = subs.filter(s => s.status === 'active' && !s.is_blocked);
    const bloqueadas = subs.filter(s => s.is_blocked);
    console.log(`• Assinaturas ativas no momento: ${ativas.length}`);
    console.log(`• Assinaturas suspensas/expiradas: ${bloqueadas.length}`);
    console.log(`• Total geral de registros de assinatura: ${subs.length}`);
  }

  console.log('\n3. CORRENTE (FILHOS DE SANTO):');
  console.log(`• Total de filhos cadastrados em todos os terreiros: ${Array.isArray(filhos) ? filhos.length : 'Erro'}`);

  console.log('\n4. SOLICITAÇÕES DE REIVINDICAÇÃO (CLAIMS NO DIRETÓRIO):');
  if (Array.isArray(claims)) {
    console.log(`• Total de claims registrados: ${claims.length}`);
    const claimsHoje = claims.filter(c => c.created_at >= todayIso);
    console.log(`• Claims realizados HOJE: ${claimsHoje.length}`);
    claimsHoje.forEach(c => console.log(`   - ${c.nome} (${c.cidade}) - Status: ${c.status}`));
  }

  // 5. WhatsApp & Mensageria Hoje
  const waLogs = await query('admin_whatsapp_messages', `select=id,phone,role,created_at,content&created_at=gte.${todayIso}&order=created_at.desc`);
  const waDeliveries = await query('whatsapp_deliveries', `select=id,recipient_phone,status,template_name,created_at&created_at=gte.${todayIso}&order=created_at.desc`);
  
  console.log('\n5. MENSAGENS E DISPAROS WHATSAPP HOJE (15/10):');
  console.log(`• Mensagens registradas no chat/admin hoje: ${Array.isArray(waLogs) ? waLogs.length : 0}`);
  console.log(`• Disparos oficiais rastreados (whatsapp_deliveries) hoje: ${Array.isArray(waDeliveries) ? waDeliveries.length : 0}`);
  
  if (Array.isArray(waDeliveries) && waDeliveries.length > 0) {
    const statusMap = {};
    const tplMap = {};
    waDeliveries.forEach(d => {
      statusMap[d.status] = (statusMap[d.status] || 0) + 1;
      tplMap[d.template_name] = (tplMap[d.template_name] || 0) + 1;
    });
    console.log('   Status de entrega:', statusMap);
    console.log('   Templates disparados:', tplMap);
  }

  // 6. Prospecção Ativa
  const leadsHoje = await query('prospecting_leads', `select=id,name,phone,city,status,updated_at&updated_at=gte.${todayIso}&order=updated_at.desc`);
  console.log('\n6. MOTOR DE PROSPECÇÃO HOJE (15/10):');
  console.log(`• Leads ativos/interagidos hoje: ${Array.isArray(leadsHoje) ? leadsHoje.length : 0}`);
  if (Array.isArray(leadsHoje)) {
    const stMap = {};
    leadsHoje.forEach(l => stMap[l.status] = (stMap[l.status] || 0) + 1);
    console.log('   Distribuição por status:', stMap);
  }

  // 7. Auditoria / Saúde do Sistema
  const failures = await query('tenant_feature_failures', 'select=id,tenant_id,feature,severity,error_message,resolved,created_at&resolved=eq.false&order=created_at.desc');
  console.log('\n7. SAÚDE & RESILIÊNCIA OPERACIONAL:');
  console.log(`• Falhas não resolvidas no sistema: ${Array.isArray(failures) ? failures.length : 0}`);
  if (Array.isArray(failures) && failures.length > 0) {
    failures.slice(0, 3).forEach(f => {
      console.log(`   - [${f.severity}] ${f.feature}: ${(f.error_message || '').slice(0, 70)}`);
    });
  }

  // 8. Eventos de auditoria recentes (ações reais de usuários hoje)
  const auditLogs = await query('audit_logs', `select=id,action,entity,created_at,details&created_at=gte.${todayIso}&order=created_at.desc&limit=50`);
  console.log('\n8. ATIVIDADE REAL NO PAINEL HOJE (15/10):');
  console.log(`• Eventos de auditoria registrados hoje: ${Array.isArray(auditLogs) ? auditLogs.length : 0}`);
  if (Array.isArray(auditLogs) && auditLogs.length > 0) {
    const actMap = {};
    auditLogs.forEach(a => actMap[a.action] = (actMap[a.action] || 0) + 1);
    console.log('   Ações executadas:', actMap);
  }
}

run().catch(console.error);
