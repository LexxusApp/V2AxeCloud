export type EventRsvpAction = 'confirmar' | 'declinar';

export function publicAppOrigin(): string {
  const fromEnv = String(import.meta.env.VITE_APP_URL || '').trim().replace(/\/$/, '');
  if (fromEnv.startsWith('http')) return fromEnv;
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin.replace(/\/$/, '');
  }
  return 'https://axecloud.com.br';
}

export function eventRsvpPublicUrl(token: string, action: EventRsvpAction): string {
  const base = publicAppOrigin();
  return `${base}/convite/${encodeURIComponent(token)}/${action}`;
}
