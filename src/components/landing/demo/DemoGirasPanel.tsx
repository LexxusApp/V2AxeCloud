import { useState } from 'react';
import { CalendarDays, Clock, Sparkles, X } from 'lucide-react';
import { DEMO_GIRAS_INITIAL, formatDemoDate, type DemoGira } from '../../../constants/landingDemo';
import { DemoCard, demoInputClass, demoLabelClass } from './demoUi';

type Props = {
  onNotify: (message: string, type?: 'success' | 'info' | 'error') => void;
};

export function DemoGirasPanel({ onNotify }: Props) {
  const [giras, setGiras] = useState<DemoGira[]>(DEMO_GIRAS_INITIAL);
  const [form, setForm] = useState({
    nome: '',
    tipo: 'Normal',
    data: '',
    horario: '20:00',
    status: 'Confirmada' as DemoGira['status'],
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome.trim() || !form.data) {
      onNotify('Informe nome e data da gira.', 'error');
      return;
    }
    const saved: DemoGira = {
      id: String(Date.now()),
      nome: form.nome.trim(),
      tipo: form.tipo,
      data: form.data,
      horario: form.horario,
      status: form.status,
    };
    setGiras((prev) => [saved, ...prev]);
    setForm({ nome: '', tipo: 'Normal', data: '', horario: '20:00', status: 'Confirmada' });
    onNotify(`Gira marcada: ${saved.nome}`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-display text-lg font-bold text-[#F1F5F9]">Calendário de giras</h3>
        <p className="text-xs text-[#94A3B8]">
          Agende trabalhos espirituais, festas e giras — com lembretes automáticos no WhatsApp no app real.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <DemoCard>
          <h4 className="mb-4 text-sm font-bold text-[#F1F5F9]">Nova gira / evento</h4>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className={demoLabelClass}>Nome</label>
              <input
                className={demoInputClass}
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Ex: Gira Caboclos Penacho"
              />
            </div>
            <div>
              <label className={demoLabelClass}>Tipo de trabalho</label>
              <select
                className={demoInputClass}
                value={form.tipo}
                onChange={(e) => setForm({ ...form, tipo: e.target.value })}
              >
                <option>Normal</option>
                <option>Caridade</option>
                <option>Festa pública</option>
                <option>Trabalho interno</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={demoLabelClass}>Data</label>
                <input
                  type="date"
                  className={demoInputClass}
                  value={form.data}
                  onChange={(e) => setForm({ ...form, data: e.target.value })}
                />
              </div>
              <div>
                <label className={demoLabelClass}>Horário</label>
                <input
                  className={demoInputClass}
                  value={form.horario}
                  onChange={(e) => setForm({ ...form, horario: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className={demoLabelClass}>Destaque</label>
              <select
                className={demoInputClass}
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as DemoGira['status'] })}
              >
                <option value="Confirmada">Confirmada</option>
                <option value="Especial">Especial / obrigação</option>
              </select>
            </div>
            <button type="submit" className="landing-btn-primary mt-2 w-full py-2.5 text-xs">
              Marcar na agenda
            </button>
          </form>
        </DemoCard>

        <div className="space-y-3 lg:col-span-2">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {giras.map((g) => (
              <article
                key={g.id}
                className="flex flex-col justify-between rounded-2xl border border-[#1E242B] bg-[#13171D] p-4 transition-colors hover:border-[#2F3643]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span
                      className={
                        g.status === 'Especial'
                          ? 'rounded-full border border-rose-500/30 bg-rose-950/40 px-2 py-0.5 text-[8px] font-bold uppercase tracking-widest text-rose-300'
                          : 'rounded-full border border-emerald-500/30 bg-emerald-950/40 px-2 py-0.5 text-[8px] font-bold uppercase tracking-widest text-emerald-300'
                      }
                    >
                      {g.tipo}
                    </span>
                    <h4 className="mt-2 text-sm font-bold text-[#F1F5F9]">{g.nome}</h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setGiras((prev) => prev.filter((x) => x.id !== g.id));
                      onNotify(`Gira removida: ${g.nome}`, 'info');
                    }}
                    className="rounded p-1 text-zinc-500 hover:text-rose-400"
                    aria-label="Remover gira"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-[#1E242B] pt-3 text-xs text-[#94A3B8]">
                  <span className="flex items-center gap-1">
                    <CalendarDays className="h-3.5 w-3.5" aria-hidden />
                    {formatDemoDate(g.data)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" aria-hidden />
                    {g.horario}
                  </span>
                </div>
              </article>
            ))}
          </div>
          <div className="flex items-start gap-3 rounded-xl border border-[#1E242B] bg-[#12161A] p-4">
            <div className="rounded-lg border border-[#1E242B] bg-[#13171D] p-2 text-primary">
              <Sparkles className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <p className="text-xs font-bold text-[#F1F5F9]">Convites e lembretes no WhatsApp</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-[#94A3B8]">
                No AxéCloud real, convidados com telefone recebem o convite ao serem adicionados ao evento — e lembretes
                automáticos antes da gira.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
