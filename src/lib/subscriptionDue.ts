import { isLifetimePlan } from '../constants/plans';

const DAY_MS = 24 * 60 * 60 * 1000;

export type SubscriptionDueState = {
  daysRemaining: number | null;
  needsAttention: boolean;
  isOverdue: boolean;
  label: string;
  tone: 'safe' | 'attention' | 'urgent' | 'permanent';
};

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

  const expires = input.expiresAt ? new Date(input.expiresAt) : null;
  const validDate = expires && Number.isFinite(expires.getTime()) ? expires : null;
  const daysRemaining = validDate
    ? Math.ceil((validDate.getTime() - Date.now()) / DAY_MS)
    : null;
  const status = String(input.status || '').toLowerCase();
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
