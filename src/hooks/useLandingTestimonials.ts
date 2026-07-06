import { useEffect, useState } from 'react';
import {
  LANDING_TESTIMONIALS_FALLBACK,
  type LandingTestimonial,
} from '../constants/landingTestimonials';

export function useLandingTestimonials() {
  const [items, setItems] = useState<readonly LandingTestimonial[]>(LANDING_TESTIMONIALS_FALLBACK);
  const [fromApi, setFromApi] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void fetch('/api/v1/landing/testimonials', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { items?: LandingTestimonial[] } | null) => {
        if (cancelled) return;
        const published = Array.isArray(data?.items) ? data!.items! : [];
        if (published.length > 0) {
          setItems(published);
          setFromApi(true);
        }
      })
      .catch(() => {
        /* mantém fallback */
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { items, fromApi, loading };
}
