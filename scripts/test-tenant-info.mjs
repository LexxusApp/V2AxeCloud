import fs from 'fs';

const envFile = fs.readFileSync('.env', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    value = value.trim().replace(/^['"]|['"]$/g, '');
    env[match[1]] = value;
  }
});

const ref = env.SUPABASE_PROJECT_REF;
const token = env.SUPABASE_ACCESS_TOKEN;

async function query(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query: sql })
  });
  return await res.json();
}

async function main() {
  const tenantId = '5de04732-9419-4ef5-8558-7287ed140e79';
  console.log('Testing what resolveLeaderId or tenant-info does for this user:');
  const user = await query(`select id, email, raw_user_meta_data from auth.users where id = '${tenantId}' or email = 'tenda.umbanda.oca@gmail.com'`);
  console.log('auth.users:', user);

  const perfil = await query(`select id, tenant_id, email, is_blocked, access_block_reason, access_blocked_at from public.perfil_lider where id = '${tenantId}'`);
  console.log('perfil_lider block status:', perfil);

  const sub = await query(`select id, status, expires_at from public.subscriptions where id = '${tenantId}'`);
  console.log('subscription:', sub);
}

main().catch(console.error);
