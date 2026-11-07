import { monthlyDueShortcut } from '../../lib/financialOverview';
import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { ArrowUpRight, ArrowDownRight, Plus, X, CheckCircle2, Clock3 } from 'lucide-react';
import { cn } from '../../lib/utils';

import type { SacredOverviewViewProps } from './SacredOverviewView';
type Props = Pick<SacredOverviewViewProps, 'formData' | 'setFormData' | 'handleSubmit' | 'submitError' | 'isSubmitting' | 'children' | 'formatBRL'> & { dueDay?: number; open: boolean; onOpenChange: (open: boolean) => void };
export function FinancialEntryModal({ open, onOpenChange, dueDay = 10, formData, setFormData, handleSubmit, submitError, isSubmitting, children, formatBRL }: Props) {
  if (!open) return null;
  return (

        <Dialog.Root open={open} onOpenChange={onOpenChange}><Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-[150] bg-black/50"/><Dialog.Content aria-describedby="manual-finance-description" className="financial-entry-dialog fixed inset-0 z-[151] flex items-center justify-center p-4 outline-none">
          <div className="relative w-full max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-lg border border-[#E0D7C6] bg-[#FAF8F4] p-6 shadow-2xl text-[#17251D]">
            <div className="flex items-center justify-between border-b border-[#E7DFD1] pb-4">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#17251D] text-[#D4AF37]">
                  <Plus className="h-5 w-5" />
                </div>
                <div>
                  <Dialog.Title className="font-display text-lg font-semibold text-[#17251D]">Novo lançamento</Dialog.Title>
                  <p id="manual-finance-description" className="text-sm text-[#6F675C]">Entrada, despesa ou mensalidade vinculada ao membro.</p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Fechar lançamento" disabled={isSubmitting} onClick={() => onOpenChange(false)}
                className="grid h-8 w-8 place-items-center rounded-full bg-white text-[#5C5547] shadow-xs hover:bg-[#EAE3D5]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={async (e) => { if (await handleSubmit(e)) onOpenChange(false); }} className="mt-5 space-y-4">
              {/* Seletor de Fluxo (Entrada / Saída) */}
              <div className="grid grid-cols-2 gap-2 rounded-lg border border-[#DCD4C5] bg-white p-1">
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, tipo: 'entrada' }))}
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-black transition",
                    formData.tipo === 'entrada' ? "bg-emerald-700 text-white shadow-xs" : "text-[#5C5547] hover:text-[#17251D]"
                  )}
                >
                  <ArrowUpRight className="h-4 w-4" /> Entrada (Receita)
                </button>
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, tipo: 'saida' }))}
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-black transition",
                    formData.tipo === 'saida' ? "bg-rose-700 text-white shadow-xs" : "text-[#5C5547] hover:text-[#17251D]"
                  )}
                >
                  <ArrowDownRight className="h-4 w-4" /> Saída (Despesa)
                </button>
              </div>

              {/* Descrição */}
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-[#635A4B] mb-1">
                  Descrição do Lançamento *
                </label>
                <input
                  required
                  type="text"
                  aria-label="Descrição do lançamento" value={formData.descricao}
                  onChange={(e) => setFormData(prev => ({ ...prev, descricao: e.target.value }))}
                  placeholder="Ex: Compra de velas palito brancas para gira"
                  className="w-full rounded-xl border border-[#D5CBB8] bg-white px-3.5 py-2.5 text-xs font-semibold text-[#17251D] placeholder:text-[#9A9182] focus:border-[#17251D] focus:outline-none"
                />
              </div>

              {/* Categoria e Valor */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-wider text-[#635A4B] mb-1">
                    Categoria *
                  </label>
                  <select
                    required
                    aria-label="Categoria"
                    value={formData.categoria}
                    onChange={(e) => {
                      const cat = e.target.value;
                      setFormData(prev => ({
                        ...prev,
                        categoria: cat,
                        ...(cat === 'Mensalidade' ? { status: prev.status || 'pendente' } : {})
                      }));
                    }}
                    className="w-full rounded-xl border border-[#D5CBB8] bg-white px-3 py-2.5 text-xs font-semibold text-[#17251D] focus:border-[#17251D] focus:outline-none"
                  >
                    <option value="">Selecione…</option>
                    <option value="Mensalidade">Mensalidade</option>
                    <option value="Doação">Doação</option>
                    <option value="Insumos">Insumos (Velas/Ervas)</option>
                    <option value="Contas">Contas (Água/Luz)</option>
                    <option value="Manutenção">Manutenção & Obras</option>
                    <option value="Evento">Festa / Cerimônia</option>
                    <option value="Outros">Outros</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-black uppercase tracking-wider text-[#635A4B] mb-1">
                    {formData.categoria === 'Mensalidade' ? 'Valor Base (R$) *' : 'Valor (R$) *'}
                  </label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    min="0.01"
                    aria-label="Valor base"
                    value={formData.valor}
                    onChange={(e) => setFormData(prev => ({ ...prev, valor: e.target.value }))}
                    placeholder="0.00"
                    className="w-full rounded-xl border border-[#D5CBB8] bg-white px-3.5 py-2.5 text-xs font-black text-[#17251D] focus:border-[#17251D] focus:outline-none"
                  />
                </div>
              </div>

              {/* Opções Avançadas de Mensalidade: Situação + Juros / Multa */}
              {formData.categoria === 'Mensalidade' && (
                <div className="rounded-xl border border-amber-300/70 bg-[#FAF4E6] p-3.5 space-y-3">
                  <div>
                    <label className="block text-[11px] font-black uppercase tracking-wider text-[#735A10] mb-1.5">
                      Situação da Mensalidade *
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, status: 'pendente' }))}
                        className={cn(
                          "rounded-lg py-2 px-3 text-xs font-bold transition flex items-center justify-center gap-1.5",
                          formData.status === 'pendente'
                            ? "bg-amber-600 text-white shadow-xs font-black"
                            : "bg-white border border-[#D5CBB8] text-[#5C5547] hover:border-amber-400"
                        )}
                      >
                        <Clock3 className="h-3.5 w-3.5" /> Pendente (Cobrar Filho)
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, status: 'pago' }))}
                        className={cn(
                          "rounded-lg py-2 px-3 text-xs font-bold transition flex items-center justify-center gap-1.5",
                          formData.status === 'pago'
                            ? "bg-emerald-700 text-white shadow-xs font-black"
                            : "bg-white border border-[#D5CBB8] text-[#5C5547] hover:border-emerald-400"
                        )}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> Quitado (Já Pago)
                      </button>
                    </div>
                  </div>

                  {/* Campo de Juros / Multa por Atraso */}
                  <div className="border-t border-[#E7DFD1] pt-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-[11px] font-black uppercase tracking-wider text-[#735A10]">
                        Juros / Multa por Atraso (Opcional)
                      </label>
                      <span className="text-[10px] text-[#8C7A52] font-semibold">Calculado automaticamente</span>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 mb-2.5">
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, jurosTipo: 'nenhum', jurosValor: '' }))}
                        className={cn(
                          "rounded-lg py-1.5 px-2 text-[11px] font-bold transition text-center",
                          (!formData.jurosTipo || formData.jurosTipo === 'nenhum')
                            ? "bg-[#17251D] text-white"
                            : "bg-white border border-[#D5CBB8] text-[#5C5547]"
                        )}
                      >
                        Sem juros
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, jurosTipo: 'valor' }))}
                        className={cn(
                          "rounded-lg py-1.5 px-2 text-[11px] font-bold transition text-center",
                          formData.jurosTipo === 'valor'
                            ? "bg-[#17251D] text-white"
                            : "bg-white border border-[#D5CBB8] text-[#5C5547]"
                        )}
                      >
                        Valor fixo (R$)
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, jurosTipo: 'porcentagem' }))}
                        className={cn(
                          "rounded-lg py-1.5 px-2 text-[11px] font-bold transition text-center",
                          formData.jurosTipo === 'porcentagem'
                            ? "bg-[#17251D] text-white"
                            : "bg-white border border-[#D5CBB8] text-[#5C5547]"
                        )}
                      >
                        Porcentagem (%)
                      </button>
                    </div>

                    {formData.jurosTipo === 'valor' && (
                      <div>
                        <label className="block text-[10px] font-bold text-[#635A4B] mb-1">
                          Valor adicional de juros/multa (R$)
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#8C7A52]">R$</span>
                          <input
                            type="number"
                            aria-label="Valor fixo de juros ou multa"
                            step="0.01"
                            min="0.01"
                            value={formData.jurosValor || ''}
                            onChange={(e) => setFormData(prev => ({ ...prev, jurosValor: e.target.value }))}
                            placeholder="5.00"
                            className="w-full rounded-lg border border-[#D5CBB8] bg-white pl-8 pr-3 py-1.5 text-xs font-black text-[#17251D] focus:border-[#17251D] focus:outline-none"
                          />
                        </div>
                      </div>
                    )}

                    {formData.jurosTipo === 'porcentagem' && (
                      <div>
                        <label className="block text-[10px] font-bold text-[#635A4B] mb-1">
                          Taxa percentual de juros/multa (%)
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            aria-label="Taxa percentual de juros ou multa"
                            step="0.1"
                            min="0.1"
                            value={formData.jurosValor || ''}
                            onChange={(e) => setFormData(prev => ({ ...prev, jurosValor: e.target.value }))}
                            placeholder="2"
                            className="w-full rounded-lg border border-[#D5CBB8] bg-white pl-3 pr-8 py-1.5 text-xs font-black text-[#17251D] focus:border-[#17251D] focus:outline-none"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black text-[#8C7A52]">%</span>
                        </div>
                      </div>
                    )}

                    {/* Resumo do cálculo dinâmico */}
                    {(() => {
                      const base = parseFloat(formData.valor) || 0;
                      const jVal = parseFloat(formData.jurosValor || '0') || 0;
                      if (base <= 0 || jVal <= 0 || !formData.jurosTipo || formData.jurosTipo === 'nenhum') return null;
                      let extra = 0;
                      if (formData.jurosTipo === 'valor') extra = jVal;
                      if (formData.jurosTipo === 'porcentagem') extra = (base * jVal) / 100;
                      const total = base + extra;
                      return (
                        <div className="mt-2.5 rounded-lg bg-amber-100/90 border border-amber-300 p-2.5 text-xs flex items-center justify-between font-medium text-amber-950">
                          <span>
                            Base: <strong>{formatBRL(base)}</strong> + Juros: <strong>{formatBRL(extra)}</strong>
                            {formData.jurosTipo === 'porcentagem' ? ` (${jVal}%)` : ''}
                          </span>
                          <span className="font-black text-emerald-800 text-sm">
                            Total: {formatBRL(total)}
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* Data e Vínculo a Filho */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-wider text-[#635A4B] mb-1">
                    {formData.categoria === 'Mensalidade' ? 'Data de Vencimento da Mensalidade *' : 'Data do Lançamento *'}
                  </label>
                  <input
                    required
                    type="date"
                    aria-label="Data do lançamento ou vencimento"
                    value={formData.data}
                    onChange={(e) => setFormData(prev => ({ ...prev, data: e.target.value }))}
                    className="w-full rounded-xl border border-[#D5CBB8] bg-white px-3 py-2 text-xs font-semibold text-[#17251D] focus:border-[#17251D] focus:outline-none"
                  />
                  {formData.categoria === 'Mensalidade' && (
                    <div className="mt-1 space-y-1">
                      <p className="text-[10px] text-amber-800 font-medium leading-tight">
                        Para cobrar mês atrasado, informe a data em que ela venceu (ex: 10/09 ou 10/10). O sistema identifica o mês no portal do filho por esta data.
                      </p>
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {(() => {
                          const prevYmd = monthlyDueShortcut(-1, dueDay);
                          const currYmd = monthlyDueShortcut(0, dueDay);
                          const prevShort = new Date(prevYmd + 'T12:00:00').toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase();
                          const currShort = new Date(currYmd + 'T12:00:00').toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase();
                          return (
                            <>
                              <button
                                type="button"
                                onClick={() => setFormData(prev => ({ ...prev, data: prevYmd }))}
                                className={cn(
                                  "text-[10px] px-2 py-0.5 rounded font-bold transition border",
                                  formData.data === prevYmd
                                    ? "bg-amber-600 border-amber-700 text-white"
                                    : "bg-white border-[#D5CBB8] text-[#5C5547] hover:border-amber-400"
                                )}
                              >
                                Mês anterior ({prevShort}/{prevYmd.slice(8)})
                              </button>
                              <button
                                type="button"
                                onClick={() => setFormData(prev => ({ ...prev, data: currYmd }))}
                                className={cn(
                                  "text-[10px] px-2 py-0.5 rounded font-bold transition border",
                                  formData.data === currYmd
                                    ? "bg-amber-600 border-amber-700 text-white"
                                    : "bg-white border-[#D5CBB8] text-[#5C5547] hover:border-amber-400"
                                )}
                              >
                                Mês atual ({currShort}/{currYmd.slice(8)})
                              </button>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-black uppercase tracking-wider text-[#635A4B] mb-1">
                    {formData.categoria === 'Mensalidade' ? 'Filho de santo *' : 'Vincular a filho (opcional)'}
                  </label>
                  <select
                    required={formData.categoria === 'Mensalidade'}
                    aria-label="Filho de santo"
                    value={formData.filho_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, filho_id: e.target.value }))}
                    className="w-full rounded-xl border border-[#D5CBB8] bg-white px-3 py-2 text-xs font-semibold text-[#17251D] focus:border-[#17251D] focus:outline-none"
                  >
                    <option value="">Nenhum filho</option>
                    {children.map(c => (
                      <option key={c.id} value={c.id}>{c.nome}</option>
                    ))}
                  </select>
                </div>
              </div>

              {submitError && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800">{submitError}</p>}
              {/* Botão de Conclusão */}
              <div className="pt-3">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full rounded-lg bg-[#17251D] py-3 text-xs sm:text-sm font-black text-[#F4EFE6] shadow-md transition hover:bg-[#243B2E] disabled:opacity-60"
                >
                  {isSubmitting ? 'Gravando no Caixa…' : 'Salvar Lançamento no Livro Caixa'}
                </button>
              </div>
            </form>
          </div>
        </Dialog.Content></Dialog.Portal></Dialog.Root>
  );
}
