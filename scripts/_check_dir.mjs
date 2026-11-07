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
  const { data: dir } = await sb.from('terreiros_diretorio').select('*').eq('id', 'c832bdda-e506-4141-b287-2a29d956705e').maybeSingle();
  console.log('--- TERREIROS DIRETORIO ---');
  console.log(dir);
}

check().catch(console.error);
