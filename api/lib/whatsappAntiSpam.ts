/**
 * Camada anti-spam para envios WhatsApp via Evolution (Baileys).
 * Reduz risco de restrição Meta: janela horária, delays humanos, variação de texto e categorias.
 */

export type WhatsAppSendCategory = "critical" | "transactional" | "notification" | "campaign";

export type WhatsAppSendMeta = {
  category: WhatsAppSendCategory;
  tipo?: string;
  tenantId?: string;
  filhoId?: string | null;
  /** Índice em envio em lote (0 = primeiro) — aumenta delay progressivo. */
  batchIndex?: number;
  batchTotal?: number;
};

function envInt(name: string, fallback: number): number {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw >= 0 ? Math.floor(raw) : fallback;
}

const SEND_WINDOW_START = envInt("WA_SEND_WINDOW_START_HOUR", 8);
const SEND_WINDOW_END = envInt("WA_SEND_WINDOW_END_HOUR", 20);
const SEND_WINDOW_WEEKEND_START = envInt("WA_SEND_WINDOW_WEEKEND_START_HOUR", 9);
const SEND_WINDOW_WEEKEND_END = envInt("WA_SEND_WINDOW_WEEKEND_END_HOUR", 19);
const ENFORCE_SEND_WINDOW = String(process.env.WA_ENFORCE_SEND_WINDOW || "1").trim() !== "0";

const CAMPAIGN_MIN_DELAY = envInt("WA_CAMPAIGN_MIN_DELAY_MS", 20_000);
const CAMPAIGN_MAX_DELAY = Math.max(
  CAMPAIGN_MIN_DELAY,
  envInt("WA_CAMPAIGN_MAX_DELAY_MS", 60_000)
);
const NOTIFICATION_MIN_DELAY = envInt("WA_NOTIFICATION_MIN_DELAY_MS", 8_000);
const NOTIFICATION_MAX_DELAY = Math.max(
  NOTIFICATION_MIN_DELAY,
  envInt("WA_NOTIFICATION_MAX_DELAY_MS", 18_000)
);
const TRANSACTIONAL_MIN_DELAY = envInt("WA_TRANSACTIONAL_MIN_DELAY_MS", 5_000);
const TRANSACTIONAL_MAX_DELAY = Math.max(
  TRANSACTIONAL_MIN_DELAY,
  envInt("WA_TRANSACTIONAL_MAX_DELAY_MS", 12_000)
);
const CRITICAL_MIN_DELAY = envInt("WA_CRITICAL_MIN_DELAY_MS", 3_000);
const CRITICAL_MAX_DELAY = Math.max(CRITICAL_MIN_DELAY, envInt("WA_CRITICAL_MAX_DELAY_MS", 7_000));

const CAMPAIGN_BATCH_EXTRA_MS = envInt("WA_CAMPAIGN_BATCH_EXTRA_MS", 4_000);

const CRITICAL_TIPOS = new Set([
  "otp",
  "forgot_password",
  "recuperar_senha",
  "codigo_verificacao",
]);

const TRANSACTIONAL_TIPOS = new Set([
  "dados_acesso",
  "pedido_reza_novo_zelador",
  "pedido_reza_aceito_fiel",
  "mensalidade_confirmada",
  "convite_evento",
]);

const CAMPAIGN_TIPOS = new Set([
  "broadcast",
  "teste",
  "transmissao_aviso",
  "mural_aviso",
  "aviso_gira",
  "resend_dados_acesso",
]);

const GREETING_VARIANTS: Array<(nome: string) => string> = [
  (nome) => `Axé, ${nome}!`,
  (nome) => `Paz e Luz, ${nome}!`,
  (nome) => `Saudações, ${nome}!`,
  (nome) => `Olá, ${nome}!`,
  (nome) => `Bom dia/tarde/noite, ${nome}!`,
];

const CLOSING_VARIANTS = [
  "Qualquer dúvida, fale com a diretoria do terreiro.",
  "Estamos à disposição.",
  "Conte conosco.",
  "Axé!",
];

function normalizeTipo(tipo: string): string {
  return String(tipo || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_");
}

function hashSeed(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) >>> 0;
  }
  return h;
}

