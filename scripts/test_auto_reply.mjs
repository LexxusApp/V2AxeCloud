import { getDiscreteSupabaseAdmin } from '../api/lib/discreteSupabase.js';
import { generateSalesReply } from '../api/lib/growthGemini.js';
import { sendMetaCloudText } from '../api/lib/metaCloudSend.js';

const sb = getDiscreteSupabaseAdmin();
const phone = '5511920033501';

async function testReply() {
  console.log(`Gerando resposta para ${phone}...`);

  // 1. Busca conversa
  const { data: conv } = await sb
    .from('admin_whatsapp_conversations')
    .select('*')
    .eq('phone_e164', phone)
    .single();

  console.log('Conversa:', conv?.id);

  // 2. Busca histórico
  const { data: history } = await sb
    .from('admin_whatsapp_messages')
    .select('direction,body,created_at')
    .eq('conversation_id', conv.id)
    .order('created_at', { ascending: false })
    .limit(10);

  const formattedHistory = [...(history || [])].reverse();
  console.log('Histórico:', formattedHistory);

  // 3. Gera resposta com a IA
  const reply = await generateSalesReply({
    terreiroNome: 'Terreiro de Teste (Lucas)',
    contactName: 'Lucas',
    history: formattedHistory,
    monthlyPriceLabel: 'R$ 69,90',
    registrationUrl: 'https://axecloud.com.br/cadastro'
  });

  console.log('\n>>> RESPOSTA DA IA GERADA:\n', reply);

  // 4. Envia para o WhatsApp do Lucas
  console.log('\nEnviando mensagem via Meta Cloud API...');
  const sendRes = await sendMetaCloudText(phone, reply);
  console.log('Envio Meta:', sendRes);

  // 5. Salva na tabela admin_whatsapp_messages
  await sb.from('admin_whatsapp_messages').insert({
    conversation_id: conv.id,
    direction: 'outbound',
    body: reply,
    message_type: 'text',
    external_id: sendRes.messageId || `out-${Date.now()}`,
    status: 'sent',
    created_at: new Date().toISOString()
  });

  // 6. Atualiza o lead no CRM
  await sb.from('prospecting_leads').update({
    status: 'interested',
    last_contact_at: new Date().toISOString()
  }).eq('phone', phone);

  console.log('\n>>> SUCESSO! Mensagem enviada para o WhatsApp do Lucas.');
}

testReply().catch(console.error);
