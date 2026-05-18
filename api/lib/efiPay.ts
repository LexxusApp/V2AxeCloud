import axios, { type AxiosInstance } from "axios";

export type EfiEnv = {
  clientId: string;
  clientSecret: string;
  sandbox: boolean;
  baseUrl: string;
};

let cachedToken: { token: string; expiresAt: number } | null = null;

/** Identificador de conta (painel Efí → API → Introdução) — usado pelo SDK para tokenizar cartão no browser. */
export function resolveEfiPayeeCode(): string {
  return String(
    process.env.EFI_PAYEE_CODE ||
      process.env.EFI_ACCOUNT_ID ||
      process.env.EFI_IDENTIFICADOR_CONTA ||
      ""
  ).trim();
}

export function resolveEfiEnv(): EfiEnv | null {
  const clientId = String(process.env.EFI_CLIENT_ID || "").trim();
  const clientSecret = String(process.env.EFI_CLIENT_SECRET || "").trim();
  if (!clientId || !clientSecret) return null;

  const sandbox =
    process.env.EFI_SANDBOX === "true" ||
    process.env.EFI_SANDBOX === "1" ||
    process.env.NODE_ENV !== "production";

  const baseUrl =
    String(process.env.EFI_API_BASE_URL || "").trim() ||
    (sandbox ? "https://sandbox.gerencianet.com.br" : "https://api.gerencianet.com.br");

  return { clientId, clientSecret, sandbox, baseUrl: baseUrl.replace(/\/$/, "") };
}

function efiClient(env: EfiEnv): AxiosInstance {
  return axios.create({
    baseURL: env.baseUrl,
    timeout: 25000,
    headers: { "Content-Type": "application/json" },
  });
}

export async function efiGetAccessToken(env: EfiEnv): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.token;
  }

  const basic = Buffer.from(`${env.clientId}:${env.clientSecret}`).toString("base64");
  const client = efiClient(env);
  const { data } = await client.post(
    "/v1/authorize",
    { grant_type: "client_credentials" },
    { headers: { Authorization: `Basic ${basic}` } }
  );

  const token = String(data?.access_token || "");
  if (!token) throw new Error("EFI: access_token ausente na resposta de autorização");

  const expiresIn = Number(data?.expires_in || 3600);
  cachedToken = { token, expiresAt: now + expiresIn * 1000 };
  return token;
}

export type EfiPaymentLinkInput = {
  tenantId: string;
  email: string;
  nomeTerreiro: string;
  nomeZelador: string;
  notificationUrl: string;
  amountCents: number;
  expireDays?: number;
};

export type EfiPaymentLinkResult = {
  chargeId: number;
  paymentUrl: string;
  raw: unknown;
};

