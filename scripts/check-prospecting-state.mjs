import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  console.log('--- DETALHES DE PROSPECÇÃO & WHATSAPP ---');
  const { data: logs } = await sb
    .from('whatsapp_logs')
    .select('id, tipo, status, created_at, phone, error')
    .order('created_at', { ascending: false })
    .limit(30);

  console.log('Últimos 30 disparos no whatsapp_logs:');
  const countByType = {};
  const countByStatus = {};
  logs?.forEach(l => {
    countByType[l.tipo] = (countByType[l.tipo] || 0) + 1;
    countByStatus[l.status] = (countByStatus[l.status] || 0) + 1;
    console.log(`  • [${l.created_at?.slice(0, 19)}] Tipo: ${l.tipo.padEnd(20)} | Status: ${l.status.padEnd(10)} | Dest: ${l.phone || '—'} ${l.error ? `| Erro: ${l.error}` : ''}`);
  });

  console.log('\nResumo dos tipos de disparos recentes:', countByType);
  console.log('Resumo de status de entrega:', countByStatus);

  // Check claim or prospecting leads
  const { data: claims, count: claimCount } = await sb
    .from('reivindicacoes')
    .select('id, status, created_at, telefone, email, terreiro_slug', { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(5);

  console.log(`\nReivindicações de perfil público (reivindicacoes): ${claimCount || 0}`);
  claims?.forEach(c => {
    console.log(`  • [${c.created_at?.slice(0, 10)}] Slug: ${c.terreiro_slug} | Tel: ${c.telefone} | Status: ${c.status}`);
  });
}

run().catch(console.error);
