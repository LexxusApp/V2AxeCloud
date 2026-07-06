import { useEffect, useState } from 'react';
import { authFetch } from '../lib/authenticatedFetch';

export type FounderHouseStatus = {
  isFounderHouse: boolean;
  status: string | null;
  nomeCasa: string | null;
};

const EMPTY: FounderHouseStatus = {
  isFounderHouse: false,
  status: null,
  nomeCasa: null,
};

export function useFounderHouseStatus(enabled = true) {
  const [data, setData] = useState<FounderHouseStatus>(EMPTY);
  const [loading, setLoading] = useState(enabled);

  useEffect(() => {
    if (!enabled) {
      setData(EMPTY);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void authFetch('/api/v1/founder-program/me', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((json: FounderHouseStatus | null) => {
        if (!cancelled && json && typeof json.isFounderHouse === 'boolean') {
          setData(json);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { ...data, loading };
}
