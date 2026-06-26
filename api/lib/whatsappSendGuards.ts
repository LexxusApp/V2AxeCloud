import type { SupabaseClient } from "@supabase/supabase-js";
import { format } from "date-fns";

function envInt(name: string, fallback: number): number {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw >= 0 ? Math.floor(raw) : fallback;
}

const MESSAGE_MIN_LEN = envInt("WA_MESSAGE_MIN_LEN", 3);
const MESSAGE_MAX_LEN = envInt("WA_MESSAGE_MAX_LEN", 3500);
const TENANT_DAILY_MAX = envInt("WA_TENANT_DAILY_MAX", 100);
const BROADCAST_MAX_RECIPIENTS = envInt("WA_BROADCAST_MAX_RECIPIENTS", 60);
const BROADCAST_COOLDOWN_MS = envInt("WA_BROADCAST_PHONE_COOLDOWN_MS", 300_000);

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
      `Limite diário de envios do terreiro atingido (${TENANT_DAILY_MAX}/dia). Tente novamente amanhã.`,
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
      `Transmissão limitada a ${BROADCAST_MAX_RECIPIENTS} destinatários por vez. Divida em lotes menores.`,
      400,
      "WA_BROADCAST_TOO_LARGE"
    );
  }
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
