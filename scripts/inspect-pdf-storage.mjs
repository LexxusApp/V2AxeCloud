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

async function checkStorage() {
  const path = 'fad75b91-d2eb-4805-b5a3-c19e8a073bed/private/a1ad0338-e32e-4205-a95a-3998c5841157.pdf';
  const anonKey = env['VITE_SUPABASE_ANON_KEY'];
  const serviceKey = env['SUPABASE_SERVICE_ROLE_KEY'];

  // Test with /authenticated/ and anonKey
  const authObjectUrl = url + '/storage/v1/object/authenticated/piloto_biblioteca_privada/' + path;
  const resAnonAuth = await fetch(authObjectUrl, {
    headers: { apikey: anonKey, Authorization: 'Bearer ' + anonKey }
  });
  console.log('Fetch /authenticated with anonKey:', resAnonAuth.status, await resAnonAuth.text());

  // Test with non-authenticated /object/ and anonKey
  const nonAuthObjectUrl = url + '/storage/v1/object/piloto_biblioteca_privada/' + path;
  const resNonAuth = await fetch(nonAuthObjectUrl, {
    headers: { apikey: anonKey, Authorization: 'Bearer ' + anonKey }
  });
  console.log('Fetch /object with anonKey:', resNonAuth.status, await resNonAuth.text());
}

checkStorage().catch(console.error);
