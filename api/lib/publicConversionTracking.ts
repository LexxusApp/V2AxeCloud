import type { Request } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { isMissingOrUnknownTable } from './adminConsoleAuth.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PUBLIC_EVENTS = new Set([
  'landing_view',
  'section_view',
  'cta_click',
  'register_view',
  'register_started',
  'register_failed',
  'directory_performance',
]);

export type ConversionFunnelStats = {
  available: boolean;
  periodDays: number;
  visitors: number;
  landingViews: number;
  ctaClicks: number;
  registerViews: number;
  registerStarted: number;
  registerCompleted: number;
  registerFailures: number;
  sectionReach: {
    sectionId: string;
    label: string;
    visitors: number;
    reachPct: number;
    dropOffPct: number;
  }[];
  visitToClickPct: number;
  clickToStartPct: number;
  startToCompletePct: number;
  visitToCompletePct: number;
};

function cleanText(value: unknown, max = 300): string | null {
  const valueAsText = String(value || '').trim();
  return valueAsText ? valueAsText.slice(0, max) : null;
}

function cleanPath(value: unknown): string {
  const raw = cleanText(value, 300) || '/';
  return (raw.startsWith('/') ? raw : `/${raw}`).split('#')[0];
}

export async function insertConversionEvent(
  sb: SupabaseClient,
  req: Request | null,
  input: Record<string, unknown>,
  options: { allowCompleted?: boolean; tenantId?: string | null } = {},
): Promise<boolean> {
  const eventName = cleanText(input.eventName, 40);
  if (!eventName || (!PUBLIC_EVENTS.has(eventName) && !(options.allowCompleted && eventName === 'register_completed'))) {
    return false;
  }
  const visitorId = cleanText(input.visitorId, 36);
  const sessionId = cleanText(input.sessionId, 36);
  if (!visitorId || !UUID_RE.test(visitorId) || !sessionId || !UUID_RE.test(sessionId)) return false;

  const metadata = input.metadata && typeof input.metadata === 'object' ? input.metadata : {};
  const attribution = input.attribution && typeof input.attribution === 'object' ? input.attribution : {};
  const { error } = await sb.from('public_conversion_events').insert({
    event_name: eventName,
    visitor_id: visitorId,
    session_id: sessionId,
    path: cleanPath(input.path),
    cta_id: cleanText(input.ctaId, 120),
    cta_label: cleanText(input.ctaLabel, 160),
    referrer: cleanText(input.referrer, 500),
    tenant_id: options.tenantId || null,
    metadata: { ...metadata, attribution },
    user_agent: cleanText(req?.headers?.['user-agent'], 500),
  });
  if (error) {
    if (isMissingOrUnknownTable(error, 'public_conversion_events')) return false;
    const isLegacyEventConstraint =
      eventName === 'directory_performance' &&
      (String((error as { code?: string }).code || '') === '23514' ||
        /event_name.*check|check constraint/i.test(String(error.message || '')));
    if (isLegacyEventConstraint) {
      // Mantém a telemetria disponível enquanto a migration do novo evento ainda não chegou ao banco.
      // access_logs é isolada do funil de conversão, então não distorce os números de cadastro.
      const { error: fallbackError } = await sb.from('access_logs').insert({
        event_type: 'directory.performance',
        target_type: 'public_directory',
        target_id: visitorId,
        description: `Métrica de desempenho em ${cleanPath(input.path)}`,
        metadata: {
          event_name: eventName,
          visitor_id: visitorId,
          session_id: sessionId,
          path: cleanPath(input.path),
          ...metadata,
          attribution,
        },
        user_agent: cleanText(req?.headers?.['user-agent'], 500),
      });
      if (!fallbackError) return true;
    }
    throw error;
  }
  return true;
}

function pct(value: number, total: number) {
  return total > 0 ? Math.round((value / total) * 1000) / 10 : 0;
}

export async function fetchConversionFunnelStats(sb: SupabaseClient, visitors: number): Promise<ConversionFunnelStats> {
  const empty: ConversionFunnelStats = {
    available: false,
    periodDays: 30,
    visitors,
    landingViews: 0,
    ctaClicks: 0,
    registerViews: 0,
    registerStarted: 0,
    registerCompleted: 0,
    registerFailures: 0,
    sectionReach: [],
    visitToClickPct: 0,
    clickToStartPct: 0,
    startToCompletePct: 0,
    visitToCompletePct: 0,
  };
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const { data, error } = await sb
    .from('public_conversion_events')
    .select('event_name, visitor_id, metadata')
    .gte('created_at', since);
  if (error) {
    if (isMissingOrUnknownTable(error, 'public_conversion_events')) return empty;
    throw error;
  }
  const groups = new Map<string, Set<string>>();
  for (const row of data || []) {
    const name = String(row.event_name || '');
    const visitorId = String(row.visitor_id || '');
    if (!name || !visitorId) continue;
    if (!groups.has(name)) groups.set(name, new Set());
    groups.get(name)!.add(visitorId);
  }
  const landingViews = groups.get('landing_view')?.size || 0;
  const ctaClicks = groups.get('cta_click')?.size || 0;
  const registerViews = groups.get('register_view')?.size || 0;
  const registerStarted = groups.get('register_started')?.size || 0;
  const registerCompleted = groups.get('register_completed')?.size || 0;
  const registerFailures = groups.get('register_failed')?.size || 0;
  const sectionLabels: Record<string, string> = {
    plataforma: 'Apresentação',
    'galeria-100gb': 'Galeria 100 GB',
    agenda: 'Agenda',
    seguranca: 'Segurança',
    recursos: 'Recursos',
    'quem-somos': 'Prova social',
    whatsapp: 'WhatsApp',
    mensalidade: 'Preço',
    faq: 'Dúvidas',
  };
  const sectionVisitors = new Map<string, Set<string>>();
  for (const row of data || []) {
    if (String(row.event_name || '') !== 'section_view') continue;
    const metadata = row.metadata && typeof row.metadata === 'object'
      ? row.metadata as Record<string, unknown>
      : {};
    const sectionId = String(metadata.sectionId || '');
    const visitorId = String(row.visitor_id || '');
    if (!sectionLabels[sectionId] || !visitorId) continue;
    if (!sectionVisitors.has(sectionId)) sectionVisitors.set(sectionId, new Set());
    sectionVisitors.get(sectionId)!.add(visitorId);
  }
  let previousVisitors = landingViews;
  const sectionReach = Object.entries(sectionLabels).map(([sectionId, label]) => {
    const sectionCount = sectionVisitors.get(sectionId)?.size || 0;
    const item = {
      sectionId,
      label,
      visitors: sectionCount,
      reachPct: pct(sectionCount, landingViews),
      dropOffPct: pct(Math.max(0, previousVisitors - sectionCount), previousVisitors),
    };
    previousVisitors = sectionCount;
    return item;
  });
  return {
    available: true,
    periodDays: 30,
    visitors,
    landingViews,
    ctaClicks,
    registerViews,
    registerStarted,
    registerCompleted,
    registerFailures,
    sectionReach,
    visitToClickPct: pct(ctaClicks, visitors),
    clickToStartPct: pct(registerStarted, ctaClicks),
    startToCompletePct: pct(registerCompleted, registerStarted),
    visitToCompletePct: pct(registerCompleted, visitors),
  };
}
