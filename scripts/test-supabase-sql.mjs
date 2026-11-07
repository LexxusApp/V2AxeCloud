import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });

async function testSupabaseApi() {
  const ref = process.env.SUPABASE_PROJECT_REF;
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  console.log('Project Ref:', ref);
  console.log('Token exists?', !!token);

  if (!token || !ref) {
    console.error('Missing ref or token');
    return;
  }

  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query: 'SELECT current_database(), current_user;' })
  });

  console.log('Status:', res.status);
  const data = await res.json().catch(() => null);
  console.log('Result:', data);
}

testSupabaseApi();
