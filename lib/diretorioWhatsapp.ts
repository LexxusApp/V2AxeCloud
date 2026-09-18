function digitsOnly(value: unknown): string {
  return String(value || "").replace(/\D/g, "");
}

function normalizeBrazilianPhone(value: unknown): string | null {
  let digits = digitsOnly(value);
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  if (!/^55[1-9]\d(?:\d{8}|\d{9})$/.test(digits)) return null;
  return digits;
}

/**
 * Resolve o contato que pode receber o CTA público de WhatsApp.
 * Um campo explicitamente informado aceita celular ou WhatsApp Business fixo;
 * números antigos importados do Maps só são aceitos quando têm formato móvel.
 */
export function resolveDiretorioWhatsapp(explicitWhatsapp: unknown, telefone: unknown): string | null {
  const explicit = normalizeBrazilianPhone(explicitWhatsapp);
  if (explicit) return explicit;

  const inferred = normalizeBrazilianPhone(telefone);
  if (!inferred) return null;
  const nationalNumber = inferred.slice(4);
  return nationalNumber.length === 9 && nationalNumber.startsWith("9") ? inferred : null;
}