import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('.env', 'utf8');
const env = {};
for (const line of envContent.split('\n')) {
  const idx = line.indexOf('=');
  if (idx > 0 && !line.trim().startsWith('#')) {
    env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
}
const sb = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY);

function cleanLeaderName(name, email) {
  let n = String(name || '').trim();
  if (!n || n.toLowerCase().includes('zelador de santo') || n.toLowerCase() === 'zelador' || n.toLowerCase() === 'dirigente' || n.toLowerCase() === 'ialorixá' || n.toLowerCase() === 'babalorixá' || n.length > 30) {
    // If it's generic, let's see if we can derive a clean friendly title or name
    if (n.toLowerCase().includes('(mãe de santo)')) return 'Mãe de Santo';
    if (n.toLowerCase().includes('(pai de santo)')) return 'Pai de Santo';
  }
  // Remove email or newlines if present
  n = n.split('\n')[0].trim();
  if (n.includes('@')) return 'Zelador(a)';
  return n;
}

function cleanTerreiroName(name) {
  let n = String(name || '').trim();
  // If it has multiple lines or email, take the actual name
  const lines = n.split('\n').map(l => l.trim()).filter(l => l && !l.includes('@'));
  if (lines.length > 0) return lines[lines.length - 1];
  return n;
}

async function prepareList() {
  const { data: leaders } = await sb
    .from('perfil_lider')
    .select('id, nome_terreiro, cargo, whatsapp, whatsapp_publico, email, is_blocked, deleted_at, role, is_admin_global')
    .is('deleted_at', null)
    .eq('is_blocked', false)
    .neq('email', 'lucasilvasiqueira@outlook.com.br');

  const list = [];

  for (const l of leaders || []) {
    if (l.nome_terreiro?.toLowerCase() === 'teste') continue;

    let rawPhone = l.whatsapp || l.whatsapp_publico;
    if (!rawPhone) {
      try {
        const { data: authUser } = await sb.auth.admin.getUserById(l.id);
        rawPhone = authUser?.user?.user_metadata?.whatsapp;
      } catch {}
    }
    if (!rawPhone) {
      const { data: lastLog } = await sb
        .from('whatsapp_logs')
        .select('telefone')
        .eq('tenant_id', l.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (lastLog?.telefone) rawPhone = lastLog.telefone;
    }

    let digits = String(rawPhone || '').replace(/\D/g, '');
    if (digits.startsWith('0') && digits.length >= 11) digits = digits.replace(/^0+/, '');
    if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;

    // Meta WhatsApp Cloud API exige celular válido: 55 + 2 DDD + 9 dígitos = 13 dígitos
    // DDDs válidos no Brasil: 11 a 99
    if (digits.length !== 13) {
      console.log(`IGNORANDO (número incompleto/inválido: ${digits}): ${l.cargo} - ${l.nome_terreiro}`);
      continue;
    }

    const nome = cleanLeaderName(l.cargo, l.email);
    const terreiro = cleanTerreiroName(l.nome_terreiro);

    list.push({
      id: l.id,
      nome,
      terreiro,
      phone: digits,
      email: l.email
    });
  }

  console.log(`\nTOTAL DE DISPAROS VÁLIDOS: ${list.length}`);
  console.log(JSON.stringify(list, null, 2));
}

prepareList();
