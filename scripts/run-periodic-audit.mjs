import fs from 'fs';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const env = dotenv.parse(fs.readFileSync('./.env'));
const sb = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const todayIso = '2026-10-17T00:00:00Z';
  const last30MinIso = new Date(Date.now() - 35 * 60 * 1000).toISOString();

  // 1. Líderes / Terreiros
  const { data: lideres } = await sb
    .from('perfil_lider')
    .select('id, tenant_id, zelador, nome_terreiro, cidade, estado_publico, whatsapp, email, created_at')
    .order('created_at', { ascending: false });

  // 2. Assinaturas
  const { data: subs } = await sb
    .from('subscriptions')
    .select('id, tenant_id, status, expires_at, plan, is_blocked, created_at')
    .order('created_at', { ascending: false });

  // 3. Filhos de Santo
  const { count: totalFilhos } = await sb
    .from('filhos_de_santo')
    .select('*', { count: 'exact', head: true });

  // 4. Disparos WhatsApp
  const { data: waDeliveries } = await sb
    .from('whatsapp_deliveries')
    .select('id, recipient_phone, status, template_name, created_at')
    .gte('created_at', todayIso)
    .order('created_at', { ascending: false });

  const { data: recentDeliveries } = await sb
    .from('whatsapp_deliveries')
    .select('id, recipient_phone, status, template_name, created_at')
    .gte('created_at', last30MinIso)
    .order('created_at', { ascending: false });

  // 5. Novas mensagens inbound nas últimas horas
  const { data: recentInbound } = await sb
    .from('admin_whatsapp_messages')
    .select('id, conversation_id, direction, body, created_at')
    .eq('direction', 'inbound')
    .gte('created_at', last30MinIso)
    .order('created_at', { ascending: false });

  const lideresHoje = (lideres || []).filter(l => l.created_at >= todayIso);
  const ativas = (subs || []).filter(s => s.status === 'active' && !s.is_blocked);
  const bloqueadas = (subs || []).filter(s => s.is_blocked);

  console.log('=== AUDITORIA PERIÓDICA AXÉCLOUD (30 MINUTOS) ===');
  console.log('Horário:', new Date().toLocaleTimeString('pt-BR'));
  console.log('Total de Terreiros Cadastrados:', (lideres || []).length);
  console.log('Terreiros Cadastrados Hoje (17/10):', lideresHoje.length);
  lideresHoje.forEach(l => {
    console.log(`  • ${l.zelador || 'Dirigente'} | ${l.nome_terreiro} (${l.cidade}/${l.estado_publico || ''}) - Tel: ${l.whatsapp || 'N/A'}`);
  });
  console.log('Total Filhos de Santo na Corrente:', totalFilhos);
  console.log('Assinaturas Ativas:', ativas.length, '| Expiradas/Bloqueadas:', bloqueadas.length);
  console.log('Disparos WhatsApp Hoje:', (waDeliveries || []).length);
  console.log('Disparos nos Últimos 30m:', (recentDeliveries || []).length);
  console.log('Mensagens Recebidas nos Últimos 30m:', (recentInbound || []).length);
  if (recentInbound && recentInbound.length > 0) {
    recentInbound.forEach(m => console.log(`  • Inbound: "${m.body.slice(0, 70)}" (${m.created_at})`));
  }
}

run().catch(err => console.error(err));
