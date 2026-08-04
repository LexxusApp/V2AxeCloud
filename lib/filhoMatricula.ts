/** Registro de filho exibido no perfil e usado no login: AXC-{ano}-{4 chars do UUID}. */

const MATRICULA_RE = /^AXC-(\d{4})-([A-Z0-9]{4})$/i;
const MATRICULA_COMPACT_RE = /^AXC(\d{4})([A-Z0-9]{4})$/i;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isFilhoUuid(value: string): boolean {
  return UUID_RE.test(String(value || "").trim());
}

export function formatFilhoMatricula(id: string, dataEntrada?: string | null): string {
  const uuid = String(id || "");
  const year = dataEntrada
    ? new Date(String(dataEntrada)).getFullYear()
    : new Date().getFullYear();
  return `AXC-${year}-${uuid.substring(0, 4).toUpperCase()}`;
}

/**
 * Normaliza digitação solta: `axc2026a1b2`, `axc-2026-a1b2`, espaços → `AXC-2026-A1B2`.
 * Também formata enquanto digita (insere hífens).
 */
export function normalizeFilhoLoginIdInput(input: string): string {
  const alnum = String(input || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  if (!alnum) return "";

  if (alnum.startsWith("AXC")) {
    const rest = alnum.slice(3);
    if (!rest) return "AXC";
    if (rest.length <= 4) return `AXC-${rest}`;
    return `AXC-${rest.slice(0, 4)}-${rest.slice(4, 8)}`;
  }

  return alnum;
}

export type ParsedFilhoLoginId = {
  kind: "uuid" | "matricula" | "prefix";
  uuidPrefix: string;
  matriculaYear?: number;
};

export function parseFilhoLoginId(input: string): ParsedFilhoLoginId | null {
  const raw = String(input || "").trim();
  if (!raw) return null;

  if (isFilhoUuid(raw)) {
    return { kind: "uuid", uuidPrefix: raw };
  }

  const normalized = normalizeFilhoLoginIdInput(raw);
  const matriculaMatch = normalized.match(MATRICULA_RE) || raw.match(MATRICULA_RE);
  if (matriculaMatch) {
    return {
      kind: "matricula",
      uuidPrefix: matriculaMatch[2].toLowerCase(),
      matriculaYear: Number(matriculaMatch[1]),
    };
  }

  const compact = raw.replace(/[^a-zA-Z0-9]/g, "").match(MATRICULA_COMPACT_RE);
  if (compact) {
    return {
      kind: "matricula",
      uuidPrefix: compact[2].toLowerCase(),
      matriculaYear: Number(compact[1]),
    };
  }

  const alnum = raw.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  if (alnum.length >= 4) {
    return { kind: "prefix", uuidPrefix: alnum };
  }

  return null;
}

export function isValidFilhoLoginId(input: string): boolean {
  const parsed = parseFilhoLoginId(input);
  if (!parsed) return false;
  if (parsed.kind === "uuid" || parsed.kind === "matricula") return true;
  return parsed.uuidPrefix.length >= 12;
}

/** Chave estável para rate-limit / lockout (sufixo UUID, não o registro inteiro). */
export function filhoLoginRateLimitKey(input: string): string {
  const parsed = parseFilhoLoginId(input);
  if (!parsed) return String(input || "").trim().toLowerCase();
  if (parsed.kind === "uuid") return String(parsed.uuidPrefix).toLowerCase();
  return parsed.uuidPrefix.toLowerCase();
}
