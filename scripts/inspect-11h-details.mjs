import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envContent = fs.readFileSync('C:/Users/Lucas A/Desktop/AxecloudV2/AxecloudV2/.env', 'utf-8');
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

async function checkDetails() {
  const { data: deliv } = await sb
    .from('whatsapp_deliveries')
    .select('*')
    .eq('recipient_phone', '5521972517565')
    .order('created_at', { ascending: false });
  console.log('Deliveries para Élida (Ilé Alákétu Asé Aiyê Aféfé):', deliv);
}

checkDetails().catch(console.error);
