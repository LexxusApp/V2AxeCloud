import type { SupabaseClient } from "@supabase/supabase-js";
import { getOfficialWhatsAppStatus } from "../../src/services/evolution.service.js";
import {
  buildWhatsAppDeliverableText,
  buildWhatsAppMessage,
  logAndSendWhatsApp,
  resolveTerreiroWhatsAppContext,
} from "./whatsappSendCore.js";
import { sendPushToZelador } from "./pushNotifyZelador.js";

function normalizeBrPhone(raw: string): string {
  let digits = String(raw).replace(/\D/g, "");
  if (!digits.startsWith("55")) digits = `55${digits}`;
  return digits;
}

async function isNotifRezaEnabled(sb: SupabaseClient, configTenantId: string): Promise<boolean> {
  const { data } = await sb
    .from("whatsapp_config")
    .select("metadata")
    .eq("tenant_id", configTenantId)
    .maybeSingle();
  const meta = (data?.metadata && typeof data.metadata === "object" ? data.metadata : {}) as Record<
    string,
    unknown
  >;
  const prefs = (meta.preferences && typeof meta.preferences === "object" ? meta.preferences : {}) as Record<
    string,
    boolean
  >;
  return prefs.notifReza !== false;
}

async function resolveNotifyContext(
  sb: SupabaseClient,
  tenantId: string,
  leaderId: string,
) {
  const ctx = await resolveTerreiroWhatsAppContext(sb, leaderId, tenantId);
  const { data: waCfg } = await sb
    .from("whatsapp_config")
    .select("templates")
    .eq("tenant_id", leaderId)
    .maybeSingle();
  return { ctx, templates: waCfg?.templates };
}

export async function notifyZeladorNovoPedidoReza(
  sb: SupabaseClient,
  resolveLeaderIdFn: (tenantId: string) => Promise<string>,
  input: {
    tenantId: string;
    liderId: string;
    pedido: { id: string; nome: string; categoria?: string | null; mensagem: string };
    nomeTerreiro: string;
  },
): Promise<void> {
  try {
    if (!(await isNotifRezaEnabled(sb, input.liderId))) return;

    const pushFallback = () =>
      sendPushToZelador(sb, input.tenantId, resolveLeaderIdFn, {
        title: "Novo pedido de reza",
        body: `${input.pedido.nome} enviou um pedido de amparo espiritual.`,
        url: "/atendimentos",
      });

    const { data: leader } = await sb
      .from("perfil_lider")
      .select("whatsapp_publico")
      .eq("id", input.liderId)
      .maybeSingle();

    const phone = String(leader?.whatsapp_publico || "").replace(/\D/g, "");
    if (phone.length < 10) {
      await pushFallback();
      return;
    }

    const st = await getOfficialWhatsAppStatus();
    if (st.status !== "CONNECTED") {
      await pushFallback();
      return;
    }

    const { ctx, templates } = await resolveNotifyContext(sb, input.tenantId, input.liderId);
    const variables = {
      nome_fiel: input.pedido.nome,
      categoria: String(input.pedido.categoria || "Pedido de amparo"),
      nome_terreiro: ctx.nomeTerreiro,
    };
    const message = buildWhatsAppMessage(templates, "pedido_reza_novo_zelador", variables);
    const deliverableText = buildWhatsAppDeliverableText(
      templates,
      "pedido_reza_novo_zelador",
      "Zelador",
      ctx.nomeTerreiro,
      variables,
      ctx.zelador,
    );

    await logAndSendWhatsApp(sb, {
      tenantId: input.tenantId,
      tipo: "pedido_reza_novo_zelador",
      phone: normalizeBrPhone(phone),
      message,
      deliverableText,
      nomeMembro: "Zelador",
      nomeTerreiro: ctx.nomeTerreiro,
      idTerreiro: ctx.idTerreiro,
      zelador: ctx.zelador,
      variables,
    });
  } catch (err) {
    console.error("[PEDIDO-REZA] notify zelador:", err);
  }
}

export async function notifyFielPedidoAceito(
  sb: SupabaseClient,
  resolveLeaderIdFn: (tenantId: string) => Promise<string>,
  input: {
    tenantId: string;
    liderId: string;
    pedido: { nome: string; whatsapp: string | null; vela?: string | null; categoria?: string | null };
    nomeTerreiro: string;
  },
): Promise<void> {
  try {
    const phone = String(input.pedido.whatsapp || "").replace(/\D/g, "");
    if (phone.length < 10) return;
    if (!(await isNotifRezaEnabled(sb, input.liderId))) return;

    const st = await getOfficialWhatsAppStatus();
    if (st.status !== "CONNECTED") return;

    const { ctx, templates } = await resolveNotifyContext(sb, input.tenantId, input.liderId);
    const variables = {
      nome_fiel: input.pedido.nome,
      nome_terreiro: ctx.nomeTerreiro,
      categoria: String(input.pedido.categoria || "pedido de amparo"),
      vela: input.pedido.vela && input.pedido.vela !== "Nenhuma" ? String(input.pedido.vela) : "",
    };
    const message = buildWhatsAppMessage(templates, "pedido_reza_aceito_fiel", variables);
    const deliverableText = buildWhatsAppDeliverableText(
      templates,
      "pedido_reza_aceito_fiel",
      input.pedido.nome,
      ctx.nomeTerreiro,
      variables,
      ctx.zelador,
    );

    await logAndSendWhatsApp(sb, {
      tenantId: input.tenantId,
      tipo: "pedido_reza_aceito_fiel",
      phone: normalizeBrPhone(phone),
      message,
      deliverableText,
      nomeMembro: input.pedido.nome,
      nomeTerreiro: ctx.nomeTerreiro,
      idTerreiro: ctx.idTerreiro,
      zelador: ctx.zelador,
      variables,
    });
  } catch (err) {
    console.error("[PEDIDO-REZA] notify fiel aceite:", err);
  }
}
