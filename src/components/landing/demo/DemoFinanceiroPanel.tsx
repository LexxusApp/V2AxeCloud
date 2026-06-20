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
        <h3 className="font-display text-lg font-bold text-slate-900">Financeiro do terreiro</h3>
        <p className="text-xs text-slate-600">
          Entradas, saídas e saldo em tempo real — como no módulo financeiro com Pix e mensalidades.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <DemoCard className="flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase text-slate-500">Entradas</span>
            <p className="mt-1 text-xl font-bold text-amber-600">{formatDemoMoney(entradas)}</p>
          </div>
          <div className="rounded-xl border border-amber-500/20 bg-amber-50 p-2.5 text-amber-600">
            <Plus className="h-5 w-5" />
          </div>
        </DemoCard>
        <DemoCard className="flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase text-slate-500">Saídas</span>
            <p className="mt-1 text-xl font-bold text-rose-500">{formatDemoMoney(saidas)}</p>
          </div>
          <div className="rounded-xl border border-rose-500/20 bg-rose-50 p-2.5 text-rose-500">
            <Trash2 className="h-5 w-5" />
          </div>
        </DemoCard>
        <DemoCard className="flex items-center justify-between border-amber-500/25">
          <div>
            <span className="text-[10px] font-bold uppercase text-amber-600">Saldo</span>
            <p className={`mt-1 text-xl font-bold ${saldo >= 0 ? 'text-slate-900' : 'text-rose-500'}`}>
              {formatDemoMoney(saldo)}
            </p>
          </div>
          <div className="rounded-xl border border-amber-500/20 bg-amber-50 p-2.5 text-amber-600">
            <DollarSign className="h-5 w-5" />
          </div>
        </DemoCard>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <DemoCard>
          <h4 className="mb-4 text-sm font-bold text-slate-900">Novo lançamento</h4>
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

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white lg:col-span-2">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-xs">
              <thead className="bg-slate-50">
                <tr>
                  {['Descrição', 'Categoria', 'Data', 'Fluxo', 'Valor', ''].map((h) => (
                    <th
                      key={h || 'act'}
                      className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {lancamentos.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3.5 font-medium text-slate-900">{l.descricao}</td>
                    <td className="px-4 py-3.5 text-slate-600">{l.categoria}</td>
                    <td className="px-4 py-3.5 text-slate-600">{l.data}</td>
                    <td className="px-4 py-3.5">
                      <span
                        className={
                          l.tipo === 'Entrada'
                            ? 'rounded-full border border-amber-500/30 bg-amber-50 px-2 py-0.5 text-[9px] font-bold text-amber-600'
                            : 'rounded-full border border-rose-500/30 bg-rose-50 px-2 py-0.5 text-[9px] font-bold text-rose-600'
                        }
                      >
                        {l.tipo}
                      </span>
                    </td>
                    <td
                      className={`px-4 py-3.5 text-right font-bold ${l.tipo === 'Entrada' ? 'text-amber-600' : 'text-rose-500'}`}
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
                        className="rounded p-1 text-rose-500 hover:bg-rose-50"
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
