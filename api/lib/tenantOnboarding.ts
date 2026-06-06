import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizePlansCatalog } from "./plansCatalog.js";
import { resolveTenantPremiumAmountCents } from "./premiumPricing.js";
import {
  CONSOLE_ADMIN_INSTANCE_NAME,
  sendEvolutionTextByInstance,
} from "../../src/services/evolution.service.js";
import {
  loadWelcomeMessageConfig,
  normalizeBrazilMsisdn,
  renderWelcomeMessage,
} from "./welcomeMessage.js";
import {
  efiFetchNotification,
  pickLatestPaidStatus,
  resolveEfiEnv,
  type EfiEnv,
} from "./efiPay.js";
import { updateSubscriptionResilient, upsertSubscriptionResilient } from "./subscriptionDb.js";
import { isSubscriptionAccessActive } from "./subscriptionAccess.js";

export type RegisterTenantInput = {
  email: string;
  password: string;
  nome_terreiro: string;
  nome_zelador: string;
  whatsapp?: string;
};

export type RegisterTenantResult = {
  userId: string;
  tenantId: string;
  email: string;
  checkoutPath: string;
  subscriptionStatus: string;
};

export function resolvePublicAppUrl(): string {
  const fromEnv = [process.env.APP_PUBLIC_URL, process.env.VITE_APP_URL, process.env.PUBLIC_APP_URL]
    .map((v) => String(v || "").trim().replace(/\/$/, ""))
    .find((v) => v.startsWith("http"));
  if (fromEnv) return fromEnv;

  if (process.env.VERCEL_ENV === "production") {
    return "https://axecloud.com.br";
  }

  const vercel = process.env.VERCEL_URL;
  if (vercel) return `https://${vercel.replace(/\/$/, "")}`;

  return "http://localhost:3000";
}

export function efiNotificationUrl(): string {
  const base = `${resolvePublicAppUrl()}/api/webhooks/efi`;
  const secret = process.env.EFI_WEBHOOK_SECRET || "";
  return secret ? `${base}?secret=${encodeURIComponent(secret)}` : base;
}

/** Preço do onboarding Premium: fundador aceito → R$ 49,90; senão catálogo → env → fallback R$ 69,90. */
export async function resolvePremiumOnboardingAmountCents(
  supabaseAdmin: SupabaseClient,
  tenantId?: string | null
): Promise<number> {
  return resolveTenantPremiumAmountCents(supabaseAdmin, tenantId);
}

export async function registerNewTenant(
  supabaseAdmin: SupabaseClient,
  input: RegisterTenantInput,
  efi?: EfiEnv | null
): Promise<RegisterTenantResult> {
  const email = String(input.email || "")
    .trim()
    .toLowerCase();
  const password = String(input.password || "");
  const nome_terreiro = String(input.nome_terreiro || "").trim();
  const nome_zelador = String(input.nome_zelador || "").trim();
  const whatsapp = String(input.whatsapp || "").trim();

  if (!email || !password || password.length < 6) {
    throw Object.assign(new Error("E-mail e senha (mín. 6 caracteres) são obrigatórios."), {
      status: 400,
    });
  }
  if (!nome_terreiro) {
    throw Object.assign(new Error("Informe o nome do terreiro."), { status: 400 });
  }

  const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      nome_terreiro,
      nome_zelador,
      whatsapp,
      onboarding: "public_register",
    },
  });

  if (createError) {
    if (createError.message?.toLowerCase().includes("already")) {
      throw Object.assign(new Error("Este e-mail já está cadastrado. Faça login ou recupere a senha."), {
        status: 409,
      });
    }
    throw createError;
  }

  const user = created.user;
  if (!user?.id) throw new Error("Falha ao criar usuário.");

  const tenantId = user.id;
  const now = new Date().toISOString();

  const { error: profileError } = await supabaseAdmin.from("perfil_lider").upsert(
    {
      id: tenantId,
      email,
      nome_terreiro,
      cargo: nome_zelador || null,
      role: "admin",
      tenant_id: tenantId,
      updated_at: now,
    },
    { onConflict: "id" }
  );
  if (profileError) {
    await supabaseAdmin.auth.admin.deleteUser(tenantId).catch(() => undefined);
    throw profileError;
  }

  const { error: subError } = await upsertSubscriptionResilient(supabaseAdmin, {
    id: tenantId,
    tenant_id: tenantId,
    plan: "premium",
    status: "pending",
    expires_at: null,
    efi_charge_id: null,
    payment_provider: (efi ?? resolveEfiEnv()) ? "efi" : null,
    pending_since: now,
    updated_at: now,
  });

  if (subError) {
    console.error("[onboarding] subscription upsert:", subError.message);
    throw Object.assign(
      new Error(
        "Cadastro criado, mas não foi possível registrar a assinatura pendente. Aplique as migrations Supabase (colunas EFI) e tente novamente."
      ),
      { status: 503 }
    );
  }

  return {
    userId: tenantId,
    tenantId,
    email,
    checkoutPath: `/checkout?tenant=${tenantId}`,
    subscriptionStatus: "pending",
  };
}

const PAID_WELCOME_DEFAULT =
  "Axé, {{nome_zelador}}! 🌿\n\n" +
  "Bem-vindo ao *AxéCloud*! Seu terreiro *{{nome_terreiro}}* já está liberado.\n\n" +
  "Acesse o painel: {{site}}\n\n" +
  "— {{assinatura}}";

