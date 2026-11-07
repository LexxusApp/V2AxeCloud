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
const sb = createClient(url, serviceKey);

async function testUserDownload() {
  const tid = 'fad75b91-d2eb-4805-b5a3-c19e8a073bed';
  const filePath = 'fad75b91-d2eb-4805-b5a3-c19e8a073bed/private/a1ad0338-e32e-4205-a95a-3998c5841157.pdf';
  const encodedPath = filePath.split('/').map(encodeURIComponent).join('/');

  // Let's create a jwt signed with supabase jwt secret
  // Where is SUPABASE_JWT_SECRET? Let's check .env
  const jwtSecret = env['SUPABASE_JWT_SECRET'];
  console.log('JWT secret exists:', Boolean(jwtSecret));

  // Or let's use supabase admin to sign in or create user session
  // Actually, let's check what auth user tokens exist or test with jsonwebtoken
  const jwt = await import('jsonwebtoken');
  const token = jwt.default.sign({
    aud: 'authenticated',
    role: 'authenticated',
    sub: tid,
    email: 'vendasmercadolivrev1@gmail.com',
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: { role: 'admin' },
  }, jwtSecret || env['SUPABASE_SERVICE_ROLE_KEY'], { expiresIn: '1h' });

  // Test 1: /storage/v1/object/piloto_biblioteca_privada/...
  const normalUrl = `${url}/storage/v1/object/piloto_biblioteca_privada/${encodedPath}`;
  const r1 = await fetch(normalUrl, {
    headers: { apikey: anonKey, Authorization: `Bearer ${token}` }
  });
  console.log('normalUrl with user token:', r1.status, await r1.text());

  // Test 2: /storage/v1/object/authenticated/piloto_biblioteca_privada/...
  const authUrl = `${url}/storage/v1/object/authenticated/piloto_biblioteca_privada/${encodedPath}`;
  const r2 = await fetch(authUrl, {
    headers: { apikey: anonKey, Authorization: `Bearer ${token}` }
  });
  console.log('authUrl with user token:', r2.status, await r2.text());
}

testUserDownload().catch(console.error);
