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

async function findLead() {
  const leadId = '6c5b8026-6dc7-4b2d-acd2-3e7141431683';
  const { data: pLead } = await sb.from('prospecting_leads').select('*').eq('id', leadId).maybeSingle();
  console.log('prospecting_leads:', pLead);
  if (!pLead) {
    const { data: gLead } = await sb.from('growth_prospects').select('*').eq('id', leadId).maybeSingle();
    console.log('growth_prospects:', gLead);
  }
}

findLead().catch(console.error);
