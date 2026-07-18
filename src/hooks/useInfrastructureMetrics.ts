import { useEffect, useState } from 'react';

export type InfrastructureMetrics = {
  status: 'online' | 'unavailable';
  measuredAt: string;
  uptimeSeconds: number;
  cpu: { usedPercent: number; cores: number };
  memory: { usedPercent: number; usedBytes: number; totalBytes: number };
  disk: { usedPercent: number; usedBytes: number; totalBytes: number } | null;
};

export function useInfrastructureMetrics() {
  const [metrics, setMetrics] = useState<InfrastructureMetrics | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let disposed = false;
    let activeController: AbortController | null = null;

    const load = async () => {
      activeController?.abort();
      const controller = new AbortController();
      activeController = controller;
      const timeout = window.setTimeout(() => controller.abort(), 8000);
      const startedAt = performance.now();
      try {
        const response = await fetch('/api/v1/public/infrastructure', {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`Infrastructure responded ${response.status}`);
        const payload = (await response.json()) as InfrastructureMetrics;
        if (disposed) return;
        setMetrics(payload);
        setLatencyMs(Math.max(1, Math.round(performance.now() - startedAt)));
        setUnavailable(false);
      } catch {
        if (!disposed) setUnavailable(true);
      } finally {
        window.clearTimeout(timeout);
      }
    };

    void load();
    const interval = window.setInterval(() => void load(), 30000);
    return () => {
      disposed = true;
      activeController?.abort();
      window.clearInterval(interval);
    };
  }, []);

  return { metrics, latencyMs, unavailable };
}
