export const supportCategories = {
  duvida: 'Dúvida sobre o uso',
  financeiro: 'Financeiro e Pix',
  filhos: 'Cadastro da corrente',
  gira: 'Giras e presença',
  sugestao: 'Sugestão de melhoria',
} as const;

export type SupportCategory = keyof typeof supportCategories;

export function isSupportCategory(value: string): value is SupportCategory {
  return Object.hasOwn(supportCategories, value);
}
