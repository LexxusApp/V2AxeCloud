/** Regras alinhadas ao Supabase Auth: lower_upper_letters_digits_symbols (mín. 8). */
export const PASSWORD_MIN_LEN = 8;

export const PASSWORD_HINT_PT =
  'Use pelo menos 8 caracteres, com letra maiúscula, minúscula, número e símbolo (ex.: Axé@2026).';

const HAS_LOWER = /[a-z]/;
const HAS_UPPER = /[A-Z]/;
const HAS_DIGIT = /\d/;
const HAS_SYMBOL = /[^A-Za-z0-9]/;

export function validateStrongPassword(password: string): { ok: true } | { ok: false; message: string } {
  const value = String(password || '');
  if (value.length < PASSWORD_MIN_LEN) {
    return { ok: false, message: `A senha deve ter pelo menos ${PASSWORD_MIN_LEN} caracteres.` };
  }
  if (!HAS_LOWER.test(value)) {
    return { ok: false, message: 'Inclua pelo menos uma letra minúscula (a–z).' };
  }
  if (!HAS_UPPER.test(value)) {
    return { ok: false, message: 'Inclua pelo menos uma letra maiúscula (A–Z).' };
  }
  if (!HAS_DIGIT.test(value)) {
    return { ok: false, message: 'Inclua pelo menos um número.' };
  }
  if (!HAS_SYMBOL.test(value)) {
    return { ok: false, message: 'Inclua pelo menos um símbolo (ex.: @, #, !).' };
  }
  return { ok: true };
}

export function humanizePasswordPolicyError(err: unknown, fallback = 'Não foi possível alterar a senha.'): string {
  const msg = String((err as { message?: string })?.message || err || '').trim();
  const lower = msg.toLowerCase();
  if (!msg) return fallback;

  if (
    lower.includes('password should contain') ||
    lower.includes('weak password') ||
    lower.includes('password is known') ||
    lower.includes('pwned')
  ) {
    return PASSWORD_HINT_PT;
  }
  if (lower.includes('at least') && lower.includes('character')) {
    return PASSWORD_HINT_PT;
  }
  if (lower.includes('same password') || lower.includes('different from')) {
    return 'A nova senha deve ser diferente da senha anterior.';
  }

  return msg.length > 160 ? fallback : msg;
}
