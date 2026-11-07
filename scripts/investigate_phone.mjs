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

async function run() {
  console.log('Searching for 982528566 or 98252-8566...');
  
  // 1. prospecting_leads
  const { data: leads } = await sb.from('prospecting_leads').select('*').or('phone.ilike.%982528566%,phone.ilike.%98252-8566%,phone.ilike.%98252%');
  console.log('Leads found:', leads);

  // 2. perfil_lider
  const { data: leaders } = await sb.from('perfil_lider').select('*');
  const matchingLeaders = leaders.filter(l => JSON.stringify(l).includes('98252') || JSON.stringify(l).includes('8566'));
  console.log('Matching Leaders:', matchingLeaders);

  // 3. terreiros
  const { data: terreiros } = await sb.from('terreiros').select('*');
  const matchingTerreiros = terreiros.filter(t => JSON.stringify(t).includes('98252') || JSON.stringify(t).includes('8566'));
  console.log('Matching Terreiros:', matchingTerreiros);

  // 4. membros
  const { data: membros } = await sb.from('membros').select('id, nome, telefone, tenant_id, role, email').or('telefone.ilike.%98252%,telefone.ilike.%8566%');
  console.log('Matching Membros:', membros);

  // 5. check whatsapp_conversations / logs
  try {
    const { data: wa } = await sb.from('whatsapp_logs').select('*').or('to_phone.ilike.%982528566%,phone.ilike.%982528566%').limit(10);
    console.log('Matching WA logs:', wa);
  } catch (e) {
    console.log('WA logs error or not exist:', e.message);
  }
}

run().catch(console.error);
