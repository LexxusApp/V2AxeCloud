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

const token = env.WA_META_TOKEN || env.META_WHATSAPP_ACCESS_TOKEN;
const phoneId = env.WA_PHONE_NUMBER_ID || env.META_WHATSAPP_PHONE_NUMBER_ID;
const sb = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY);

const TEMPLATE_NAME = 'aviso_acesso_filhos_zelador_axc';

// Mapeamento cuidadoso e afetuoso dos líderes conhecidos
const NAME_OVERRIDES = {
  'a90db681-e55f-4668-8715-34e23ffbb591': 'Mãe Miriam',
  '968ae2d1-e32d-454d-9b30-05543843d8ab': 'Tata Robson',
  '5de04732-9419-4ef5-8558-7287ed140e79': 'Mãe Joyce',
  '8b3caf8b-83a7-4262-926b-42f7b92c6ad0': 'Pai Mailson',
  'd48b05d6-e14f-4bbd-9471-c4aaef118d75': 'Mãe Rebeca',
  '14a642ef-a88d-4a10-895c-8d41e0ab61e2': 'Pai Jesué',
  '29baae98-c2eb-4191-99db-1f26e970f285': 'Ialorixá Flávia',
  'cb9f6b7b-701c-496c-8644-04b039af6e5b': 'Mãe Graça',
  '009a518e-cae2-40ac-bf90-df6f754a56f2': 'Dirigente Lucas',
  'e49bfd52-884f-4706-9c62-cbc0a32d8e4d': 'Dr. Diego Tomé',
};

function formatLeaderName(l) {
  if (NAME_OVERRIDES[l.id]) return NAME_OVERRIDES[l.id];
  let n = String(l.cargo || '').trim();
  if (!n || n.toLowerCase() === 'zelador' || n.toLowerCase() === 'dirigente') return 'Zelador(a)';
  if (n.toLowerCase().includes('pai de santo')) return 'Pai de Santo';
  if (n.toLowerCase().includes('mãe de santo')) return 'Mãe de Santo';
  // Pega até 2 primeiros nomes se for muito longo
  const parts = n.split(/\s+/);
  if (parts.length > 3) return parts.slice(0, 2).join(' ');
  return n;
}

function cleanTerreiroName(name) {
  let n = String(name || '').trim();
  const lines = n.split('\n').map(l => l.trim()).filter(l => l && !l.includes('@'));
  if (lines.length > 0) return lines[lines.length - 1];
  return n;
}

async function sendWhatsAppTemplate(phone, nome, terreiro) {
  const url = `https://graph.facebook.com/v21.0/${phoneId}/messages`;
  const body = {
    messaging_product: 'whatsapp',
    to: phone,
    type: 'template',
    template: {
      name: TEMPLATE_NAME,
      language: { code: 'pt_BR' },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: nome.slice(0, 50) },
            { type: 'text', text: terreiro.slice(0, 60) }
          ]
        }
      ]
    }
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || `HTTP ${res.status}`);
  }
  return data?.messages?.[0]?.id || null;
}

async function runBroadcast() {
  console.log('--- INICIANDO DISPARO EM MASSA: AVISO LOGIN MEMBROS PARA ZELADORES ---');

  const { data: leaders, error } = await sb
    .from('perfil_lider')
    .select('id, nome_terreiro, cargo, whatsapp, whatsapp_publico, email, is_blocked, deleted_at')
    .is('deleted_at', null)
    .eq('is_blocked', false)
    .neq('email', 'lucasilvasiqueira@outlook.com.br');

  if (error) {
    console.error('Erro ao buscar líderes:', error);
    return;
  }

  // Verificar quem já recebeu hoje para evitar duplicidade
  const { data: alreadySent } = await sb
    .from('whatsapp_logs')
    .select('tenant_id, telefone')
    .eq('tipo', 'aviso_acesso_filhos_zelador');

  const sentTenantIds = new Set((alreadySent || []).map(r => r.tenant_id).filter(Boolean));
  const sentPhones = new Set((alreadySent || []).map(r => r.telefone).filter(Boolean));

  let sentCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

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

    // Apenas números válidos de 13 dígitos
    if (digits.length !== 13) continue;

    // Idempotência: não reenviar se já recebeu
    if (sentTenantIds.has(l.id) || sentPhones.has(digits)) {
      console.log(`[PULADO - JÁ ENVIADO] ${l.cargo} (${digits})`);
      skippedCount++;
      continue;
    }

    const nome = formatLeaderName(l);
    const terreiro = cleanTerreiroName(l.nome_terreiro);

    try {
      console.log(`Enviando para: ${nome} | Terreiro: ${terreiro} | Tel: ${digits}...`);
      const msgId = await sendWhatsAppTemplate(digits, nome, terreiro);
      
      await sb.from('whatsapp_logs').insert({
        tenant_id: l.id,
        filho_id: null,
        tipo: 'aviso_acesso_filhos_zelador',
        telefone: digits,
        mensagem: `Template aviso_acesso_filhos_zelador_axc enviado para ${nome} (${terreiro})`,
        status: 'sent',
        external_id: msgId
      });

      console.log(`  ✅ Sucesso! Msg ID: ${msgId}`);
      sentCount++;
      sentTenantIds.add(l.id);
      sentPhones.add(digits);

      // Intervalo de segurança para Meta Cloud API (1200ms)
      await new Promise(r => setTimeout(r, 1200));
    } catch (err) {
      console.error(`  ❌ Falha ao enviar para ${nome} (${digits}):`, err.message);
      errorCount++;
    }
  }

  console.log('\n=========================================');
  console.log(`DISPARO CONCLUÍDO:`);
  console.log(`Enviados com sucesso: ${sentCount}`);
  console.log(`Pulados (já enviados): ${skippedCount}`);
  console.log(`Erros: ${errorCount}`);
  console.log('=========================================');
}

runBroadcast();
