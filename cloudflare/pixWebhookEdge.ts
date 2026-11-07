import { createClient } from "@supabase/supabase-js";

export function isPixActivationAlreadyApplied(lastChargeId: unknown, txid: string): boolean {
  return String(lastChargeId || "").trim() === `pix:${txid}`;
}

const EFI_PIX_WEBHOOK_IPS = new Set(["34.193.116.226"]);

function constantTimeTextEqual(left: string, right: string): boolean {
  if (!left || left.length !== right.length) return false;
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return diff === 0;
}

export function isTrustedEfiPixWebhook(input: {
  sourceIp?: string | null;
  expectedSecret?: string | null;
  suppliedSecret?: string | null;
}): boolean {
  const sourceIp = String(input.sourceIp || "").trim();
  if (EFI_PIX_WEBHOOK_IPS.has(sourceIp)) return true;
  const expected = String(input.expectedSecret || "").trim();
  const supplied = String(input.suppliedSecret || "").trim();
  return !!expected && constantTimeTextEqual(expected, supplied);
}

export async function handlePixWebhookEdge(
  rawBody: string,
  url: URL,
  method: string,
  env: {
    SUPABASE_SERVICE_ROLE_KEY?: string;
    VITE_SUPABASE_URL?: string;
    [k: string]: unknown;
  },
  requestSecurity?: {
    sourceIp?: string | null;
    suppliedSecret?: string | null;
  },
): Promise<Response | null> {
  const isEfiWebhook =
    url.pathname === "/api/webhooks/efi" ||
    url.pathname === "/webhook/efi" ||
    url.pathname.startsWith("/api/webhooks/efi");

  if (!isEfiWebhook || method !== "POST") {
    return null;
  }

  let body: Record<string, unknown> | null = null;
  try {
    body = JSON.parse(rawBody);
  } catch {
    // Não é JSON — deixa o container avaliar se é x-www-form-urlencoded
    return null;
  }

  // Se não tem propriedade "pix", deixa seguir para o container (ex: notificação de cartão/carnê)
  if (!body || !Array.isArray(body.pix)) {
    return null;
  }

  const pixList = body.pix as Array<Record<string, unknown>>;

  if (!isTrustedEfiPixWebhook({
    sourceIp: requestSecurity?.sourceIp,
    expectedSecret: String(env.EFI_WEBHOOK_SECRET || ""),
    suppliedSecret: requestSecurity?.suppliedSecret,
  })) {
    console.warn("[pix-edge] Webhook Pix recusado: origem não autenticada");
    return new Response("Unauthorized", {
      status: 401,
      headers: { "x-axecloud-runtime": "cloudflare-edge-pix" },
    });
  }

  // Handshake ou probe de validação do webhook da Efí (ex: array vazio [])
  if (pixList.length === 0) {
    return new Response("OK", {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8", "x-axecloud-runtime": "cloudflare-edge-pix" },
    });
  }

  const supabaseUrl = String(env.VITE_SUPABASE_URL || "").trim();
  const serviceKey = String(env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!supabaseUrl || !serviceKey) {
    console.error("[pix-edge] Supabase credentials ausentes");
    return new Response("Temporarily unavailable", {
      status: 503,
      headers: { "Retry-After": "60", "x-axecloud-runtime": "cloudflare-edge-pix" },
    });
  }

  const sb = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const now = new Date().toISOString();
  let processingFailed = false;

  for (const pixItem of pixList) {
    const txid = String(pixItem?.txid || "").trim();
    if (!txid) continue;

    console.log(`[pix-edge] Processando PIX txid=${txid}`);

    let { data: sub, error: subError } = await sb
      .from("subscriptions")
      .select("id, status, plan, expires_at, billing_cycle, pending_billing_cycle, efi_pix_txid, efi_charge_id, last_activated_charge_id")
      .or(`efi_pix_txid.eq.${txid},efi_charge_id.eq.pix:${txid}`)
      .maybeSingle();

    if (subError) {
      console.error("[pix-edge] Erro ao buscar assinatura:", subError.message);
      processingFailed = true;
      continue;
    }

    if (!sub) {
      const { data: event } = await sb
        .from("payment_webhook_events")
        .select("tenant_id")
        .eq("provider", "efi_pix")
        .eq("charge_id", txid)
        .not("tenant_id", "is", null)
        .order("occurred_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (event?.tenant_id) {
        const fallback = await sb
          .from("subscriptions")
          .select("id, status, plan, expires_at, billing_cycle, pending_billing_cycle, efi_pix_txid, efi_charge_id, last_activated_charge_id")
          .eq("id", event.tenant_id)
          .maybeSingle();
        sub = fallback.data;
        subError = fallback.error;
      }
    }

    if (subError || !sub) {
      console.warn(`[pix-edge] Assinatura não localizada para txid=${txid}`);
      processingFailed = true;
      continue;
    }

    if (isPixActivationAlreadyApplied(sub.last_activated_charge_id, txid)) {
      console.log(`[pix-edge] PIX já aplicado; ignorando repetição txid=${txid}`);
      continue;
    }

    const billingCycle = (sub.pending_billing_cycle || sub.billing_cycle || "monthly").toLowerCase();
    const periodDays = billingCycle === "annual" ? 365 : 30;
    const currentExpiry = new Date(String(sub.expires_at || "")).getTime();
    const baseTime = Number.isFinite(currentExpiry) ? Math.max(Date.now(), currentExpiry) : Date.now();
    const expiresAt = new Date(baseTime + periodDays * 24 * 60 * 60 * 1000).toISOString();

    const valorNum = Number(pixItem?.valor) || 0;
    const amountCents = valorNum > 0 ? Math.round(valorNum * 100) : 6990;

    const { error: updateSubErr } = await sb
      .from("subscriptions")
      .update({
        status: "active",
        plan: sub.plan || "premium",
        expires_at: expiresAt,
        billing_cycle: billingCycle,
        pending_billing_cycle: null,
        payment_provider: "efi_pix",
        pending_since: null,
        updated_at: now,
        last_activated_charge_id: `pix:${txid}`,
        efi_charge_id: `pix:${txid}`,
      })
      .eq("id", sub.id);

    if (updateSubErr) {
      console.error("[pix-edge] Falha ao atualizar assinatura:", updateSubErr.message);
      processingFailed = true;
      continue;
    } else {
      console.log(`[pix-edge] Assinatura ativada até ${expiresAt} para tenant=${sub.id}`);
    }

    // Desbloquear zelador se bloqueado por expiração
    const { data: profile } = await sb
      .from("perfil_lider")
      .select("is_blocked, access_block_reason")
      .eq("id", sub.id)
      .maybeSingle();

    if (profile?.is_blocked && profile?.access_block_reason === "subscription_expired") {
      await sb
        .from("perfil_lider")
        .update({
          is_blocked: false,
          access_block_reason: null,
          access_blocked_at: null,
          updated_at: now,
        })
        .eq("id", sub.id);
    }

    // Remover flag de trial do usuário auth
    try {
      const { data: authUser } = await sb.auth.admin.getUserById(sub.id);
      const meta = (authUser?.user?.user_metadata || {}) as Record<string, unknown>;
      if (meta.is_trial === true) {
        await sb.auth.admin.updateUserById(sub.id, {
          user_metadata: { ...meta, is_trial: false },
        });
      }
    } catch {
      /* ignore */
    }

    // Registrar na trilha financeira
    await sb
      .from("payment_webhook_events")
      .insert({
        tenant_id: sub.id,
        provider: "efi_pix",
        external_id: `pix:${txid}:paid`,
        event_type: "payment_confirmed",
        status: "paid",
        payment_method: "pix",
        amount_cents: amountCents,
        billing_cycle: billingCycle,
        charge_id: txid,
        message: "Pagamento PIX confirmado via webhook da Efí.",
        payload: pixItem,
        occurred_at: now,
        processed_at: now,
      })
      .catch((err) => console.warn("[pix-edge] Registro financeiro:", err));

    // Enviar mensagem no WhatsApp confirmando a renovação
    try {
      const waToken = String(env.WA_META_TOKEN || "").trim();
      const phoneId = String(env.WA_PHONE_NUMBER_ID || "").trim();
      const apiVer = String(env.WA_BUSINESS_VERSION || "v21.0").trim();

      if (waToken && phoneId) {
        // Busca zelador e telefone
        const { data: leader } = await sb
          .from("perfil_lider")
          .select("nome_terreiro, cargo, whatsapp, whatsapp_publico")
          .eq("id", sub.id)
          .maybeSingle();

        let targetPhone = String(leader?.whatsapp || leader?.whatsapp_publico || "").replace(/\D/g, "");
        if (!targetPhone) {
          const { data: lastLog } = await sb
            .from("whatsapp_logs")
            .select("telefone")
            .eq("tenant_id", sub.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          targetPhone = String(lastLog?.telefone || "").replace(/\D/g, "");
        }

        if (targetPhone) {
          if (targetPhone.length === 10) {
            targetPhone = `${targetPhone.slice(0, 2)}9${targetPhone.slice(2)}`;
          }
          if (!targetPhone.startsWith("55")) targetPhone = `55${targetPhone}`;

          const nomeZelador = String(leader?.cargo || "Zelador(a)").trim();
          const nomeTerreiro = String(leader?.nome_terreiro || "Terreiro").trim();
          const valorFormatado = `R$ ${(amountCents / 100).toFixed(2).replace(".", ",")}`;
          const expDate = new Date(expiresAt);
          const validadeFormatada = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(expDate);

          // Tenta enviar o template oficial 'confirmacao_assinatura_pix_axecloud'
          // Se ainda estiver PENDING, fallback para 'mensalidade_confirmada_axecloud'
          const metaUrl = `https://graph.facebook.com/${apiVer}/${phoneId}/messages`;
          
          let templatePayload: Record<string, unknown> = {
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: targetPhone,
            type: "template",
            template: {
              name: "confirmacao_assinatura_pix_axecloud",
              language: { code: "pt_BR" },
              components: [
                {
                  type: "body",
                  parameters: [
                    { type: "text", text: nomeZelador },
                    { type: "text", text: valorFormatado },
                    { type: "text", text: nomeTerreiro },
                    { type: "text", text: validadeFormatada },
                  ],
                },
              ],
            },
          };

          let waRes = await fetch(metaUrl, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${waToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(templatePayload),
          });

          if (!waRes.ok) {
            const errBody = await waRes.text().catch(() => "");
            console.warn("[pix-edge] Template confirmacao_assinatura_pix falhou, tentando fallback mensalidade_confirmada:", errBody);
            templatePayload = {
              messaging_product: "whatsapp",
              recipient_type: "individual",
              to: targetPhone,
              type: "template",
              template: {
                name: "mensalidade_confirmada_axecloud",
                language: { code: "pt_BR" },
                components: [
                  {
                    type: "body",
                    parameters: [
                      { type: "text", text: nomeZelador },
                      { type: "text", text: "Assinatura AxéCloud" },
                      { type: "text", text: (amountCents / 100).toFixed(2).replace(".", ",") },
                      { type: "text", text: nomeTerreiro },
                    ],
                  },
                ],
              },
            };
            waRes = await fetch(metaUrl, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${waToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(templatePayload),
            });
          }

          if (waRes.ok) {
            const sentJson = (await waRes.json().catch(() => ({}))) as any;
            const wamid = sentJson?.messages?.[0]?.id || null;
            console.log(`[pix-edge] Confirmação de renovação enviada via WhatsApp para ${targetPhone}: wamid=${wamid}`);

            await sb.from("whatsapp_logs").insert({
              tenant_id: sub.id,
              tipo: "confirmacao_assinatura_pix",
              telefone: targetPhone,
              mensagem: `Confirmamos o pagamento de ${valorFormatado} via Pix para a assinatura do ${nomeTerreiro}. Validade: ${validadeFormatada}.`,
              status: "delivered",
              external_id: wamid,
            }).catch(() => null);
          } else {
            console.error("[pix-edge] Erro ao enviar WhatsApp de confirmação:", await waRes.text().catch(() => ""));
          }
        }
      }
    } catch (waErr) {
      console.error("[pix-edge] Exceção ao enviar confirmação WhatsApp:", waErr);
    }
  }

  return new Response(processingFailed ? "Retry" : "OK", {
    status: processingFailed ? 503 : 200,
    headers: { "Content-Type": "text/plain; charset=utf-8", "x-axecloud-runtime": "cloudflare-edge-pix" },
  });
}