export async function efiCreatePaymentLink(
  env: EfiEnv,
  input: EfiPaymentLinkInput
): Promise<EfiPaymentLinkResult> {
  const token = await efiGetAccessToken(env);
  const client = efiClient(env);
  const expireAt = new Date();
  expireAt.setDate(expireAt.getDate() + (input.expireDays ?? 3));

  const body = {
    items: [
      {
        name: "AxéCloud Premium — R$ 89,90/mês",
        value: input.amountCents,
        amount: 1,
      },
    ],
    customer: {
      email: input.email,
      name: input.nomeZelador || input.nomeTerreiro,
    },
    metadata: {
      custom_id: input.tenantId,
      notification_url: input.notificationUrl,
    },
    settings: {
      payment_method: "all",
      expire_at: expireAt.toISOString().slice(0, 10),
    },
  };

  const { data } = await client.post("/v1/charge/one-step/link", body, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const chargeId = Number(data?.data?.charge_id ?? data?.charge_id ?? 0);
  const paymentUrl = String(
    data?.data?.payment_url ?? data?.data?.link ?? data?.payment_url ?? data?.link ?? ""
  ).trim();

  if (!chargeId || !paymentUrl) {
    throw new Error("EFI: resposta de link de pagamento incompleta");
  }

  return { chargeId, paymentUrl, raw: data };
}

export type EfiNotificationEntry = {
  chargeId?: number;
  customId?: string | null;
  currentStatus?: string;
  type?: string;
};

export async function efiFetchNotification(
  env: EfiEnv,
  notificationToken: string
): Promise<EfiNotificationEntry[]> {
  const token = await efiGetAccessToken(env);
  const client = efiClient(env);
  const { data } = await client.get(`/v1/notification/${encodeURIComponent(notificationToken)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const rows = Array.isArray(data?.data) ? data.data : [];
  return rows.map((row: any) => ({
    chargeId: Number(row?.identifiers?.charge_id ?? 0) || undefined,
    customId: row?.custom_id ?? null,
    currentStatus: row?.status?.current ?? undefined,
    type: row?.type ?? undefined,
  }));
}

export function pickLatestPaidStatus(entries: EfiNotificationEntry[]): {
  paid: boolean;
  chargeId?: number;
  customId?: string | null;
} {
  let chargeId: number | undefined;
  let customId: string | null | undefined;
  let paid = false;

  for (const e of entries) {
    if (e.chargeId) chargeId = e.chargeId;
    if (e.customId) customId = e.customId;
    if (e.currentStatus === "paid" || e.currentStatus === "settled") paid = true;
  }

  return { paid, chargeId, customId };
}

let cachedPremiumPlanId: number | null = null;

export async function efiEnsurePremiumPlan(env: EfiEnv): Promise<number> {
  const fromEnv = Number(process.env.EFI_PREMIUM_PLAN_ID || "");
  if (Number.isFinite(fromEnv) && fromEnv > 0) return fromEnv;
  if (cachedPremiumPlanId) return cachedPremiumPlanId;

  const token = await efiGetAccessToken(env);
  const client = efiClient(env);

  const { data: listData } = await client.get("/v1/plans", {
    headers: { Authorization: `Bearer ${token}` },
    params: { limit: 50, offset: 0 },
  });

  const plans = Array.isArray(listData?.data) ? listData.data : [];
  const existing = plans.find(
    (p: { name?: string }) => String(p?.name || "").toLowerCase() === "axecloud premium"
  );
  if (existing?.plan_id) {
    cachedPremiumPlanId = Number(existing.plan_id);
    return cachedPremiumPlanId;
  }

  const { data } = await client.post(
    "/v1/plan",
    {
      name: "AxéCloud Premium",
      interval: 1,
      repeats: null,
    },
    { headers: { Authorization: `Bearer ${token}` } }
  );

  const planId = Number(data?.data?.plan_id ?? data?.plan_id ?? 0);
  if (!planId) throw new Error("EFI: falha ao criar plano de assinatura Premium");

  cachedPremiumPlanId = planId;
  return planId;
}

export type EfiCardSubscriptionInput = {
  tenantId: string;
  email: string;
  nome: string;
  cpf: string;
  phoneNumber: string;
  paymentToken: string;
  amountCents: number;
  notificationUrl: string;
  billingAddress: {
    street: string;
    number: string;
    neighborhood: string;
    zipcode: string;
    city: string;
    state: string;
    complement?: string;
  };
};

export type EfiCardSubscriptionResult = {
  subscriptionId: number;
  chargeId?: number;
  status: string;
  raw: unknown;
};

export async function efiCreateCardSubscriptionOneStep(
  env: EfiEnv,
  input: EfiCardSubscriptionInput
): Promise<EfiCardSubscriptionResult> {
  const planId = await efiEnsurePremiumPlan(env);
  const token = await efiGetAccessToken(env);
  const client = efiClient(env);

  const cpf = input.cpf.replace(/\D/g, "");
  const phone = input.phoneNumber.replace(/\D/g, "").slice(0, 11);
  const priceLabel = (input.amountCents / 100).toFixed(2).replace(".", ",");

  const body = {
    items: [
      {
        name: `AxéCloud Premium — R$ ${priceLabel}/mês`,
        value: input.amountCents,
        amount: 1,
      },
    ],
    metadata: {
      custom_id: input.tenantId,
      notification_url: input.notificationUrl,
    },
    payment: {
      credit_card: {
        customer: {
          name: input.nome,
          cpf,
          email: input.email,
          phone_number: phone || "11999999999",
        },
        billing_address: {
          street: input.billingAddress.street,
          number: input.billingAddress.number,
          neighborhood: input.billingAddress.neighborhood,
          zipcode: input.billingAddress.zipcode.replace(/\D/g, ""),
          city: input.billingAddress.city,
          state: input.billingAddress.state.slice(0, 2).toUpperCase(),
          complement: input.billingAddress.complement || "",
        },
        payment_token: input.paymentToken,
      },
    },
  };

  const { data } = await client.post(`/v1/plan/${planId}/subscription/one-step`, body, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const subscriptionId = Number(
    data?.data?.subscription_id ?? data?.subscription_id ?? 0
  );
  const chargeId = Number(data?.data?.charge?.id ?? data?.data?.charge_id ?? 0) || undefined;
  const status = String(data?.data?.status ?? data?.status ?? "new");

  if (!subscriptionId) {
    throw new Error("EFI: resposta de assinatura incompleta");
  }

  return { subscriptionId, chargeId, status, raw: data };
}

export async function efiGetCharge(
  env: EfiEnv,
  chargeId: number
): Promise<{ status: string; paid: boolean; raw: unknown }> {
  const token = await efiGetAccessToken(env);
  const client = efiClient(env);
  const { data } = await client.get(`/v1/charge/${chargeId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const status = String(data?.data?.status ?? data?.status ?? "").toLowerCase();
  const paid = status === "paid" || status === "settled" || status === "approved";
  return { status, paid, raw: data };
}

export async function efiGetSubscription(
  env: EfiEnv,
  subscriptionId: number
): Promise<{ status: string; active: boolean; raw: unknown }> {
  const token = await efiGetAccessToken(env);
  const client = efiClient(env);
  const { data } = await client.get(`/v1/subscription/${subscriptionId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const status = String(data?.data?.status ?? data?.status ?? "").toLowerCase();
  const active = status === "active";
  return { status, active, raw: data };
}
