/**
 * Espaçamento de envios POR TERREIRO (tenant) no caminho Meta Cloud direto.
 * Cada terreiro tem sua própria fila de ritmo: o fan-out do terreiro A
 * não atrasa o terreiro B. A Evolution já tem fila própria; isto cobre
 * o envio direto na Graph API, que antes saía em rajada.
 */
import { resolveSendCategory, type WhatsAppSendCategory } from "./whatsappAntiSpam.js";

function envInt(name: string, fallback: number): number {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw >= 0 ? Math.floor(raw) : fallback;
}

/** Intervalo mínimo entre envios de campanha do MESMO terreiro (padrão 20s). */
const TENANT_CAMPAIGN_DELAY_MS = envInt("WA_TENANT_CAMPAIGN_DELAY_MS", 20_000);
/** Intervalo entre notificações comuns do mesmo terreiro (padrão 3s; 0 desliga). */
const TENANT_NOTIFICATION_DELAY_MS = envInt("WA_TENANT_NOTIFICATION_DELAY_MS", 3_000);

const tails = new Map<string, Promise<void>>();
const lastSentAt = new Map<string, number>();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function delayForCategory(category: WhatsAppSendCategory): number {
  if (category === "campaign") return TENANT_CAMPAIGN_DELAY_MS;
  if (category === "notification") return TENANT_NOTIFICATION_DELAY_MS;
  // critical/transactional (OTP, dados de acesso, confirmações) saem sem espera
  return 0;
}

/**
 * Aguarda a "vez" do terreiro antes de um envio Meta direto.
 * Envios simultâneos do mesmo tenant se serializam com o intervalo configurado;
 * tenants diferentes correm em paralelo sem se bloquear.
 */
export function waitTenantSendSlot(tenantId: string | undefined, tipo: string): Promise<void> {
  const category = resolveSendCategory(String(tipo || ""));
  const delay = delayForCategory(category);
  if (delay <= 0) return Promise.resolve();

  const key = String(tenantId || "__global__");
  const prev = tails.get(key) || Promise.resolve();
  const next = prev.then(async () => {
    const last = lastSentAt.get(key) || 0;
    const wait = last + delay - Date.now();
    if (wait > 0) await sleep(wait);
    lastSentAt.set(key, Date.now());
  });
  tails.set(key, next.catch(() => {}));
  return next;
}
