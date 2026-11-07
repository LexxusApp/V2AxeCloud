import * as dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
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

async function checkStatus() {
  console.log('=== VERIFICANDO STATUS DAS TABELAS E FUNÇÕES DO PILOTO ===');

  const checkObjectsSql = `
    SELECT
      table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name LIKE 'piloto_%';
  `;
  const tables = await executeSql(checkObjectsSql);
  console.log('Tabelas piloto existentes:', tables.map(t => t.table_name));

  const checkRpcsSql = `
    SELECT routine_name
    FROM information_schema.routines
    WHERE routine_schema = 'public' AND routine_name LIKE 'piloto_%';
  `;
  const rpcs = await executeSql(checkRpcsSql);
  console.log('RPCs piloto existentes:', rpcs.map(r => r.routine_name));

  // Verificar tabela supabase_migrations se existir
  const checkMigrationsTable = `
    SELECT table_name FROM information_schema.tables WHERE table_name = 'schema_migrations' OR table_name = 'supabase_migrations';
  `;
  const migTable = await executeSql(checkMigrationsTable);
  console.log('Tabela de controle de migrations:', migTable);
}

checkStatus();
