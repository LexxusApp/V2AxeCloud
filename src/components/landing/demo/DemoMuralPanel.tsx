import { useState } from 'react';
import { Megaphone, Pin, Trash2 } from 'lucide-react';
import { DEMO_AVISOS_INITIAL, formatDemoDate, type DemoAviso } from '../../../constants/landingDemo';
import { DemoCard, demoInputClass, demoLabelClass } from './demoUi';

type Props = {
  onNotify: (message: string, type?: 'success' | 'info' | 'error') => void;
};

export function DemoMuralPanel({ onNotify }: Props) {
  const [avisos, setAvisos] = useState<DemoAviso[]>(DEMO_AVISOS_INITIAL);
  const [form, setForm] = useState({ titulo: '', autor: 'Zeladoria', resumo: '', fixado: false });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.titulo.trim() || !form.resumo.trim()) {
      onNotify('Preencha título e mensagem do aviso.', 'error');
      return;
    }
    const saved: DemoAviso = {
      id: String(Date.now()),
      titulo: form.titulo.trim(),
      autor: form.autor.trim() || 'Zeladoria',
      resumo: form.resumo.trim(),
      data: new Date().toISOString().slice(0, 10),
      fixado: form.fixado,
    };
    setAvisos((prev) => [saved, ...prev]);
    setForm({ titulo: '', autor: 'Zeladoria', resumo: '', fixado: false });
    onNotify(`Aviso publicado: ${saved.titulo}`);
  };

  const sorted = [...avisos].sort((a, b) => Number(b.fixado) - Number(a.fixado));

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-display text-lg font-bold text-slate-900">Mural de avisos</h3>
        <p className="text-xs text-slate-600">
          Comunicados para filhos de santo e diretoria — o mesmo mural que substitui grupos espalhados no WhatsApp.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <DemoCard>
          <h4 className="mb-4 flex items-center gap-1.5 text-sm font-bold text-slate-900">
            <Megaphone className="h-4 w-4 text-amber-600" aria-hidden />
            Novo aviso
          </h4>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className={demoLabelClass}>Título</label>
              <input
                className={demoInputClass}
                value={form.titulo}
                onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                placeholder="Ex: Escala da gira de sábado"
              />
            </div>
            <div>
              <label className={demoLabelClass}>Autor / setor</label>
              <input
                className={demoInputClass}
                value={form.autor}
                onChange={(e) => setForm({ ...form, autor: e.target.value })}
              />
            </div>
            <div>
              <label className={demoLabelClass}>Mensagem</label>
              <textarea
                className={`${demoInputClass} min-h-[88px] resize-y`}
                value={form.resumo}
                onChange={(e) => setForm({ ...form, resumo: e.target.value })}
                placeholder="Texto visível para a comunidade da casa..."
              />
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={form.fixado}
                onChange={(e) => setForm({ ...form, fixado: e.target.checked })}
                className="rounded border-slate-300"
              />
              Fixar no topo do mural
            </label>
            <button type="submit" className="landing-btn-primary mt-2 w-full py-2.5 text-xs">
              Publicar aviso
            </button>
          </form>
        </DemoCard>

        <ul className="space-y-3 lg:col-span-2" role="list">
          {sorted.map((a) => (
            <li
              key={a.id}
              className="rounded-2xl border border-slate-200 bg-white p-4 transition-colors hover:border-amber-300"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {a.fixado ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/25 bg-amber-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-600">
                        <Pin className="h-3 w-3" aria-hidden />
                        Fixado
                      </span>
                    ) : null}
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{a.autor}</span>
                    <span className="text-[10px] text-slate-400">{formatDemoDate(a.data)}</span>
                  </div>
                  <h4 className="mt-2 text-sm font-bold text-slate-900">{a.titulo}</h4>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-600">{a.resumo}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setAvisos((prev) => prev.filter((x) => x.id !== a.id));
                    onNotify(`Aviso removido: ${a.titulo}`, 'info');
                  }}
                  className="shrink-0 rounded p-1 text-slate-400 hover:text-rose-500"
                  aria-label="Remover aviso"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
