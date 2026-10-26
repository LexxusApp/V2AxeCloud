import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { apiJson } from '@/lib/api';
import { AdminPanel } from './AdminDashboardLayout';

type Metrics = {
  days: number;
  rows: { id: string; title: string; date: string; impressions: number; detailOpens: number; whatsappClicks: number }[];
};
const number = (value: number) => new Intl.NumberFormat('pt-BR').format(value);

export function RitualPromotionMetrics() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Metrics | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const retry = useCallback(() => setRefresh((value) => value + 1), []);

  useEffect(() => {
    const abort = new AbortController();
    setBusy(true);
    setError('');
    setData(null);
    apiJson<Metrics>(`/api/admin-console/ritual-promotions?days=${days}`, { signal: abort.signal })
      .then((value) => { if (!abort.signal.aborted) setData(value); })
      .catch(() => { if (!abort.signal.aborted) setError('Não foi possível carregar os resultados. Tente atualizar.'); })
      .finally(() => { if (!abort.signal.aborted) setBusy(false); });
    return () => abort.abort();
  }, [days, refresh]);

  return <div id="anuncios-rituais">
    <AdminPanel kicker="Divulgação" title="Anúncios de rituais" action={<div className="flex items-center gap-2">
      <select aria-label="Período dos anúncios" value={days} onChange={(event) => setDays(Number(event.target.value))} className="admin-btn-secondary">
        <option value={7}>Últimos 7 dias</option><option value={30}>Últimos 30 dias</option>
      </select>
      <button type="button" onClick={retry} disabled={busy} className="admin-btn-secondary" aria-label="Atualizar métricas dos anúncios"><RefreshCw className="h-4 w-4" /></button>
    </div>}>
      <p className="mb-4 text-xs text-[var(--ac-text-muted)]">Visualizações dos destaques no diretório, aberturas dos detalhes e cliques no WhatsApp. Cliques não confirmam conversa ou inscrição.</p>
      {busy ? <p role="status" className="py-4 text-sm text-[var(--ac-text-muted)]">Carregando resultados…</p> : error ? <p role="alert" className="py-4 text-sm text-[var(--ac-danger)]">{error}</p> : data ? <div className="space-y-4">
        {data.rows.map((row) => <article key={row.id} className="border-t border-[var(--ac-paper-border)] pt-4">
          <h4 className="text-sm font-semibold text-[var(--ac-text)]">{row.title}</h4>
          <p className="mt-1 text-xs text-[var(--ac-text-muted)]">{row.date.split('-').reverse().join('/')}</p>
          <dl className="mt-3 grid grid-cols-3 gap-2">
            {([['Visualizações', row.impressions], ['Ver detalhes', row.detailOpens], ['WhatsApp', row.whatsappClicks]] as const).map(([label, value]) => <div key={label}>
              <dt className="text-xs text-[var(--ac-text-muted)]">{label}</dt><dd className="admin-mono mt-1 text-2xl font-semibold text-[var(--ac-text)]">{number(value)}</dd>
            </div>)}
          </dl>
        </article>)}
        <p className="text-xs text-[var(--ac-text-faint)]">Contagem de ações, não de pessoas únicas. Zero indica que ainda não houve registros no período.</p>
      </div> : null}
    </AdminPanel>
  </div>;
}