export async function sendPostPaymentWelcomeWhatsApp(
  supabaseAdmin: SupabaseClient,
  opts: {
    whatsapp?: string | null;
    nome_terreiro: string;
    nome_zelador?: string | null;
    email: string;
  }
): Promise<"skipped" | "queued" | "no-phone" | "disabled"> {
  const msisdn = normalizeBrazilMsisdn(opts.whatsapp || "");
  if (!msisdn) return "no-phone";

  let template = PAID_WELCOME_DEFAULT;
  let loginUrl = resolvePublicAppUrl();
  let signature = "Equipe AxéCloud";
  let enabled = true;

  try {
    const { loadGlobalSettingPayload } = await import("./globalSettings.js");
    const raw = await loadGlobalSettingPayload(supabaseAdmin, "onboarding_paid_welcome");
    const v = raw as Record<string, unknown> | undefined;
    if (v && typeof v === "object") {
      if (typeof v.enabled === "boolean") enabled = v.enabled;
      if (typeof v.template === "string" && v.template.trim()) template = v.template;
      if (typeof v.loginUrl === "string" && v.loginUrl.trim()) loginUrl = v.loginUrl.trim();
      if (typeof v.signature === "string" && v.signature.trim()) signature = v.signature.trim();
    }
  } catch {
    /* usa default */
  }

  if (!enabled) return "disabled";

  const cfg = await loadWelcomeMessageConfig(supabaseAdmin).catch(() => null);
  if (cfg?.loginUrl) loginUrl = cfg.loginUrl;

  const text = renderWelcomeMessage(template, {
    nome_terreiro: opts.nome_terreiro,
    nome_zelador: opts.nome_zelador || "",
    email: opts.email,
    site: loginUrl,
    assinatura: signature,
  });

  void sendEvolutionTextByInstance(CONSOLE_ADMIN_INSTANCE_NAME, msisdn, text)
    .then((r) => console.log(`[onboarding] WhatsApp pós-pagamento → ${msisdn}`, r?.messageId || ""))
    .catch((err) => console.error(`[onboarding] WhatsApp falhou:`, err?.message || err));

  return "queued";
}

export async function activateTenantSubscription(
  supabaseAdmin: SupabaseClient,
  tenantId: string,
  opts?: { chargeId?: number; provider?: string }
): Promise<{ alreadyActive: boolean }> {
  const tid = String(tenantId || "").trim();
  if (!tid) throw new Error("tenant_id inválido");

  const { data: sub, error: subErr } = await supabaseAdmin
    .from("subscriptions")
    .select("id, status, plan, expires_at")
    .eq("id", tid)
    .maybeSingle();
  if (subErr) throw subErr;

  if (isSubscriptionAccessActive(sub)) {
    return { alreadyActive: true };
  }

  const hadAccessBefore = String(sub?.status || "").toLowerCase() === "active";
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const now = new Date().toISOString();

  const patch: Record<string, unknown> = {
    status: "active",
    plan: sub?.plan || "premium",
    expires_at: expiresAt,
    payment_provider: opts?.provider || "efi",
    pending_since: null,
    updated_at: now,
  };
  if (opts?.chargeId) patch.efi_charge_id = String(opts.chargeId);

  const { error: upErr } = await updateSubscriptionResilient(supabaseAdmin, tid, patch);

  if (upErr) throw upErr;

  const { data: profile } = await supabaseAdmin
    .from("perfil_lider")
    .select("nome_terreiro, cargo, email")
    .eq("id", tid)
    .maybeSingle();

  const metaWhatsapp = await supabaseAdmin.auth.admin
    .getUserById(tid)
    .then((r) => String(r.data.user?.user_metadata?.whatsapp || ""))
    .catch(() => "");

  if (!hadAccessBefore) {
    await sendPostPaymentWelcomeWhatsApp(supabaseAdmin, {
      whatsapp: metaWhatsapp,
      nome_terreiro: profile?.nome_terreiro || "Seu terreiro",
      nome_zelador: profile?.cargo,
      email: profile?.email || "",
    });
  }

  return { alreadyActive: false };
}

export async function processEfiNotificationToken(
  supabaseAdmin: SupabaseClient,
  notificationToken: string
): Promise<{ ok: boolean; message: string }> {
  const env = resolveEfiEnv();
  if (!env) return { ok: false, message: "EFI não configurado" };

  const entries = await efiFetchNotification(env, notificationToken);
  const { paid, chargeId, customId } = pickLatestPaidStatus(entries);

  if (!paid) {
    return { ok: true, message: "Notificação recebida; pagamento ainda não confirmado." };
  }

  const externalId = `${chargeId || "unknown"}:${notificationToken.slice(0, 32)}`;

  const { error: idemErr } = await supabaseAdmin.from("payment_webhook_events").insert({
    provider: "efi",
    external_id: externalId,
    tenant_id: customId || null,
    payload: { entries, notificationToken: notificationToken.slice(0, 8) + "…" },
  });

  if (idemErr?.code === "23505") {
    return { ok: true, message: "Evento já processado (idempotente)." };
  }

  let tenantId = String(customId || "").trim();

  if (!tenantId && chargeId) {
    const { data: byCharge } = await supabaseAdmin
      .from("subscriptions")
      .select("id, tenant_id")
      .eq("efi_charge_id", String(chargeId))
      .maybeSingle();
    tenantId = String(byCharge?.tenant_id || byCharge?.id || "").trim();
  }

  if (!tenantId && chargeId) {
    const { data: bySub } = await supabaseAdmin
      .from("subscriptions")
      .select("id, tenant_id")
      .eq("efi_subscription_id", String(chargeId))
      .maybeSingle();
    tenantId = String(bySub?.tenant_id || bySub?.id || "").trim();
  }

  if (!tenantId) {
    return { ok: false, message: "Pagamento confirmado, mas tenant não identificado." };
  }

  await activateTenantSubscription(supabaseAdmin, tenantId, {
    chargeId,
    provider: "efi",
  });

  return { ok: true, message: "Assinatura ativada." };
}
