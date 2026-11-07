import * as dotenv from 'dotenv';
import fs from 'fs';
dotenv.config({ path: 'C:/Users/Lucas A/Desktop/AxecloudV2/AxecloudV2/.env' });

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

async function inspectPolicies() {
  const sql = `
    SELECT proname, prosrc 
    FROM pg_proc 
    WHERE proname = 'operation' AND pronamespace = 'storage'::regnamespace;
  `;
  const procs = await executeSql(sql);
  console.log('storage.operation definition:');
  console.log(JSON.stringify(procs, null, 2));
}

inspectPolicies().catch(console.error);
