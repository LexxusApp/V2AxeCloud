import { useEffect, useState } from 'react';
import { FOUNDER_PROGRAM } from '../constants/founderProgram';

export type FounderProgramStats = {
  maxSlots: number;
  usedSlots: number;
  remainingSlots: number;
  acceptingApplications: boolean;
};

const FALLBACK: FounderProgramStats = {
  maxSlots: FOUNDER_PROGRAM.maxSlots,
  usedSlots: 0,
  remainingSlots: FOUNDER_PROGRAM.maxSlots,
  acceptingApplications: true,
};

export function useFounderProgramStats() {
  const [stats, setStats] = useState<FounderProgramStats>(FALLBACK);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void fetch('/api/v1/founder-program/stats', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: FounderProgramStats | null) => {
        if (!cancelled && data?.maxSlots != null) setStats(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { stats, loading };
}
