import type { SupabaseClient } from "@supabase/supabase-js";
import { format } from "date-fns";
import { computeContentFingerprint } from "./whatsappAntiSpam.js";

function envInt(name: string, fallback: number): number {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw >= 0 ? Math.floor(raw) : fallback;
}

const GLOBAL_HOURLY_MAX = envInt("WA_SEND_HOURLY_MAX", 40);
const GLOBAL_DAILY_MAX = envInt("WA_SEND_DAILY_MAX", 250);
const PHONE_COOLDOWN_MS = envInt("WA_SEND_PHONE_COOLDOWN_MS", 120_000);
const CAMPAIGN_FINGERPRINT_HOURLY_MAX = envInt("WA_CAMPAIGN_FINGERPRINT_HOURLY_MAX", 25);
const CAMPAIGN_FINGERPRINT_DAILY_MAX = envInt("WA_CAMPAIGN_FINGERPRINT_DAILY_MAX", 80);

function quotaError(code: string, message: string): Error & { code: string; statusCode: number } {
  const err = new Error(message) as Error & { code: string; statusCode: number };
  err.code = code;
  err.statusCode = 429;
  return err;
}

function normalizePhone(phone: string): string {
  return String(phone).replace(/\D/g, "");
}

/** Conta envios globais na última hora (persistente — funciona em serverless). */
export async function countGlobalSendsLastHour(sb: SupabaseClient): Promise<number> {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error } = await sb
    .from("whatsapp_logs")
    .select("id", { count: "exact", head: true })
    .eq("status", "sent")
    .gte("created_at", since);
  if (error) throw error;
  return count || 0;
}

/** Conta envios globais no dia UTC. */
export async function countGlobalSendsToday(sb: SupabaseClient): Promise<number> {
  const today = format(new Date(), "yyyy-MM-dd");
  const { count, error } = await sb
    .from("whatsapp_logs")
    .select("id", { count: "exact", head: true })
    .eq("status", "sent")
    .gte("created_at", `${today}T00:00:00`);
  if (error) throw error;
  return count || 0;
}

/** Verifica cotas globais persistentes antes do envio. */
export async function assertPersistentGlobalQuota(sb: SupabaseClient): Promise<void> {
  if (GLOBAL_HOURLY_MAX <= 0 && GLOBAL_DAILY_MAX <= 0) return;

  const [hourly, daily] = await Promise.all([
    GLOBAL_HOURLY_MAX > 0 ? countGlobalSendsLastHour(sb) : Promise.resolve(0),
    GLOBAL_DAILY_MAX > 0 ? countGlobalSendsToday(sb) : Promise.resolve(0),
  ]);

  if (GLOBAL_HOURLY_MAX > 0 && hourly >= GLOBAL_HOURLY_MAX) {
    throw quotaError(
      "WA_QUOTA_HOURLY",
      `Limite horário global de envios WhatsApp atingido (${GLOBAL_HOURLY_MAX}/h). Aguarde alguns minutos.`
    );
  }
  if (GLOBAL_DAILY_MAX > 0 && daily >= GLOBAL_DAILY_MAX) {
    throw quotaError(
      "WA_QUOTA_DAILY",
      `Limite diário global de envios WhatsApp atingido (${GLOBAL_DAILY_MAX}/dia). Tente amanhã.`
    );
  }
}

/** Último envio para um número (cooldown persistente). */
export async function getPhoneLastSentAt(sb: SupabaseClient, phone: string): Promise<number | null> {
  const digits = normalizePhone(phone);
  if (!digits) return null;

  const { data, error } = await sb
    .from("whatsapp_logs")
    .select("created_at")
    .eq("telefone", digits)
    .eq("status", "sent")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data?.created_at) return null;
  return new Date(String(data.created_at)).getTime();
}

/** Aguarda cooldown por número com base no banco (cross-instance). */
export async function waitForPersistentPhoneCooldown(sb: SupabaseClient, phone: string): Promise<void> {
  if (PHONE_COOLDOWN_MS <= 0) return;
  const last = await getPhoneLastSentAt(sb, phone);
  if (!last) return;
  const elapsed = Date.now() - last;
  if (elapsed < PHONE_COOLDOWN_MS) {
    await new Promise((r) => setTimeout(r, PHONE_COOLDOWN_MS - elapsed));
  }
}

/** Conta envios com mesmo fingerprint de conteúdo na última hora (anti-broadcast spam). */
export async function countCampaignFingerprintLastHour(
  sb: SupabaseClient,
  tenantId: string,
  fingerprint: string
): Promise<number> {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const marker = `[fp:${fingerprint}]`;
  const { count, error } = await sb
    .from("whatsapp_logs")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("status", "sent")
    .ilike("mensagem", `%${marker}%`)
    .gte("created_at", since);
  if (error) throw error;
  return count || 0;
}

export async function countCampaignFingerprintToday(
  sb: SupabaseClient,
  tenantId: string,
  fingerprint: string
): Promise<number> {
  const today = format(new Date(), "yyyy-MM-dd");
  const marker = `[fp:${fingerprint}]`;
  const { count, error } = await sb
    .from("whatsapp_logs")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("status", "sent")
    .ilike("mensagem", `%${marker}%`)
    .gte("created_at", `${today}T00:00:00`);
  if (error) throw error;
  return count || 0;
}

/** Impede disparar o mesmo conteúdo para muitos números em pouco tempo. */
export async function assertCampaignFingerprintQuota(
  sb: SupabaseClient,
  tenantId: string,
  messageText: string,
  plannedSends = 1
): Promise<string> {
  const fingerprint = computeContentFingerprint(messageText);

  if (CAMPAIGN_FINGERPRINT_HOURLY_MAX > 0) {
    const hourly = await countCampaignFingerprintLastHour(sb, tenantId, fingerprint);
    if (hourly + plannedSends > CAMPAIGN_FINGERPRINT_HOURLY_MAX) {
      throw quotaError(
        "WA_CAMPAIGN_FINGERPRINT_HOURLY",
        `Muitos envios com o mesmo conteúdo nesta hora (máx. ${CAMPAIGN_FINGERPRINT_HOURLY_MAX}). Divida em lotes menores ou aguarde.`
      );
    }
  }

  if (CAMPAIGN_FINGERPRINT_DAILY_MAX > 0) {
    const daily = await countCampaignFingerprintToday(sb, tenantId, fingerprint);
    if (daily + plannedSends > CAMPAIGN_FINGERPRINT_DAILY_MAX) {
      throw quotaError(
        "WA_CAMPAIGN_FINGERPRINT_DAILY",
        `Limite diário de mensagens repetidas atingido (${CAMPAIGN_FINGERPRINT_DAILY_MAX}/dia).`
      );
    }
  }

  return fingerprint;
}

/** Anexa marcador de fingerprint ao log (dedupe e auditoria). */
export function appendFingerprintMarker(message: string, fingerprint: string): string {
  const marker = `[fp:${fingerprint}]`;
  if (message.includes(marker)) return message;
  return `${message}\n\n${marker}`.trim();
}

export type PersistentQuotaSnapshot = {
  sentLastHour: number;
  sentToday: number;
  hourlyMax: number;
  dailyMax: number;
};

export async function getPersistentQuotaSnapshot(sb: SupabaseClient): Promise<PersistentQuotaSnapshot> {
  const [sentLastHour, sentToday] = await Promise.all([
    countGlobalSendsLastHour(sb),
    countGlobalSendsToday(sb),
  ]);
  return {
    sentLastHour,
    sentToday,
    hourlyMax: GLOBAL_HOURLY_MAX,
    dailyMax: GLOBAL_DAILY_MAX,
  };
}
