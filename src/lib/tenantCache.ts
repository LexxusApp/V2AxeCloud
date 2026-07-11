/** Persiste o tenant do terreiro por usuário (útil quando props ainda não hidrataram no mobile). */
const LS_PREFIX = 'axecloud_tenant_cache_v1';
const SS_PREFIX = 'axecloud_tenant_ss_v1';

type TenantCachePayload = {
  tenant_id?: string;
  nome_terreiro?: string;
  t?: number;
};

function parseTenantPayload(raw: string | null): TenantCachePayload | null {
  if (!raw) return null;
  try {
    const j = JSON.parse(raw) as TenantCachePayload;
    return j && typeof j === 'object' ? j : null;
  } catch {
    return null;
  }
}

function readTenantCachePayload(userId: string): TenantCachePayload | null {
  if (!userId || typeof window === 'undefined') return null;
  try {
    const ls = parseTenantPayload(localStorage.getItem(`${LS_PREFIX}:${userId}`));
    if (ls?.tenant_id) return ls;
  } catch {
    /* */
  }
  try {
    return parseTenantPayload(sessionStorage.getItem(`${SS_PREFIX}:${userId}`));
  } catch {
    return null;
  }
}

export function writeCachedTenantIdForUser(
  userId: string,
  tenantId: string,
  nomeTerreiro?: string | null
) {
  if (!userId || !tenantId || typeof window === 'undefined') return;
  const existing = readTenantCachePayload(userId);
  const nome =
    String(nomeTerreiro || '').trim() ||
    String(existing?.nome_terreiro || '').trim() ||
    undefined;
  const payload = JSON.stringify({
    tenant_id: tenantId,
    ...(nome ? { nome_terreiro: nome } : {}),
    t: Date.now(),
  });
  try {
    localStorage.setItem(`${LS_PREFIX}:${userId}`, payload);
  } catch {
    /* quota / modo privado */
  }
  try {
    sessionStorage.setItem(`${SS_PREFIX}:${userId}`, payload);
  } catch {
    /* sessão / iframe */
  }
}

/**
 * @param rejectSelfId Quando true (filho), ignora cache onde tenant === auth user id —
 * vínculo inválido gravado por versões antigas do login filho.
 */
export function readCachedTenantIdForUser(
  userId: string,
  opts?: { rejectSelfId?: boolean }
): string {
  if (!userId || typeof window === 'undefined') return '';
  const rejectSelfId = !!opts?.rejectSelfId;

  const pick = (raw: string | null): string => {
    const tid = String(parseTenantPayload(raw)?.tenant_id || '').trim();
    if (!tid) return '';
    if (rejectSelfId && tid === userId) return '';
    return tid;
  };

  try {
    const ls = pick(localStorage.getItem(`${LS_PREFIX}:${userId}`));
    if (ls) return ls;
  } catch {
    /* */
  }
  try {
    return pick(sessionStorage.getItem(`${SS_PREFIX}:${userId}`));
  } catch {
    return '';
  }
}

export function clearCachedTenantIdForUser(userId: string) {
  if (!userId || typeof window === 'undefined') return;
  try {
    localStorage.removeItem(`${LS_PREFIX}:${userId}`);
  } catch {
    /* */
  }
  try {
    sessionStorage.removeItem(`${SS_PREFIX}:${userId}`);
  } catch {
    /* */
  }
}

/**
 * Hidratação síncrona no refresh: mesmo antes do tenant-info, grafos/listas podem usar este id.
 * Deve ser chamado assim que existir `user.id` (INITIAL_SESSION / login).
 */
export function peekCachedTenantId(userId: string): string {
  return readCachedTenantIdForUser(userId);
}

/** Nome do terreiro gravado no cache local (login filho / tenant-info). */
export function peekCachedTerreiroNome(userId: string): string {
  return String(readTenantCachePayload(userId)?.nome_terreiro || '').trim();
}

/**
 * Resolve tenant para APIs financeiras/dashboard.
 * Zelador: tenant_id costuma ser o próprio perfil_lider.id (igual ao user.id) — isso é válido.
 * Filho: auth user id nunca é o tenant do terreiro.
 */
export function resolveTenantIdForFinance(
  tenantFromSession: string | null | undefined,
  userId?: string | null,
  isFilho = false
): string {
  const uid = String(userId || '').trim();
  const fromSession = String(tenantFromSession ?? '').trim();

  if (fromSession) {
    if (isFilho && uid && fromSession === uid) {
      const cached = readCachedTenantIdForUser(uid, { rejectSelfId: true });
      if (cached) return cached;
      return '';
    }
    return fromSession;
  }

  const cached = readCachedTenantIdForUser(uid, { rejectSelfId: isFilho });
  if (cached) return cached;

  if (!isFilho && uid) return uid;
  return '';
}
