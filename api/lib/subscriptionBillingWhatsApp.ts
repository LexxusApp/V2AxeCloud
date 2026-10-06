import type { SupabaseClient } from "@supabase/supabase-js";
import { formatAmountLabelFromCents, normalizeBillingCycle } from "./plansCatalog.js";
import { isMetaCloudDirectConfigured, sendMetaCloudTemplate } from "./metaCloudSend.js";
import { resolveTenantPremiumAmountCents } from "./premiumPricing.js";
import { resolveLeaderId } from "./tenantAccess.js";
import { normalizeBrazilMsisdn } from "./welcomeMessage.js";
import {
  buildCobrancaAssinaturaComponents,
  resolveMetaTemplateLanguage,
} from "./whatsappMetaCloud.js";

const TEMPLATE = "cobranca_assinatura_axecloud";
const BR_TZ = "America/Sao_Paulo";

function saoPauloYmd(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BR_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function ymdUtcDays(value: string): number {
  const match = String(value || "").slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return Number.NaN;
  return Math.floor(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / 86_400_000);
}

export function subscriptionBillingReminderOffset(expiresAt: string, now = new Date()): number | null {
  const today = ymdUtcDays(saoPauloYmd(now));
  const expiryYmd = String(expiresAt || "").slice(0, 10);
  const expiry = ymdUtcDays(expiryYmd);
  if (!Number.isFinite(today) || !Number.isFinite(expiry)) return null;
  const offset = expiry - today;
  return offset === 0 || offset === 1 ? offset : null;
}

function firstName(value: unknown): string {
  const name = String(value || "").trim().split(/\s+/).find(Boolean) || "Zelador";
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}

function formatDateBr(ymd: string): string {
  const [year, month, day] = ymd.split("-");
  return `${day}/${month}/${year}`;
}

export async function runSubscriptionBillingReminders(
  sb: SupabaseClient,
  now = new Date(),
): Promise<{ sent: number; skipped: number; errors: number }> {
  let sent = 0;
  let skipped = 0;
  let errors = 0;
  if (!isMetaCloudDirectConfigured()) return { sent, skipped: 1, errors };

  const { data: subscriptions, error } = await sb
    .from("subscriptions")
    .select("id, tenant_id, status, expires_at, billing_cycle")
    .eq("status", "active")
    .not("expires_at", "is", null)
    .limit(500);
  if (error) {
    console.error("[SUBSCRIPTION WA] query:", error.message);
    return { sent, skipped, errors: 1 };
  }

  for (const subscription of subscriptions || []) {
    const expiresAt = String(subscription.expires_at || "");
    const offset = subscriptionBillingReminderOffset(expiresAt, now);
    if (offset == null) {
      skipped++;
      continue;
    }
    const tenantRef = String(subscription.tenant_id || subscription.id || "").trim();
    if (!tenantRef) {
      skipped++;
      continue;
    }

    try {
      const leaderId = await resolveLeaderId(sb, tenantRef);
      const { data: profile } = await sb
        .from("perfil_lider")
        .select("id, tenant_id, nome_terreiro, cargo, email")
        .eq("id", leaderId)
        .maybeSingle();
      if (!profile) {
        skipped++;
        continue;
      }
      const authResult = await sb.auth.admin.getUserById(leaderId);
      const phone = normalizeBrazilMsisdn(String(authResult.data?.user?.user_metadata?.whatsapp || ""));
      if (!phone) {
        skipped++;
        continue;
      }

      const expiryYmd = expiresAt.slice(0, 10);
      const dedupe = `ASSINATURA:${expiryYmd}:D-${offset}`;
      const { count } = await sb
        .from("whatsapp_logs")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", leaderId)
        .eq("tipo", "cobranca_assinatura")
        .ilike("mensagem", `%${dedupe}%`);
      if ((count || 0) > 0) {
        skipped++;
        continue;
      }

      const cycle = normalizeBillingCycle(subscription.billing_cycle);
      const amount = await resolveTenantPremiumAmountCents(sb, leaderId, cycle);
      const valueLabel = formatAmountLabelFromCents(amount);
      const expiryLabel = offset === 1
        ? `vence amanha, no dia ${formatDateBr(expiryYmd)}`
        : `vence hoje, no dia ${formatDateBr(expiryYmd)}`;
      const templateName = String(process.env.WA_META_TEMPLATE_COBRANCA_ASSINATURA || "").trim() || TEMPLATE;
      const components = buildCobrancaAssinaturaComponents(
        firstName(profile.cargo),
        String(profile.nome_terreiro || "Seu terreiro"),
        expiryLabel,
        valueLabel,
      );
      const out = await sendMetaCloudTemplate(phone, templateName, resolveMetaTemplateLanguage(), components, {
        tenantId: leaderId,
        recipientName: String(profile.cargo || "Zelador"),
        source: "billing",
        sourceId: leaderId,
        idempotencyKey: `subscription-billing:${leaderId}:${expiryYmd}:d${offset}`,
        metadata: { billingCycle: cycle, expiresAt: expiryYmd, offset },
      });
      await sb.from("whatsapp_logs").insert({
        tenant_id: leaderId,
        filho_id: null,
        tipo: "cobranca_assinatura",
        telefone: phone,
        mensagem: `${dedupe} · ${expiryLabel} · ${valueLabel}`,
        status: "sent",
        external_id: out.messageId || `subscription_${Date.now()}_${leaderId.slice(0, 8)}`,
      });
      sent++;
    } catch (sendError) {
      errors++;
      console.error("[SUBSCRIPTION WA] reminder:", sendError instanceof Error ? sendError.message : sendError);
    }
  }
  return { sent, skipped, errors };
}
