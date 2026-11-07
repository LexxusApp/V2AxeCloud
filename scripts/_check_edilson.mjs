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

async function check() {
  const { data: lead } = await sb.from('prospecting_leads').select('*').ilike('phone', '%933005105%').maybeSingle();
  console.log('--- LEAD NO CRM ---');
  console.log(lead);

  const { data: users, error: userErr } = await sb.auth.admin.listUsers();
  const existingUser = users?.users?.find(u => u.email?.toLowerCase() === 'axeogumoxumdey@gmail.com');
  console.log('--- USUARIO AUTH EXISTENTE? ---', existingUser ? existingUser.id : 'NÃO');
}

check().catch(console.error);
