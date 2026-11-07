import fs from 'fs';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const env = dotenv.parse(fs.readFileSync('./.env'));
const sb = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function runReport() {
  const now = new Date();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const todayIso = startOfDay.toISOString();

  // 1. Líderes / Terreiros cadastrados (perfil_lider)
  const { count: totalLideres } = await sb.from('perfil_lider').select('*', { count: 'exact', head: true });
  const { data: recentLideres } = await sb.from('perfil_lider')
    .select('id, nome, nome_terreiro, cidade, estado, telefone, created_at')
    .order('created_at', { ascending: false })
    .limit(5);

  // Novos hoje
  const { count: lideresHoje } = await sb.from('perfil_lider')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', todayIso);

  // 2. Subscriptions
  const { data: subs } = await sb.from('subscriptions').select('id, status, is_blocked, plan');
  let subsAtivas = 0;
  let subsTrial = 0;
  let subsBloqueadas = 0;
  for (const s of subs || []) {
    if (s.is_blocked) subsBloqueadas++;
    else if (s.status === 'active') subsAtivas++;
    else if (s.status === 'trialing' || s.status === 'trial') subsTrial++;
  }

  // 3. Disparos WhatsApp Hoje
  const { count: msgsTotalHoje } = await sb.from('admin_whatsapp_messages').select('*', { count: 'exact', head: true }).gte('created_at', todayIso);
  const { count: msgsInboundHoje } = await sb.from('admin_whatsapp_messages').select('*', { count: 'exact', head: true }).gte('created_at', todayIso).eq('direction', 'inbound');
  const { count: msgsOutboundHoje } = await sb.from('admin_whatsapp_messages').select('*', { count: 'exact', head: true }).gte('created_at', todayIso).eq('direction', 'outbound');

  // Inbound recente (últimas 2h)
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const { data: recentInbounds } = await sb.from('admin_whatsapp_messages')
    .select('phone_number, content, created_at')
    .eq('direction', 'inbound')
    .gte('created_at', twoHoursAgo)
    .order('created_at', { ascending: false });

  // 4. Leads de Prospecção
  const { count: totalLeads } = await sb.from('prospecting_leads').select('*', { count: 'exact', head: true });
  const { count: leadsInterested } = await sb.from('prospecting_leads').select('*', { count: 'exact', head: true }).eq('status', 'interested');

  // 5. API Health Check
  let apiHealthy = false;
  let apiResponseTimeMs = 0;
  try {
    const t0 = Date.now();
    const res = await fetch('https://axecloud.com.br/api/health');
    apiResponseTimeMs = Date.now() - t0;
    if (res.ok) {
      const j = await res.json();
      apiHealthy = j.status === 'ok';
    }
  } catch (err) {
    apiHealthy = false;
  }

  console.log(JSON.stringify({
    timestamp: now.toISOString(),
    api: { healthy: apiHealthy, responseTimeMs: apiResponseTimeMs },
    terreiros: {
      total: totalLideres,
      novosHoje: lideresHoje,
      recentes: recentLideres
    },
    assinaturas: {
      ativas: subsAtivas,
      trial: subsTrial,
      bloqueadas: subsBloqueadas,
      total: (subs || []).length
    },
    mensagensHoje: {
      total: msgsTotalHoje,
      inbound: msgsInboundHoje,
      outbound: msgsOutboundHoje,
      recentesInbound: recentInbounds || []
    },
    leads: {
      total: totalLeads,
      interessados: leadsInterested
    }
  }, null, 2));
}

runReport().catch(console.error);
