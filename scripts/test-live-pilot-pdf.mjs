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

async function testLivePilotEndpoint() {
  const { data: link } = await sbAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email: 'vendasmercadolivrev1@gmail.com'
  });

  const sbClient = createClient(url, anonKey);
  const { data: sessionData } = await sbClient.auth.verifyOtp({
    token_hash: link.properties.hashed_token,
    type: 'magiclink'
  });

  const accessToken = sessionData.session.access_token;
  const path = 'fad75b91-d2eb-4805-b5a3-c19e8a073bed/private/a1ad0338-e32e-4205-a95a-3998c5841157.pdf';

  const liveUrl = `https://axecloud.com.br/api/pilot/library/pdf-proxy?tenantId=fad75b91-d2eb-4805-b5a3-c19e8a073bed&path=${encodeURIComponent(path)}`;
  console.log('Fetching live Cloudflare endpoint:', liveUrl);

  const res = await fetch(liveUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Origin: 'https://axecloud.com.br'
    }
  });

  console.log('Status code live:', res.status);
  console.log('Content-Type:', res.headers.get('content-type'));
  console.log('Content-Length:', res.headers.get('content-length'));
  console.log('Content-Disposition:', res.headers.get('content-disposition'));
}

testLivePilotEndpoint().catch(console.error);
