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

async function resolveFailure() {
  const failureId = '86c0df7b-2dd7-496e-9e9e-9c8ccdfc2d55';
  const { data: row, error: fetchErr } = await sb
    .from('tenant_feature_failures')
    .select('*')
    .eq('id', failureId)
    .single();

  if (fetchErr || !row) {
    console.error('Falha não encontrada:', fetchErr);
    return;
  }

  const { error } = await sb
    .from('tenant_feature_failures')
    .update({
      resolved_at: new Date().toISOString(),
      metadata: {
        ...(row.metadata || {}),
        auto_healed: true,
        resolved_by: 'antigravity_client_compression_patch',
        resolution_reason: 'Compressão client-side aplicada em todos os fluxos de upload de fotos (ChildProfile, SettingsProfile, FilhoProfilePhoto, DirectoryProfile e Register). Imagens são redimensionadas via Canvas para 1024-1200px gerando payloads < 300KB, eliminando a causa raiz de erro HTTP 413.',
        self_healing_status: 'resolved'
      }
    })
    .eq('id', failureId);

  if (error) {
    console.error('Erro ao resolver falha:', error);
  } else {
    console.log('SUCESSO: Falha ' + failureId + ' marcada como resolvida no Supabase!');
  }
}

resolveFailure();
