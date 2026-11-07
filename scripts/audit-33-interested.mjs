import fs from 'fs';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const env = dotenv.parse(fs.readFileSync('./.env'));
const sb = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function auditInterested() {
  const { data: leads, error } = await sb
    .from('prospecting_leads')
    .select('id, name, phone, phone_normalized, city, state, status, last_contact_at, updated_at, created_at')
    .eq('status', 'interested')
    .order('updated_at', { ascending: false });

  if (error) return console.error('Error:', error);
  console.log(`Total leads com status interested no CRM: ${leads?.length || 0}`);

  const report = [];

  for (const l of leads || []) {
    const rawDigits = (l.phone_normalized || l.phone || '').replace(/\D/g, '');
    const last8 = rawDigits.slice(-8);

    // 1. Procurar conversa no admin_whatsapp_conversations
    const { data: convs } = await sb
      .from('admin_whatsapp_conversations')
      .select('id, contact_name, phone_e164, unread_count, last_message_preview, last_message_at')
      .ilike('phone_e164', '%' + last8 + '%')
      .limit(1);

    const conv = convs?.[0];

    // 2. Verificar mensagens outbound / inbound
    let lastInbound = null;
    let lastOutbound = null;
    let msgsCount = 0;

    if (conv?.id) {
      const { data: msgs } = await sb
        .from('admin_whatsapp_messages')
        .select('direction, body, created_at')
        .eq('conversation_id', conv.id)
        .order('created_at', { ascending: false });

      msgsCount = msgs?.length || 0;
      lastInbound = msgs?.find(m => m.direction === 'inbound');
      lastOutbound = msgs?.find(m => m.direction === 'outbound');
    }

    // 3. Verificar se já tem terreiro/lider cadastrado
    const { data: leader } = await sb
      .from('perfil_lider')
      .select('id, nome_terreiro')
      .ilike('whatsapp', '%' + last8 + '%')
      .limit(1);

    const isRegistered = !!leader?.length;
    const answered = !!lastOutbound;
    const pendingReply = lastInbound && (!lastOutbound || new Date(lastInbound.created_at) > new Date(lastOutbound.created_at));

    report.push({
      name: l.name,
      phone: l.phone,
      city: `${l.city || ''}-${l.state || ''}`,
      registered: isRegistered ? 'SIM' : 'NÃO',
      answered: answered ? 'SIM' : 'NÃO',
      pending: pendingReply ? 'SIM ⚠️' : 'NÃO',
      lastInText: lastInbound ? lastInbound.body.slice(0, 35).replace(/\n/g, ' ') : 'sem inbound',
      lastInDate: lastInbound ? lastInbound.created_at.slice(0, 10) : '-',
      lastOutDate: lastOutbound ? lastOutbound.created_at.slice(0, 10) : '-'
    });
  }

  console.table(report);

  const pendingList = report.filter(r => r.pending.includes('SIM'));
  console.log('\n--- LEADS COM RESPOSTA PENDENTE (INBOUND MAIS RECENTE QUE OUTBOUND) ---');
  console.log(`Total pendentes de resposta: ${pendingList.length}`);
  pendingList.forEach(p => console.log(` -> ${p.name} | Tel: ${p.phone} | Inbound: "${p.lastInText}" | Data: ${p.lastInDate}`));
}

auditInterested().catch(console.error);
