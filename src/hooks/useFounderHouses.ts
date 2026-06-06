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
};

export function useFounderHouses() {
  const [houses, setHouses] = useState<PublicFounderHouse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void fetch('/api/v1/landing/founder-houses', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { items?: PublicFounderHouse[] } | null) => {
        if (!cancelled && Array.isArray(data?.items)) setHouses(data.items);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { houses, loading, count: houses.length };
}
