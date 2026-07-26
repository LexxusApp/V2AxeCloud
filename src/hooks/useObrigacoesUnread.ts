import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

const SEEN_KEY_PREFIX = 'axecloud_obrigacoes_seen_';
const SEEN_EVENT = 'axecloud:obrigacoes-seen';

function seenStorageKey(filhoId: string): string {
  return `${SEEN_KEY_PREFIX}${filhoId}`;
}

export function loadObrigacoesSeen(filhoId: string): Set<string> {
  try {
    const raw = localStorage.getItem(seenStorageKey(filhoId));
    return new Set(JSON.parse(raw || '[]') as string[]);
  } catch {
    return new Set();
  }
}

function notifySeenChanged(filhoId: string): void {
  window.dispatchEvent(new CustomEvent(SEEN_EVENT, { detail: { filhoId } }));
}

export function saveObrigacoesSeen(filhoId: string, ids: Set<string>): void {
  localStorage.setItem(seenStorageKey(filhoId), JSON.stringify([...ids]));
  notifySeenChanged(filhoId);
}

/** Marca IDs como vistos e notifica a nav para atualizar o badge. */
export function markObrigacoesSeen(filhoId: string, ids: string[]): void {
  if (!filhoId) return;
  const next = loadObrigacoesSeen(filhoId);
  for (const id of ids) {
    if (id) next.add(String(id));
  }
  saveObrigacoesSeen(filhoId, next);
}

async function resolveFilhoId(userId: string, email?: string | null): Promise<string | null> {
  let { data: filho } = await supabase
    .from('filhos_de_santo')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (!filho && email) {
    const byEmail = await supabase
      .from('filhos_de_santo')
      .select('id')
      .eq('email', email)
      .maybeSingle();
    if (!byEmail.error && byEmail.data) filho = byEmail.data;
  }

  return filho?.id ? String(filho.id) : null;
}

async function fetchObligationIds(filhoId: string, tenantId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('calendario_axe')
    .select('id')
    .eq('tipo', 'Obrigação')
    .eq('tenant_id', tenantId)
    .like('descricao', `%FILHO_ID:${filhoId}%`);

  if (error) throw error;
  return (data || []).map((row) => String(row.id));
}

/**
 * Conta obrigações ainda não vistas pelo filho (IDs em localStorage).
 * Usado no badge da aba Obrigações.
 */
export function useObrigacoesUnread(
  enabled: boolean,
  userId: string | null | undefined,
  tenantId: string | null | undefined,
  userEmail?: string | null,
): { unreadCount: number; filhoId: string | null; refresh: () => void } {
  const [unreadCount, setUnreadCount] = useState(0);
  const [filhoId, setFilhoId] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const refresh = useCallback(() => {
    if (!enabled || !userId || !tenantId) {
      setUnreadCount(0);
      setFilhoId(null);
      return;
    }

    const requestId = ++requestIdRef.current;

    void (async () => {
      try {
        const resolved = await resolveFilhoId(userId, userEmail);
        if (requestId !== requestIdRef.current) return;
        if (!resolved) {
          setFilhoId(null);
          setUnreadCount(0);
          return;
        }
        setFilhoId(resolved);

        const ids = await fetchObligationIds(resolved, tenantId);
        if (requestId !== requestIdRef.current) return;
        const seen = loadObrigacoesSeen(resolved);
        setUnreadCount(ids.filter((id) => !seen.has(id)).length);
      } catch (err) {
        console.error('[useObrigacoesUnread]', err);
        if (requestId === requestIdRef.current) setUnreadCount(0);
      }
    })();
  }, [enabled, userId, tenantId, userEmail]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!enabled) return;

    const onSeen = () => refresh();
    const onFocus = () => refresh();

    window.addEventListener(SEEN_EVENT, onSeen);
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener(SEEN_EVENT, onSeen);
      window.removeEventListener('focus', onFocus);
    };
  }, [enabled, refresh]);

  return { unreadCount, filhoId, refresh };
}
