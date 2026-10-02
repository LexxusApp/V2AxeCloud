import type { SupabaseClient } from "@supabase/supabase-js";
import { TRIAL_DAYS } from "../../lib/planPricing.js";
import { normalizeBillingCycle, type BillingCycle } from "./plansCatalog.js";
import { resolveTenantPremiumAmountCents } from "./premiumPricing.js";
import {
  CONSOLE_ADMIN_INSTANCE_NAME,
} from "../../src/services/evolution.service.js";
import { sendEvolutionTextQueued } from "./evolutionSendQueue.js";
import {
  dispatchZeladorWelcomeWhatsApp,
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
import { validateStrongPassword } from "../../lib/passwordPolicy.js";
import { rejectCompromisedPassword } from "./pwnedPassword.js";
import { isPlausibleDiretorioCoordinate } from "../../lib/diretorioCoordinates.js";
import { slugifyCidadeOnly } from "./diretorioSlug.js";
import { slugifyBairro } from "../../lib/diretorioBairro.js";
import { normalizeBrazilPhone } from "../../lib/brazilPhone.js";
import {
  normalizePaymentStatus,
  paymentEventKey,
  recordPaymentEvent,
} from "./paymentEvents.js";

export type RegisterTenantInput = {
  email: string;
  password: string;
  nome_terreiro: string;
  nome_zelador: string;
  whatsapp: string;
  billingCycle?: BillingCycle;
  cep: string;
  endereco: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  estado: string;
  descricao_publica?: string;
  publicar_no_mapa: boolean;
};

export type RegisterTenantResult = {
  userId: string;
  tenantId: string;
  email: string;
  checkoutPath: string;
  subscriptionStatus: string;
  trialEndsAt: string;
  trialDays: number;
  radarPublished: boolean;
};

export type ActivateApprovedClaimInput = {
  claimId: string;
  password: string;
  billingCycle?: BillingCycle;
};

export function trialExpiresAtFromNow(days: number = TRIAL_DAYS): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

export function resolvePublicAppUrl(): string {
  const fromEnv = [process.env.APP_PUBLIC_URL, process.env.VITE_APP_URL, process.env.PUBLIC_APP_URL]
    .map((v) => String(v || "").trim().replace(/\/$/, ""))
    .find((v) => v.startsWith("http"));
  if (fromEnv) return fromEnv;

  if (process.env.NODE_ENV === "production") {
    return "https://axecloud.com.br";
  }

  return "http://localhost:3000";
}

export function efiNotificationUrl(): string {
  return `${resolvePublicAppUrl()}/api/webhooks/efi`;
}

async function geocodeRegistrationAddress(address: string, city: string, state: string) {
  const cep = address.match(/\b\d{5}-?\d{3}\b/)?.[0] || "";
  const queries = [
    `${address}, ${city}, ${state}, Brasil`,
    cep ? `${cep}, ${city}, ${state}, Brasil` : "",
    `${city}, ${state}, Brasil`,
  ].filter(Boolean);

  for (const query of queries) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4500);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=br&q=${encodeURIComponent(query)}`;
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { "User-Agent": "AxeCloudRegister/1.0 (https://axecloud.com.br)" },
      });
      if (!response.ok) continue;
      const rows = (await response.json()) as Array<{ lat?: string; lon?: string }>;
      const lat = Number(rows[0]?.lat);
      const lng = Number(rows[0]?.lon);
      if (isPlausibleDiretorioCoordinate(lat, lng)) return { lat, lng };
    } catch {
      // O perfil fica como rascunho e pode ser confirmado depois no Radar.
    } finally {
      clearTimeout(timeout);
    }
  }
  return null;
}

/** Preço do onboarding Premium: catálogo → env → fallback R$ 69,90. */
export async function resolvePremiumOnboardingAmountCents(
  supabaseAdmin: SupabaseClient,
  tenantId?: string | null,
  billingCycle: BillingCycle = "monthly"
): Promise<number> {
  return resolveTenantPremiumAmountCents(supabaseAdmin, tenantId, billingCycle);
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
  const whatsapp = normalizeBrazilPhone(input.whatsapp);
  const billingCycle = normalizeBillingCycle(input.billingCycle);
  const cep = String(input.cep || "").replace(/\D/g, "").slice(0, 8);
  const logradouro = String(input.endereco || "").trim().slice(0, 220);
  const numero = String(input.numero || "").trim().slice(0, 30);
  const complemento = String(input.complemento || "").trim().slice(0, 100);
  const bairro = String(input.bairro || "").trim().slice(0, 120);
  const cidade = String(input.cidade || "").trim().slice(0, 120);
  const estado = String(input.estado || "").trim().toUpperCase().slice(0, 2);
  const descricaoPublica = String(input.descricao_publica || "").trim().slice(0, 1200);
  const publicarNoMapa = input.publicar_no_mapa === true;

  if (!email || !password) {
    throw Object.assign(new Error("E-mail e senha são obrigatórios."), {
      status: 400,
    });
  }
  const passwordCheck = validateStrongPassword(password);
  if (passwordCheck.ok === false) {
    throw Object.assign(new Error(passwordCheck.message), { status: 400 });
  }
  await rejectCompromisedPassword(password);
  if (!nome_terreiro) {
    throw Object.assign(new Error("Informe o nome do terreiro."), { status: 400 });
  }
  if (!whatsapp) {
    throw Object.assign(new Error("Informe um WhatsApp brasileiro válido com DDD."), { status: 400 });
  }
  if (!/^\d{8}$/.test(cep)) {
    throw Object.assign(new Error("Informe um CEP válido."), { status: 400 });
  }
  if (logradouro.length < 3 || numero.length < 1 || bairro.length < 2 || cidade.length < 2 || !/^[A-Z]{2}$/.test(estado)) {
    throw Object.assign(new Error("Complete o endereço da casa antes de criar a conta."), { status: 400 });
  }
  if (!publicarNoMapa) {
    throw Object.assign(new Error("Autorize a publicação dos dados informados para incluir a casa no mapa."), { status: 400 });
  }

  const enderecoCompleto = [
    `${logradouro}, ${numero}`,
    complemento,
    bairro,
    `${cidade} - ${estado}`,
    `CEP ${cep.replace(/^(\d{5})(\d{3})$/, "$1-$2")}`,
  ].filter(Boolean).join(" · ");

  const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      nome_terreiro,
      nome_zelador,
      whatsapp,
      cep,
      endereco: enderecoCompleto,
      cidade,
      estado,
      publicar_no_mapa: publicarNoMapa,
      onboarding: "public_register",
      is_trial: true,
      billing_cycle: billingCycle,
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
      whatsapp_publico: whatsapp.replace(/\D/g, "").slice(0, 15) || null,
      descricao_publica: descricaoPublica || null,
      updated_at: now,
    },
    { onConflict: "id" }
  );
  if (profileError) {
    await supabaseAdmin.auth.admin.deleteUser(tenantId).catch(() => undefined);
    throw profileError;
  }

  // O Radar nasce preenchido junto com a conta. A publicação só acontece após
  // consentimento explícito e geocodificação válida; se o serviço externo não
  // responder, os dados permanecem salvos para confirmação posterior no Radar.
  const radarSlugBase = nome_terreiro
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 52) || "casa-de-axe";
  const coordinates = await geocodeRegistrationAddress(enderecoCompleto, cidade, estado);
  const radarPublicado = publicarNoMapa && Boolean(coordinates);
  const { error: radarError } = await supabaseAdmin.from("terreiros_diretorio").insert({
    nome: nome_terreiro,
    cep,
    endereco: enderecoCompleto,
    telefone: whatsapp.replace(/\D/g, "").slice(0, 15) || null,
    link_maps: null,
    cidade,
    estado,
    slug: `${radarSlugBase}-${tenantId.replace(/-/g, "").slice(0, 8)}`,
    cidade_slug: slugifyCidadeOnly(cidade),
    bairro,
    bairro_slug: slugifyBairro(bairro),
    tipo: "terreiro",
    claimed_by_tenant_id: tenantId,
    descricao_publica: descricaoPublica || null,
    latitude: coordinates?.lat ?? null,
    longitude: coordinates?.lng ?? null,
    coordinate_source: coordinates ? "public_register_address" : "public_register_pending",
    publicacao_status: radarPublicado ? "publicado" : "rascunho",
    publicado_em: radarPublicado ? now : null,
  });
  if (radarError) {
    // Não desfaz o cadastro: a tela Radar também repara contas sem perfil.
    console.warn("[onboarding] Radar draft:", radarError.message);
  }

  const trialEndsAt = trialExpiresAtFromNow();

  const { error: subError } = await upsertSubscriptionResilient(supabaseAdmin, {
    id: tenantId,
    tenant_id: tenantId,
    plan: "premium",
    status: "active",
    expires_at: trialEndsAt,
    efi_charge_id: null,
    payment_provider: (efi ?? resolveEfiEnv()) ? "efi" : null,
    billing_cycle: billingCycle,
    pending_since: null,
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

  // Boas-vindas WhatsApp no cadastro público (Meta template boas_vindas_zelador).
  // Sem senha no follow-up: o zelador criou a própria senha no formulário.
  try {
    const cfg = await loadWelcomeMessageConfig(supabaseAdmin);
    if (cfg.enabled) {
      const msisdn = normalizeBrazilMsisdn(whatsapp || "");
      if (msisdn) {
        const freeText = renderWelcomeMessage(
          "Axé, {{nome_zelador}}! 🌿\n" +
            "Seu terreiro *{{nome_terreiro}}* foi cadastrado no AxéCloud com sucesso.\n\n" +
            "Entre no painel com o e-mail {{email}} e a senha que você criou.\n" +
            "Site: {{site}}\n\n" +
            "📘 Instruções de uso: https://axecloud.com.br/instrucoes\n\n" +
            "— {{assinatura}}",
          {
            nome_terreiro,
            nome_zelador,
            email,
            site: cfg.loginUrl || resolvePublicAppUrl(),
            assinatura: cfg.signature,
          }
        );
        void dispatchZeladorWelcomeWhatsApp({
          msisdn,
          freeText,
          nome_zelador,
          nome_terreiro,
          email,
          site: cfg.loginUrl || resolvePublicAppUrl(),
          sb: supabaseAdmin,
          tenantId,
          // sem senha → só o template Meta (ou freeText), sem follow-up de credenciais
        })
          .then((r) =>
            console.log(
              `[onboarding] Welcome WhatsApp cadastro público (${r.channel}) → ${msisdn}`,
              r?.messageId || "",
              r?.logged ? "logged" : "no-log"
            )
          )
          .catch((err) =>
            console.error(
              `[onboarding] Welcome WhatsApp cadastro público falhou (${msisdn}):`,
              err?.message || err
            )
          );
      } else {
        console.log("[onboarding] Welcome WhatsApp: número ausente/inválido — pulado.");
      }
    }
  } catch (welErr: unknown) {
    console.error(
      "[onboarding] Welcome WhatsApp setup:",
      welErr instanceof Error ? welErr.message : welErr
    );
  }

  void import("./opsAlertWhatsApp.js")
    .then(({ notifyOpsNewTerreiro }) =>
      notifyOpsNewTerreiro({
        nome_terreiro,
        nome_zelador,
        email,
        whatsapp,
        source: "public-register",
        tenantId,
      })
    )
    .catch((err) =>
      console.error("[onboarding] ops alert:", err instanceof Error ? err.message : err)
    );

  return {
    userId: tenantId,
    tenantId,
    email,
    checkoutPath: `/checkout?tenant=${tenantId}&billing=${billingCycle}`,
    subscriptionStatus: "active",
    trialEndsAt,
    trialDays: TRIAL_DAYS,
    radarPublished: radarPublicado,
  };
}

/**
 * Cria a conta a partir de uma reivindicação já aprovada. Todos os dados da
 * casa e do responsável são lidos novamente pelo servidor; o navegador envia
 * somente o protocolo, a senha e a preferência de cobrança.
 */
export async function registerApprovedClaimTenant(
  supabaseAdmin: SupabaseClient,
  input: ActivateApprovedClaimInput,
  efi?: EfiEnv | null,
): Promise<RegisterTenantResult> {
  const claimId = String(input.claimId || "").trim();
  const password = String(input.password || "");
  const billingCycle = normalizeBillingCycle(input.billingCycle);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(claimId)) {
    throw Object.assign(new Error("Convite de ativação inválido."), { status: 400 });
  }
  const passwordCheck = validateStrongPassword(password);
  if (passwordCheck.ok === false) {
    throw Object.assign(new Error(passwordCheck.message), { status: 400 });
  }
  await rejectCompromisedPassword(password);

  const { data: claim, error: claimError } = await supabaseAdmin
    .from("terreiro_claim_requests")
    .select("id, status, requester_name, requester_email, requester_phone, claimed_tenant_id, terreiro_id")
    .eq("id", claimId)
    .maybeSingle();
  if (claimError) throw claimError;
  if (!claim) throw Object.assign(new Error("Reivindicação não encontrada."), { status: 404 });
  if (String(claim.status) !== "approved") {
    throw Object.assign(new Error("Esta reivindicação ainda não está liberada para ativação."), { status: 409 });
  }
  if (claim.claimed_tenant_id) {
    throw Object.assign(new Error("Esta casa já está conectada. Entre no AxéCloud para continuar."), { status: 409 });
  }

  const { data: terreiro, error: terreiroError } = await supabaseAdmin
    .from("terreiros_diretorio")
    .select("id, nome, telefone, cidade, estado, descricao_publica, publicacao_status, claimed_by_tenant_id")
    .eq("id", claim.terreiro_id)
    .maybeSingle();
  if (terreiroError) throw terreiroError;
  if (!terreiro) throw Object.assign(new Error("Perfil público da casa não encontrado."), { status: 404 });
  if (terreiro.claimed_by_tenant_id) {
    throw Object.assign(new Error("Esta casa já está conectada. Entre no AxéCloud para continuar."), { status: 409 });
  }

  const email = String(claim.requester_email || "").trim().toLowerCase();
  const nomeTerreiro = String(terreiro.nome || "").trim();
  const nomeZelador = String(claim.requester_name || "").trim();
  const whatsapp = normalizeBrazilPhone(claim.requester_phone || terreiro.telefone || "");
  if (!email || !nomeTerreiro || !nomeZelador) {
    throw Object.assign(new Error("A reivindicação aprovada está incompleta. Fale com o suporte para corrigir os dados."), { status: 409 });
  }
  if (!whatsapp) {
    throw Object.assign(new Error("O WhatsApp da reivindicação é inválido. Fale com o suporte para corrigir."), { status: 409 });
  }

  const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      nome_terreiro: nomeTerreiro,
      nome_zelador: nomeZelador,
      whatsapp,
      cidade: String(terreiro.cidade || ""),
      estado: String(terreiro.estado || ""),
      publicar_no_mapa: true,
      onboarding: "directory_claim_activation",
      directory_claim_id: claimId,
      is_trial: true,
      billing_cycle: billingCycle,
    },
  });
  if (createError) {
    if (createError.message?.toLowerCase().includes("already")) {
      throw Object.assign(new Error("Este e-mail já possui acesso. Entre na conta ou recupere a senha para conectar a casa."), { status: 409 });
    }
    throw createError;
  }
  const tenantId = created.user?.id;
  if (!tenantId) throw new Error("Falha ao criar usuário.");

  const cleanup = async () => {
    await Promise.allSettled([
      supabaseAdmin.from("subscriptions").delete().eq("id", tenantId),
      supabaseAdmin.from("perfil_lider").delete().eq("id", tenantId),
      supabaseAdmin.auth.admin.deleteUser(tenantId),
    ]);
  };
  const now = new Date().toISOString();
  try {
    const { error: profileError } = await supabaseAdmin.from("perfil_lider").upsert(
      {
        id: tenantId,
        email,
        nome_terreiro: nomeTerreiro,
        cargo: nomeZelador,
        role: "admin",
        tenant_id: tenantId,
        whatsapp_publico: whatsapp.replace(/\D/g, "").slice(0, 15) || null,
        descricao_publica: String(terreiro.descricao_publica || "").trim() || null,
        casa_verificada: true,
        updated_at: now,
      },
      { onConflict: "id" },
    );
    if (profileError) throw profileError;

    const trialEndsAt = trialExpiresAtFromNow();
    const { error: subError } = await upsertSubscriptionResilient(supabaseAdmin, {
      id: tenantId,
      tenant_id: tenantId,
      plan: "premium",
      status: "active",
      expires_at: trialEndsAt,
      efi_charge_id: null,
      payment_provider: (efi ?? resolveEfiEnv()) ? "efi" : null,
      billing_cycle: billingCycle,
      pending_since: null,
      updated_at: now,
    });
    if (subError) throw subError;

    const { error: linkError } = await supabaseAdmin.rpc("connect_approved_terreiro_claim", {
      p_claim_id: claimId,
      p_requester_email: email,
      p_tenant_id: tenantId,
    });
    if (linkError) throw linkError;

    try {
      const cfg = await loadWelcomeMessageConfig(supabaseAdmin);
      const msisdn = normalizeBrazilMsisdn(whatsapp);
      if (cfg.enabled && msisdn) {
        const freeText = renderWelcomeMessage(
          "Axé, {{nome_zelador}}! 🌿\nSua casa *{{nome_terreiro}}* foi ativada no AxéCloud.\n\nEntre com {{email}} e a senha que você criou.\nSite: {{site}}\n\n— {{assinatura}}",
          {
            nome_terreiro: nomeTerreiro,
            nome_zelador: nomeZelador,
            email,
            site: cfg.loginUrl || resolvePublicAppUrl(),
            assinatura: cfg.signature,
          },
        );
        void dispatchZeladorWelcomeWhatsApp({
          msisdn,
          freeText,
          nome_zelador: nomeZelador,
          nome_terreiro: nomeTerreiro,
          email,
          site: cfg.loginUrl || resolvePublicAppUrl(),
          sb: supabaseAdmin,
          tenantId,
        }).catch((error) => console.error("[claim-activation] welcome:", error instanceof Error ? error.message : error));
      }
    } catch (error) {
      console.warn("[claim-activation] welcome setup:", error instanceof Error ? error.message : error);
    }

    void import("./opsAlertWhatsApp.js")
      .then(({ notifyOpsNewTerreiro }) => notifyOpsNewTerreiro({
        nome_terreiro: nomeTerreiro,
        nome_zelador: nomeZelador,
        email,
        whatsapp,
        source: "directory-claim-activation",
        tenantId,
      }))
      .catch((error) => console.error("[claim-activation] ops alert:", error instanceof Error ? error.message : error));

    return {
      userId: tenantId,
      tenantId,
      email,
      checkoutPath: "/checkout?tenant=" + encodeURIComponent(tenantId) + "&billing=" + billingCycle,
      subscriptionStatus: "active",
      trialEndsAt,
      trialDays: TRIAL_DAYS,
      radarPublished: String(terreiro.publicacao_status || "") === "publicado",
    };
  } catch (error) {
    await cleanup();
    if (String((error as { message?: string })?.message || "").includes("duplicate")) {
      throw Object.assign(new Error("Esta casa acabou de ser conectada a outra conta. Atualize a página."), { status: 409 });
    }
    throw error;
  }
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

  void sendEvolutionTextQueued(CONSOLE_ADMIN_INSTANCE_NAME, msisdn, text)
    .then((r) => console.log(`[onboarding] WhatsApp pós-pagamento → ${msisdn}`, r?.messageId || ""))
    .catch((err) => console.error(`[onboarding] WhatsApp falhou:`, err?.message || err));

  return "queued";
}

export async function activateTenantSubscription(
  supabaseAdmin: SupabaseClient,
  tenantId: string,
  opts?: {
    chargeId?: number | string;
    provider?: string;
    billingCycle?: BillingCycle;
  }
): Promise<{ alreadyActive: boolean }> {
  const tid = String(tenantId || "").trim();
  if (!tid) throw new Error("tenant_id inválido");

  const { data: sub, error: subErr } = await supabaseAdmin
    .from("subscriptions")
    .select("id, status, plan, expires_at, billing_cycle, pending_billing_cycle, last_activated_charge_id")
    .eq("id", tid)
    .maybeSingle();
  if (subErr) throw subErr;

  const chargeId = opts?.chargeId != null ? String(opts.chargeId) : "";
  if (
    chargeId &&
    String(sub?.last_activated_charge_id || "") === chargeId
  ) {
    return { alreadyActive: true };
  }
  if (!chargeId && !sub?.pending_billing_cycle && isSubscriptionAccessActive(sub)) {
    return { alreadyActive: true };
  }

  const hadAccessBefore = String(sub?.status || "").toLowerCase() === "active";
  const billingCycle = normalizeBillingCycle(
    opts?.billingCycle || sub?.pending_billing_cycle || sub?.billing_cycle
  );
  const periodDays = billingCycle === "annual" ? 365 : 30;
  const currentExpiry = new Date(String(sub?.expires_at || "")).getTime();
  const baseTime = Number.isFinite(currentExpiry)
    ? Math.max(Date.now(), currentExpiry)
    : Date.now();
  const expiresAt = new Date(baseTime + periodDays * 24 * 60 * 60 * 1000).toISOString();
  const now = new Date().toISOString();

  const patch: Record<string, unknown> = {
    status: "active",
    plan: sub?.plan || "premium",
    expires_at: expiresAt,
    billing_cycle: billingCycle,
    pending_billing_cycle: null,
    payment_provider: opts?.provider || "efi",
    pending_since: null,
    updated_at: now,
  };
  if (chargeId) {
    patch.efi_charge_id = chargeId;
    patch.last_activated_charge_id = chargeId;
  }

  const { error: upErr } = await updateSubscriptionResilient(supabaseAdmin, tid, patch);

  if (upErr) throw upErr;

  const { data: profile } = await supabaseAdmin
    .from("perfil_lider")
    .select("nome_terreiro, cargo, email, is_blocked, access_block_reason")
    .eq("id", tid)
    .maybeSingle();

  const authUserRes = await supabaseAdmin.auth.admin.getUserById(tid).catch(() => null);
  const userMeta = (authUserRes?.data.user?.user_metadata || {}) as Record<string, unknown>;
  const metaWhatsapp = String(userMeta.whatsapp || "");

  // Pagamento confirmado encerra o período de teste: sem isso o painel
  // continuaria rotulando a conta como trial.
  if (userMeta.is_trial === true) {
    await supabaseAdmin.auth.admin
      .updateUserById(tid, { user_metadata: { ...userMeta, is_trial: false } })
      .catch(() => undefined);
  }

  // Um pagamento só remove bloqueios que foram aplicados automaticamente pelo
  // vencimento. Um bloqueio manual do administrador continua respeitado.
  if (profile?.is_blocked && profile?.access_block_reason === "subscription_expired") {
    const { error: unblockError } = await supabaseAdmin
      .from("perfil_lider")
      .update({
        is_blocked: false,
        access_block_reason: null,
        access_blocked_at: null,
        updated_at: now,
      })
      .eq("id", tid);
    if (unblockError) throw unblockError;
  }

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

  const latestProviderStatus = [...entries]
    .reverse()
    .find((entry) => entry.currentStatus)?.currentStatus || (paid ? "paid" : "processed");
  const normalizedStatus = paid ? "paid" : normalizePaymentStatus(latestProviderStatus);
  await recordPaymentEvent(supabaseAdmin, {
    provider: "efi",
    externalId: paymentEventKey([chargeId || "unknown", notificationToken.slice(0, 32)]),
    tenantId: tenantId || customId || null,
    eventType: paid ? "payment_confirmed" : "webhook_status_received",
    status: normalizedStatus,
    paymentMethod: "card",
    chargeId: chargeId || null,
    message: paid
      ? "Pagamento confirmado pelo webhook da Efí."
      : "Atualização de cobrança recebida pelo webhook da Efí.",
    metadata: {
      entries,
      notificationToken: notificationToken.slice(0, 8) + "…",
      providerStatus: latestProviderStatus,
    },
  });

  if (!paid) {
    return { ok: true, message: "Notificação recebida; pagamento ainda não confirmado." };
  }

  if (!tenantId) {
    return { ok: false, message: "Pagamento confirmado, mas tenant não identificado." };
  }

  try {
    await activateTenantSubscription(supabaseAdmin, tenantId, {
      chargeId,
      provider: "efi",
    });
  } catch (error) {
    await recordPaymentEvent(supabaseAdmin, {
      provider: "efi",
      externalId: paymentEventKey([chargeId || tenantId, notificationToken.slice(0, 16), "activation_failed"]),
      tenantId,
      eventType: "subscription_activation_failed",
      status: "failed",
      paymentMethod: "card",
      chargeId: chargeId || null,
      errorCode: "activation_failed",
      message: error instanceof Error ? error.message : "Pagamento confirmado, mas a assinatura não foi ativada.",
    });
    throw error;
  }

  return { ok: true, message: "Assinatura ativada." };
}
