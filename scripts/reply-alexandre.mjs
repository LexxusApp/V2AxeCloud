import fs from 'fs';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const env = dotenv.parse(fs.readFileSync('./.env'));
const sb = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const token = env.WA_META_TOKEN;
const fromId = env.WA_PHONE_NUMBER_ID;

const phone = '554788942536';
const text = `Axé, Alexandre! 🙏

Para você conhecer e testar na prática com o Ilê Osagiã, liberamos 30 dias de acesso 100% gratuito, sem precisar de cartão e sem compromisso nenhum.

Após o teste de 30 dias, se você gostar e quiser continuar, o plano do AxéCloud custa apenas R$ 69,90 por mês.

Esse valor inclui todos os recursos sem limites:
• Gestão da corrente e filhos de santo
• Mensalidades com Pix automatizado no WhatsApp
• Calendário de giras com lembretes automáticos para os membros
• Emissão de carteirinhas digitais
• Presença no Radar AxéCloud

Você pode criar o acesso do terreiro em 1 minuto por este link:
👉 https://axecloud.com.br/register

Ou se preferir, me responde aqui com o seu melhor e-mail que eu mesmo já gero o seu login de teste agora!`;

async function reply() {
  console.log(`Enviando resposta sobre custos para Alexandre (${phone})...`);

  // 1. Enviar mensagem direta via Meta Graph API (janela de 24h aberta)
  const url = `https://graph.facebook.com/v21.0/${fromId}/messages`;
  const payload = {
    messaging_product: 'whatsapp',
    to: phone,
    type: 'text',
    text: { body: text }
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

  const messageId = data.messages?.[0]?.id;
  console.log(`Mensagem enviada com sucesso! WAMID: ${messageId}`);

  // 2. Registrar no banco de dados (admin_whatsapp_conversations e admin_whatsapp_messages)
  const nowIso = new Date().toISOString();
  const { data: conv } = await sb
    .from('admin_whatsapp_conversations')
    .select('id')
    .ilike('phone_e164', '%88942536%')
    .single();

  if (conv?.id) {
    await sb.from('admin_whatsapp_messages').insert({
      conversation_id: conv.id,
      direction: 'outbound',
      message_type: 'text',
      body: text,
      external_id: messageId,
      status: 'sent',
      created_at: nowIso
    });

    await sb
      .from('admin_whatsapp_conversations')
      .update({
        last_message_at: nowIso,
        last_message_preview: text.slice(0, 140),
        unread_count: 0
      })
      .eq('id', conv.id);

    console.log(`Registrado na conversa ${conv.id}`);
  }
}

reply().catch(console.error);
