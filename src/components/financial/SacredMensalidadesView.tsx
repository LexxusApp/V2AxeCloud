import React from 'react';
import {
  Clock,
  CheckCircle2,
  CalendarDays,
  Search,
  MessageCircle,
  Loader2,
  Settings,
  Users,
  QrCode,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Smartphone
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { AxeMetricRail, AxeMetricCard } from '../shared/AxePageScaffold';

interface SacredMensalidadesViewProps {
  receiptPanel?: React.ReactNode;
  receiptPendingCount?: number;
  receiptOpenIds?: string[];
  mensalidadeAtiva: boolean;
  isTogglingMensalidade: boolean;
  handleToggleMensalidadeAtiva: (v: boolean) => Promise<void>;
  mensalidadesTab: 'pendentes' | 'pagas' | 'comprovantes';
  setMensalidadesTab: (v: 'pendentes' | 'pagas' | 'comprovantes') => void;
  mensalidadeSearch: string;
  setMensalidadeSearch: (v: string) => void;
  mensalidadesLoading: boolean;
  mensalidadesSyncing?: boolean;
  mensalidadesError?: string;
  onRetryMensalidades?: () => void;
  mensalidadesPendentesFiltradas: any[];
  mensalidadesPagasFiltradas: any[];
  pendingMonthlyTotal: number;
  overdueMonthlyCount: number;
  handleMensalidadeLiquidar: (row: any) => Promise<void>;
  handleGerarCobranca: (fid: string, nome: string, venc: string, valor: string) => Promise<void>;
  processingMensalidadeId: string | null;
  sendingChargeKey: string | null;
  mensalidadesValorEdits: Record<string, string>;
  setMensalidadesValorEdits: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  formatBRL: (v: number) => string;
  onNavigateToConfigs?: () => void;
  onNavigateToChildren?: () => void;
}

export const SacredMensalidadesView: React.FC<SacredMensalidadesViewProps> = ({
  receiptPanel, receiptPendingCount=0, receiptOpenIds=[],
  mensalidadeAtiva,
  isTogglingMensalidade,
  handleToggleMensalidadeAtiva,
  mensalidadesTab,
  setMensalidadesTab,
  mensalidadeSearch,
  setMensalidadeSearch,
  mensalidadesLoading,
  mensalidadesSyncing,
  mensalidadesError,
  onRetryMensalidades,
  mensalidadesPendentesFiltradas,
  mensalidadesPagasFiltradas,
  pendingMonthlyTotal,
  overdueMonthlyCount,
  handleMensalidadeLiquidar,
  handleGerarCobranca,
  processingMensalidadeId,
  sendingChargeKey,
  mensalidadesValorEdits,
  setMensalidadesValorEdits,
  formatBRL,
  onNavigateToConfigs,
  onNavigateToChildren,
}) => {
  const totalConfirmadoMes = mensalidadesPagasFiltradas.reduce((acc, m) => acc + (Number(m.valor) || 0), 0);

  return (
    <div className="sacred-mensalidades-container space-y-6">
      {/* 1. Métricas da Corrente */}
      <AxeMetricRail className="grid grid-cols-1 sm:grid-cols-3">
        <AxeMetricCard
          label="Em Aberto"
          value={formatBRL(pendingMonthlyTotal)}
          icon={Clock}
          tone="amber"
          subtext={`${mensalidadesPendentesFiltradas.length} cobrança(s) pendente(s)`}
        />
        <AxeMetricCard
          label="Recebido no Mês"
          value={formatBRL(totalConfirmadoMes)}
          icon={CheckCircle2}
          tone="emerald"
          subtext={`${mensalidadesPagasFiltradas.length} pagamento(s) confirmado(s)`}
        />
        <AxeMetricCard
          label="Em Atraso"
          value={overdueMonthlyCount}
          icon={CalendarDays}
          tone="rose"
          subtext="Médiuns que pedem acompanhamento"
        />
      </AxeMetricRail>

      {/* 2. Barra de Controle de Cobrança do Terreiro */}
      <div className="rounded-lg border border-[#E0D7C6] bg-white p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-[#EAE3D5] pb-5">
          <div className="flex items-start gap-3">
            <button
              type="button"
              role="switch"
              aria-checked={mensalidadeAtiva}
              disabled={isTogglingMensalidade}
              onClick={() => void handleToggleMensalidadeAtiva(!mensalidadeAtiva)}
              className={cn(
                "relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors focus:outline-none disabled:opacity-60",
                mensalidadeAtiva ? "bg-[#17251D]" : "bg-[#D5CBB8]"
              )}
            >
              <span
                className={cn(
                  "block h-5 w-5 rounded-full bg-white shadow-xs transition-transform duration-200",
                  mensalidadeAtiva ? "translate-x-5" : "translate-x-0"
                )}
              />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-display text-sm sm:text-base font-black text-[#17251D]">
                  Cobrança de Mensalidade {mensalidadeAtiva ? 'Ativa' : 'Desativada'}
                </h4>
                <span className={cn(
                  "rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wide",
                  mensalidadeAtiva ? "bg-emerald-100 text-emerald-800" : "bg-neutral-100 text-neutral-600"
                )}>
                  {mensalidadeAtiva ? "Em Operação" : "Pausada"}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-[#6F675C]">
                {mensalidadeAtiva
                  ? 'O terreiro gera pendências mensais e os médiuns visualizam o Pix e valor no Portal do Filho.'
                  : 'Cobrança desativada. Nenhuma mensalidade nova será cobrada automaticamente da corrente.'}
              </p>
            </div>
          </div>

          {/* Abas Pendentes / Pagas */}
          {(mensalidadeAtiva || receiptPanel) && (
            <div className="flex flex-wrap shrink-0 items-center rounded-lg border border-[#D5CBB8] bg-[#FAF8F4] p-1">
              <button
                type="button"
                onClick={() => setMensalidadesTab('pendentes')}
                className={cn(
                  "rounded-xl px-4 py-2 text-xs font-black transition",
                  mensalidadesTab === 'pendentes' ? "bg-[#17251D] text-white shadow-xs" : "text-[#5C5547] hover:text-[#17251D]"
                )}
              >
                Pendentes ({mensalidadesPendentesFiltradas.length})
              </button>
              <button
                type="button"
                onClick={() => setMensalidadesTab('pagas')}
                className={cn(
                  "rounded-xl px-4 py-2 text-xs font-black transition",
                  mensalidadesTab === 'pagas' ? "bg-emerald-700 text-white shadow-xs" : "text-[#5C5547] hover:text-[#17251D]"
                )}
              >
                Pagas ({mensalidadesPagasFiltradas.length})
              </button>
              {receiptPanel&&<button type="button" onClick={()=>setMensalidadesTab('comprovantes')} className={cn('min-h-11 rounded-xl px-3 py-2 text-xs font-black',mensalidadesTab==='comprovantes'?'bg-[#17251D] text-white':'text-[#5C5547]')}>Comprovantes ({receiptPendingCount})</button>}
            </div>
          )}
        </div>

        {/* Busca rápida */}
        {mensalidadeAtiva && mensalidadesTab!=='comprovantes' && (
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-[#F0ECE1] pb-4">
            <div className="relative flex-1 max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8F8778]" />
              <input
                type="search"
                value={mensalidadeSearch}
                onChange={(e) => setMensalidadeSearch(e.target.value)}
                placeholder="Buscar médium por nome…"
                className="w-full rounded-xl border border-[#D5CBB8] bg-[#FAF8F4] pl-9 pr-3 py-2 text-xs font-semibold text-[#17251D] placeholder:text-[#9A9182] focus:border-[#17251D] focus:bg-white focus:outline-none"
              />
            </div>
            <p className="text-xs font-bold text-[#6F675C]">
              {mensalidadesTab === 'pendentes'
                ? `${mensalidadesPendentesFiltradas.length} cobrança(s) aguardando pagamento`
                : `${mensalidadesPagasFiltradas.length} mensalidade(s) quitada(s) no mês`}
            </p>
          </div>
        )}

        {/* 3. Conteúdo: Lista de Mensalidades OU Painel de Demonstração / Onboarding */}
        <div className="mt-5">
          {mensalidadesError && (
            <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950">
              <p>{mensalidadesError}</p>
              <button type="button" onClick={onRetryMensalidades} className="min-h-11 font-bold underline underline-offset-4">Tentar novamente</button>
            </div>
          )}
          {mensalidadesSyncing && !mensalidadesLoading && (
            <p role="status" className="mb-3 flex items-center gap-2 text-xs font-semibold text-[#526558]">
              <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" /> Atualizando mensalidades…
            </p>
          )}
          {mensalidadesTab==='comprovantes' ? receiptPanel : mensalidadesLoading ? (
            <div className="flex items-center justify-center py-12 text-sm font-bold text-[#6F675C]">
              <Loader2 className="h-5 w-5 animate-spin text-[#17251D] mr-2" />
              Carregando mensalidades…
            </div>
          ) : !mensalidadeAtiva ? (
            <div className="rounded-lg border border-[#E0D7C6] bg-[#FAF8F4] p-10 text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-lg bg-amber-50 text-amber-700">
                <Settings className="h-6 w-6" />
              </div>
              <h4 className="mt-3 font-display text-base font-black text-[#17251D]">Mensalidades Desativadas</h4>
              <p className="mx-auto mt-1 max-w-md text-xs text-[#6F675C]">
                Ative o interruptor acima para organizar a contribuição da corrente com chave Pix e lembretes automáticos.
              </p>
            </div>
          ) : mensalidadesTab === 'pendentes' && mensalidadesPendentesFiltradas.length > 0 ? (
            <div className="divide-y divide-[#F0ECE1]">
              {mensalidadesPendentesFiltradas.map((row) => {
                const nome = row.filhos_de_santo?.nome || 'Filho de santo';
                const fid = row.filho_id || '';
                const venc = String(row.data_vencimento || row.data || '').slice(0, 10);
                const valorCampo = mensalidadesValorEdits[row.id] ?? String(row.valor ?? '');
                const chargeKey = `${fid}:${venc}`;
                const isSendingCharge = sendingChargeKey === chargeKey;

                return (
                  <div
                    key={row.id}
                    className="flex flex-col gap-3 py-3.5 sm:flex-row sm:items-center sm:justify-between px-2 rounded-xl transition hover:bg-[#FAF8F4]"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#17251D]/10 font-black text-sm text-[#17251D]">
                        {nome.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-display text-sm font-bold text-[#17251D] truncate">{nome}</p>
                        <p className="text-[11px] font-semibold text-[#796F5E]">
                          Vencimento: {venc ? new Date(`${venc}T12:00:00`).toLocaleDateString('pt-BR') : 'A definir'}
                        </p>
                        {receiptOpenIds.includes(row.id)&&<p className="mt-1 text-xs font-bold text-amber-800">Comprovante em análise · lembretes pausados</p>}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-[#6F675C]">R$</span>
                        <input
                          type="number"
                          step="0.01"
                          value={valorCampo}
                          onChange={(e) => setMensalidadesValorEdits(prev => ({ ...prev, [row.id]: e.target.value }))}
                          className="w-24 rounded-lg border border-[#D5CBB8] bg-white px-2 py-1 text-xs font-black text-[#17251D] focus:outline-none"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => void handleMensalidadeLiquidar(row)}
                        disabled={processingMensalidadeId !== null}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-[#17251D] px-3.5 py-2 text-xs font-black text-white shadow-xs transition hover:bg-[#233B2E]"
                      >
                        {processingMensalidadeId === row.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />}
                        {processingMensalidadeId === row.id ? 'Baixando…' : 'Dar Baixa'}
                      </button>

                      <button
                        type="button"
                        onClick={() => fid ? void handleGerarCobranca(fid, nome, venc, valorCampo) : undefined}
                        disabled={!fid || sendingChargeKey !== null}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-600 bg-emerald-50 px-3.5 py-2 text-xs font-black text-emerald-900 shadow-xs transition hover:bg-emerald-100"
                      >
                        {isSendingCharge ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageCircle className="h-3.5 w-3.5 text-emerald-700" />}
                        {isSendingCharge ? 'Enviando…' : 'Cobrar WhatsApp'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : mensalidadesTab === 'pagas' && mensalidadesPagasFiltradas.length > 0 ? (
            <div className="divide-y divide-[#F0ECE1]">
              {mensalidadesPagasFiltradas.map((row) => {
                const nome = row.filhos_de_santo?.nome || 'Filho de santo';
                const payDate = String(row.data || '').slice(0, 10);
                return (
                  <div
                    key={row.id}
                    className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between px-2 rounded-xl transition hover:bg-[#FAF8F4]"
                  >
                    <div className="flex items-center gap-3">
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-800">
                        <CheckCircle2 className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-display text-sm font-bold text-[#17251D]">{nome}</p>
                        <p className="text-[11px] text-[#6F675C]">
                          Pago em: {payDate ? new Date(`${payDate}T12:00:00`).toLocaleDateString('pt-BR') : 'Data registrada'}
                        </p>
                      </div>
                    </div>
                    <span className="font-display text-sm font-black text-emerald-700">
                      + {formatBRL(row.valor || 0)}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-[#E0D7C6] bg-[#FAF8F4] p-6 text-[#17251D]">
              <h3 className="text-lg font-extrabold">{mensalidadesTab==='pagas'?'Nenhum pagamento confirmado neste mês':'Nenhuma mensalidade neste filtro'}</h3>
              <p className="mt-2 text-sm text-[#5F685E]">Os registros aparecem aqui após a atualização do financeiro. Comprovantes enviados ficam na aba Comprovantes e só quitam a mensalidade após sua confirmação.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
