export function normalizeComprovanteDate(raw: string): string | null {
  const value = String(raw || "").trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  const dmy = /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/.exec(value);
  const parts = iso
    ? { year: Number(iso[1]), month: Number(iso[2]), day: Number(iso[3]) }
    : dmy
      ? { year: Number(dmy[3]), month: Number(dmy[2]), day: Number(dmy[1]) }
      : null;
  if (!parts) return null;
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  if (
    date.getUTCFullYear() !== parts.year ||
    date.getUTCMonth() !== parts.month - 1 ||
    date.getUTCDate() !== parts.day
  ) {
    return null;
  }
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

export function isComprovanteDateCompatible(
  paymentYmd: string,
  competenceYmd: string,
  now: Date = new Date()
): boolean {
  const payment = normalizeComprovanteDate(paymentYmd);
  const competence = normalizeComprovanteDate(competenceYmd);
  if (!payment || !competence) return false;
  const [year, month] = competence.split("-").map(Number);
  const min = new Date(Date.UTC(year, month - 1, 1));
  min.setUTCDate(min.getUTCDate() - 7);
  const max = new Date(Date.UTC(year, month, 0));
  max.setUTCDate(max.getUTCDate() + 15);
  const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  const paidAt = new Date(`${payment}T00:00:00.000Z`);
  return paidAt >= min && paidAt <= max && paidAt <= tomorrow;
}

function normalizedName(raw: string): string {
  return String(raw || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function comprovanteBeneficiarioMatches(expected: string, extracted: string): boolean {
  const a = normalizedName(expected);
  const b = normalizedName(extracted);
  if (!a || !b) return false;
  if (a.includes(b) || b.includes(a)) return true;
  const meaningful = (value: string) => value.split(" ").filter((token) => token.length >= 3);
  const expectedTokens = meaningful(a);
  const extractedTokens = new Set(meaningful(b));
  if (expectedTokens.length === 0) return false;
  const matches = expectedTokens.filter((token) => extractedTokens.has(token)).length;
  return matches >= Math.min(2, expectedTokens.length);
}

export function normalizeComprovanteTransactionId(raw: string): string {
  return String(raw || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * Reduz o CPF lido do comprovante a um padrão de 11 posições quando possível,
 * preservando os dígitos visíveis e marcando os ocultos com "*".
 * Ex.: "***.456.789-**" -> "***456789**"
 */
export function extractCpfMaskPattern(raw: string): string {
  return String(raw || "")
    .replace(/[xX•·°º#oO]/g, "*")
    .replace(/[^0-9*]/g, "");
}

/**
 * Compara o CPF completo do cadastro (11 dígitos) com o CPF lido do comprovante,
 * que normalmente vem mascarado no Pix (apenas os 6 dígitos do meio: ***.456.789-**).
 */
export function cpfComprovanteMatches(fullCadastroCpf: string, rawExtracted: string): boolean {
  const full = String(fullCadastroCpf || "").replace(/\D/g, "");
  if (full.length !== 11) return false;

  const pat = extractCpfMaskPattern(rawExtracted);
  if (!pat) return false;

  const onlyDigits = pat.replace(/\*/g, "");
  const hasMask = pat.includes("*");

  // CPF completo (11 dígitos, sem máscara)
  if (!hasMask && onlyDigits.length === 11) {
    return onlyDigits === full;
  }

  // Padrão posicional de 11 casas (ex.: ***456789**) — casa dígito a dígito
  if (pat.length === 11) {
    let visible = 0;
    for (let i = 0; i < 11; i++) {
      const c = pat[i];
      if (c === "*") continue;
      visible++;
      if (c !== full[i]) return false;
    }
    return visible >= 3;
  }

  // Somente os 6 dígitos do meio (padrão BACEN ***.456.789-**)
  if (!hasMask && onlyDigits.length === 6) {
    return full.slice(3, 9) === onlyDigits;
  }

  // Últimos recursos: sequência visível suficiente contida no CPF completo
  if (!hasMask && onlyDigits.length >= 4 && onlyDigits.length < 11) {
    return full.includes(onlyDigits);
  }

  return false;
}
