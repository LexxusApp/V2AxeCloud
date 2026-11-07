import * as dotenv from 'dotenv';
import fs from 'fs';
dotenv.config({ path: '.env' });

const ref = process.env.SUPABASE_PROJECT_REF;
const token = process.env.SUPABASE_ACCESS_TOKEN;

async function executeSql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query })
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`HTTP ${res.status}: ${err}`);
  }
  return await res.json().catch(() => null);
}

async function run() {
  console.log('Aplicando migration 20261106180000_pilot_coadministradores.sql...');
  const sql = fs.readFileSync('supabase/migrations/20261106180000_pilot_coadministradores.sql', 'utf8');
  await executeSql(sql);
  console.log('✅ Migration aplicada com sucesso no Supabase!');
}

run().catch(err => {
  console.error('❌ Falha:', err);
  process.exit(1);
});
