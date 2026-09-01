export function normalizeBrazilPhone(raw: unknown): string | null {
  let digits = String(raw || '').replace(/\D/g, '');
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    digits = digits.slice(2);
  }

  if (!/^[1-9]{2}(?:9\d{8}|[2-5]\d{7})$/.test(digits)) return null;
  return digits;
}

export function formatBrazilPhone(raw: unknown): string {
  const digits = String(raw || '').replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '').slice(0, 11);
  if (digits.length <= 2) return digits ? `(${digits}` : '';
  const ddd = digits.slice(0, 2);
  const number = digits.slice(2);
  if (number.length <= 4) return `(${ddd}) ${number}`;
  const split = number.length > 8 ? 5 : 4;
  return `(${ddd}) ${number.slice(0, split)}-${number.slice(split)}`;
}

export function brazilPhoneMsisdn(raw: unknown): string | null {
  const national = normalizeBrazilPhone(raw);
  return national ? `55${national}` : null;
}
