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

async function main() {
  const res = await fetch(`${url}/rest/v1/admin_whatsapp_messages?created_at=gte.2026-10-08T00:00:00Z&order=created_at.desc`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` }
  });
  const msgs = await res.json();
  console.log(`Total de mensagens criadas hoje (08/10): ${msgs.length}`);
  msgs.forEach(m => {
    console.log(`[${m.created_at}] Dir: ${m.direction} | Status: ${m.status} | Body/Template: ${m.body?.slice(0, 90)}`);
  });
}

main().catch(console.error);
