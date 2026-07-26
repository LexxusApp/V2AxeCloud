import { useEffect, useState } from 'react';

export type PublicFounderHouse = {
  id: string;
  houseName: string;
  city: string;
  state: string;
  tradition: string;
  contactName?: string;
  quote?: string;
  /** Slug do portal público quando a casa activou pedidos de reza */
  portalSlug?: string;
  /** Foto do perfil do terreiro (perfil_lider.foto_url) */
  fotoUrl?: string;
};

export function useFounderHouses() {
  const [houses, setHouses] = useState<PublicFounderHouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8000);
    setLoading(true);
    setError(null);
    void fetch('/api/v1/landing/founder-houses', { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`Founder houses responded ${res.status}`);
        return res.json();
      })
      .then((data: { items?: PublicFounderHouse[] } | null) => {
        if (!cancelled && Array.isArray(data?.items)) setHouses(data.items);
      })
      .catch(() => {
        if (!cancelled) setError('Não foi possível carregar as casas agora.');
      })
      .finally(() => {
        window.clearTimeout(timeout);
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [attempt]);

  return { houses, loading, error, retry: () => setAttempt((value) => value + 1), count: houses.length };
}
