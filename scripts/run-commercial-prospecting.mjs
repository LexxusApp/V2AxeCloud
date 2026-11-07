import fs from 'node:fs';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const env = dotenv.parse(fs.readFileSync('./.env'));
const sb = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const token = env.WA_META_TOKEN;
const fromId = env.WA_PHONE_NUMBER_ID;

const sleep = ms => new Promise(r => setTimeout(r, ms));

function getSaoPauloTime() {
  const now = new Date();
  const spString = now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' });
  const spDate = new Date(spString);
  return {
    date: spDate,
    hour: spDate.getHours(),
    minute: spDate.getMinutes(),
    formatted: spDate.toLocaleString('pt-BR')
  };
}

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

export async function runProspectingBatch(options = {}) {
  const maxBatch = options.limit || 25;
  const force = Boolean(options.force);
  const timeInfo = getSaoPauloTime();

  console.log(`====================================================`);
  console.log(`ROBÔ DE PROSPECÇÃO AXÉCLOUD - LOTE COMERCIAL`);
  console.log(`Horário atual (São Paulo): ${timeInfo.formatted} (${timeInfo.hour}:${String(timeInfo.minute).padStart(2, '0')})`);
  console.log(`Janela de envio: 09:00 às 18:00`);
  console.log(`====================================================\n`);

  if (!force && (timeInfo.hour < 9 || timeInfo.hour >= 18)) {
    console.log(`⛔ FORA DO HORÁRIO COMERCIAL (09:00 às 18:00).`);
    console.log(`Nenhum disparo de prospecção ativa será realizado agora.`);
    console.log(`O robô permanece 100% ativo no modo RECEPTIVO (respondendo quem mandar mensagem).`);
    console.log(`A prospecção ativa iniciará automaticamente às 09:00.`);
    return { status: 'outside_business_hours', sent: 0 };
  }

  // 1. Verificar quantos já foram disparados hoje para respeitar o limite de 25-30
  const todayIso = new Date().toISOString().slice(0, 10);
  const { count: sentToday } = await sb
    .from('prospecting_events')
    .select('id', { count: 'exact', head: true })
    .eq('event_type', 'outreach_sent')
    .gte('created_at', `${todayIso}T00:00:00Z`);

  const currentSent = sentToday || 0;
  console.log(`Disparos já realizados hoje (${todayIso}): ${currentSent}`);

  const remainingToday = Math.max(0, maxBatch - currentSent);
  if (remainingToday <= 0 && !force) {
    console.log(`✅ Limite diário de ${maxBatch} disparos já atingido hoje.`);
    return { status: 'daily_limit_reached', sent: 0 };
  }

  const batchLimit = Math.min(remainingToday, maxBatch);
  console.log(`Buscando ${batchLimit} leads qualificados para envio...\n`);

  // 2. Buscar próximos leads qualificados (priorizando cidades/estados com boa densidade)
  const { data: leads, error } = await sb
    .from('prospecting_leads')
    .select('id, name, phone, phone_normalized, city, state, status')
    .eq('status', 'qualified')
    .order('state', { ascending: true })
    .order('city', { ascending: true })
    .limit(batchLimit);

  if (error || !leads || leads.length === 0) {
    console.log('Nenhum lead qualificado encontrado na fila.');
    return { status: 'empty_queue', sent: 0 };
  }

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < leads.length; i++) {
    const l = leads[i];
    const raw = (l.phone_normalized || l.phone || '').replace(/\D/g, '');
    const phone = raw.startsWith('55') ? raw : '55' + raw;
    const cleanName = (l.name || 'Terreiro').trim().slice(0, 50);

    console.log(`[${i + 1}/${leads.length}] Enviando convite para: ${cleanName} (${l.city}/${l.state} - ${phone})...`);

    try {
      const messageId = await sendProspectingTemplate({ phone, cleanName });
      successCount++;
      console.log(`  -> SUCESSO! WAMID: ${messageId}`);

      const nowIso = new Date().toISOString();
      const messageBody = `Olá! Falo do AxéCloud, uma plataforma desenvolvida com respeito às tradições para apoiar terreiros na gestão da corrente, mensalidades e giras. Entramos em contato para apresentar nossa ferramenta para ${cleanName}. Posso enviar uma apresentação curta e liberar 30 dias de teste gratuito? Para não receber mensagens, responda SAIR.\n\n[ Quero conhecer ] [ Sair ]`;

      // Atualizar/Criar conversa no CRM Inbox
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

      // Atualizar status do lead
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
        description: `Disparo comercial oficial Meta axecloud_prospeccao_v2 enviado para ${cleanName}`,
        metadata: { messageId, phone, city: l.city, state: l.state }
      });

    } catch (err) {
      failCount++;
      console.error(`  -> ERRO ao enviar para ${phone}:`, err.message);
    }

    // Intervalo de segurança anti-bloqueio entre envios (1.5 segundos)
    await sleep(1500);
  }

  console.log('\n====================================================');
  console.log(`LOTE COMERCIAL CONCLUÍDO!`);
  console.log(`Sucessos: ${successCount} | Falhas: ${failCount}`);
  console.log('====================================================');

  return { status: 'completed', sent: successCount, failed: failCount };
}

if (process.argv.includes('--run') || process.argv.includes('--force')) {
  const force = process.argv.includes('--force');
  runProspectingBatch({ force, limit: 25 }).catch(console.error);
} else {
  console.log('Módulo carregado. Para testar a verificação de horário, execute: node scripts/run-commercial-prospecting.mjs --run');
}
