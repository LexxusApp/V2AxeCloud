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

const url = map['VITE_SUPABASE_URL'] || 'https://vlaojhfwhqmwudqsumpi.supabase.co';
const key = map['SUPABASE_SERVICE_ROLE_KEY'] || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZsYW9qaGZ3aHFtd3VkcXN1bXBpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTIwNDE2NCwiZXhwIjoyMDkwNzgwMTY0fQ.3BmBPr8C7LegYLaF4F4fWJOUvQblfbEeZKXMmOate9o';

async function getCount(table) {
  const res = await fetch(`${url}/rest/v1/${table}?select=*`, {
    method: 'HEAD',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Prefer: 'count=exact'
    }
  });
  const contentRange = res.headers.get('content-range');
  if (contentRange) {
    const parts = contentRange.split('/');
    return parts[1] || 'unknown';
  }
  return 'no-range';
}

async function main() {
  const [diretorioCount, leadsCount, msgsCount, patternsCount] = await Promise.all([
    getCount('terreiros_diretorio'),
    getCount('prospecting_leads'),
    getCount('admin_whatsapp_messages'),
    getCount('prospecting_learned_patterns')
  ]);

  console.log('Total em terreiros_diretorio:', diretorioCount);
  console.log('Total em prospecting_leads:', leadsCount);
  console.log('Total em admin_whatsapp_messages:', msgsCount);
  console.log('Total em prospecting_learned_patterns:', patternsCount);

  // Check recent interested leads
  const resInterested = await fetch(`${url}/rest/v1/prospecting_leads?status=eq.interested&select=id,name,phone,city,status,updated_at`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` }
  });
  console.log('\nLeads interessados:', await resInterested.json());

  // Check contacted leads today or yesterday
  const resContacted = await fetch(`${url}/rest/v1/prospecting_leads?status=eq.contacted&select=id,name,phone,city,updated_at&order=updated_at.desc&limit=10`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` }
  });
  console.log('\nÚltimos leads contactados:', await resContacted.json());
}

main().catch(console.error);
