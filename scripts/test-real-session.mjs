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
const anonKey = env['VITE_SUPABASE_ANON_KEY'];
const serviceKey = env['SUPABASE_SERVICE_ROLE_KEY'];
const sbAdmin = createClient(url, serviceKey);

async function testWithRealSession() {
  const { data: link, error: lErr } = await sbAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email: 'vendasmercadolivrev1@gmail.com'
  });

  const token_hash = link?.properties?.hashed_token;
  console.log('token_hash:', Boolean(token_hash));

  // Verify OTP to get user access_token
  const sbClient = createClient(url, anonKey);
  const { data: sessionData, error: sErr } = await sbClient.auth.verifyOtp({
    token_hash,
    type: 'magiclink'
  });

  const accessToken = sessionData?.session?.access_token;
  console.log('User access_token obtained:', Boolean(accessToken), sErr?.message);

  if (!accessToken) return;

  const path = 'fad75b91-d2eb-4805-b5a3-c19e8a073bed/private/a1ad0338-e32e-4205-a95a-3998c5841157.pdf';
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');

  // Test exactly what cloudflare/pilot-library.js line 111 does:
  const targetUrl = `${url}/storage/v1/object/piloto_biblioteca_privada/${encodedPath}`;
  console.log('\nTesting exact pilot-library fetch:', targetUrl);
  const res = await fetch(targetUrl, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${accessToken}`
    }
  });

  console.log('Status code:', res.status);
  console.log('Headers:', Object.fromEntries(res.headers.entries()));
  const bodyText = await res.text();
  console.log('Body:', bodyText.slice(0, 300));

  // Test querying row with sbClient
  const { data: clientRows, error: crErr } = await sbClient
    .from('piloto_biblioteca_privada')
    .select('*');
  console.log('\nQuerying piloto_biblioteca_privada with sbClient:');
  console.log('Rows count:', clientRows?.length, 'Error:', crErr);
  if (clientRows?.length) console.log('First row:', clientRows[0]);

  // Test storage.objects query with sbClient
  const { data: objects, error: objErr } = await sbClient
    .schema('storage')
    .from('objects')
    .select('name, bucket_id');
  console.log('\nQuerying storage.objects with sbClient:');
  console.log('Objects:', objects, 'Error:', objErr);
}

testWithRealSession().catch(console.error);
