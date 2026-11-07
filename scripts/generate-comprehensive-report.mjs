import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function run() {
  console.log('=== RELATÓRIO OPERACIONAL COMPLETO - 26/10/2026 ===\n');

  // 1. TERREIROS CADASTRADOS
  console.log('--- 1. TERREIROS CADASTRADOS NO SISTEMA ---');
  const { data: leaders } = await supabase
    .from('perfil_lider')
    .select('*')
    .order('created_at', { ascending: false });

  console.log(`Total de terreiros (perfil_lider): ${leaders?.length || 0}`);
  if (leaders && leaders.length > 0) {
    console.log('Colunas de perfil_lider:', Object.keys(leaders[0]));
    console.log('\nLista de todos os terreiros cadastrados:');
    leaders.forEach((l, idx) => {
      console.log(`  ${idx + 1}. [${l.created_at?.slice(0, 10)}] ${l.nome_terreiro || 'Sem nome'} | Líder: ${l.nome_lider || l.cargo || 'Zelador'} | E-mail: ${l.email} | WhatsApp: ${l.whatsapp_phone || l.telefone || '—'} | Status: ${l.status_assinatura || l.status || 'ativo'}`);
    });

    // Análise de quando parou os cadastros
    const dates = leaders.map(l => l.created_at?.slice(0, 10)).filter(Boolean);
    console.log('\nData do cadastro mais recente:', dates[0]);
    console.log('Data do segundo mais recente:', dates[1]);
    console.log('Data do terceiro mais recente:', dates[2]);
  }

  // 2. FILHOS DE SANTO & LOGINS
  console.log('\n--- 2. ANÁLISE DE LOGINS DOS FILHOS DE SANTO ---');
  const { data: auditAll } = await supabase
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(300);

  const filhoSuccess = (auditAll || []).filter(a => a.action === 'auth.login_success' && a.details?.mode === 'filho');
  const filhoFailed = (auditAll || []).filter(a => a.action === 'auth.login_failed' && a.details?.mode === 'filho');
  const adminSuccess = (auditAll || []).filter(a => a.action === 'auth.login_success' && a.details?.mode !== 'filho');

  console.log(`Sucessos de login de filhos (amostra recente): ${filhoSuccess.length}`);
  console.log(`Falhas de login de filhos (amostra recente): ${filhoFailed.length}`);
  console.log(`Sucessos de login de zeladores/admin: ${adminSuccess.length}`);

  console.log('\nFilhos de santo que conseguiram logar recentemente:');
  const loggedFilhos = new Map();
  filhoSuccess.forEach(f => {
    const nome = f.details?.nome || f.user_email || 'Desconhecido';
    if (!loggedFilhos.has(nome)) {
      loggedFilhos.set(nome, { count: 1, lastAt: f.created_at, details: f.details });
    } else {
      loggedFilhos.get(nome).count++;
    }
  });

  for (const [nome, info] of loggedFilhos.entries()) {
    console.log(`  ✅ ${nome.padEnd(25)} | Logins: ${info.count} | Último: ${info.lastAt?.slice(0, 19)} | Método: ${info.details?.loginMethod || info.details?.source}`);
  }

  console.log('\nFalhas de login mais comuns dos filhos de santo:');
  const failPatterns = {};
  filhoFailed.forEach(f => {
    const msg = f.details?.message || f.action;
    const input = f.details?.childId || 'vazio';
    failPatterns[msg] = (failPatterns[msg] || 0) + 1;
  });
  console.log('Motivos das falhas:', failPatterns);

  console.log('Últimas 10 tentativas com falha (o que os filhos estão digitando):');
  filhoFailed.slice(0, 10).forEach(f => {
    console.log(`  ❌ [${f.created_at?.slice(0, 19)}] Digitou: "${f.details?.childId}" | Erro: ${f.details?.message}`);
  });

  // 3. WHATSAPP: DISPAROS, TEMPLATES E ENTREGAS
  console.log('\n--- 3. WHATSAPP & DISPARO DE TEMPLATES ---');
  
  // Try querying known tables
  const potentialWaTables = [
    'whatsapp_delivery_logs',
    'whatsapp_messages',
    'whatsapp_dispatch_logs',
    'whatsapp_logs',
    'whatsapp_events',
    'disparos_whatsapp',
    'mensagens_whatsapp',
    'filho_welcome_logs',
    'cron_whatsapp_jobs'
  ];

  for (const tbl of potentialWaTables) {
    try {
      const { data, count, error } = await supabase
        .from(tbl)
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .limit(10);
      if (!error && count !== null) {
        console.log(`\nTabela encontrada: ${tbl} (${count} registros)`);
        console.log('Últimos registros:');
        data?.slice(0, 5).forEach(r => {
          console.log('  •', r.created_at?.slice(0, 19), '| Status:', r.status || r.delivery_status || r.state, '| Dest:', r.recipient_phone || r.phone || r.destinatario || r.to, '| Template/Tipo:', r.template_name || r.template || r.tipo || r.event);
        });
      }
    } catch {}
  }

  // 4. USO DAS FERRAMENTAS DO SISTEMA
  console.log('\n--- 4. NÍVEL DE USO DO SISTEMA (ENGAJAMENTO) ---');
  // Check recent financial entries
  const { data: finRec, count: finCount } = await supabase
    .from('financeiro')
    .select('id, data, descricao, valor, status, categoria, tipo, created_at, tenant_id', { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(10);

  console.log(`Financeiro: ${finCount} registros no total.`);
  console.log('Últimas movimentações financeiras:');
  finRec?.slice(0, 5).forEach(r => {
    console.log(`  • [${r.data || r.created_at?.slice(0, 10)}] ${r.tipo?.toUpperCase()} - ${r.categoria} - ${r.descricao} - R$ ${r.valor} (${r.status})`);
  });

  // Check Giras
  const { data: giras, count: girasCount } = await supabase
    .from('giras')
    .select('id, data, horario, titulo, tipo, created_at', { count: 'exact' })
    .order('data', { ascending: false })
    .limit(5);

  console.log(`\nGiras: ${girasCount || 0} giras cadastradas.`);
  giras?.forEach(g => {
    console.log(`  • [${g.data} ${g.horario || ''}] ${g.titulo} (${g.tipo || 'Gira'})`);
  });

  // Check Presenças / Frequência
  const { data: freq, count: freqCount } = await supabase
    .from('frequencia')
    .select('id, gira_id, data, presente, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(5);

  console.log(`\nFrequência / Check-ins: ${freqCount || 0} presenças registradas.`);

  // 5. ERROS E FALHAS NO SISTEMA
  console.log('\n--- 5. ERROS E FALHAS RECENTES DO SISTEMA ---');
  const { data: recentFailures } = await supabase
    .from('tenant_feature_failures')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(15);

  console.log(`Total de falhas recentes em tenant_feature_failures: ${recentFailures?.length || 0}`);
  recentFailures?.slice(0, 10).forEach(f => {
    console.log(`  • [${f.created_at?.slice(0, 19)}] Feature: ${f.feature} | Rota: ${f.route} | Erro: ${f.error_message?.slice(0, 100)}`);
  });

  // 6. PIPELINE COMERCIAL / PROSPECÇÃO (POR QUE PAROU?)
  console.log('\n--- 6. ANÁLISE DE PROSPECÇÃO COMERCIAL ---');
  try {
    const { data: growth, count: growthCount } = await supabase
      .from('growth_prospects')
      .select('*', { count: 'exact' })
      .order('updated_at', { ascending: false })
      .limit(10);

    console.log(`Tabela growth_prospects: ${growthCount} leads.`);
    growth?.forEach(g => {
      console.log(`  • [${g.updated_at?.slice(0, 10)}] ${g.nome || g.nome_terreiro} | Status: ${g.status || g.stage} | Último contato: ${g.last_contact_at || g.created_at?.slice(0, 10)}`);
    });
  } catch (e) {
    console.log('growth_prospects error:', e.message);
  }
}

run().catch(console.error);