function pickVariant<T>(items: T[], seed: string): T {
  if (items.length === 0) throw new Error("empty variant list");
  return items[hashSeed(seed) % items.length];
}

function jitterBetween(minMs: number, maxMs: number, seed?: string): number {
  if (maxMs <= minMs) return minMs;
  const span = maxMs - minMs;
  if (seed) {
    const offset = hashSeed(seed) % (span + 1);
    return minMs + offset;
  }
  return minMs + Math.floor(Math.random() * (span + 1));
}

/** Horário de Brasília (UTC-3 fixo — sem DST no Brasil). */
function nowBrasilia(): Date {
  const utc = Date.now();
  return new Date(utc - 3 * 60 * 60 * 1000);
}

function isWeekendBr(d: Date): boolean {
  const day = d.getUTCDay();
  return day === 0 || day === 6;
}

/** Verifica se o envio está dentro da janela permitida (evita disparos de madrugada). */
export function isWithinAllowedSendWindow(at: Date = nowBrasilia()): boolean {
  if (!ENFORCE_SEND_WINDOW) return true;
  const hour = at.getUTCHours();
  const weekend = isWeekendBr(at);
  const start = weekend ? SEND_WINDOW_WEEKEND_START : SEND_WINDOW_START;
  const end = weekend ? SEND_WINDOW_WEEKEND_END : SEND_WINDOW_END;
  return hour >= start && hour < end;
}

/** Janela horária só para campanhas em massa — envios pontuais (acesso, financeiro, etc.) podem a qualquer hora. */
export function shouldEnforceSendWindow(tipo?: string): boolean {
  if (!ENFORCE_SEND_WINDOW) return false;
  if (!tipo) return false;
  return resolveSendCategory(tipo) === "campaign";
}

function sendWindowLabel(): string {
  const weekend = isWeekendBr(nowBrasilia());
  const start = weekend ? SEND_WINDOW_WEEKEND_START : SEND_WINDOW_START;
  const end = weekend ? SEND_WINDOW_WEEKEND_END : SEND_WINDOW_END;
  return `${start}h e ${end}h`;
}

/** Milissegundos até a próxima janela de envio (0 se já dentro). */
export function msUntilNextSendWindow(at: Date = nowBrasilia()): number {
  if (isWithinAllowedSendWindow(at)) return 0;
  const hour = at.getUTCHours();
  const weekend = isWeekendBr(at);
  const start = weekend ? SEND_WINDOW_WEEKEND_START : SEND_WINDOW_START;
  let hoursUntil = start - hour;
  if (hoursUntil <= 0) hoursUntil += 24;
  return hoursUntil * 60 * 60 * 1000;
}

export function assertWithinSendWindow(tipo?: string): void {
  if (!shouldEnforceSendWindow(tipo)) return;
  if (isWithinAllowedSendWindow()) return;
  const waitMin = Math.ceil(msUntilNextSendWindow() / 60_000);
  const err = new Error(
    `Transmissões em massa permitidas apenas entre ${sendWindowLabel()} (horário de Brasília). Tente novamente amanhã ou aguarde ~${waitMin} min.`
  ) as Error & { statusCode: number; code: string };
  err.statusCode = 429;
  err.code = "WA_SEND_WINDOW_CLOSED";
  throw err;
}

/** Classifica o tipo de mensagem para prioridade e delay. */
export function resolveSendCategory(tipo: string): WhatsAppSendCategory {
  const t = normalizeTipo(tipo);
  if (CRITICAL_TIPOS.has(t)) return "critical";
  if (CAMPAIGN_TIPOS.has(t)) return "campaign";
  if (TRANSACTIONAL_TIPOS.has(t)) return "transactional";
  return "notification";
}

export function resolveSendPriority(category: WhatsAppSendCategory): number {
  switch (category) {
    case "critical":
      return 0;
    case "transactional":
      return 1;
    case "notification":
      return 2;
    case "campaign":
      return 3;
    default:
      return 2;
  }
}

