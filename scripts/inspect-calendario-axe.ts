import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl!, supabaseKey!);

async function run() {
  console.log('--- Buscando em public.calendario_axe ---');
  const { data: events, error } = await supabase
    .from('calendario_axe')
    .select('*')
    .gte('data_evento', '2026-10-27T00:00:00')
    .lte('data_evento', '2026-10-31T23:59:59')
    .order('data_evento', { ascending: true });

  if (error) {
    console.error('Erro ao buscar calendario_axe:', error);
    return;
  }

  console.log(`Giras encontradas no período 27/10 a 31/10: ${events?.length || 0}`);

  // Fetch terreiros to know which terreiro each gira belongs to
  const tenantIds = [...new Set((events || []).map(e => e.tenant_id).filter(Boolean))];
  const { data: terreiros } = await supabase
    .from('terreiros')
    .select('id, nome, email, telefone, responsavel_nome')
    .in('id', tenantIds);

  const tMap = new Map((terreiros || []).map(t => [t.id, t]));

  for (const e of events || []) {
    const t = tMap.get(e.tenant_id);
    console.log(`\n📅 Gira: "${e.titulo || e.nome || 'Gira'}"`);
    console.log(`  Data/Hora: ${e.data_evento} (${e.horario || ''})`);
    console.log(`  Tipo: ${e.tipo || 'Gira'} | Descrição: ${e.descricao || ''}`);
    console.log(`  Terreiro: ${t?.nome || e.tenant_id} (Zelador: ${t?.responsavel_nome || ''})`);
    console.log(`  Disparado: ${e.aviso_disparado || e.notificacao_enviada || e.lembrete_enviado || 'N/A'}`);
  }

  // Also query what avisos_gira were logged in whatsapp_logs today specifically for the gira of today
  const { data: todayLogs } = await supabase
    .from('whatsapp_logs')
    .select('*')
    .eq('tipo', 'aviso_gira')
    .gte('created_at', '2026-10-27T00:00:00.000Z')
    .order('created_at', { ascending: false });

  console.log(`\n--- Total de logs de aviso_gira hoje: ${todayLogs?.length} ---`);
  todayLogs?.forEach(l => {
    console.log(`[${l.created_at}] Tel: ${l.telefone} | Status: ${l.status} | Tenant: ${l.tenant_id} | Msg: ${l.mensagem}`);
  });
}

run();
