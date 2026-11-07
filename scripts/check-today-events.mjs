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

async function checkEvents() {
  const todayStr = '2026-10-24T00:00:00.000Z';
  const { data: events, error } = await sb
    .from('prospecting_events')
    .select('*')
    .gte('created_at', todayStr)
    .order('created_at', { ascending: false });

  console.log(`Eventos de prospecção hoje (${todayStr.slice(0, 10)}): ${events?.length || 0}`);
  for (const e of events || []) {
    console.log(`[${e.created_at}] Type: ${e.event_type} | Lead: ${e.lead_id} | Payload:`, JSON.stringify(e.payload || {}));
  }
}

checkEvents().catch(console.error);
