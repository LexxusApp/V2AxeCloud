import fs from 'fs';
import { checkLeadDuplicate } from '../cloudflare/prospect-worker/src/deduplication/leadDeduplicator.js';

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

async function debugDedup() {
  // 1. Fetch rawLeads from terreiros_diretorio (just like ExistingAxeCloudDbProvider does)
  const dirRes = await fetch(`${url}/rest/v1/terreiros_diretorio?select=id,nome,endereco,telefone,cidade,estado,bairro,slug,link_maps,instagram_url,claimed_by_tenant_id&limit=5&order=created_at.desc`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  const dirRows = await dirRes.json();
  const rawLeads = dirRows.map(r => ({
    name: r.nome,
    city: r.cidade,
    state: r.estado,
    address: [r.endereco, r.bairro].filter(Boolean).join(', ') || null,
    phone: r.telefone,
    instagram: r.instagram_url,
    google_place_id: null,
    directory_id: r.id,
    terreiro_id: r.claimed_by_tenant_id || null,
    source: 'existing_axecloud_database',
  }));

  // 2. Fetch existingList from prospecting_leads (just like crm.listAllCandidatesForDedup does)
  const dedupRes = await fetch(`${url}/rest/v1/prospecting_leads?select=id,name,city,address,phone,phone_normalized,website,instagram,google_place_id&limit=5000`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  const existingList = await dedupRes.json();

  console.log(`existingList count from DB: ${existingList.length}`);
  console.log(`rawLeads count: ${rawLeads.length}`);

  for (const raw of rawLeads) {
    const dupResult = checkLeadDuplicate(raw, existingList);
    console.log(`Lead "${raw.name}": isDuplicate = ${dupResult.isDuplicate}, reason = ${dupResult.matchReason}`);
  }
}

debugDedup();
