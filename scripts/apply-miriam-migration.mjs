import fs from 'fs';

const envFile = fs.readFileSync('.env', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    value = value.trim().replace(/^["']|["']$/g, '');
    env[match[1]] = value;
  }
});

const ref = env.SUPABASE_PROJECT_REF;
const token = env.SUPABASE_ACCESS_TOKEN;

async function executeSql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query })
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

async function run() {
  console.log('Aplicando migration 20261103150000_pilot_expand_miriam.sql...');
  const sql = fs.readFileSync('supabase/migrations/20261103150000_pilot_expand_miriam.sql', 'utf8');
  await executeSql(sql);
  console.log('✅ Migration aplicada com sucesso no Supabase!');
}

run().catch(err => {
  console.error('❌ Falha:', err);
  process.exit(1);
});
