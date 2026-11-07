import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl!, supabaseKey!);

async function run() {
  console.log('=== ATIVIDADE DA TARDE (2026-10-27) ===\n');

  // 1. WhatsApp logs in the afternoon (after 16:00 UTC = 13:00 BRT)
  const afternoonSince = '2026-10-27T16:00:00.000Z';
  const { data: afternoonLogs, error: errLogs } = await supabase
    .from('whatsapp_logs')
    .select('*')
    .gte('created_at', afternoonSince)
    .order('created_at', { ascending: false });

  console.log(`Disparos WhatsApp nesta tarde (desde 13:00 BRT): ${afternoonLogs?.length || 0}`);
  afternoonLogs?.forEach(l => {
    console.log(` - [${l.created_at}] Tel: ${l.telefone} | Tipo: ${l.tipo} | Status: ${l.status} | Msg: ${l.mensagem?.slice(0, 100)}`);
  });

  // 2. Check if Pai Nando's messages were read
  const { data: nandoLogs } = await supabase
    .from('whatsapp_logs')
    .select('id, tipo, status, created_at, mensagem')
    .eq('telefone', '5521982528566')
    .gte('created_at', '2026-10-27T15:30:00.000Z')
    .order('created_at', { ascending: false });

  console.log('\nStatus das mensagens do Pai Nando (enviadas ~12:40):');
  nandoLogs?.forEach(l => {
    console.log(` - [${l.created_at}] Status: ${l.status} | Msg: ${l.mensagem?.slice(0, 70)}`);
  });

  // 3. New children or transactions registered this afternoon
  const { data: newKids } = await supabase
    .from('filhos_de_santo')
    .select('id, nome, created_at, tenant_id')
    .gte('created_at', afternoonSince);
  console.log(`\nNovos filhos cadastrados à tarde: ${newKids?.length || 0}`, newKids);

  const { data: newTx } = await supabase
    .from('financeiro')
    .select('id, valor, categoria, status, descricao, created_at')
    .gte('created_at', afternoonSince);
  console.log(`Novos lançamentos financeiros à tarde: ${newTx?.length || 0}`, newTx);

  // 4. API health check
  try {
    const res = await fetch('https://axecloud.com.br/api/health-check');
    const json = await res.json().catch(() => null);
    console.log('\nAPI Live Health Check:', res.status, json);
  } catch (e: any) {
    console.error('Health check error:', e.message);
  }
}

run();
