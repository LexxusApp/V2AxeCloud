const CANONICAL_HOST = 'axecloud.com.br';

/** Redireciona www → domínio canônico (evita falha de SW e manifest fora do scope). */
export function redirectToCanonicalOriginIfNeeded(): boolean {
  if (typeof window === 'undefined') return false;
  const { hostname, pathname, search, hash } = window.location;
  if (hostname !== `www.${CANONICAL_HOST}`) return false;
  window.location.replace(`https://${CANONICAL_HOST}${pathname}${search}${hash}`);
  return true;
}

export function isCanonicalAppOrigin(): boolean {
  if (typeof window === 'undefined') return true;
  const host = window.location.hostname;
  return host === CANONICAL_HOST || host.endsWith('.vercel.app') || host === 'localhost' || host === '127.0.0.1';
}
