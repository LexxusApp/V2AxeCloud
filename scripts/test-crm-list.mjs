import fs from 'fs';

const envContent = fs.readFileSync('.env', 'utf-8');
const map = {};
envContent.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const idx = trimmed.indexOf('=');
    if (idx > 0) {
      map[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
    }
  }
});

const url = map['VITE_SUPABASE_URL'];
const key = map['SUPABASE_SERVICE_ROLE_KEY'];

async function testList() {
  const res = await fetch(`${url}/rest/v1/prospecting_leads?select=id,name,city,address,phone,phone_normalized,website,instagram,google_place_id&limit=5000`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
  });
  console.log('Status:', res.status);
  const rows = await res.json();
  console.log('Rows count:', rows.length);
  console.log('First 2 rows:', rows.slice(0, 2));
}

testList();
