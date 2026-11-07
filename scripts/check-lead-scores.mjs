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

async function checkScores() {
  const res = await fetch(`${url}/rest/v1/prospecting_leads?select=id,name,status,score&limit=20`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  const leads = await res.json();
  console.log('Sample leads and scores:');
  leads.forEach(l => {
    console.log(`- ${l.name} | Status: ${l.status} | Score: ${l.score}`);
  });

  // Check counts grouped by status
  const resAll = await fetch(`${url}/rest/v1/prospecting_leads?select=status,score`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  const all = await resAll.json();
  const statusCounts = {};
  let scoredCount = 0;
  all.forEach(l => {
    statusCounts[l.status] = (statusCounts[l.status] || 0) + 1;
    if (l.score !== null && l.score !== undefined && l.score > 0) scoredCount++;
  });
  console.log('\nStatus counts in DB:', statusCounts);
  console.log(`Scored leads: ${scoredCount} of ${all.length}`);
}

checkScores().catch(console.error);
