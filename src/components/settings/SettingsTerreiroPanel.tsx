import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { authFetch } from '../../lib/authenticatedFetch';
import { TRADICAO_OPTIONS } from '../../lib/tradicaoModules';

type SettingsTerreiroPanelProps = {
  nomeTerreiro?: string | null;
};

export function SettingsTerreiroPanel({ nomeTerreiro }: SettingsTerreiroPanelProps) {
  const [tradicao, setTradicao] = useState<string>('—');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void authFetch('/api/v1/settings/portal-consulente')
      .then((res) => res.json())
      .then((json) => {
        const key = String(json.tradicao || 'mista');
        const label = TRADICAO_OPTIONS.find((o) => o.value === key)?.label ?? 'Mista';
        setTradicao(label);
      })
      .catch(() => setTradicao('Mista'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center rounded-2xl border border-[#1E242B] bg-[#13171D]">
        <Loader2 className="h-6 w-6 animate-spin text-[#3B82F6]" />
      </div>
    );
  }

  return (
    <div className="animate-fadeIn space-y-5 rounded-2xl border border-[#1E242B] bg-[#13171D] p-5 sm:p-6">
      <div className="flex flex-col gap-2 border-b border-[#1E242B] pb-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h6 className="font-display text-sm font-bold text-[#F1F5F9]">Informações Litúrgicas do Templo</h6>
          <p className="mt-0.5 text-[11px] font-light text-gray-400">
            Linhas de trabalho espirituais e identidade pública do terreiro.
          </p>
        </div>
        <span className="shrink-0 rounded border border-cyan-500/20 bg-cyan-950/30 px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-cyan-400">
          Luz Espiritual
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="block text-[9px] font-bold uppercase text-[#94A3B8]">Nome do Terreiro</label>
          <input
            type="text"
            readOnly
            value={nomeTerreiro || '—'}
            className="w-full cursor-default rounded-lg border border-[#1E242B] bg-[#12161A]/40 p-2.5 text-xs text-gray-300"
          />
        </div>
        <div className="space-y-1">
          <label className="block text-[9px] font-bold uppercase text-[#94A3B8]">Tradição / Linha Dominante</label>
          <input
            type="text"
            readOnly
            value={tradicao}
            className="w-full cursor-default rounded-lg border border-[#1E242B] bg-[#12161A]/40 p-2.5 text-xs text-gray-300"
          />
        </div>
      </div>

      <div className="rounded-xl border border-cyan-500/10 bg-cyan-500/5 p-3 text-xs font-light leading-relaxed text-cyan-400">
        <strong>Nota:</strong> Para alterar a tradição e o portal público do consulente, use o submenu{' '}
        <strong>Portal do Consulente</strong>. O nome do terreiro é editado em <strong>Perfil do Zelador</strong>.
      </div>
    </div>
  );
}
