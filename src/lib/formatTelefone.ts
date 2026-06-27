/** Formata telefone BR para exibição (aceita 10–13 dígitos, com ou sem DDI/0). */
export function formatTelefoneBr(raw: string): string {
  let digits = String(raw || '').replace(/\D/g, '');
  if (digits.startsWith('55') && digits.length >= 12) digits = digits.slice(2);
  if (digits.startsWith('0') && digits.length >= 11) digits = digits.slice(1);

  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return raw.trim();
}

export function telefoneHref(raw: string): string {
  let digits = String(raw || '').replace(/\D/g, '');
  if (digits.startsWith('55') && digits.length >= 12) return `tel:+${digits}`;
  if (digits.startsWith('0')) digits = digits.slice(1);
  if (digits.length >= 10) return `tel:+55${digits}`;
  return `tel:${digits}`;
}
