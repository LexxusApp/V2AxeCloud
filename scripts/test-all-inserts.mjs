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

async function testAllInserts() {
  const dirRes = await fetch(`${url}/rest/v1/terreiros_diretorio?select=id,nome,endereco,telefone,cidade,estado,bairro,slug,link_maps,instagram_url,claimed_by_tenant_id&limit=10&order=created_at.desc`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  const dirRows = await dirRes.json();
  
  for (let i = 0; i < dirRows.length; i++) {
    const r = dirRows[i];
    console.log(`\nTesting item ${i + 1}: ${r.nome} (dir_id: ${r.id})`);
    const payload = {
      name: r.nome,
      city: r.cidade,
      state: r.estado,
      address: [r.endereco, r.bairro].filter(Boolean).join(', ') || null,
      phone: r.telefone,
      phone_normalized: r.telefone ? r.telefone.replace(/\D/g, '') : null,
      directory_id: r.id,
      terreiro_id: r.claimed_by_tenant_id || null,
      source: 'existing_axecloud_database',
      status: 'discovered',
      score: 0,
      whatsapp_opt_in: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const res = await fetch(`${url}/rest/v1/prospecting_leads`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify(payload),
    });

    console.log(`Status: ${res.status} ${res.statusText}`);
    const resText = await res.text();
    if (!res.ok) {
      console.error(`FAILED:`, resText);
    } else {
      console.log(`SUCCESS, id:`, JSON.parse(resText)[0]?.id);
      // Clean up the test row
      const createdId = JSON.parse(resText)[0]?.id;
      if (createdId) {
        await fetch(`${url}/rest/v1/prospecting_leads?id=eq.${createdId}`, {
          method: 'DELETE',
          headers: { apikey: key, Authorization: `Bearer ${key}` },
        });
      }
    }
  }
}

testAllInserts();
