import fs from 'fs';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const env = dotenv.parse(fs.readFileSync('./.env'));
const sb = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const token = env.WA_META_TOKEN;
const fromId = env.WA_PHONE_NUMBER_ID;

// Lista filtrada e higienizada: 7 dirigentes reais que manifestaram interesse (Jonatan removido por opt-out)
export const targetLeads = [
  { name: 'Lita', phone: '554792451689', terreiro: 'Tenda de Umbanda Ogum Rompe Mato' },
  { name: 'Pricylla Bianchi', phone: '554792144370', terreiro: 'Templo de Umbanda Guerreiros de Aruanda' },
  { name: 'Everton Luiz Boing', phone: '554799982274', terreiro: 'Yle Ase Aforiba' },
  { name: 'Valdecir Velez', phone: '556191727820', terreiro: 'Ile ase incitomei 2' },
  { name: 'Lucas', phone: '554799609699', terreiro: 'Ylê Africanista Xangô e Iemanjá' },
  { name: 'Bàbá Jhony Ti Òṣógìyan', phone: '554197012137', terreiro: 'Axé Guerreiros de Branco' },
  { name: 'Alexandre Souza', phone: '554788942536', terreiro: 'Ilê Osagiã' }
];

async function sendTemplate(lead) {
  const url = `https://graph.facebook.com/v21.0/${fromId}/messages`;
  const payload = {
    messaging_product: 'whatsapp',
    to: lead.phone,
    type: 'template',
    template: {
      name: 'retomada_interesse_axc_v1',
      language: { code: 'pt_BR' },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: lead.name },
            { type: 'text', text: lead.terreiro }
          ]
        }
      ]
    }
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(JSON.stringify(data));
  }
  return data.messages?.[0]?.id;
}

export async function run() {
  console.log(`Iniciando disparo do template oficial para os ${targetLeads.length} terreiros qualificados...`);
  const results = [];

  for (const lead of targetLeads) {
    try {
      const messageId = await sendTemplate(lead);
      console.log(`[OK] Enviado para ${lead.name} (${lead.phone}) - Terreiro: ${lead.terreiro} -> wamid: ${messageId}`);

      const nowIso = new Date().toISOString();
      const messageBody = `Olá, ${lead.name}! Axé! 🙏\n\nVimos que você pediu para conhecer o AxéCloud para o terreiro ${lead.terreiro}.\n\nComo passamos por uma melhoria técnica na nossa plataforma, estamos liberando com prioridade o seu acesso de 30 dias 100% gratuitos para organizar a sua casa sem compromisso.\n\nDeseja ativar seu teste agora?\n\n[ Ativar 30 Dias Grátis ] [ Agora Não ]`;

      // 1. Localiza ou cria a conversa no chat administrativo
      let { data: conv } = await sb
        .from('admin_whatsapp_conversations')
        .select('id')
        .or(`phone_e164.eq.${lead.phone},phone_e164.eq.+${lead.phone}`)
        .maybeSingle();

      if (!conv?.id) {
        const { data: newConv } = await sb
          .from('admin_whatsapp_conversations')
          .insert({
            phone_e164: lead.phone,
            contact_name: lead.name,
            last_message_at: nowIso,
            last_message_preview: messageBody.slice(0, 140),
            unread_count: 0
          })
          .select('id')
          .single();
        conv = newConv;
      }

      if (conv?.id) {
        await sb.from('admin_whatsapp_messages').insert({
          conversation_id: conv.id,
          direction: 'outbound',
          message_type: 'template',
          body: messageBody,
          external_id: messageId,
          status: 'sent',
          created_at: nowIso
        });

        await sb
          .from('admin_whatsapp_conversations')
          .update({
            last_message_at: nowIso,
            last_message_preview: messageBody.slice(0, 140),
            unread_count: 0
          })
          .eq('id', conv.id);
      }

      // 2. Atualiza lead de prospecção
      const last8 = lead.phone.slice(-8);
      const { data: pLeads } = await sb
        .from('prospecting_leads')
        .select('id')
        .ilike('phone_normalized', `%${last8}%`)
        .limit(1);

      if (pLeads?.[0]?.id) {
        await sb
          .from('prospecting_leads')
          .update({
            status: 'contacted',
            last_contact_at: nowIso
          })
          .eq('id', pLeads[0].id);

        await sb.from('prospecting_events').insert({
          lead_id: pLeads[0].id,
          event_type: 'reengagement_dispatched',
          from_status: 'contacted',
          to_status: 'contacted',
          description: `Disparado template oficial de reengajamento com 30 dias grátis para ${lead.name}`,
          metadata: { messageId, phone: lead.phone, template: 'retomada_interesse_axc_v1' }
        });
      }

      results.push({ lead: lead.name, phone: lead.phone, status: 'SUCCESS', messageId });
      await new Promise(r => setTimeout(r, 600));
    } catch (err) {
      console.error(`[ERRO] Falha ao enviar para ${lead.name} (${lead.phone}):`, err.message || err);
      results.push({ lead: lead.name, phone: lead.phone, status: 'ERROR', error: err.message });
    }
  }

  console.log('\n--- RESUMO DO DISPARO ---');
  console.table(results);
}

if (process.argv[1]?.endsWith('send-reengagement-8-leads.mjs') || process.argv[1]?.endsWith('send-reengagement-leads.mjs')) {
  run();
}
