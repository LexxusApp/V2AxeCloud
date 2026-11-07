import fs from 'fs';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const env = dotenv.parse(fs.readFileSync('./.env'));
const sb = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const TABLE = 'whatsapp_deliveries';
const MARKETING_KEYWORDS = ['prospec', 'resgate', 'campanha', 'botoes', 'teste_encerrando', 'retomada', 'cortesia', 'convite', 'mkt'];
const RATE_MARKETING_BRL = 0.38;
const RATE_UTILITY_BRL = 0.20;

function isMarketingTemplate(templateName) {
  if (!templateName) return false;
  const name = templateName.toLowerCase();
  return MARKETING_KEYWORDS.some((kw) => name.includes(kw));
}

async function summarize(sb) {
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60_000).toISOString();
  
  const now = new Date();
  const spFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const todayKey = spFormatter.format(now);
  const [yearStr, monthStr, dayStr] = todayKey.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);
  const startOfMonth = new Date(Date.UTC(year, month - 1, 1, 3, 0, 0)).toISOString();
  const totalDaysInMonth = new Date(year, month, 0).getDate();
  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  const monthName = `${monthNames[month - 1]}/${year}`;

  const deliveriesRes = await sb
    .from(TABLE)
    .select('status, created_at, template_name')
    .gte('created_at', since30d)
    .limit(10000);

  let prospectingEvents = [];
  try {
    const { data: pData } = await sb
      .from('prospecting_events')
      .select('created_at, metadata')
      .eq('event_type', 'whatsapp_message_sent')
      .gte('created_at', startOfMonth)
      .limit(10000);
    if (pData) prospectingEvents = pData;
  } catch (err) {
    console.warn('Could not fetch prospecting events:', err);
  }

  if (deliveriesRes.error) {
    console.error('deliveriesRes error:', deliveriesRes.error);
    throw deliveriesRes.error;
  }

  const data = deliveriesRes.data || [];

  console.log('2. Data fetched. Deliveries:', data.length, 'Prospecting:', prospectingEvents.length);

  const counts = {
    total30d: 0, today: 0, queued: 0, accepted: 0, sent: 0,
    delivered: 0, read: 0, failed: 0, unknown: 0,
  };

  let currentMonthEstimatedBrl = 0;
  let todayCostBrl = 0;
  let marketingCountMonth = 0;
  let utilityCountMonth = 0;
  let transactionalCountMonth = 0;

  for (const row of data) {
    const status = String(row.status || '');
    counts.total30d += 1;
    if (status in counts) counts[status] += 1;
    const rowDay = spFormatter.format(new Date(row.created_at));
    if (rowDay === todayKey) counts.today += 1;

    // Custos do mês corrente para mensagens que não falharam
    if (row.created_at >= startOfMonth && status !== 'failed') {
      transactionalCountMonth += 1;
      const isMkt = isMarketingTemplate(row.template_name);
      const unitCost = isMkt ? RATE_MARKETING_BRL : RATE_UTILITY_BRL;
      currentMonthEstimatedBrl += unitCost;
      if (isMkt) marketingCountMonth += 1;
      else utilityCountMonth += 1;
      if (rowDay === todayKey) todayCostBrl += unitCost;
    }
  }

  let prospectingCountMonth = 0;
  for (const p of prospectingEvents) {
    prospectingCountMonth += 1;
    const tplName = String(p.metadata?.template || 'axecloud_prospeccao_imagem_v1');
    const isMkt = isMarketingTemplate(tplName);
    const unitCost = isMkt ? RATE_MARKETING_BRL : RATE_UTILITY_BRL;
    currentMonthEstimatedBrl += unitCost;
    if (isMkt) marketingCountMonth += 1;
    else utilityCountMonth += 1;
    const pDay = spFormatter.format(new Date(p.created_at));
    if (pDay === todayKey) todayCostBrl += unitCost;
  }

  const daysElapsed = Math.max(1, day);
  const dailyAverageBrl = currentMonthEstimatedBrl / daysElapsed;
  const projectedMonthEndBrl = dailyAverageBrl * totalDaysInMonth;

  const terminal = counts.delivered + counts.read + counts.failed;
  const res = {
    ...counts,
    attention: counts.failed + counts.unknown + counts.queued,
    deliveryRate: terminal > 0 ? Math.round(((counts.delivered + counts.read) / terminal) * 1000) / 10 : null,
    cost: {
      currentMonthEstimatedBrl: Math.round(currentMonthEstimatedBrl * 100) / 100,
      projectedMonthEndBrl: Math.round(projectedMonthEndBrl * 100) / 100,
      todayCostBrl: Math.round(todayCostBrl * 100) / 100,
      dailyAverageBrl: Math.round(dailyAverageBrl * 100) / 100,
      marketingCountMonth,
      utilityCountMonth,
      prospectingCountMonth,
      transactionalCountMonth,
      totalMessagesMonth: marketingCountMonth + utilityCountMonth,
      monthName,
      daysElapsed,
      totalDaysInMonth,
      rateMarketingBrl: RATE_MARKETING_BRL,
      rateUtilityBrl: RATE_UTILITY_BRL,
    },
  };
  console.log('Result:', JSON.stringify(res, null, 2));
}

summarize(sb).catch(err => console.error('Error in summarize:', err));
