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

async function main() {
  const { data: link, error: linkErr } = await sbAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email: 'vendasmercadolivrev1@gmail.com'
  });
  if (linkErr) throw linkErr;

  const sbClient = createClient(url, anonKey);
  const { data: sessionData, error: otpErr } = await sbClient.auth.verifyOtp({
    token_hash: link.properties.hashed_token,
    type: 'magiclink'
  });
  if (otpErr) throw otpErr;

  const accessToken = sessionData.session.access_token;
  const authHeaders = {
    Authorization: `Bearer ${accessToken}`,
    Origin: 'https://axecloud.com.br',
    'Content-Type': 'application/json'
  };

  console.log('1. Calling POST /api/pilot/interface-access...');
  const accessRes = await fetch('https://axecloud.com.br/api/pilot/interface-access', {
    method: 'POST',
    headers: authHeaders
  });
  console.log('Access status:', accessRes.status);
  const accessData = await accessRes.json();
  console.log('Access data:', accessData);

  const rawCookie = accessRes.headers.get('set-cookie');
  console.log('Set-Cookie received:', rawCookie ? rawCookie.split(';')[0] : 'None');

  const cookieHeader = rawCookie ? rawCookie.split(';')[0] : '';

  console.log('\n2. Fetching Pilot Subscription JS with authenticated cookie...');
  const chunkRes = await fetch('https://axecloud.com.br/assets/pilot-20261101/assets/SubscriptionPage-Dfl5kIBl.js', {
    headers: {
      ...authHeaders,
      Cookie: cookieHeader
    }
  });
  console.log('SubscriptionPage chunk status:', chunkRes.status);
  console.log('Content-Type:', chunkRes.headers.get('content-type'));
  console.log('Content-Length:', chunkRes.headers.get('content-length'));

  if (chunkRes.ok) {
    const text = await chunkRes.text();
    console.log('JS text sample (first 120 chars):', text.slice(0, 120));
    console.log('Contains SubscriptionPixDialog / Pix creation:', text.includes('Renovar assinatura via Pix') && text.includes('/api/v1/checkout/efi/pix'));
  }

  console.log('\n3. Fetching Pilot Subscription CSS with authenticated cookie...');
  const cssRes = await fetch('https://axecloud.com.br/assets/pilot-20261101/assets/SubscriptionPage-BtZldupC.css', {
    headers: {
      ...authHeaders,
      Cookie: cookieHeader
    }
  });
  console.log('SubscriptionPage CSS status:', cssRes.status);
  console.log('Content-Type:', cssRes.headers.get('content-type'));
  console.log('Content-Length:', cssRes.headers.get('content-length'));

  console.log('\n4. Simulating live Zelador generating Pix renewal via POST /api/v1/checkout/efi/pix...');
  const pixRes = await fetch('https://axecloud.com.br/api/v1/checkout/efi/pix', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      tenantId: 'fad75b91-d2eb-4805-b5a3-c19e8a073bed',
      purpose: 'renewal',
      billingCycle: 'monthly'
    })
  });
  console.log('Pix endpoint status:', pixRes.status);
  const pixData = await pixRes.json();
  console.log('Pix response summary:', {
    status: pixData.status,
    txid: pixData.txid,
    reused: pixData.reused,
    expiresIn: pixData.expiresIn,
    copyPasteLen: pixData.copyPaste?.length,
    hasQrCode: Boolean(pixData.qrCodeDataUrl)
  });

  if (pixData.txid) {
    console.log('\n5. Checking Pix polling status via GET /api/v1/checkout/efi/pix/:txid/status...');
    const statusRes = await fetch(`https://axecloud.com.br/api/v1/checkout/efi/pix/${pixData.txid}/status?tenantId=fad75b91-d2eb-4805-b5a3-c19e8a073bed`, {
      headers: authHeaders
    });
    console.log('Status endpoint status:', statusRes.status);
    const statusData = await statusRes.json();
    console.log('Polling result:', statusData);
  }
}

main().catch(console.error);
