import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envContent = fs.readFileSync('C:/Users/Lucas A/Desktop/AxecloudV2/AxecloudV2/.env', 'utf-8');
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
const sb = createClient(url, key);

async function checkNow() {
  // Pegar das últimas 4 horas até agora (05h00 às 09h00 BRT)
  const sinceIso = new Date(Date.now() - 4 * 3600 * 1000).toISOString();
  console.log('=== TELEMETRIA EM TEMPO REAL AXÉCLOUD ===');
  console.log('Horário da consulta:', new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }));
  console.log('Janela analisada (últimas 4h):', sinceIso);

  // 1. Falhas / Erros de uso
  const { data: failures } = await sb
    .from('access_logs')
    .select('created_at, description, metadata, target_id')
    .eq('event_type', 'feature.failure')
    .gte('created_at', sinceIso)
    .order('created_at', { ascending: false });

  console.log('\nTotal de falhas recentes (feature.failure):', failures?.length || 0);
  if (failures?.length) {
    console.log('Últimas falhas registradas:', JSON.stringify(failures.slice(0, 5), null, 2));
  }

  // 2. Erros na tabela app_errors
  const { data: appErrors } = await sb
    .from('app_errors')
    .select('*')
    .gte('created_at', sinceIso);
  console.log('Total de erros em app_errors:', appErrors?.length || 0);

  // 3. Logins recentes
  const { data: { users } } = await sb.auth.admin.listUsers({ page: 1, perPage: 25 });
  const recentLogins = users
    .filter(u => u.last_sign_in_at && u.last_sign_in_at >= sinceIso)
    .map(u => ({ email: u.email, last_sign_in: u.last_sign_in_at }));
  console.log('\nUsuários logados recentemente:', recentLogins);

  // 4. WhatsApp logs recentes
  const { data: waLogs } = await sb
    .from('whatsapp_logs')
    .select('created_at, tipo, status, telefone, mensagem')
    .gte('created_at', sinceIso)
    .order('created_at', { ascending: false });
  console.log('\nMensagens WhatsApp recentes:', waLogs?.length || 0);
  for (const w of (waLogs || []).slice(0, 5)) {
    console.log(`[${w.created_at}] ${w.tipo} -> ${w.telefone} (${w.status}) - ${w.mensagem?.slice(0, 60)}`);
  }

  // 5. WhatsApp deliveries recentes
  const { data: waDeliv } = await sb
    .from('whatsapp_deliveries')
    .select('created_at, template_name, status, recipient_phone, source')
    .gte('created_at', sinceIso)
    .order('created_at', { ascending: false });
  console.log('\nDeliveries oficiais recentes:', waDeliv?.length || 0);
  for (const d of (waDeliv || []).slice(0, 5)) {
    console.log(`[${d.created_at}] ${d.template_name} -> ${d.recipient_phone} (${d.status})`);
  }

  // 6. Tráfego geral no access_logs
  const { count: recentEvents } = await sb
    .from('access_logs')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', sinceIso);
  console.log('\nTotal de eventos de acesso (access_logs):', recentEvents);

  const { count: googleViews } = await sb
    .from('access_logs')
    .select('id', { count: 'exact', head: true })
    .eq('event_type', 'directory.profile_google_view')
    .gte('created_at', sinceIso);
  console.log('Visualizações vindas do Google:', googleViews);

  const { count: waClicks } = await sb
    .from('access_logs')
    .select('id', { count: 'exact', head: true })
    .eq('event_type', 'directory.whatsapp_click')
    .gte('created_at', sinceIso);
  console.log('Cliques no WhatsApp do Radar:', waClicks);

  // 7. Teste de saúde da API
  const t0 = Date.now();
  const res = await fetch('https://axecloud.com.br/api/health');
  console.log('\nHealth check /api/health agora:', res.status, `(${Date.now() - t0}ms)`);
}

checkNow().catch(console.error);
