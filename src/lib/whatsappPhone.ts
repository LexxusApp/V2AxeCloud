/**
 * Normaliza telefone brasileiro para WhatsApp Cloud / Evolution (MSISDN E.164 sem +).
 * Corrige o caso comum de "9 a mais" (ex.: 55549996528561 → 5554996528561).
 */

export function digitsOnly(value: string): string {
  return String(value || "").replace(/\D/g, "");
}

function ensureMobileNine(ddd: string, line: string): string {
  if (line.length === 8 && /^[6-9]/.test(line)) return `${ddd}9${line}`;
  if (line.length === 9 && line.startsWith("9")) return `${ddd}${line}`;
  throw new Error(
    `Número inválido para celular (${ddd} ${line}). Use 11 dígitos com o 9, ex.: ${ddd}912345678.`
  );
}

/** Se veio com 9 duplicado após o DDD, remove um. */
function stripDuplicateMobileNine(national11or12: string): string {
  // DDD (2) + 99 + 8 dígitos = 12 → vira DDD + 9 + 8
  if (national11or12.length === 12 && national11or12[2] === "9" && national11or12[3] === "9") {
    return `${national11or12.slice(0, 2)}9${national11or12.slice(4)}`;
  }
  return national11or12;
}

/**
 * Retorna MSISDN 55 + DDD + 9 + 8 dígitos (13 dígitos).
 * Lança Error com mensagem clara se inválido.
 */
export function normalizeBrWhatsAppMsisdn(phone: string): string {
  let digits = digitsOnly(phone);
  if (!digits) throw new Error("Número de telefone inválido");
  if (digits.length < 10) {
    throw new Error("Número incompleto: digite DDD + celular (10 ou 11 dígitos).");
  }

  // Já com país
  if (digits.startsWith("55")) {
    let local = digits.slice(2);
    local = stripDuplicateMobileNine(local);
    if (local.length === 11 && local[2] === "9") return `55${local}`;
    if (local.length === 10) {
      const ddd = local.slice(0, 2);
      const line = local.slice(2);
      return `55${ensureMobileNine(ddd, line)}`;
    }
    if (local.length === 12 && local[2] === "9" && local[3] === "9") {
      // stripDuplicate deveria ter resolvido; reforço
      const fixed = `${local.slice(0, 2)}9${local.slice(4)}`;
      if (fixed.length === 11) return `55${fixed}`;
    }
    throw new Error(
      "Número brasileiro inválido. Confira se não há um 9 a mais. Ex.: 54996528561 (11 dígitos)."
    );
  }

  digits = stripDuplicateMobileNine(digits);

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
      "Número com 12 dígitos — confira se não digitou um 9 a mais. Ex.: 54996528561, não 549996528561."
    );
  }

  throw new Error("Formato de telefone não reconhecido. Digite DDD + celular com 9 (11 dígitos).");
}

/** Forma nacional sem 55 (11 dígitos) para gravar em filhos_de_santo.whatsapp_phone. */
export function normalizeBrWhatsAppNational(phone: string): string {
  const msisdn = normalizeBrWhatsAppMsisdn(phone);
  return msisdn.startsWith("55") ? msisdn.slice(2) : msisdn;
}

/** Preview amigável do MSISDN; null se inválido. */
export function previewBrWhatsAppMsisdn(phone: string): string | null {
  try {
    const raw = digitsOnly(phone);
    if (raw.length < 10) return null;
    return normalizeBrWhatsAppMsisdn(phone);
  } catch {
    return null;
  }
}

/** Lê WhatsApp do filho (coluna canônica `whatsapp_phone`, fallback legado `contato`). */
export function resolveChildWhatsAppPhone(row: Record<string, unknown> | null | undefined): string {
  if (!row) return "";
  const raw = row.whatsapp_phone ?? row.contato;
  return raw != null ? String(raw) : "";
}
