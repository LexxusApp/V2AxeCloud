import { useMemo, useState } from 'react';
import { DollarSign, Plus, Trash2 } from 'lucide-react';
import {
  DEMO_LANCAMENTOS_INITIAL,
  formatDemoMoney,
  type DemoLancamento,
} from '../../../constants/landingDemo';
import { DemoCard, demoInputClass, demoLabelClass } from './demoUi';

type Props = {
  onNotify: (message: string, type?: 'success' | 'info' | 'error') => void;
};

export function DemoFinanceiroPanel({ onNotify }: Props) {
  const [lancamentos, setLancamentos] = useState<DemoLancamento[]>(DEMO_LANCAMENTOS_INITIAL);
  const [form, setForm] = useState({
    descricao: '',
    tipo: 'Entrada' as DemoLancamento['tipo'],
    valor: '',
    categoria: 'Mensalidade',
  });

  const { entradas, saidas, saldo } = useMemo(() => {
    const ent = lancamentos.filter((l) => l.tipo === 'Entrada').reduce((a, l) => a + l.valor, 0);
    const sai = lancamentos.filter((l) => l.tipo === 'Saída').reduce((a, l) => a + l.valor, 0);
    return { entradas: ent, saidas: sai, saldo: ent - sai };
  }, [lancamentos]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const valor = parseFloat(form.valor.replace(',', '.'));
    if (!form.descricao.trim() || !form.valor || Number.isNaN(valor) || valor <= 0) {
      onNotify('Preencha descrição e valor válido.', 'error');
      return;
    }
    const saved: DemoLancamento = {
      id: String(Date.now()),
      descricao: form.descricao.trim(),
      tipo: form.tipo,
      valor,
      categoria: form.categoria,
      data: new Date().toISOString().slice(0, 10),
    };
    setLancamentos((prev) => [saved, ...prev]);
    setForm({ descricao: '', tipo: 'Entrada', valor: '', categoria: 'Mensalidade' });
    onNotify(`Lançamento registrado: ${saved.descricao}`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-display text-lg font-bold text-[#F1F5F9]">Financeiro do terreiro</h3>
        <p className="text-xs text-[#94A3B8]">
          Entradas, saídas e saldo em tempo real — como no módulo financeiro com Pix e mensalidades.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <DemoCard className="flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase text-[#94A3B8]">Entradas</span>
            <p className="mt-1 text-xl font-bold text-emerald-400">{formatDemoMoney(entradas)}</p>
          </div>
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/40 p-2.5 text-emerald-400">
            <Plus className="h-5 w-5" />
          </div>
        </DemoCard>
        <DemoCard className="flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase text-[#94A3B8]">Saídas</span>
            <p className="mt-1 text-xl font-bold text-rose-400">{formatDemoMoney(saidas)}</p>
          </div>
          <div className="rounded-xl border border-rose-500/20 bg-rose-950/40 p-2.5 text-rose-400">
            <Trash2 className="h-5 w-5" />
          </div>
        </DemoCard>
        <DemoCard className="flex items-center justify-between border-primary/25">
          <div>
            <span className="text-[10px] font-bold uppercase text-primary">Saldo</span>
            <p className={`mt-1 text-xl font-bold ${saldo >= 0 ? 'text-[#F1F5F9]' : 'text-rose-400'}`}>
              {formatDemoMoney(saldo)}
            </p>
          </div>
          <div className="rounded-xl border border-primary/20 bg-[#1E252E] p-2.5 text-primary">
            <DollarSign className="h-5 w-5" />
          </div>
        </DemoCard>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <DemoCard>
          <h4 className="mb-4 text-sm font-bold text-[#F1F5F9]">Novo lançamento</h4>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className={demoLabelClass}>Descrição</label>
              <input
                className={demoInputClass}
                value={form.descricao}
                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                placeholder="Ex: Mensalidade — filho João"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={demoLabelClass}>Fluxo</label>
                <select
                  className={demoInputClass}
                  value={form.tipo}
                  onChange={(e) => setForm({ ...form, tipo: e.target.value as DemoLancamento['tipo'] })}
                >
                  <option value="Entrada">Entrada</option>
                  <option value="Saída">Saída</option>
                </select>
              </div>
              <div>
                <label className={demoLabelClass}>Categoria</label>
                <select
                  className={demoInputClass}
                  value={form.categoria}
                  onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                >
                  {['Mensalidade', 'Doação', 'Material litúrgico', 'Oferendas', 'Manutenção'].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className={demoLabelClass}>Valor (R$)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className={demoInputClass}
                value={form.valor}
                onChange={(e) => setForm({ ...form, valor: e.target.value })}
                placeholder="150.00"
              />
            </div>
            <button type="submit" className="landing-btn-primary mt-2 w-full py-2.5 text-xs">
              Registrar lançamento
            </button>
          </form>
        </DemoCard>

        <div className="overflow-hidden rounded-2xl border border-[#1E242B] bg-[#13171D] lg:col-span-2">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[#1E242B] text-xs">
              <thead className="bg-[#12161A]">
                <tr>
                  {['Descrição', 'Categoria', 'Data', 'Fluxo', 'Valor', ''].map((h) => (
                    <th
                      key={h || 'act'}
                      className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E242B]">
                {lancamentos.map((l) => (
                  <tr key={l.id} className="hover:bg-[#1E242B]/40">
                    <td className="px-4 py-3.5 font-medium text-[#F1F5F9]">{l.descricao}</td>
                    <td className="px-4 py-3.5 text-[#94A3B8]">{l.categoria}</td>
                    <td className="px-4 py-3.5 text-[#94A3B8]">{l.data}</td>
                    <td className="px-4 py-3.5">
                      <span
                        className={
                          l.tipo === 'Entrada'
                            ? 'rounded-full border border-emerald-500/30 bg-emerald-950/50 px-2 py-0.5 text-[9px] font-bold text-emerald-300'
                            : 'rounded-full border border-rose-500/30 bg-rose-950/50 px-2 py-0.5 text-[9px] font-bold text-rose-300'
                        }
                      >
                        {l.tipo}
                      </span>
                    </td>
                    <td
                      className={`px-4 py-3.5 text-right font-bold ${l.tipo === 'Entrada' ? 'text-emerald-400' : 'text-rose-400'}`}
                    >
                      {l.tipo === 'Entrada' ? '+' : '−'} {formatDemoMoney(l.valor)}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setLancamentos((prev) => prev.filter((x) => x.id !== l.id));
                          onNotify(`Removido: ${l.descricao}`, 'info');
                        }}
                        className="rounded p-1 text-rose-400 hover:bg-white/5"
                        aria-label="Remover lançamento"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
