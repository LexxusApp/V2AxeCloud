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

function normalizeBrazilMsisdn(raw) {
  let digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) return digits;
  if (digits.startsWith("0") && digits.length >= 11) digits = digits.replace(/^0+/, "");
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return null;
}

async function checkLeaders() {
  const { data: leaders } = await sb
    .from('perfil_lider')
    .select('id, nome_terreiro, cargo, whatsapp, whatsapp_publico, email, is_blocked, deleted_at, role, is_admin_global')
    .is('deleted_at', null)
    .eq('is_blocked', false)
    .neq('email', 'lucasilvasiqueira@outlook.com.br'); // pula admin próprio

  const eligible = [];

  for (const l of leaders || []) {
    // skip obvious test houses
    if (l.nome_terreiro?.toLowerCase() === 'teste') continue;

    let phone = normalizeBrazilMsisdn(l.whatsapp || l.whatsapp_publico);

    if (!phone) {
      try {
        const { data: authUser } = await sb.auth.admin.getUserById(l.id);
        const metaWa = authUser?.user?.user_metadata?.whatsapp;
        if (metaWa) {
          phone = normalizeBrazilMsisdn(metaWa);
        }
      } catch {}
    }

    if (!phone) {
      const { data: lastLog } = await sb
        .from('whatsapp_logs')
        .select('telefone')
        .eq('tenant_id', l.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (lastLog?.telefone) {
        phone = normalizeBrazilMsisdn(lastLog.telefone);
      }
    }

    if (phone) {
      eligible.push({
        id: l.id,
        nome: l.cargo || 'Zelador',
        terreiro: l.nome_terreiro || 'Terreiro',
        phone,
        email: l.email
      });
    }
  }

  console.log(`Encontrados ${eligible.length} zeladores com WhatsApp válido:`);
  console.log(JSON.stringify(eligible, null, 2));
}

checkLeaders();
