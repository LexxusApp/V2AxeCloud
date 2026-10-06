import { peekCachedTerreiroNome } from './tenantCache';

export const FILHO_ALLOWED_TABS = new Set([
  'profile',
  'perfil',
  'obrigacoes',
  'financial',
  'calendar',
  'library',
  'store',
  'mural',
  'chat',
]);

const ZELADOR_DEEP_LINK_TABS = new Set([
  'dashboard', 'children', 'obligations', 'calendar', 'frequencia', 'mural', 'chat',
  'gallery', 'inventory', 'library', 'store', 'radar', 'subscription', 'settings',
  'suporte', 'financial', 'financial-mensalidades', 'financial-configs', 'reports',
  'patrimony', 'documents', 'consulentes', 'atendimento-agenda', 'journey',
  'liturgical', 'development', 'camarinha',
]);

const FILHO_FLAG_KEY = 'axecloud_is_filho';
const FILHO_FLAG_USER_KEY = 'axecloud_is_filho_user_id';
const TENANT_ANCHOR_KEY = 'tenant_id';
const USER_ROLE_KEY = 'axecloud_user_role';
let isSessionReadyGlobal = false;

export function getIsSessionReady() {
  return isSessionReadyGlobal;
}

export function markSessionReadyGlobal(ready: boolean) {
  isSessionReadyGlobal = ready;
}

export function readTenantAnchorFromStorage() {
  try {
    const value = String(localStorage.getItem(TENANT_ANCHOR_KEY) || '').trim();
    return value || null;
  } catch {
    return null;
  }
}

export function writeTenantAnchorToStorage(tenantId?: string | null) {
  const value = String(tenantId || '').trim();
  try {
    if (value) localStorage.setItem(TENANT_ANCHOR_KEY, value);
    else localStorage.removeItem(TENANT_ANCHOR_KEY);
  } catch {
    // Storage pode estar indisponível em WebViews privados.
  }
}

export function readUserRoleAnchor() {
  try {
    const raw = String(localStorage.getItem(USER_ROLE_KEY) || '').toLowerCase().trim();
    return raw === 'filho' || raw === 'admin' ? raw : null;
  } catch {
    return null;
  }
}

export function writeUserRoleAnchor(role?: 'admin' | 'filho' | null) {
  try {
    if (role) localStorage.setItem(USER_ROLE_KEY, role);
    else localStorage.removeItem(USER_ROLE_KEY);
  } catch {
    // Storage pode estar indisponível em WebViews privados.
  }
}

export function readPersistedFilhoFlag(userId?: string | null) {
  try {
    if (localStorage.getItem(FILHO_FLAG_KEY) !== 'true') return false;
    if (!userId) return true;
    const flaggedUserId = localStorage.getItem(FILHO_FLAG_USER_KEY);
    return !flaggedUserId || flaggedUserId === userId;
  } catch {
    return false;
  }
}

export function persistFilhoFlag(isFilho: boolean, userId?: string | null) {
  try {
    if (isFilho) {
      localStorage.setItem(FILHO_FLAG_KEY, 'true');
      if (userId) localStorage.setItem(FILHO_FLAG_USER_KEY, userId);
      return;
    }
    localStorage.removeItem(FILHO_FLAG_KEY);
    localStorage.removeItem(FILHO_FLAG_USER_KEY);
  } catch {
    // Storage pode estar indisponível em WebViews privados.
  }
}

export function normalizeFilhoTab(tab: string) {
  return FILHO_ALLOWED_TABS.has(tab) ? tab : 'profile';
}

export function normalizeZeladorDeepLinkTab(tab: string) {
  const normalized = tab === 'atendimentos' ? 'consulentes' : tab;
  return ZELADOR_DEEP_LINK_TABS.has(normalized) ? normalized : null;
}

export function requestedTabFromLocation() {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get('tab');
}

export function resolveTerreiroNomeFallback(userId?: string | null, nome?: string | null): string {
  const direct = String(nome || '').trim();
  if (direct) return direct;
  if (userId) {
    const cached = peekCachedTerreiroNome(userId);
    if (cached) return cached;
  }
  return 'Meu Terreiro';
}

export function isFilhoIdentity(
  user?: { email?: string | null; user_metadata?: any } | null,
  emailFallback?: string,
  roleFallback?: string,
) {
  const role = String(user?.user_metadata?.role || roleFallback || '').toLowerCase().trim();
  const email = String(user?.email || emailFallback || '').toLowerCase().trim();
  return role === 'filho' || (email.startsWith('f_') && email.endsWith('@axecloud.internal'));
}
