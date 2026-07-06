/**
 * Normaliza telefone brasileiro para pareamento WhatsApp (Evolution/Baileys).
 * O número precisa ser EXATAMENTE o da conta no celular (com o 9 do móvel).
 */
export function normalizeBrWhatsAppMsisdn(phone: string): string {
  let digits = String(phone || "").replace(/\D/g, "");
  if (!digits) throw new Error("Número de telefone inválido");
  if (digits.length < 10) {
    throw new Error("Número incompleto: digite DDD + linha (10 ou 11 dígitos).");
  }

  const ensureMobileNine = (ddd: string, line: string): string => {
    if (line.length === 8 && /^[6-9]/.test(line)) return `${ddd}9${line}`;
    if (line.length === 9 && line.startsWith("9")) return `${ddd}${line}`;
    throw new Error(
      `Número inválido para celular (${ddd} ${line}). Use 11 dígitos com o 9, ex.: ${ddd}912345678.`,
    );
  };

  if (digits.startsWith("55")) {
    const local = digits.slice(2);
    if (local.length === 11) return digits;
    if (local.length === 10) {
      const ddd = local.slice(0, 2);
      const line = local.slice(2);
      return `55${ensureMobileNine(ddd, line)}`;
    }
    throw new Error("Número brasileiro inválido. Use DDD + 9 + oito dígitos (11 números após o 55).");
  }

  if (digits.length === 10) {
    const ddd = digits.slice(0, 2);
    const line = digits.slice(2);
    return `55${ensureMobileNine(ddd, line)}`;
  }

  if (digits.length === 11) {
    if (digits[2] !== "9") {
      throw new Error("Celular no Brasil precisa do 9 após o DDD (ex.: 11912345678).");
    }
    return `55${digits}`;
  }

  if (digits.length === 12) {
    throw new Error(
      "Número com 12 dígitos — confira se não digitou um 9 a mais. Ex.: 11912276156 (11 dígitos), não 119912276156.",
    );
  }

  throw new Error("Formato de telefone não reconhecido. Digite DDD + celular com 9 (11 dígitos).");
}

/** Preview amigável do MSISDN que será enviado à Evolution. */
export function previewBrWhatsAppMsisdn(phone: string): string | null {
  try {
    const raw = digitsOnly(phone);
    if (raw.length < 10) return null;
    return normalizeBrWhatsAppMsisdn(phone);
  } catch {
    return null;
  }
}

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/** Lê WhatsApp do filho (coluna canônica `whatsapp_phone`, fallback legado `contato`). */
export function resolveChildWhatsAppPhone(row: Record<string, unknown> | null | undefined): string {
  if (!row) return "";
  const raw = row.whatsapp_phone ?? row.contato;
  return raw != null ? String(raw) : "";
}
