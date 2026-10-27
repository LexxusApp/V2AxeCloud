export type ManualFinanceInput = {
  tipo: string; valor: string | number; categoria: string; data: string; descricao: string;
  filho_id?: string | null; status?: string; jurosTipo?: string; jurosValor?: string | number;
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function buildManualFinanceEntry(input: ManualFinanceInput) {
  if (!['entrada', 'saida'].includes(input.tipo)) throw new Error('Selecione entrada ou saída.');
  const valor = Number(input.valor);
  if (!Number.isFinite(valor) || valor <= 0) throw new Error('Informe um valor maior que zero.');
  const date = String(input.data || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) throw new Error('Informe uma data válida.');
  const categoria = String(input.categoria || '').trim();
  const descricao = String(input.descricao || '').trim();
  if (!categoria || !descricao || descricao.length > 1500) throw new Error('Preencha a categoria e a descrição (até 1.500 caracteres).');
  const monthly = categoria === 'Mensalidade';
  const filho_id = String(input.filho_id || '').trim() || null;
  if (filho_id && !uuid.test(filho_id)) throw new Error('Selecione um membro válido.');
  if (monthly && !filho_id) throw new Error('Selecione o filho de santo para vincular a mensalidade.');
  if (monthly && input.tipo !== 'entrada') throw new Error('Mensalidade é uma entrada. Para despesas, selecione outra categoria.');
  if (monthly && input.status && !['pago', 'pendente'].includes(input.status)) throw new Error('Situação da mensalidade inválida.');
  let extra = 0;
  let suffix = '';
  if (monthly && input.jurosTipo && input.jurosTipo !== 'nenhum') {
    const interest = Number(input.jurosValor);
    if (!['valor', 'porcentagem'].includes(input.jurosTipo) || !Number.isFinite(interest) || interest < 0) throw new Error('Informe juros ou multa válidos.');
    extra = input.jurosTipo === 'porcentagem' ? valor * interest / 100 : interest;
    suffix = ` (+ ${input.jurosTipo === 'porcentagem' ? interest + '%: ' : ''}R$ ${(Math.round(extra * 100) / 100).toFixed(2)} juros/multa)`;
  }
  const total = Math.round((valor + extra) * 100) / 100;
  if (!Number.isFinite(total) || total > 999999999) throw new Error('Valor do lançamento fora do limite permitido.');
  const status = monthly ? (input.status || 'pendente') : 'pago';
  return { tipo: input.tipo, valor: total, categoria, data: date, filho_id, status,
    data_vencimento: monthly ? date : null,
    descricao: `${descricao}${suffix}${monthly ? ` (${status === 'pago' ? 'competência' : 'vencimento'} ${date})` : ''}${filho_id ? ` (ID:${filho_id})` : ''}` };
}

export function isPendingMonthlyEntry(row: Record<string, any>) {
  if (row.categoria !== 'Mensalidade' || row.tipo !== 'entrada') return false;
  const status = String(row.status || '').toLowerCase();
  if (['pago', 'paid', 'confirmado', 'cancelado', 'excluido'].includes(status)) return false;
  return ['pendente', 'pending', 'atrasado', 'overdue'].includes(status) || (!status && /\(vencimento/i.test(String(row.descricao || '')));
}
