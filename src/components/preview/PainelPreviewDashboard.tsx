import { CalendarDays, ChevronRight, Heart, TrendingUp, Users, Wallet } from 'lucide-react';
import { formatDemoMoney } from '../../constants/landingDemo';
import { cn } from '../../lib/utils';
import { PreviewFlowChart } from './PreviewFlowChart';
import { PreviewKpiCard, PreviewPanelCard, PreviewSectionHeader } from './painelPreviewUi';

const BIRTHDAYS = [
  { nome: 'Mariana', dia: '03', tone: 'bg-amber-100 text-amber-800' },
  { nome: 'Alexandre', dia: '08', tone: 'bg-sky-100 text-sky-800' },
  { nome: 'Clara', dia: '14', tone: 'bg-rose-100 text-rose-800' },
  { nome: 'Vinícius', dia: '21', tone: 'bg-emerald-100 text-emerald-800' },
];

const NOTICES = [
  { tag: 'Aviso', titulo: 'Reunião de pais e mães de santo', quando: 'Há 2 h' },
  { tag: 'Evento', titulo: 'Festa de Iemanjá — confirme presença', quando: 'Ontem' },
  { tag: 'Pedido', titulo: '5 novos pedidos de reza aguardando', quando: 'Hoje' },
];

const PEDIDOS = [
  { nome: 'Lucia de Oxum', pedido: 'Saúde e proteção', status: 'Pendente' },
  { nome: 'Carlos Caboclo', pedido: 'Trabalho e caminhos abertos', status: 'Em atendimento' },
];

export default function PainelPreviewDashboard() {
  return (
    <div className="space-y-6">
      <PreviewSectionHeader
        title="Visão geral da casa"
        description="Resumo do mês — saldo, corpo mediúnico, próxima gira e comunicados."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <PreviewKpiCard
          label="Saldo do mês"
          value={formatDemoMoney(4280)}
          hint={
            <span className="inline-flex items-center gap-1 text-emerald-700">
              <TrendingUp className="h-3 w-3" aria-hidden />
              +12,4% vs. maio
            </span>
          }
          icon={Wallet}
        />
        <PreviewKpiCard label="Filhos ativos" value="47" hint="+3 novos este mês" icon={Users} />
        <PreviewKpiCard label="Próxima gira" value="Em 3 dias" hint="15 de junho · 20:00" icon={CalendarDays} />
        <PreviewKpiCard label="Pedidos de reza" value="5" hint="2 aguardando resposta" icon={Heart} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <PreviewPanelCard className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h3 className="font-display text-sm font-bold text-[#1b1813]">Entradas x saídas</h3>
            <span className="rounded-full border border-[#dccfb8] bg-[#faf6ef] px-2.5 py-1 text-[10px] font-bold text-[#1b1813]/60">
              Junho 2026
            </span>
          </div>
          <PreviewFlowChart />
        </PreviewPanelCard>

        <PreviewPanelCard className="flex flex-col">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#1b1813]/50">Próxima gira</p>
          <div className="mt-3 flex gap-3">
            <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-[#FFC107] text-[#1b1813]">
              <span className="text-[10px] font-black uppercase leading-none">Jun</span>
              <span className="font-display text-xl font-black leading-none">15</span>
            </div>
            <div className="min-w-0">
              <h3 className="font-display text-base font-bold text-[#1b1813]">Gira de Caboclos</h3>
              <p className="mt-0.5 text-xs text-[#1b1813]/60">Salão principal · Domingo 20:00</p>
            </div>
          </div>
          <button
            type="button"
            className="mt-auto flex h-10 w-full items-center justify-center gap-1 rounded-lg bg-[#FFC107] text-xs font-black uppercase tracking-wider text-[#1b1813] transition hover:bg-[#e6ad00]"
          >
            Ver detalhes
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          </button>
        </PreviewPanelCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <PreviewPanelCard className="lg:col-span-2">
          <h3 className="mb-4 font-display text-sm font-bold text-[#1b1813]">Aniversariantes do mês</h3>
          <div className="flex gap-4 overflow-x-auto pb-1 scrollbar-none">
            {BIRTHDAYS.map((b) => (
              <div key={b.nome} className="flex shrink-0 flex-col items-center gap-2">
                <div className={cn('grid h-12 w-12 place-items-center rounded-full text-sm font-black', b.tone)}>
                  {b.nome.charAt(0)}
                </div>
                <div className="text-center">
                  <p className="text-xs font-bold text-[#1b1813]">{b.nome}</p>
                  <p className="text-[10px] text-[#1b1813]/50">{b.dia} JUN</p>
                </div>
              </div>
            ))}
          </div>
        </PreviewPanelCard>

        <PreviewPanelCard>
          <h3 className="mb-3 font-display text-sm font-bold text-[#1b1813]">Comunicados recentes</h3>
          <ul className="space-y-3">
            {NOTICES.map((n) => (
              <li key={n.titulo} className="border-b border-[#dccfb8]/60 pb-3 last:border-0 last:pb-0">
                <span className="inline-flex rounded-full bg-[#FFC107]/20 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-[#1b1813]">
                  {n.tag}
                </span>
                <p className="mt-1 text-xs font-semibold text-[#1b1813]">{n.titulo}</p>
                <p className="text-[10px] text-[#1b1813]/45">{n.quando}</p>
              </li>
            ))}
          </ul>
        </PreviewPanelCard>
      </div>

      <PreviewPanelCard>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="font-display text-sm font-bold text-[#1b1813]">Pedidos de reza recentes</h3>
          <button type="button" className="text-[11px] font-bold text-[#1b1813]/55 hover:text-[#1b1813]">
            Ver todos
          </button>
        </div>
        <ul className="divide-y divide-[#dccfb8]/60">
          {PEDIDOS.map((p) => (
            <li key={p.nome} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
              <div>
                <p className="text-sm font-bold text-[#1b1813]">{p.nome}</p>
                <p className="text-xs text-[#1b1813]/55">{p.pedido}</p>
              </div>
              <span
                className={cn(
                  'shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wide',
                  p.status === 'Pendente' ? 'bg-amber-100 text-amber-800' : 'bg-sky-100 text-sky-800',
                )}
              >
                {p.status}
              </span>
            </li>
          ))}
        </ul>
      </PreviewPanelCard>
    </div>
  );
}
