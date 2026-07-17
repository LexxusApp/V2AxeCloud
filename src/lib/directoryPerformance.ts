import { trackConversionEvent } from './trackConversion';

type SummaryTiming = {
  durationMs: number;
  cityCount: number;
  totalTerreiros: number;
};

type LargestContentfulPaintEntry = PerformanceEntry & {
  renderTime?: number;
  loadTime?: number;
};

export function monitorDirectoryPerformance() {
  let summary: SummaryTiming | null = null;
  let lcpMs: number | null = null;
  let reported = false;
  let observer: PerformanceObserver | null = null;

  const report = () => {
    if (reported || !summary) return;
    reported = true;
    void trackConversionEvent('directory_performance', {
      metadata: {
        summaryLoadMs: Math.round(summary.durationMs),
        lcpMs: lcpMs == null ? null : Math.round(lcpMs),
        cityCount: summary.cityCount,
        totalTerreiros: summary.totalTerreiros,
        connection: (navigator as Navigator & { connection?: { effectiveType?: string } }).connection
          ?.effectiveType,
      },
    });
  };

  if (typeof PerformanceObserver !== 'undefined') {
    try {
      observer = new PerformanceObserver((list) => {
        const entries = list.getEntries() as LargestContentfulPaintEntry[];
        const last = entries.at(-1);
        if (last) lcpMs = last.renderTime || last.loadTime || last.startTime;
      });
      observer.observe({ type: 'largest-contentful-paint', buffered: true });
    } catch {
      observer = null;
    }
  }

  const reportTimer = window.setTimeout(report, 6000);
  const onHidden = () => {
    if (document.visibilityState === 'hidden') report();
  };
  document.addEventListener('visibilitychange', onHidden);

  return {
    recordSummary(value: SummaryTiming) {
      summary = value;
    },
    stop() {
      report();
      window.clearTimeout(reportTimer);
      observer?.disconnect();
      document.removeEventListener('visibilitychange', onHidden);
    },
  };
}
