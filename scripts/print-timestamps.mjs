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

async function printAllTimestamps() {
  const res = await fetch(`${url}/rest/v1/prospecting_leads?select=id,name,created_at&order=created_at.asc`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  const rows = await res.json();
  rows.forEach((r, idx) => console.log(`${idx + 1}. [${r.created_at}] ${r.name} (${r.id})`));
}

printAllTimestamps();
