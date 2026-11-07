const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../../../Desktop/AxecloudV2/AxecloudV2/.env') });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const s = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const now = new Date();
  const since = new Date(now - 45*60*1000).toISOString(); // last 45min

  // Recent logins
  const { data: logins } = await s.from('audit_logs')
    .select('created_at, details, tenant_id')
    .eq('action', 'auth.login_success')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(15);

  console.log('=== LOGINS (últimos 45min) ===');
  if (logins?.length) {
    logins.forEach(l => {
      const d = l.details || {};
      console.log(`[${new Date(l.created_at).toLocaleTimeString('pt-BR')}] ${d.nome || d.name || 'N/A'} | ${d.email || d.whatsapp || d.matricula || '?'} | tenant: ${l.tenant_id?.slice(0,8)}`);
    });
  } else {
    console.log('Nenhum login.');
  }

  // WhatsApp deliveries
  const { data: wa } = await s.from('whatsapp_deliveries')
    .select('created_at, status, recipient_phone, tenant_id, message_id')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(15);

  console.log('\n=== WHATSAPP DELIVERIES (últimos 45min) ===');
  if (wa?.length) {
    wa.forEach(w => {
      console.log(`[${new Date(w.created_at).toLocaleTimeString('pt-BR')}] ${w.recipient_phone} | ${w.status} | tenant: ${w.tenant_id?.slice(0,8)}`);
    });
  } else {
    console.log('Nenhum disparo.');
  }

  // whatsapp_logs recentes
  const { data: wl } = await s.from('whatsapp_logs')
    .select('created_at, status, recipient_name, recipient_phone, tenant_id, error_message')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(15);

  console.log('\n=== WHATSAPP LOGS (últimos 45min) ===');
  if (wl?.length) {
    wl.forEach(w => {
      console.log(`[${new Date(w.created_at).toLocaleTimeString('pt-BR')}] ${w.recipient_name || w.recipient_phone} | ${w.status}${w.error_message ? ' | ERR: '+w.error_message.slice(0,80) : ''}`);
    });
  } else {
    console.log('Nenhum log.');
  }

  // Erros recentes em audit_logs
  const { data: errs } = await s.from('audit_logs')
    .select('created_at, action, details')
    .or('action.like.%error%,action.like.%fail%')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(10);

  console.log('\n=== ERROS AUDIT (últimos 45min) ===');
  if (errs?.length) {
    errs.forEach(e => console.log(`[${new Date(e.created_at).toLocaleTimeString('pt-BR')}] ${e.action} | ${JSON.stringify(e.details).slice(0,100)}`));
  } else {
    console.log('Sem erros registrados.');
  }
}

check().catch(console.error);
