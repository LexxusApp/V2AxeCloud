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

async function checkLeads() {
  const todayStr = '2026-10-24T00:00:00.000Z';
  const { data: contactedToday } = await sb
    .from('prospecting_leads')
    .select('id, name, phone, city, state, status, last_contacted_at, notes')
    .gte('last_contacted_at', todayStr)
    .order('last_contacted_at', { ascending: false });

  console.log(`Leads contatados hoje (${todayStr.slice(0, 10)}): ${contactedToday?.length || 0}`);
  
  const statusCounts = {};
  for (const l of contactedToday || []) {
    statusCounts[l.status] = (statusCounts[l.status] || 0) + 1;
    console.log(`- ${l.name} (${l.phone} - ${l.city}/${l.state}): status=${l.status} | notes=${l.notes || ''}`);
  }

  console.log('\nDistribuição de status dos contatados hoje:', statusCounts);
}

checkLeads().catch(console.error);
