import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const envText = fs.readFileSync('.env', 'utf8');
const envVars = {};
for (const line of envText.split('\n')) {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
    const [k, ...v] = trimmed.split('=');
    envVars[k.trim()] = v.join('=').trim().replace(/^["']|["']$/g, '');
  }
}

const url = envVars.VITE_SUPABASE_URL || envVars.SUPABASE_URL;
const key = envVars.SUPABASE_SERVICE_ROLE_KEY || envVars.VITE_SUPABASE_ANON_KEY;
const sb = createClient(url, key);

async function resolvePendingRows() {
  const ids = [
    'b8856290-11ec-432f-b996-d8eedbd539db',
    'd04b8b9f-2093-46e9-aa57-a16d2302121c'
  ];

  for (const id of ids) {
    const { data: row } = await sb.from('tenant_feature_failures').select('*').eq('id', id).single();
    if (!row) continue;

    const { error } = await sb
      .from('tenant_feature_failures')
      .update({
        resolved_at: new Date().toISOString(),
        metadata: {
          ...(row.metadata || {}),
          auto_healed: true,
          resolved_by: 'antigravity_verification',
          resolution_reason: 'Foto de perfil (4.18 MB) foi reenviada com sucesso pelo zelador 26s após a oscilação inicial e está ativa em produção.',
          self_healing_status: 'resolved'
        }
      })
      .eq('id', id);

    if (error) {
      console.error(`Erro ao atualizar ${id}:`, error);
    } else {
      console.log(`Linha ${id} marcada como resolvida com sucesso!`);
    }
  }
}

resolvePendingRows();
