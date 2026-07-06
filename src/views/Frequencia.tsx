import { useEffect, useState } from 'react';
import { Loader2, TrendingUp, Users } from 'lucide-react';
import { AppPageShell, AppPanelLoading } from '../components/app/AppTopNav';
import { AppDemoCard, AppDemoPanelHeader } from '../components/ui/appDemoUi';
import { fetchFrequenciaReport } from '../lib/giraOperations';
import { cn } from '../lib/utils';
import Avatar from '../components/Avatar';

type Props = {
  tenantData?: { tenant_id?: string | null; plan?: string; is_admin_global?: boolean };
  setActiveTab: (tab: string) => void;
};

export default function Frequencia({ tenantData, setActiveTab }: Props) {
  const tenantId = tenantData?.tenant_id || '';
  const [rows, setRows] = useState<Awaited<ReturnType<typeof fetchFrequenciaReport>>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantId) return;
    setLoading(true);
    void fetchFrequenciaReport(tenantId)
      .then(setRows)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Erro'))
      .finally(() => setLoading(false));
  }, [tenantId]);

  if (loading) {
    return (
      <AppPageShell>
        <AppPanelLoading />
      </AppPageShell>
    );
  }

  return (
    <AppPageShell>
      <AppDemoPanelHeader
        title="Frequência da corrente"
        description="Assiduidade dos filhos de santo nas giras — presença registrada por check-in ou confirmação."
        action={
          <button
            type="button"
            onClick={() => setActiveTab('calendar')}
            className="rounded-xl border border-[#1E242B] bg-[#12161A] px-3 py-2 text-xs font-bold text-primary"
          >
            Ir para giras
          </button>
        }
      />

      {error ? (
        <p className="text-sm text-red-400">{error}</p>
      ) : rows.length === 0 ? (
        <AppDemoCard className="py-12 text-center text-[#94A3B8]">
          <Users className="mx-auto h-10 w-10 text-primary/40" />
          <p className="mt-3 text-sm">Ainda não há registros de presença.</p>
          <p className="mt-1 text-xs text-gray-600">
            Abra uma gira no calendário e use Frequência / QR Check-in para começar.
          </p>
        </AppDemoCard>
      ) : (
        <div className="space-y-2">
          {rows.map((r, idx) => (
            <div
              key={r.filho_id}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-[#1E242B] bg-[#13171D] px-4 py-3"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-black text-primary">
                {idx + 1}
              </span>
              <Avatar
                src={r.foto_url}
                name={r.nome}
                shape="circle"
                textSize="text-xs"
                className="h-10 w-10 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold text-white">{r.nome}</p>
                <p className="text-[10px] text-gray-500">{r.cargo || 'Filho de santo'}</p>
              </div>
              <div className="flex flex-wrap gap-3 text-center text-[10px] font-bold uppercase tracking-wider">
                <div>
                  <p className="text-lg font-black text-emerald-400 tabular-nums">{r.presentes}</p>
                  <p className="text-gray-600">Presentes</p>
                </div>
                <div>
                  <p className="text-lg font-black text-[#94A3B8] tabular-nums">{r.confirmados}</p>
                  <p className="text-gray-600">Confirmados</p>
                </div>
                <div>
                  <p className="text-lg font-black text-red-400/80 tabular-nums">{r.faltas}</p>
                  <p className="text-gray-600">Faltas</p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1">
                <TrendingUp className="h-3.5 w-3.5 text-primary" />
                <span className="text-sm font-black text-primary tabular-nums">{r.assiduidade_pct}%</span>
              </div>
              <div className="h-1.5 w-full basis-full overflow-hidden rounded-full bg-[#12161A] sm:max-w-xs sm:basis-auto sm:flex-1">
                <div
                  className={cn('h-full rounded-full bg-primary transition-all')}
                  style={{ width: `${Math.min(100, r.assiduidade_pct)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </AppPageShell>
  );
}
