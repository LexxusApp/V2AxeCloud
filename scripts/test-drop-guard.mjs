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

async function fixAndTest() {
  console.log('Dropping pilot_pdf_operation_guard...');
  await executeSql('DROP POLICY IF EXISTS pilot_pdf_operation_guard ON storage.objects;');
  console.log('Dropped policy!');

  // Now run test-real-session to see if download works!
  const { execSync } = await import('child_process');
  const out = execSync('node scripts/test-real-session.mjs', { encoding: 'utf8' });
  console.log('Result of test-real-session:\n', out);
}

fixAndTest().catch(console.error);
