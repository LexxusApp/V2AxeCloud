import { isLifetimePlan } from '../constants/plans';

const DAY_MS = 24 * 60 * 60 * 1000;
const BR_TZ = 'America/Sao_Paulo';

export type SubscriptionDueState = {
  daysRemaining: number | null;
  needsAttention: boolean;
  isOverdue: boolean;
  label: string;
  tone: 'safe' | 'attention' | 'urgent' | 'permanent';
};

/** Extrai a data civil YYYY-MM-DD no fuso de Brasília. */
export function parseSubscriptionExpiryYmd(raw?: string | null): string | null {
  if (!raw) return null;
  const str = String(raw).trim();
  if (!str) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const date = new Date(str);
  if (!Number.isFinite(date.getTime())) return null;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BR_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/** Retorna a data civil atual YYYY-MM-DD em Brasília. */
export function getTodayYmd(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BR_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** Retorna a diferença em dias civis entre o vencimento e hoje (0 = vence hoje, 1 = vence amanhã, -1 = 1 dia após vencimento). */
export function getCalendarDaysRemaining(expiresAt?: string | null, now = new Date()): number | null {
  const expiryYmd = parseSubscriptionExpiryYmd(expiresAt);
  if (!expiryYmd) return null;
  const todayYmd = getTodayYmd(now);
  const [ey, em, ed] = expiryYmd.split('-').map(Number);
  const [ty, tm, td] = todayYmd.split('-').map(Number);
  const utce = Date.UTC(ey, em - 1, ed);
  const utct = Date.UTC(ty, tm - 1, td);
  return Math.round((utce - utct) / DAY_MS);
}

/**
 * Retorna se o terreiro deve ser bloqueado por vencimento.
 * Regra: Bloqueio ocorre apenas a partir de um dia depois do vencimento (D+1 em diante).
 * No dia do vencimento (daysRemaining === 0), o terreiro tem o dia todo liberado.
 */
export function isSubscriptionBlockedAfterDue(expiresAt?: string | null, now = new Date()): boolean {
  const days = getCalendarDaysRemaining(expiresAt, now);
  if (days == null) return false;
  return days < 0;
}

export function getSubscriptionDueState(input: {
  expiresAt?: string | null;
  plan?: string | null;
  status?: string | null;
  isTrial?: boolean;
}): SubscriptionDueState {
  if (isLifetimePlan(String(input.plan || ''))) {
    return {
      daysRemaining: null,
      needsAttention: false,
      isOverdue: false,
      label: 'Acesso permanente',
      tone: 'permanent',
    };
  }

  const daysRemaining = getCalendarDaysRemaining(input.expiresAt);
  const status = String(input.status || '').toLowerCase();
  // Bloqueio / Vencido apenas a partir de 1 dia depois do vencimento (daysRemaining < 0)
  const isOverdue = status === 'expired' || status === 'inactive' || (daysRemaining != null && daysRemaining < 0);
  const needsAttention = isOverdue || status === 'pending' || (daysRemaining != null && daysRemaining <= 7);

  if (isOverdue) {
    return { daysRemaining, needsAttention, isOverdue, label: 'Pagamento pendente', tone: 'urgent' };
  }
  if (daysRemaining === 0) {
    return { daysRemaining, needsAttention: true, isOverdue: false, label: 'Vence hoje', tone: 'urgent' };
  }
  if (daysRemaining != null && daysRemaining <= 7) {
    return {
      daysRemaining,
      needsAttention: true,
      isOverdue: false,
      label: `Vence em ${daysRemaining} dia${daysRemaining === 1 ? '' : 's'}`,
      tone: 'attention',
    };
  }

  return {
    daysRemaining,
    needsAttention: false,
    isOverdue: false,
    label: input.isTrial ? 'Período de teste ativo' : 'Mensalidade em dia',
    tone: 'safe',
  };
}
