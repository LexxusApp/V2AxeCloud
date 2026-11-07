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

const ref = map['SUPABASE_PROJECT_REF'];
const token = map['SUPABASE_ACCESS_TOKEN'];

const cleanupSql = `
-- 1. Remove duplicatas mantendo apenas o primeiro registro criado de cada terreiro
DELETE FROM public.prospecting_leads
WHERE id NOT IN (
  SELECT DISTINCT ON (COALESCE(directory_id::text, phone_normalized, name)) id
  FROM public.prospecting_leads
  ORDER BY COALESCE(directory_id::text, phone_normalized, name), created_at ASC
);

-- 2. Limpa eventos órfãos caso algum tenha ficado sem lead
DELETE FROM public.prospecting_events
WHERE lead_id NOT IN (SELECT id FROM public.prospecting_leads);

-- 3. Cria índices únicos de proteção no banco
CREATE UNIQUE INDEX IF NOT EXISTS prospecting_leads_directory_id_uidx
  ON public.prospecting_leads (directory_id)
  WHERE directory_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS prospecting_leads_phone_norm_uidx
  ON public.prospecting_leads (phone_normalized)
  WHERE phone_normalized IS NOT NULL AND phone_normalized != '';

CREATE UNIQUE INDEX IF NOT EXISTS prospecting_leads_place_id_uidx
  ON public.prospecting_leads (google_place_id)
  WHERE google_place_id IS NOT NULL AND google_place_id != '';
`;

async function applyCleanup() {
  console.log('Applying database deduplication and unique index constraints...');
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query: cleanupSql }),
  });

  console.log('Status:', res.status, res.statusText);
  const text = await res.text();
  console.log('Result:', text);
}

applyCleanup();
