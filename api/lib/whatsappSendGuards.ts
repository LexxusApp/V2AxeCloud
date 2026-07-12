import type { SupabaseClient } from "@supabase/supabase-js";
import { format } from "date-fns";
import { assertWithinSendWindow, isCampaignTipo, shouldEnforceSendWindow } from "./whatsappAntiSpam.js";
import { assertCampaignFingerprintQuota } from "./whatsappPersistentLimits.js";

function envInt(name: string, fallback: number): number {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw >= 0 ? Math.floor(raw) : fallback;
}

const MESSAGE_MIN_LEN = envInt("WA_MESSAGE_MIN_LEN", 3);
const MESSAGE_MAX_LEN = envInt("WA_MESSAGE_MAX_LEN", 3500);
const TENANT_DAILY_MAX = envInt("WA_TENANT_DAILY_MAX", 60);
const BROADCAST_MAX_RECIPIENTS = envInt("WA_BROADCAST_MAX_RECIPIENTS", 25);
const FANOUT_MAX_RECIPIENTS = envInt("WA_FANOUT_MAX_RECIPIENTS", 30);
const BROADCAST_COOLDOWN_MS = envInt("WA_BROADCAST_COOLDOWN_MS", 600_000);
const FANOUT_COOLDOWN_MS = envInt("WA_FANOUT_COOLDOWN_MS", 300_000);

function httpError(message: string, statusCode: number, code?: string): Error & { statusCode: number; code?: string } {
  const err = new Error(message) as Error & { statusCode: number; code?: string };
  err.statusCode = statusCode;
  if (code) err.code = code;
  return err;
}

/** Valida tamanho e conteúdo mínimo da mensagem antes do envio. */
export function validateWhatsAppOutboundMessage(message: string): string {
  const text = String(message || "").trim();
  if (text.length < MESSAGE_MIN_LEN) {
    throw httpError(`Mensagem muito curta (mínimo ${MESSAGE_MIN_LEN} caracteres).`, 400, "WA_MESSAGE_TOO_SHORT");
  }
  if (text.length > MESSAGE_MAX_LEN) {
    throw httpError(`Mensagem muito longa (máximo ${MESSAGE_MAX_LEN} caracteres).`, 400, "WA_MESSAGE_TOO_LONG");
  }
  return text;
}

/** Impede que um terreiro dispare volume excessivo no mesmo dia. */
export async function assertTenantWhatsAppDailyQuota(
  sb: SupabaseClient,
  tenantId: string,
  plannedSends = 1
): Promise<void> {
  if (TENANT_DAILY_MAX <= 0) return;
  const today = format(new Date(), "yyyy-MM-dd");
  const { count, error } = await sb
    .from("whatsapp_logs")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("status", "sent")
    .gte("created_at", `${today}T00:00:00`);
  if (error) throw error;
  const used = count || 0;
  if (used + plannedSends > TENANT_DAILY_MAX) {
    throw httpError(
      `Limite diário de envios do terreiro atingido (${TENANT_DAILY_MAX}/dia). Tente novamente amanhã ou divida em lotes.`,
      429,
      "WA_QUOTA_TENANT_DAILY"
    );
  }
}

/** Limita tamanho de transmissão (corrente geral). */
export function assertBroadcastRecipientLimit(recipientCount: number): void {
  if (BROADCAST_MAX_RECIPIENTS <= 0) return;
  if (recipientCount > BROADCAST_MAX_RECIPIENTS) {
    throw httpError(
      `Transmissão limitada a ${BROADCAST_MAX_RECIPIENTS} destinatários por vez (proteção anti-spam). Divida em lotes menores.`,
      400,
      "WA_BROADCAST_TOO_LARGE"
    );
  }
}

/** Limita fan-out automático (mural, gira, mensalidade em massa). */
export function assertFanoutRecipientLimit(recipientCount: number, tipo: string): void {
  if (!isCampaignTipo(tipo) && tipo !== "financeiro") return;
  if (FANOUT_MAX_RECIPIENTS <= 0) return;
  if (recipientCount > FANOUT_MAX_RECIPIENTS) {
    throw httpError(
      `Envio em massa limitado a ${FANOUT_MAX_RECIPIENTS} destinatários por disparo (${tipo}). O restante será ignorado nesta rodada.`,
      400,
      "WA_FANOUT_TOO_LARGE"
    );
  }
}

/** Retorna no máximo N destinatários, embaralhados para não sempre começar pelos mesmos. */
export function capAndShuffleRecipients<T>(items: T[], max: number): T[] {
  if (max <= 0 || items.length <= max) {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }
  const shuffled = capAndShuffleRecipients(items, 0);
  return shuffled.slice(0, max);
}

/** Cooldown entre transmissões do mesmo terreiro. */
export async function assertBroadcastCooldown(sb: SupabaseClient, tenantId: string): Promise<void> {
  if (BROADCAST_COOLDOWN_MS <= 0) return;
  const { data: last } = await sb
    .from("whatsapp_logs")
    .select("created_at")
    .eq("tenant_id", tenantId)
    .eq("tipo", "broadcast")
    .eq("telefone", "corrente_geral")
    .in("status", ["sent", "partial"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!last?.created_at) return;
  const elapsed = Date.now() - new Date(String(last.created_at)).getTime();
  if (elapsed < BROADCAST_COOLDOWN_MS) {
    const waitMin = Math.ceil((BROADCAST_COOLDOWN_MS - elapsed) / 60000);
    throw httpError(
      `Aguarde cerca de ${waitMin} min antes de uma nova transmissão (proteção anti-spam).`,
      429,
      "WA_BROADCAST_COOLDOWN"
    );
  }
}

/** Cooldown entre fan-outs automáticos (mural, gira). */
export async function assertFanoutCooldown(sb: SupabaseClient, tenantId: string, tipo: string): Promise<void> {
  if (FANOUT_COOLDOWN_MS <= 0) return;
  const { data: last } = await sb
    .from("whatsapp_logs")
    .select("created_at")
    .eq("tenant_id", tenantId)
    .eq("tipo", tipo)
    .eq("status", "sent")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!last?.created_at) return;
  const elapsed = Date.now() - new Date(String(last.created_at)).getTime();
  if (elapsed < FANOUT_COOLDOWN_MS) {
    const waitMin = Math.ceil((FANOUT_COOLDOWN_MS - elapsed) / 60000);
    throw httpError(
      `Aguarde cerca de ${waitMin} min antes de outro envio em massa (${tipo}).`,
      429,
      "WA_FANOUT_COOLDOWN"
    );
  }
}

/** Verificações anti-spam antes de qualquer envio ou lote. */
export async function assertWhatsAppOutboundAllowed(
  sb: SupabaseClient,
  opts: {
    tenantId: string;
    tipo: string;
    messageText: string;
    plannedSends?: number;
    skipSendWindow?: boolean;
  }
): Promise<{ fingerprint?: string }> {
  if (!opts.skipSendWindow && shouldEnforceSendWindow(opts.tipo)) {
    assertWithinSendWindow(opts.tipo);
  }

  validateWhatsAppOutboundMessage(opts.messageText);
  await assertTenantWhatsAppDailyQuota(sb, opts.tenantId, opts.plannedSends ?? 1);

  let fingerprint: string | undefined;
  if (isCampaignTipo(opts.tipo) || opts.tipo === "financeiro") {
    fingerprint = await assertCampaignFingerprintQuota(
      sb,
      opts.tenantId,
      opts.messageText,
      opts.plannedSends ?? 1
    );
  }

  return { fingerprint };
}
