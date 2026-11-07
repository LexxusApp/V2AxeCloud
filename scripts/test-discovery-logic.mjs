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

async function testDiscoveryBatch() {
  // 1. Get imported IDs
  const existingLeadsRes = await fetch(`${url}/rest/v1/prospecting_leads?select=directory_id&directory_id=not.is.null&limit=10000`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  const existingLeads = await existingLeadsRes.json();
  const importedIds = new Set(existingLeads.map(l => l.directory_id).filter(Boolean));
  console.log('Imported IDs count:', importedIds.size);

  // 2. Fetch page 1 (limit 200, offset 0)
  const dirRes = await fetch(`${url}/rest/v1/terreiros_diretorio?select=id,nome,cidade,estado,telefone&limit=200&offset=0&order=created_at.desc`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  const dirRows = await dirRes.json();
  console.log('Fetched from diretorio:', dirRows.length);

  const unimported = dirRows.filter(r => !importedIds.has(r.id));
  console.log('Unimported in this batch:', unimported.length);
  if (unimported.length > 0) {
    console.log('First 3 unimported:', unimported.slice(0, 3));
  }
}

testDiscoveryBatch().catch(console.error);
