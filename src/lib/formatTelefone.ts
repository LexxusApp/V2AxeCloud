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

/** Aplica máscara progressiva de telefone BR em inputs (aceita paste com +55). */
export function maskTelefoneInput(raw: string): string {
  let digits = String(raw || '').replace(/\D/g, '');
  if (digits.startsWith('55') && digits.length >= 12) {
    digits = digits.slice(2);
  }
  if (digits.startsWith('0') && digits.length >= 11) {
    digits = digits.slice(1);
  }
  digits = digits.slice(0, 11);

  if (!digits) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

/** Valida se o telefone brasileiro é plausível (DDD 11–99 e 10–11 dígitos, celular com 9). */
export function isValidTelefoneBr(raw: string): boolean {
  let digits = String(raw || '').replace(/\D/g, '');
  if (digits.startsWith('55') && digits.length >= 12) digits = digits.slice(2);
  if (digits.startsWith('0') && digits.length >= 11) digits = digits.slice(1);

  if (digits.length !== 10 && digits.length !== 11) return false;
  const ddd = parseInt(digits.slice(0, 2), 10);
  if (isNaN(ddd) || ddd < 11 || ddd > 99) return false;
  if (digits.length === 11 && digits[2] !== '9') return false;
  return true;
}

export function telefoneHref(raw: string): string {
  let digits = String(raw || '').replace(/\D/g, '');
  if (digits.startsWith('55') && digits.length >= 12) return `tel:+${digits}`;
  if (digits.startsWith('0')) digits = digits.slice(1);
  if (digits.length >= 10) return `tel:+55${digits}`;
  return `tel:${digits}`;
}
