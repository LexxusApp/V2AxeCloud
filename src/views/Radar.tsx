import { useEffect, useState } from 'react';
import { Eye, MapPinned, Radio, Sparkles, TrendingUp } from 'lucide-react';
import { AppPageShell } from '../components/app/AppTopNav';
import { ClaimedDirectoryProfileSettings } from '../components/settings/ClaimedDirectoryProfileSettings';
import { TerreiroServicosSettings } from '../components/settings/TerreiroServicosSettings';
import { authFetch } from '../lib/authenticatedFetch';

type RadarSummary = {
  profile?: {
    nome?: string;
    cidade?: string;
    estado?: string;
    publicacaoStatus?: string;
    latitude?: number | null;
    longitude?: number | null;
  } | null;
  metrics?: { viewsTotal?: number; views30?: number; views7?: number };
};

function Metric({ icon: Icon, label, value, detail }: { icon: typeof Eye; label: string; value: number | string; detail: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.055] p-4 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-xl border border-[#E5AE12]/25 bg-[#E5AE12]/10 text-[#F2C441]"><Icon className="h-4 w-4" /></span>
        <strong className="text-2xl font-black tracking-tight text-white">{value}</strong>
      </div>
      <p className="mt-3 text-xs font-black text-white">{label}</p>
      <p className="mt-1 text-[10px] font-semibold leading-relaxed text-white/48">{detail}</p>
    </div>
  );
}

export default function Radar() {
  const [summary, setSummary] = useState<RadarSummary | null>(null);

  useEffect(() => {
    void authFetch('/api/v1/settings/directory-profile')
      .then(async (response) => {
        const json = await response.json().catch(() => ({}));
        if (response.ok) setSummary(json);
      })
      .catch(() => undefined);
  }, []);

  const profile = summary?.profile;
  const metrics = summary?.metrics;
  const published = profile?.publicacaoStatus === 'publicado';
  const positioned = profile?.latitude != null && profile?.longitude != null;

  return (
    <AppPageShell>
      <div className="overflow-hidden rounded-[2rem] border border-[#D3C9B7] bg-[#F6F0E4] shadow-[0_30px_90px_-58px_rgba(20,43,31,.8)]">
        <header className="relative overflow-hidden bg-[#0D241A] px-5 py-7 text-white sm:px-8 sm:py-9">
          <div className="pointer-events-none absolute -right-24 -top-44 h-[34rem] w-[34rem] rounded-full border border-[#E5AE12]/10" />
          <div className="pointer-events-none absolute -right-8 -top-28 h-[25rem] w-[25rem] rounded-full border border-[#E5AE12]/10" />
          <div className="relative grid gap-7 lg:grid-cols-[1.15fr_.85fr] lg:items-end">
            <div>
              <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-[#F2C441]"><Radio className="h-4 w-4" /> Presença pública da casa</p>
              <h1 className="mt-3 max-w-3xl text-3xl font-black tracking-[-0.045em] sm:text-4xl">Radar</h1>
              <p className="mt-3 max-w-2xl text-sm font-semibold leading-relaxed text-white/58">
                Controle como sua casa aparece no mapa, confirme a localização, apresente atendimentos e acompanhe quem está encontrando o terreiro.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <span className={`rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] ${published ? 'bg-emerald-400/15 text-emerald-300' : 'bg-[#E5AE12]/15 text-[#F2C441]'}`}>
                  {published ? 'Perfil visível no mapa' : 'Perfil em preparação'}
                </span>
                <span className="rounded-full bg-white/7 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-white/65">
                  {positioned ? 'Localização confirmada' : 'Localização pendente'}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              <Metric icon={Eye} label="7 dias" value={metrics?.views7 || 0} detail="Aberturas recentes" />
              <Metric icon={TrendingUp} label="30 dias" value={metrics?.views30 || 0} detail="Interesse no período" />
              <Metric icon={MapPinned} label="Total" value={metrics?.viewsTotal || 0} detail="Visitas ao perfil" />
            </div>
          </div>
        </header>

        <div className="border-b border-[#D8CFBF] bg-[#FFF9EE] px-5 py-4 sm:px-8">
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#E5AE12]/15 text-[#8A6200]"><Sparkles className="h-4 w-4" /></span>
            <div>
              <p className="text-xs font-black text-[#241F18]">Complete primeiro o endereço e a biografia.</p>
              <p className="mt-0.5 text-[11px] font-semibold text-[#72695D]">Depois confirme o marcador, publique o perfil e cadastre os atendimentos que deseja apresentar.</p>
            </div>
          </div>
        </div>

        <div className="space-y-6 p-4 sm:p-6">
          {summary ? (
            <>
              <ClaimedDirectoryProfileSettings />
              <TerreiroServicosSettings />
            </>
          ) : (
            <div className="grid min-h-56 place-items-center rounded-2xl border border-[#D8CFBF] bg-[#FFF9EE] text-sm font-black text-[#746A5B]">Preparando o Radar da casa…</div>
          )}
        </div>
      </div>
    </AppPageShell>
  );
}
