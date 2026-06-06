/**
 * Valida checkout EFI autenticado para casa fundadora (R$ 49,90).
 * Usa Supabase service role + magic link para obter JWT do zelador fundador.
 *
 * Requer no .env: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
 */
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config();

const url = process.env.VITE_SUPABASE_URL?.trim();
const anonKey = process.env.VITE_SUPABASE_ANON_KEY?.trim();
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const apiBase = (process.env.AXE_API_URL || 'https://axecloud.com.br').replace(/\/$/, '');
const founderEmail = process.env.AXE_FOUNDER_TEST_EMAIL?.trim() || 'terreiro1@axecloud.com';
const founderLeaderId = process.env.AXE_FOUNDER_LEADER_ID?.trim() || 'a90db681-e55f-4668-8715-34e23ffbb591';

if (!url || !anonKey || !serviceKey) {
  console.error('Faltam VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY ou SUPABASE_SERVICE_ROLE_KEY no .env');
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const anon = createClient(url, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
  type: 'magiclink',
  email: founderEmail,
});

if (linkErr || !linkData?.properties?.hashed_token) {
  console.error('generateLink falhou:', linkErr?.message || linkData);
  process.exit(1);
}

const { data: sessionData, error: otpErr } = await anon.auth.verifyOtp({
  type: 'magiclink',
  token_hash: linkData.properties.hashed_token,
});

if (otpErr || !sessionData.session?.access_token) {
  console.error('verifyOtp falhou:', otpErr?.message || sessionData);
  process.exit(1);
}

const token = sessionData.session.access_token;
const userId = sessionData.session.user.id;

console.log(`[auth] ${founderEmail} → user ${userId}`);

const cfgRes = await fetch(`${apiBase}/api/v1/checkout/efi/config`, {
  headers: { Authorization: `Bearer ${token}` },
  cache: 'no-store',
});

if (!cfgRes.ok) {
  console.error('checkout/efi/config HTTP', cfgRes.status, await cfgRes.text());
  process.exit(1);
}

const cfg = await cfgRes.json();
console.log('[checkout/efi/config]', JSON.stringify(cfg, null, 2));

const founderRes = await fetch(`${apiBase}/api/v1/founder-program/me`, {
  headers: { Authorization: `Bearer ${token}` },
  cache: 'no-store',
});

let isFounder = false;
if (founderRes.ok) {
  const founder = await founderRes.json();
  isFounder = !!founder.isFounderHouse;
  console.log('[founder-program/me]', JSON.stringify(founder, null, 2));
}

const okAmount = cfg.amountCents === 4990 && cfg.amountLabel === 'R$ 49,90';
const okUser = userId === founderLeaderId;

if (!okAmount) {
  console.error(`FALHA: esperado amountCents=4990 e R$ 49,90; recebido ${cfg.amountCents} / ${cfg.amountLabel}`);
  process.exit(1);
}

if (!isFounder) {
  console.warn('AVISO: founder/house-status não retornou isFounderHouse=true (verifique leader_id)');
}

if (!okUser) {
  console.warn(`AVISO: userId ${userId} difere do leader_id esperado ${founderLeaderId}`);
}

console.log('OK — checkout fundador autenticado: R$ 49,90 (4990 centavos)');
