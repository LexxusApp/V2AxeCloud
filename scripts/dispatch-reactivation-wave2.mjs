import fs from 'fs';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const env = dotenv.parse(fs.readFileSync('./.env'));
const sb = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const token = env.WA_META_TOKEN;
const fromId = env.WA_PHONE_NUMBER_ID;

// Lista completa dos alvos históricos higienizada e mapeada com nomes respeitosos
export const targets = [
  { phone: '5527997226314', leader: 'Zelador(a)', terreiro: 'Tenda Espírita São Sebastião' },
  { phone: '5527998120026', leader: 'Janayna Duque', terreiro: 'TUAC Tenda de Umbanda Amor e Caridade' },
  { phone: '5527996967046', leader: 'Zelador(a)', terreiro: 'Casa Espiritualista Maria Padilha' },
  { phone: '5599981060225', leader: 'Fernandes', terreiro: 'Tenda Umbandista São Miguel Arcanjo' },
  { phone: '5598999696357', leader: 'Pai Carlos', terreiro: 'Cabana do Caboclo Ubirajara' },
  { phone: '5598970024233', leader: 'Zelador(a)', terreiro: 'Terreiro Nossa Senhora da Vitória' },
  { phone: '5598981193977', leader: 'Zelador(a)', terreiro: 'Terreiro de Mina Mata Encantada' },
  { phone: '5561986533014', leader: 'Zelador(a)', terreiro: 'Casa de Umbanda Boiadeiro 7 Porteiras' },
  { phone: '5562994580419', leader: 'Zelador(a)', terreiro: 'Casa de Quimbanda Exú Tiriri' },
  { phone: '5549999007751', leader: 'Tata Robson', terreiro: 'Terreiro Luz de Aruanda' },
  { phone: '5549999627700', leader: 'Zelador(a)', terreiro: 'Casa de Rezo Ogum Sete Ondas' },
  { phone: '5548991474288', leader: 'Zelador(a)', terreiro: 'Tenda de Umbanda Cacique Pena Vermelha' },
  { phone: '5548996857910', leader: 'Zelador(a)', terreiro: 'Casa de Umbanda Família de Fé' },
  { phone: '5547984680153', leader: 'Zelador(a)', terreiro: 'Ilê Axé de Oxum' },
  { phone: '5548996619894', leader: 'Zelador(a)', terreiro: 'Tenda Espírita Caboclo 7 Demandas' },
  { phone: '5548988367666', leader: 'Zelador(a)', terreiro: 'C.E. Reino de Yemanjá e Ogum' },
  { phone: '5548996133539', leader: 'Pai Ricardo', terreiro: 'Ilê Axé Okê Obá Ketú' },
  { phone: '5547992074260', leader: 'Zelador(a)', terreiro: 'Casa de Caboclo' },
  { phone: '5547996528045', leader: 'Zelador(a)', terreiro: 'Terreiro Jacutá Mãe Maria Benedita' },
  { phone: '5547991476015', leader: 'Zelador(a)', terreiro: 'Terreiro Casa Grande Xangô e Oxóssi' },
  { phone: '5548988745143', leader: 'Zelador(a)', terreiro: 'Templo de Axé Mãe Oxum' },
  { phone: '5548996710912', leader: 'Zelador(a)', terreiro: "Seara D'Oxóssi" },
  { phone: '5548996456341', leader: 'Zelador(a)', terreiro: 'Centro de Magia Umbanda e Quimbanda' },
  { phone: '5547999298016', leader: 'Zelador(a)', terreiro: 'Terreiro Zé Pelintra da Lapa' },
  { phone: '5548988422192', leader: 'Mãe Nara', terreiro: 'Ilê de Oyá' },
  { phone: '5553984591717', leader: 'Zelador(a)', terreiro: 'Templo de Kimbanda Exu Tiriri' },
  { phone: '5549988312514', leader: 'Zelador(a)', terreiro: 'Tenda Cavaleiros de Aruanda' },
  { phone: '5549998180922', leader: 'Zelador(a)', terreiro: 'Centro Caboclo Aimoré' }
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
            { type: 'text', text: lead.leader },
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

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  console.log(`====================================================`);
  console.log(`INICIANDO DISPARO OFICIAL META PARA ${targets.length} TERREIROS`);
  console.log(`Template: retomada_interesse_axc_v1 (+30 Dias Grátis)`);
  console.log(`====================================================\n`);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < targets.length; i++) {
    const lead = targets[i];
    console.log(`[${i + 1}/${targets.length}] Enviando para ${lead.leader} - ${lead.terreiro} (${lead.phone})...`);

    try {
      const messageId = await sendTemplate(lead);
      successCount++;
      console.log(`  -> SUCESSO! WAMID: ${messageId}`);

      const nowIso = new Date().toISOString();
      const messageBody = `Olá, ${lead.leader}! Axé! 🙏\n\nVimos que você pediu para conhecer o AxéCloud para o terreiro ${lead.terreiro}.\n\nComo passamos por uma melhoria técnica na nossa plataforma, estamos liberando com prioridade o seu acesso de 30 dias 100% gratuitos para organizar a sua casa sem compromisso.\n\nDeseja ativar seu teste agora?\n\n[ Ativar 30 Dias Grátis ] [ Agora Não ]`;

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
            contact_name: lead.leader !== 'Zelador(a)' ? lead.leader : lead.terreiro,
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

      // 2. Atualiza no CRM prospecting_leads
      const last8 = lead.phone.slice(-8);
      await sb
        .from('prospecting_leads')
        .update({
          last_contact_at: nowIso,
          updated_at: nowIso
        })
        .ilike('phone', `%${last8}%`);

    } catch (err) {
      failCount++;
      console.error(`  -> ERRO ao enviar para ${lead.phone}:`, err.message);
    }

    // Intervalo de 600ms entre envios para fluidez da API Meta
    await sleep(600);
  }

  console.log(`\n====================================================`);
  console.log(`DISPARO CONCLUÍDO!`);
  console.log(`Total Sucesso: ${successCount}`);
  console.log(`Total Falhas: ${failCount}`);
  console.log(`====================================================`);
}

main().catch(console.error);
