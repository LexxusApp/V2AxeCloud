import fs from 'fs';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const env = dotenv.parse(fs.readFileSync('./.env'));
const sb = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const token = env.WA_META_TOKEN;
const fromId = env.WA_PHONE_NUMBER_ID;

// Template oficial aprovado para prospecção fria: axecloud_prospeccao_v2
async function sendProspectingTemplate(lead) {
  const url = `https://graph.facebook.com/v21.0/${fromId}/messages`;
  const payload = {
    messaging_product: 'whatsapp',
    to: lead.phone,
    type: 'template',
    template: {
      name: 'axecloud_prospeccao_v2',
      language: { code: 'pt_BR' },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: lead.cleanName }
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

const sleep = ms => new Promise(r => setTimeout(r, ms));

export async function run() {
  console.log('====================================================');
  console.log('CARREGANDO LEADS QUALIFICADOS DE SANTA CATARINA (SC)');
  console.log('====================================================\n');

  const { data: leads, error } = await sb
    .from('prospecting_leads')
    .select('id, name, phone, phone_normalized, city, state, status')
    .eq('status', 'qualified')
    .eq('state', 'SC')
    .order('city', { ascending: true });

  if (error || !leads || leads.length === 0) {
    console.error('Nenhum lead qualificado encontrado em SC:', error);
    return;
  }

  console.log(`Encontrados ${leads.length} terreiros qualificados em SC.`);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < leads.length; i++) {
    const l = leads[i];
    const raw = (l.phone_normalized || l.phone || '').replace(/\D/g, '');
    const phone = raw.startsWith('55') ? raw : '55' + raw;
    const cleanName = (l.name || 'Terreiro').trim().slice(0, 50);

    console.log(`[${i + 1}/${leads.length}] Enviando convite para ${cleanName} (${l.city}/SC - ${phone})...`);

    try {
      const messageId = await sendProspectingTemplate({ phone, cleanName });
      successCount++;
      console.log(`  -> SUCESSO! WAMID: ${messageId}`);

      const nowIso = new Date().toISOString();
      const messageBody = `Olá! Falo do AxéCloud, uma plataforma desenvolvida com respeito às tradições para apoiar terreiros na gestão da corrente, mensalidades e giras. Entramos em contato para apresentar nossa ferramenta para ${cleanName}. Posso enviar uma apresentação curta e liberar 30 dias de teste gratuito? Para não receber mensagens, responda SAIR.\n\n[ Quero conhecer ] [ Sair ]`;

      // 1. Grava conversa
      let { data: conv } = await sb
        .from('admin_whatsapp_conversations')
        .select('id')
        .or(`phone_e164.eq.${phone},phone_e164.eq.+${phone}`)
        .maybeSingle();

      if (!conv?.id) {
        const { data: newConv } = await sb
          .from('admin_whatsapp_conversations')
          .insert({
            phone_e164: phone,
            contact_name: cleanName,
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

      // 2. Atualiza lead no CRM
      await sb
        .from('prospecting_leads')
        .update({
          status: 'contacted',
          last_contact_at: nowIso,
          updated_at: nowIso
        })
        .eq('id', l.id);

      await sb.from('prospecting_events').insert({
        lead_id: l.id,
        event_type: 'outreach_sent',
        from_status: 'qualified',
        to_status: 'contacted',
        description: `Disparo oficial Meta axecloud_prospeccao_v2 enviado para ${cleanName}`,
        metadata: { messageId, phone }
      });

    } catch (err) {
      failCount++;
      console.error(`  -> ERRO ao enviar para ${phone}:`, err.message);
    }

    await sleep(700);
  }

  console.log('\n====================================================');
  console.log(`LOTE SC CONCLUÍDO!`);
  console.log(`Sucessos: ${successCount} | Falhas: ${failCount}`);
  console.log('====================================================');
}

if (process.argv.includes('--run')) {
  run().catch(console.error);
} else {
  console.log('Script carregado. Para disparar, execute com a flag: node scripts/dispatch-sc-23-prospecting.mjs --run');
}
