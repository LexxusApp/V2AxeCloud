import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

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

const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

async function checkTerreiro() {
  const tenantId = '283d4903-4303-4c99-92f3-24249bde61cb';
  console.log('=== INVESTIGATING TENANT:', tenantId, '===');

  // 1. Perfil Líder
  const { data: leader } = await sb.from('perfil_lider').select('*').eq('id', tenantId).single();
  console.log('\n--- PERFIL LIDER ---');
  console.log(leader);

  // 2. Subscriptions
  const { data: subs } = await sb.from('subscriptions').select('*').eq('user_id', tenantId);
  console.log('\n--- SUBSCRIPTIONS ---');
  console.log(subs);

  // 3. Pix Config (Terreiro Pix config)
  try {
    const { data: pixConfig } = await sb.from('pix_config').select('*').eq('tenant_id', tenantId);
    console.log('\n--- PIX CONFIG ---');
    console.log(pixConfig);
  } catch (e) {
    console.log('pix_config error:', e.message);
  }

  // 4. Mensalidades / Cobranças
  try {
    const { data: mens } = await sb.from('mensalidades').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(10);
    console.log('\n--- MENSALIDADES ---');
    console.log(mens);
  } catch (e) {
    console.log('mensalidades error:', e.message);
  }

  // 5. Cobrancas
  try {
    const { data: cobrancas } = await sb.from('cobrancas').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(10);
    console.log('\n--- COBRANCAS ---');
    console.log(cobrancas);
  } catch (e) {
    console.log('cobrancas error:', e.message);
  }

  // 6. Asaas / Gateways logs or payments
  try {
    const { data: asaas } = await sb.from('asaas_customers').select('*').eq('user_id', tenantId);
    console.log('\n--- ASAAS CUSTOMERS ---');
    console.log(asaas);
  } catch (e) {
    console.log('asaas error:', e.message);
  }

  // 7. Membros
  const { data: membros } = await sb.from('membros').select('id, nome, email, telefone, role, status').eq('tenant_id', tenantId);
  console.log('\n--- MEMBROS --- (count:', membros?.length, ')');
  console.log(membros?.slice(0, 5));

  // 8. Failures in tenant_feature_failures
  const { data: fails } = await sb.from('tenant_feature_failures').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(10);
  console.log('\n--- FAILURES IN LOGS ---');
  console.log(fails);
}

checkTerreiro().catch(console.error);
