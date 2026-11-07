import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Check, CircleAlert } from 'lucide-react';
import type { DemoMember } from './MembersPage';
import type { DemoPix } from './PixSettingsPage';
import { WorkflowDialog } from './WorkflowUI';
import { financialMoney as money, parseFinancialAmount, type CashEntry } from './finance';
import { createMonthlyCharge, financialToday, monthlyAmounts, monthlyLabel, validFinancialDate, type MonthlyCharge, type ChargeDraft } from './billing';
import './billing.css';

type EntryDraft = ChargeDraft & { kind: 'income' | 'expense'; category: string; date: string; createdAt: number };
type Props = { open: boolean; onOpenChange: (open: boolean) => void; members: DemoMember[]; charges: MonthlyCharge[]; pix?: DemoPix | null; initialCash?: Partial<CashEntry> | null; initialCharge?: MonthlyCharge | null; monthlyOnly?: boolean; editingCash?: boolean; onSaveCash?: (entry: CashEntry) => void; onSaveCharge: (charge: MonthlyCharge) => void };
export default function FinancialEntryDialog({ open, onOpenChange, members, charges, pix, initialCash, initialCharge, monthlyOnly = false, editingCash = false, onSaveCash, onSaveCharge }: Props) {
  const [draft, setDraft] = useState<EntryDraft | null>(null);
  const [error, setError] = useState('');
  const savingRef=useRef(false);const [saving,setSaving]=useState(false);
  useEffect(() => {
    if (!open) return;
    const today = financialToday();
    const lastDay = new Date(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 0).getDate();
    const dueDate = `${today.slice(0, 7)}-${String(Math.min(lastDay, Number(pix?.day || 10))).padStart(2, '0')}`;
    const charge = initialCharge;
    setDraft({ id: charge?.id || initialCash?.id || `entry-${crypto.randomUUID()}`, kind: initialCash?.kind || 'income', category: charge || monthlyOnly ? 'Mensalidade' : initialCash?.category || 'Doação', description: charge?.description || initialCash?.description || '', amount: charge ? (charge.baseCents / 100).toFixed(2).replace('.', ',') : initialCash?.cents ? (initialCash.cents / 100).toFixed(2).replace('.', ',') : monthlyOnly && pix ? pix.amount : '', memberId: charge?.memberId || initialCash?.memberId || '', date: initialCash?.date || today, dueDate: charge?.dueDate || dueDate, interestMode: charge?.interestMode || 'none', interestValue: charge?.interestValue || '', status: charge?.status || 'pending', receivedDate: charge?.receivedDate || today, createdAt: initialCash?.createdAt || Date.now() });
    setError('');
  }, [open, initialCharge, initialCash, monthlyOnly, pix]);
  if (!draft) return null;
  const patch = (value: Partial<EntryDraft>) => { setDraft({ ...draft, ...value }); setError(''); };
  const isMonthly = draft.kind === 'income' && draft.category === 'Mensalidade';
  const amounts = isMonthly ? monthlyAmounts(draft.amount, draft.interestMode, draft.interestValue) : null;
  const total = isMonthly ? amounts?.totalCents || 0 : parseFinancialAmount(draft.amount) || 0;
  const save = async (event: FormEvent) => {
    event.preventDefault();
    try {
      if (isMonthly) {
        if (editingCash) throw new Error('Este movimento já está no caixa. Ele não pode virar uma mensalidade pela edição. Para corrigir um lançamento feito por engano, remova-o pelo extrato; crie a cobrança em Lançar mensalidade.');
        await onSaveCharge(createMonthlyCharge(draft, members, charges));
      }
      else {
        if (!draft.description.trim() || !total) throw new Error('Informe a descrição e um valor maior que zero, no formato 100,00.');
        if (!validFinancialDate(draft.date) || draft.date > financialToday()) throw new Error('Informe a data em que o valor foi recebido ou pago, até hoje.');
        if (draft.memberId && !members.some(member => member.id === draft.memberId)) throw new Error('Selecione um membro válido.');
        await onSaveCash?.({ id: draft.id, kind: draft.kind, category: draft.category, date: draft.date, description: draft.description.trim(), cents: total, memberId: draft.memberId || undefined, createdAt: draft.createdAt });
      }
      onOpenChange(false);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível salvar. Confira os dados e tente novamente.'); } finally {savingRef.current=false;setSaving(false);}
  };
  return <WorkflowDialog open={open} onOpenChange={onOpenChange} title={initialCharge ? 'Editar mensalidade' : editingCash ? 'Editar lançamento' : 'Novo lançamento'} description="O registro será salvo no sistema e vinculado à casa e ao membro selecionado.">
    <form className="billing-form" onSubmit={save}>
      {!monthlyOnly && <div className="billing-options" role="group" aria-label="Tipo do lançamento">{(['income', 'expense'] as const).map(kind => <button type="button" key={kind} aria-pressed={draft.kind === kind} onClick={() => patch({ kind, category: kind === 'income' ? 'Doação' : 'Insumos' })}>{kind === 'income' ? 'Entrada (receita)' : 'Saída (despesa)'}</button>)}</div>}
      <label className="billing-wide">Descrição do lançamento *<input required maxLength={1500} value={draft.description} onChange={e => patch({ description: e.target.value })} placeholder={isMonthly ? 'Ex.: Mensalidade de setembro' : 'Descreva o movimento da casa'} /></label>
      {!monthlyOnly && <label>Categoria *<select value={draft.category} onChange={e => patch({ category: e.target.value, ...(e.target.value === 'Mensalidade' && !draft.amount && pix ? { amount: pix.amount } : {}) })}>{[...new Set([...(draft.kind === 'income' ? ['Doação', 'Mensalidade', 'Insumos', 'Contas', 'Manutenção', 'Evento', 'Cantina', 'Outros'] : ['Insumos', 'Contas', 'Manutenção', 'Evento', 'Doação', 'Outros']), draft.category])].filter(category => !editingCash || category !== 'Mensalidade').map(category => <option key={category}>{category}</option>)}</select></label>}
      <label>Valor {isMonthly ? 'base ' : ''}(R$) *<input required inputMode="decimal" value={draft.amount} onChange={e => patch({ amount: e.target.value })} placeholder="100,00" /></label>
      {isMonthly && <fieldset className="billing-interest billing-wide"><legend>Situação da mensalidade e juros</legend><div className="billing-options" role="group" aria-label="Situação da mensalidade"><button type="button" aria-pressed={draft.status === 'pending'} onClick={() => patch({ status: 'pending' })}>Pendente (cobrar membro)</button><button type="button" aria-pressed={draft.status === 'paid'} onClick={() => patch({ status: 'paid' })}>Quitada (já paga)</button></div><div className="billing-options" role="group" aria-label="Juros ou multa por atraso">{([['none', 'Sem juros'], ['fixed', 'Valor fixo (R$)'], ['percent', 'Porcentagem (%)']] as const).map(([mode, label]) => <button key={mode} type="button" aria-pressed={draft.interestMode === mode} onClick={() => patch({ interestMode: mode })}>{label}</button>)}</div>{draft.interestMode !== 'none' && <label>{draft.interestMode === 'percent' ? 'Taxa de juros / multa (%)' : 'Juros / multa (R$)'}<input required inputMode="decimal" value={draft.interestValue} onChange={e => patch({ interestValue: e.target.value })} placeholder={draft.interestMode === 'percent' ? '2' : '10,00'} /></label>}<p>Aplicação única sobre o valor base, como no sistema atual.</p><div className="billing-calculation"><span>Base {money(parseFinancialAmount(draft.amount) || 0)} + juros {money(amounts?.extraCents || 0)}</span><strong>Total {money(total)}</strong></div></fieldset>}
      <label>{isMonthly ? 'Vencimento da mensalidade *' : 'Data do movimento *'}<input required type="date" max={isMonthly ? undefined : financialToday()} value={isMonthly ? draft.dueDate : draft.date} onInput={e => patch(isMonthly ? { dueDate: e.currentTarget.value } : { date: e.currentTarget.value })} onChange={e => patch(isMonthly ? { dueDate: e.target.value } : { date: e.target.value })} />{isMonthly && <small>A referência vem desta data: {validFinancialDate(draft.dueDate) ? monthlyLabel(draft.dueDate.slice(0, 7)) : 'informe o vencimento'}. Pode ser de um mês antigo.</small>}</label>
      <label>Vincular membro {isMonthly ? '*' : '(opcional)'}<select required={isMonthly} value={draft.memberId} onChange={e => patch({ memberId: e.target.value })}><option value="">{isMonthly ? 'Selecione o membro' : 'Sem vínculo'}</option>{members.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label>
      {isMonthly && draft.status === 'paid' && <label className="billing-wide">Data do recebimento *<input required type="date" max={financialToday()} value={draft.receivedDate} onInput={e => patch({ receivedDate: e.currentTarget.value })} onChange={e => patch({ receivedDate: e.target.value })} /><small>O caixa usa esta data. A referência da mensalidade continua sendo o mês do vencimento.</small></label>}
      <div className="billing-note billing-wide"><CircleAlert size={18} /><p>{isMonthly ? draft.status === 'pending' ? 'A cobrança aparecerá nas Mensalidades e no financeiro do membro. Só entrará no caixa após a baixa.' : 'A mensalidade ficará quitada no perfil do membro e o recebimento entrará uma única vez no caixa.' : 'Este movimento registra dinheiro recebido ou pago. Vincular um membro identifica o registro; não cria uma cobrança.'}</p></div>
      {error && <p className="wf-error billing-wide" role="alert">{error}</p>}
      <div className="billing-footer billing-wide"><strong>{money(total)}</strong><button className="wf-button" type="submit" disabled={saving} aria-busy={saving}><Check size={17} />{saving?'Salvando…':'Salvar lançamento'}</button></div>
    </form>
  </WorkflowDialog>;
}
