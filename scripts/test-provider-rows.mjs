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

async function testProvider() {
  const params = new URLSearchParams({
    select: 'id,nome,endereco,telefone,cidade,estado,bairro,slug,link_maps,instagram_url,claimed_by_tenant_id',
    limit: '10',
    order: 'created_at.desc',
  });
  const res = await fetch(`${url}/rest/v1/terreiros_diretorio?${params.toString()}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  const rows = await res.json();
  console.log('Terreiros diretorio rows:', rows.map(r => ({
    id: r.id,
    nome: r.nome,
    cidade: r.cidade,
    endereco: r.endereco,
    bairro: r.bairro,
    telefone: r.telefone
  })));
}

testProvider();
