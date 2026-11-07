import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const envText = fs.readFileSync('.env', 'utf8');
const envVars = {};
for (const line of envText.split('\n')) {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
    const [k, ...v] = trimmed.split('=');
    envVars[k.trim()] = v.join('=').trim().replace(/^["']|["']$/g, '');
  }
}

const url = envVars.VITE_SUPABASE_URL || envVars.SUPABASE_URL;
const key = envVars.SUPABASE_SERVICE_ROLE_KEY || envVars.VITE_SUPABASE_ANON_KEY;
const sb = createClient(url, key);

async function checkAllContactedToday() {
  const todayStr = '2026-10-24T00:00:00.000Z';
  const { data: contactedToday, error } = await sb
    .from('prospecting_leads')
    .select('id, name, phone, city, state, status, last_contact_at, score')
    .gte('last_contact_at', todayStr)
    .order('last_contact_at', { ascending: false });

  console.log(`=== PROSPECÇÃO ATIVA DE HOJE (2026-10-24) ===`);
  console.log(`Total de terreiros abordados hoje: ${contactedToday?.length || 0}\n`);

  const statusMap = {};
  for (const l of contactedToday || []) {
    statusMap[l.status] = (statusMap[l.status] || 0) + 1;
    console.log(`[${l.last_contact_at.slice(11, 19)}] ${l.name} | ${l.phone} | ${l.city}/${l.state} | Status: ${l.status}`);
  }

  console.log(`\nResumo por status:`, statusMap);

  // Verificar todos os leads da base que estão com status de interessados / respondeu / etc.
  const { data: allEngaged } = await sb
    .from('prospecting_leads')
    .select('id, name, phone, city, state, status, last_contact_at, updated_at')
    .in('status', ['interested', 'responded', 'qualified', 'trial', 'converted'])
    .order('updated_at', { ascending: false })
    .limit(30);

  console.log(`\n=== LEADS ENGAJADOS RECENTES (ÚLTIMOS 30) ===`);
  for (const l of allEngaged || []) {
    console.log(`- ${l.name} (${l.phone} - ${l.city}/${l.state}): status=${l.status} | updated=${l.updated_at}`);
  }
}

checkAllContactedToday().catch(console.error);