/** Delay entre envios conforme categoria e posição no lote. */
export function resolveSendDelayMs(meta: WhatsAppSendMeta, seed?: string): number {
  const batchIndex = Math.max(0, meta.batchIndex ?? 0);
  let base: number;
  switch (meta.category) {
    case "critical":
      base = jitterBetween(CRITICAL_MIN_DELAY, CRITICAL_MAX_DELAY, seed);
      break;
    case "transactional":
      base = jitterBetween(TRANSACTIONAL_MIN_DELAY, TRANSACTIONAL_MAX_DELAY, seed);
      break;
    case "notification":
      base = jitterBetween(NOTIFICATION_MIN_DELAY, NOTIFICATION_MAX_DELAY, seed);
      break;
    case "campaign":
    default:
      base = jitterBetween(CAMPAIGN_MIN_DELAY, CAMPAIGN_MAX_DELAY, seed);
      if (batchIndex > 0 && CAMPAIGN_BATCH_EXTRA_MS > 0) {
        base += Math.min(batchIndex * CAMPAIGN_BATCH_EXTRA_MS, 120_000);
      }
      break;
  }
  return base;
}

/** Normaliza texto para fingerprint (ignora nome do membro e espaços). */
export function computeContentFingerprint(text: string): string {
  const normalized = String(text || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/paz e luz|axé|saudações|olá|bom dia\/tarde\/noite/gi, "{{greeting}}")
    .replace(/\{\{[^}]+\}\}/g, "")
    .replace(/\[dedupe-[^\]]+\]/gi, "")
    .replace(/\d{2}\/\d{2}\/\d{4}/g, "{{date}}")
    .trim()
    .slice(0, 500);
  let h = 0;
  for (let i = 0; i < normalized.length; i++) {
    h = (h * 33 + normalized.charCodeAt(i)) >>> 0;
  }
  return `fp_${h.toString(16)}`;
}

export type HumanizeOptions = {
  nomeMembro: string;
  tipo?: string;
  tenantId?: string;
  filhoId?: string | null;
  phone?: string;
  /** Se false, não altera mensagens já com saudação personalizada. */
  forceGreeting?: boolean;
};

/**
 * Varia saudação e fechamento para que mensagens em lote não sejam byte-a-byte idênticas.
 * Mantém o corpo principal intacto.
 */
export function humanizeWhatsAppMessage(text: string, opts: HumanizeOptions): string {
  const body = String(text || "").trim();
  if (!body) return body;

  const seed = [
    opts.tenantId || "",
    opts.filhoId || "",
    opts.phone || "",
    opts.nomeMembro || "",
    new Date().toISOString().slice(0, 10),
  ].join(":");

  const nome = String(opts.nomeMembro || "Membro").trim() || "Membro";
  const greeting = pickVariant(GREETING_VARIANTS, seed)(nome);
  const closing = pickVariant(CLOSING_VARIANTS, `${seed}:close`);

  const hasPersonalGreeting =
    /^(axé|paz e luz|saudações|olá|bom dia)/i.test(body) && body.toLowerCase().includes(nome.toLowerCase());

  if (hasPersonalGreeting && !opts.forceGreeting) {
    return body;
  }

  const lines = body.split("\n");
  const firstLine = lines[0]?.trim() || "";
  const looksLikeGreeting =
    /^(axé|paz e luz|saudações|olá|bom dia)/i.test(firstLine) && firstLine.length < 80;

  if (looksLikeGreeting && !opts.forceGreeting) {
    lines[0] = greeting;
    return lines.join("\n").trim();
  }

  const tipo = normalizeTipo(opts.tipo || "");
  const isCampaign = CAMPAIGN_TIPOS.has(tipo);

  if (isCampaign || opts.forceGreeting) {
    const rest = looksLikeGreeting ? lines.slice(1).join("\n").trim() : body;
    const parts = [greeting, ""];
    if (rest) parts.push(rest);
    if (isCampaign && !rest.toLowerCase().includes(closing.toLowerCase().slice(0, 12))) {
      parts.push("", closing);
    }
    return parts.join("\n").trim().slice(0, 4096);
  }

  return body;
}

export function isCampaignTipo(tipo: string): boolean {
  return CAMPAIGN_TIPOS.has(normalizeTipo(tipo));
}

export function buildSendMeta(
  tipo: string,
  extras?: Partial<Omit<WhatsAppSendMeta, "category">>
): WhatsAppSendMeta {
  return {
    category: resolveSendCategory(tipo),
    tipo,
    ...extras,
  };
}
