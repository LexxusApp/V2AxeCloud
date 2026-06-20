import { useMemo, useState } from 'react';
import { Info, Plus, Search, Trash2 } from 'lucide-react';
import {
  DEMO_AVATAR_TONES,
  DEMO_FILHOS_INITIAL,
  type DemoFilho,
} from '../../../constants/landingDemo';
import { DemoCard, demoInputClass, demoLabelClass } from './demoUi';

type Props = {
  onNotify: (message: string, type?: 'success' | 'info' | 'error') => void;
};

export function DemoFilhosPanel({ onNotify }: Props) {
  const [filhos, setFilhos] = useState<DemoFilho[]>(DEMO_FILHOS_INITIAL);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({
    nome: '',
    cargo: 'Médium de Desenvolvimento',
    orixaFrente: 'Oxum',
    guiaEspiritual: '',
    status: 'Ativo' as DemoFilho['status'],
  });

  const filtered = useMemo(
    () => filhos.filter((f) => f.nome.toLowerCase().includes(search.toLowerCase())),
    [filhos, search],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome.trim()) {
      onNotify('Informe o nome do filho de santo.', 'error');
      return;
    }
    const saved: DemoFilho = {
      id: String(Date.now()),
      nome: form.nome.trim(),
      cargo: form.cargo,
      orixaFrente: form.orixaFrente,
      guiaEspiritual: form.guiaEspiritual.trim() || 'Em desenvolvimento',
      status: form.status,
      avatarTone: DEMO_AVATAR_TONES[Math.floor(Math.random() * DEMO_AVATAR_TONES.length)],
    };
    setFilhos((prev) => [saved, ...prev]);
    setForm({
      nome: '',
      cargo: 'Médium de Desenvolvimento',
      orixaFrente: 'Oxum',
      guiaEspiritual: '',
      status: 'Ativo',
    });
    onNotify(`${saved.nome} cadastrado na demo — no app real isso vai para o terreiro.`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <h3 className="font-display text-lg font-bold text-slate-900">Filhos de Santo</h3>
          <p className="text-xs text-slate-600">
            Cadastro litúrgico com cargo, orixá de frente e status — como no módulo real do AxéCloud.
          </p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" aria-hidden />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome..."
            className={`${demoInputClass} pl-9`}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <DemoCard>
          <h4 className="mb-4 flex items-center gap-1.5 text-sm font-bold text-slate-900">
            <Plus className="h-4 w-4 text-emerald-600" aria-hidden />
            Adicionar filho de santo
          </h4>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className={demoLabelClass}>Nome</label>
              <input
                className={demoInputClass}
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Ex: Mariana de Iansã"
              />
            </div>
            <div>
              <label className={demoLabelClass}>Cargo</label>
              <select
                className={demoInputClass}
                value={form.cargo}
                onChange={(e) => setForm({ ...form, cargo: e.target.value })}
              >
                <option>Médium de Desenvolvimento</option>
                <option>Zelador de Santo</option>
                <option>Ogã</option>
                <option>Cambone</option>
                <option>Filho de Santo</option>
              </select>
            </div>
            <div>
              <label className={demoLabelClass}>Orixá de frente</label>
              <select
                className={demoInputClass}
                value={form.orixaFrente}
                onChange={(e) => setForm({ ...form, orixaFrente: e.target.value })}
              >
                {['Oxum', 'Iansã', 'Ogum', 'Oxóssi', 'Xangô', 'Oxalá', 'Yemanjá', 'Obaluaiê'].map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={demoLabelClass}>Guia espiritual</label>
              <input
                className={demoInputClass}
                value={form.guiaEspiritual}
                onChange={(e) => setForm({ ...form, guiaEspiritual: e.target.value })}
                placeholder="Ex: Caboclo Penacho Violeta"
              />
            </div>
            <div>
              <label className={demoLabelClass}>Status</label>
              <select
                className={demoInputClass}
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as DemoFilho['status'] })}
              >
                <option value="Ativo">Ativo</option>
                <option value="Pendente">Pendente</option>
                <option value="Inativo">Inativo</option>
              </select>
            </div>
            <button type="submit" className="landing-btn-primary mt-2 w-full py-2.5 text-xs">
              Salvar na demo
            </button>
          </form>
        </DemoCard>

        <div className="space-y-3 lg:col-span-2">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-xs">
                <thead className="bg-slate-50">
                  <tr>
                    {['Filho', 'Cargo', 'Orixá', 'Guia', 'Status', ''].map((h) => (
                      <th
                        key={h || 'actions'}
                        className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filtered.map((f) => (
                    <tr key={f.id} className="transition-colors hover:bg-slate-50">
                      <td className="whitespace-nowrap px-4 py-3.5 font-medium text-slate-900">
                        <div className="flex items-center gap-2">
                          <span
                            className={`grid h-7 w-7 place-items-center rounded-full text-[10px] font-bold ${f.avatarTone}`}
                          >
                            {f.nome.slice(0, 2).toUpperCase()}
                          </span>
                          {f.nome}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-slate-600">{f.cargo}</td>
                      <td className="px-4 py-3.5 font-semibold text-emerald-600">{f.orixaFrente}</td>
                      <td className="px-4 py-3.5 italic text-slate-500">{f.guiaEspiritual}</td>
                      <td className="px-4 py-3.5">
                        <span
                          className={
                            f.status === 'Ativo'
                              ? 'rounded-full border border-emerald-500/30 bg-emerald-50 px-2 py-0.5 text-[9px] font-bold text-emerald-600'
                              : f.status === 'Pendente'
                                ? 'rounded-full border border-amber-500/30 bg-amber-50 px-2 py-0.5 text-[9px] font-bold text-amber-600'
                                : 'rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-500'
                          }
                        >
                          {f.status}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setFilhos((prev) => prev.filter((x) => x.id !== f.id));
                            onNotify(`${f.nome} removido da demo.`, 'info');
                          }}
                          className="rounded p-1 text-rose-500 hover:bg-rose-50 hover:text-rose-600"
                          aria-label={`Remover ${f.nome}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                        Nenhum filho encontrado para &ldquo;{search}&rdquo;.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
          <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-[11px] text-slate-600">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden />
            <span>
              No AxéCloud real, cada terreiro tem ambiente isolado (RLS), perfis de acesso e histórico completo do
              filho — esta demo roda só no seu navegador.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
