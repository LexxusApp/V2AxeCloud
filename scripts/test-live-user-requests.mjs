import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envContent = fs.readFileSync('.env', 'utf-8');
const map = {};
envContent.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const idx = trimmed.indexOf('=');
    if (idx > 0) map[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
  }
});

const url = map['VITE_SUPABASE_URL'];
const key = map['SUPABASE_SERVICE_ROLE_KEY'];
const sb = createClient(url, key);

async function testWithUserToken() {
  const email = 'vendasmercadolivrev1@gmail.com';
  // Generate magic link or sign in token
  const { data: linkData, error: linkErr } = await sb.auth.admin.generateLink({
    type: 'magiclink',
    email: email
  });
  if (linkErr) {
    console.error("Link error:", linkErr);
    return;
  }
  const tokenHash = linkData.properties.hashed_token;
  console.log("Token generated for:", email);

  // Exchange hashed token for session via verifyOtp
  const { data: sessionData, error: sessionErr } = await sb.auth.verifyOtp({
    token_hash: tokenHash,
    type: 'magiclink'
  });

  if (sessionErr || !sessionData.session) {
    console.error("Session error:", sessionErr);
    return;
  }

  const accessToken = sessionData.session.access_token;
  console.log("Got access token! Length:", accessToken.length);

  const tenantId = '4b167a21-d208-4f36-8b97-692f9c8e44a3';

  console.log("\n--- Calling GET /api/events ---");
  const eventsUrl = `https://axecloud.com.br/api/events?tenantId=${tenantId}&start=2026-10-10&end=2026-10-17&scope=calendar`;
  const resEvents = await fetch(eventsUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });
  console.log("Events HTTP Status:", resEvents.status);
  console.log("Events Body:", await resEvents.text());

  console.log("\n--- Calling GET /api/v1/atendimentos/pedidos-reza ---");
  const rezaUrl = `https://axecloud.com.br/api/v1/atendimentos/pedidos-reza?tenantId=${tenantId}`;
  const resReza = await fetch(rezaUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });
  console.log("Pedidos Reza HTTP Status:", resReza.status);
  console.log("Pedidos Reza Body:", await resReza.text());
}

testWithUserToken();
