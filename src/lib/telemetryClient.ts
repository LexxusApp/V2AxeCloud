import { supabase } from './supabase';

export type ClientFeatureType =
  | 'fotos'
  | 'agenda'
  | 'membros'
  | 'financeiro'
  | 'configuracoes'
  | 'acesso'
  | 'geral';

export interface ReportFailureOptions {
  feature: ClientFeatureType;
  action: string;
  error: unknown;
  httpStatus?: number;
  metadata?: Record<string, unknown>;
}

const recentDedup = new Map<string, number>();
const DEDUP_WINDOW_MS = 20_000; // 20s para não spammar se o usuário clicar várias vezes seguidas

function extractErrorMessage(err: unknown): string {
  if (!err) return 'Erro desconhecido';
  if (typeof err === 'string') return err;
  if (err instanceof Error) return err.message || err.name;
  if (typeof err === 'object') {
    const ob = err as Record<string, unknown>;
    const msg = ob.message || ob.error || ob.error_description || ob.details;
    if (typeof msg === 'string' && msg.trim()) return msg.trim();
    try {
      return JSON.stringify(err).slice(0, 300);
    } catch {
      return 'Objeto de erro não serializável';
    }
  }
  return String(err);
}

/**
 * Reporta silenciosamente uma falha de recurso para monitoramento em tempo real.
 * Nunca lança exceção para não quebrar a experiência do usuário.
 */
export async function reportFeatureFailureClient(options: ReportFailureOptions): Promise<void> {
  try {
    const errorMessage = extractErrorMessage(options.error);
    const dedupKey = `${options.feature}:${options.action}:${errorMessage.slice(0, 80)}`;
    const now = Date.now();

    const last = recentDedup.get(dedupKey);
    if (last && now - last < DEDUP_WINDOW_MS) {
      return; // Deduplicado
    }
    recentDedup.set(dedupKey, now);

    // Limpeza periódica do cache de deduplicação
    if (recentDedup.size > 100) {
      for (const [k, ts] of recentDedup) {
        if (now - ts > DEDUP_WINDOW_MS) recentDedup.delete(k);
      }
    }

    const isMobile = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const screenRes = typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : 'unknown';

    const payload = {
      feature: options.feature,
      action: options.action,
      errorMessage,
      route: typeof window !== 'undefined' ? window.location.pathname : '',
      httpStatus: options.httpStatus || null,
      metadata: {
        isMobile,
        screen: screenRes,
        online: typeof navigator !== 'undefined' ? navigator.onLine : true,
        clientTimestamp: new Date().toISOString(),
        ...(options.metadata || {}),
      },
    };

    let authHeader = '';
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        authHeader = `Bearer ${session.access_token}`;
      }
    } catch {
      // continua sem token
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authHeader) headers['Authorization'] = authHeader;

    await fetch('/api/v1/telemetry/failure', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    }).catch(() => {
      // Ignora silenciosamente se o servidor estiver indisponível
    });
  } catch (telemetryErr) {
    console.warn('[TelemetryClient] Erro ao enviar telemetria:', telemetryErr);
  }
}
