import type { Request } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { isMissingOrUnknownTable, isRememberedMissingTable } from './adminConsoleAuth.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PUBLIC_EVENTS = new Set([
  'landing_view',
  'commercial_view',
  'section_view',
  'cta_click',
  'commercial_cta_click',
  'trial_cta_click',
  'login_click',
  'directory_view',
  'directory_action',
  'claim_started',
  'claim_completed',
  'register_view',
  'register_started',
  'register_step_completed',
  'register_submitted',
  'register_failed',
  'directory_performance',
]);

export type ConversionFunnelStats = {
  available: boolean;
  periodDays: number;
  commercial: {
    visitors: number;
    ctaClicks: number;
    trialClicks: number;
    registerViews: number;
    registerStarted: number;
    registerSubmitted: number;
    registerCompleted: number;
    registerFailures: number;
    viewToTrialPct: number;
    trialToRegisterPct: number;
    registerToStartPct: number;
    startToSubmitPct: number;
    submitToCompletePct: number;
    viewToCompletePct: number;
  };
  directory: {
    visitors: number;
    actions: number;
    claimStarted: number;
    claimCompleted: number;
    visitorToActionPct: number;
    claimCompletionPct: number;
  };
  sectionReach: {
    sectionId: string;
    label: string;
    visitors: number;
    reachPct: number;
    dropOffPct: number;
  }[];
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

const FUNNEL_STAGE_EVENTS = [
  'landing_view',
  'commercial_view',
  'cta_click',
  'commercial_cta_click',
  'trial_cta_click',
  'login_click',
  'directory_view',
  'directory_action',
  'claim_started',
  'claim_completed',
  'register_view',
  'register_started',
  'register_step_completed',
  'register_submitted',
  'register_completed',
  'register_failed',
] as const;

const PAGE_SIZE = 1000;

async function loadConversionRowsForEvent(
  sb: SupabaseClient,
  since: string,
  eventName: string,
  maxRows: number,
): Promise<{ event_name: string; visitor_id: string; path: string; cta_id: string | null; metadata: unknown }[]> {
  const rows: { event_name: string; visitor_id: string; path: string; cta_id: string | null; metadata: unknown }[] = [];
  let from = 0;
  while (from < maxRows) {
    const { data, error } = await sb
      .from('public_conversion_events')
      .select('event_name, visitor_id, path, cta_id, metadata')
      .eq('event_name', eventName)
      .gte('created_at', since)
      .order('created_at', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) {
      if (isMissingOrUnknownTable(error, 'public_conversion_events')) return [];
      throw error;
    }
    const batch = data || [];
    for (const row of batch) {
      rows.push({
        event_name: String(row.event_name || ''),
        visitor_id: String(row.visitor_id || ''),
        path: String(row.path || '/'),
        cta_id: row.cta_id ? String(row.cta_id) : null,
        metadata: row.metadata,
      });
    }
    if (batch.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return rows;
}

/**
 * PostgREST limita ~1000 linhas por request. section_view explode o volume e
 * cortava register_completed do funil — por isso paginamos por tipo de evento.
 */
async function loadConversionRowsByEvents(
  sb: SupabaseClient,
  since: string,
  eventNames: readonly string[],
  maxRowsPerEvent = PAGE_SIZE * 50,
): Promise<{ event_name: string; visitor_id: string; path: string; cta_id: string | null; metadata: unknown }[]> {
  if (isRememberedMissingTable('public_conversion_events')) return [];
  const batches = await Promise.all(
    eventNames.map((eventName) => loadConversionRowsForEvent(sb, since, eventName, maxRowsPerEvent)),
  );
  return batches.flat();
}

export async function fetchConversionFunnelStats(
  sb: SupabaseClient,
  visitors: number,
  options?: { maxRowsPerEvent?: number },
): Promise<ConversionFunnelStats> {
  const empty: ConversionFunnelStats = {
    available: false,
    periodDays: 30,
    commercial: {
      visitors, ctaClicks: 0, trialClicks: 0, registerViews: 0, registerStarted: 0,
      registerSubmitted: 0, registerCompleted: 0, registerFailures: 0, viewToTrialPct: 0,
      trialToRegisterPct: 0, registerToStartPct: 0, startToSubmitPct: 0,
      submitToCompletePct: 0, viewToCompletePct: 0,
    },
    directory: {
      visitors: 0, actions: 0, claimStarted: 0, claimCompleted: 0,
      visitorToActionPct: 0, claimCompletionPct: 0,
    },
    sectionReach: [],
  };
  if (isRememberedMissingTable('public_conversion_events')) return empty;
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const maxRowsPerEvent = options?.maxRowsPerEvent ?? PAGE_SIZE * 50;
  let stageRows: { event_name: string; visitor_id: string; path: string; cta_id: string | null; metadata: unknown }[];
  let sectionRows: { event_name: string; visitor_id: string; path: string; cta_id: string | null; metadata: unknown }[];
  try {
    [stageRows, sectionRows] = await Promise.all([
      loadConversionRowsByEvents(sb, since, FUNNEL_STAGE_EVENTS, maxRowsPerEvent),
      loadConversionRowsByEvents(sb, since, ['section_view'], maxRowsPerEvent),
    ]);
  } catch (error) {
    if (isMissingOrUnknownTable(error as { message?: string }, 'public_conversion_events')) return empty;
    throw error;
  }
  if (stageRows.length === 0 && sectionRows.length === 0) {
    // Tabela existe, mas ainda sem eventos — funil disponível com zeros.
  }
  const groups = new Map<string, Set<string>>();
  for (const row of stageRows) {
    const name = row.event_name;
    const visitorId = row.visitor_id;
    if (!name || !visitorId) continue;
    if (!groups.has(name)) groups.set(name, new Set());
    groups.get(name)!.add(visitorId);
  }
  const unique = (predicate: (row: (typeof stageRows)[number]) => boolean) =>
    new Set(stageRows.filter(predicate).map((row) => row.visitor_id).filter(Boolean)).size;
  const isDirectoryPath = (path: string) => /^\/(?:terreiros|terreiro)(?:\/|$)/.test(path);
  const legacyTrialClick = (row: (typeof stageRows)[number]) =>
    row.event_name === 'cta_click' && row.cta_id === 'cta_trial_click';
  const commercialVisitors = unique((row) =>
    row.event_name === 'commercial_view' || (row.event_name === 'landing_view' && !isDirectoryPath(row.path)));
  const directoryVisitors = unique((row) =>
    row.event_name === 'directory_view' || (row.event_name === 'landing_view' && isDirectoryPath(row.path)));
  const commercialCtaClicks = unique((row) =>
    row.event_name === 'commercial_cta_click' || row.event_name === 'trial_cta_click' || legacyTrialClick(row));
  const trialClicks = unique((row) => row.event_name === 'trial_cta_click' || legacyTrialClick(row));
  const directoryActions = unique((row) => row.event_name === 'directory_action' || (
    row.event_name === 'cta_click' && Boolean(row.cta_id?.startsWith('directory')) && row.cta_id !== 'directory-profile-claim'
  ));
  const claimStarted = unique((row) => row.event_name === 'claim_started' || (
    row.event_name === 'cta_click' && row.cta_id === 'directory-profile-claim'
  ));
  const claimCompleted = groups.get('claim_completed')?.size || 0;
  const registerViews = groups.get('register_view')?.size || 0;
  const registerStarted = groups.get('register_started')?.size || 0;
  const registerSubmitted = groups.get('register_submitted')?.size || 0;
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
  for (const row of sectionRows) {
    const metadata = row.metadata && typeof row.metadata === 'object'
      ? row.metadata as Record<string, unknown>
      : {};
    const sectionId = String(metadata.sectionId || '');
    const visitorId = row.visitor_id;
    if (!sectionLabels[sectionId] || !visitorId) continue;
    if (!sectionVisitors.has(sectionId)) sectionVisitors.set(sectionId, new Set());
    sectionVisitors.get(sectionId)!.add(visitorId);
  }
  let previousVisitors = commercialVisitors;
  const sectionReach = Object.entries(sectionLabels).map(([sectionId, label]) => {
    const sectionCount = sectionVisitors.get(sectionId)?.size || 0;
    const item = {
      sectionId,
      label,
      visitors: sectionCount,
      reachPct: pct(sectionCount, commercialVisitors),
      dropOffPct: pct(Math.max(0, previousVisitors - sectionCount), previousVisitors),
    };
    previousVisitors = sectionCount;
    return item;
  });
  const visitorBase = visitors || commercialVisitors;
  return {
    available: true,
    periodDays: 30,
    commercial: {
      visitors: visitorBase,
      ctaClicks: commercialCtaClicks,
      trialClicks,
      registerViews,
      registerStarted,
      registerSubmitted,
      registerCompleted,
      registerFailures,
      viewToTrialPct: pct(trialClicks, visitorBase),
      trialToRegisterPct: pct(registerViews, trialClicks),
      registerToStartPct: pct(registerStarted, registerViews),
      startToSubmitPct: pct(registerSubmitted, registerStarted),
      submitToCompletePct: pct(registerCompleted, registerSubmitted),
      viewToCompletePct: pct(registerCompleted, visitorBase),
    },
    directory: {
      visitors: directoryVisitors,
      actions: directoryActions,
      claimStarted,
      claimCompleted,
      visitorToActionPct: pct(directoryActions, directoryVisitors),
      claimCompletionPct: pct(claimCompleted, claimStarted),
    },
    sectionReach,
  };
}
