import fs from 'fs';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const env = dotenv.parse(fs.readFileSync('./.env'));
const sb = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  console.log('=== 1. LEADS COM STATUS "INTERESTED" NO CRM ===');
  const { data: interestedLeads } = await sb
    .from('prospecting_leads')
    .select('id, name, phone, phone_normalized, city, state, status, last_contact_at, updated_at')
    .eq('status', 'interested')
    .order('updated_at', { ascending: false });

  console.log(`Total interessados no CRM: ${interestedLeads?.length || 0}`);
  for (const l of interestedLeads || []) {
    // verifica se virou lider
    const last8 = (l.phone_normalized || l.phone || '').slice(-8);
    const { data: leader } = await sb.from('perfil_lider').select('id, zelador, nome_terreiro').ilike('whatsapp', `%${last8}%`).limit(1);
    console.log(` • ${l.name} | Tel: ${l.phone} | ${l.city}-${l.state} | Cadastrado no App? ${leader?.length ? 'SIM (' + leader[0].nome_terreiro + ')' : 'NÃO'}`);
  }

  console.log('\n=== 2. MENSAGENS INBOUND DE INTERESSE NO CHAT (HISTÓRICO) ===');
  const { data: inboundMsgs } = await sb
    .from('admin_whatsapp_messages')
    .select('id, conversation_id, body, created_at, direction')
    .eq('direction', 'inbound')
    .order('created_at', { ascending: false });

  const positiveKeywords = ['quero', 'como funciona', 'sim', 'gostaria', 'ola', 'boa', 'valor', 'preco', 'teste', 'apresentacao'];
  const positiveConvs = new Map();

  for (const m of inboundMsgs || []) {
    const text = (m.body || '').toLowerCase().trim();
    if (text === 'sair' || text.startsWith('sair')) continue;
    const isPositive = positiveKeywords.some(kw => text.includes(kw));
    if (isPositive && !positiveConvs.has(m.conversation_id)) {
      positiveConvs.set(m.conversation_id, m);
    }
  }

  console.log(`Total de conversas com mensagens receptivas/interesse: ${positiveConvs.size}`);
  for (const [cid, msg] of positiveConvs.entries()) {
    const { data: conv } = await sb.from('admin_whatsapp_conversations').select('id, contact_name, phone_e164').eq('id', cid).single();
    if (!conv) continue;
    const last8 = (conv.phone_e164 || '').slice(-8);
    const { data: leader } = await sb.from('perfil_lider').select('id, zelador, nome_terreiro').ilike('whatsapp', `%${last8}%`).limit(1);
    console.log(` • ${conv.contact_name} (${conv.phone_e164}) | Texto: "${msg.body.slice(0, 60)}" | Data: ${msg.created_at.slice(0, 10)} | Já é cadastrado? ${leader?.length ? 'SIM' : 'NÃO'}`);
  }

  console.log('\n=== 3. REIVINDICAÇÕES DE TERREIRO (CLAIMS) PENDENTES ===');
  const { data: claims } = await sb
    .from('terreiro_claim_requests')
    .select('id, nome, telefone, cidade, status, created_at')
    .order('created_at', { ascending: false });

  console.log(`Total claims: ${claims?.length || 0}`);
  for (const c of claims || []) {
    console.log(` • Claim: ${c.nome} (${c.cidade}) | Tel: ${c.telefone} | Status: ${c.status} | Data: ${c.created_at.slice(0, 10)}`);
  }
}

check().catch(err => console.error(err));
