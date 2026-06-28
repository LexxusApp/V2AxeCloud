/**
 * Configura SMTP + URLs de auth no projeto Supabase remoto (Management API).
 * Uso (não commitar credenciais):
 *   SMTP_USER=... SMTP_PASS=... SMTP_ADMIN_EMAIL=... node scripts/configure-supabase-auth-smtp.mjs
 * Token: SUPABASE_ACCESS_TOKEN ou arquivo do Supabase CLI (~/.supabase/access-token).
 */
import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const PROJECT_REF = 'vlaojhfwhqmwudqsumpi';
const SITE_URL = 'https://axecloud.com.br';
const REDIRECT_URLS = [`${SITE_URL}/entrar`, `${SITE_URL}/redefinir-senha`];

function readAccessToken() {
  if (process.env.SUPABASE_ACCESS_TOKEN?.trim()) {
    return process.env.SUPABASE_ACCESS_TOKEN.trim();
  }
  const candidates = [
    join(process.env.APPDATA || '', 'supabase', 'access-token'),
    join(homedir(), '.supabase', 'access-token'),
    join(homedir(), 'AppData', 'Roaming', 'supabase', 'access-token'),
  ];
  for (const path of candidates) {
    if (existsSync(path)) {
      return readFileSync(path, 'utf8').trim();
    }
  }
  throw new Error('SUPABASE_ACCESS_TOKEN não encontrado. Gere em https://supabase.com/dashboard/account/tokens');
}

async function main() {
  const smtpUser = String(process.env.SMTP_USER || '').trim();
  const smtpPass = String(process.env.SMTP_PASS || '').replace(/\s+/g, '');
  const smtpAdmin = String(process.env.SMTP_ADMIN_EMAIL || smtpUser).trim();

  if (!smtpUser || !smtpPass) {
    console.error('Defina SMTP_USER e SMTP_PASS no ambiente.');
    process.exit(1);
  }

  const token = readAccessToken();
  const payload = {
    external_email_enabled: true,
    smtp_host: 'smtp.gmail.com',
    smtp_port: 587,
    smtp_user: smtpUser,
    smtp_pass: smtpPass,
    smtp_admin_email: smtpAdmin,
    smtp_sender_name: 'AxéCloud',
    site_url: SITE_URL,
    uri_allow_list: REDIRECT_URLS.join('\n'),
  };

  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  if (!res.ok) {
    console.error('Falha ao configurar auth SMTP:', res.status, text.slice(0, 500));
    process.exit(1);
  }

  console.log('OK — SMTP Gmail + URLs de redirect configurados no Supabase.');
  console.log('Site URL:', SITE_URL);
  console.log('Redirect URLs:', REDIRECT_URLS.join(', '));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
