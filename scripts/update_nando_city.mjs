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
const sb = createClient(url, key);

async function updateNando() {
  const { data, error } = await sb
    .from('perfil_lider')
    .update({
      cidade: 'Rio de Janeiro',
      cidade_publica: 'Rio de Janeiro',
      estado_publico: 'RJ'
    })
    .eq('id', '283d4903-4303-4c99-92f3-24249bde61cb')
    .select();

  console.log('Updated leader:', data, 'error:', error);
}

updateNando().catch(console.error);
