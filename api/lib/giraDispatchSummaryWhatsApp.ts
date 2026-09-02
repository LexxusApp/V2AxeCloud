import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeBrazilMsisdn } from "./welcomeMessage.js";
import type { GiraWhatsAppDispatchResult } from "./cronWhatsAppJobs.js";

export type GiraDispatchSummaryStats = {
  enviados: number;
  entregues: number;
  falhas: number;
  pendentes: number;
  eligible: number;
};

export function buildResumoDisparoGiraText(stats: GiraDispatchSummaryStats): string {
  if (stats.eligible === 0) {
    return "Nenhum membro com WhatsApp cadastrado para receber o aviso.";
  }

  const base = `Enviados: ${stats.enviados} · Entregues: ${stats.entregues} · Falhas: ${stats.falhas}`;

  if (stats.falhas === 0 && stats.entregues >= stats.enviados && stats.enviados > 0) {
    return `${base} · Todos os membros elegiveis receberam o aviso.`;
  }

  if (stats.falhas > 0) {
    const n = stats.falhas;
    const verbo = n === 1 ? "nao foi entregue" : "nao foram entregues";
    return `${base} · ${n} aviso${n === 1 ? "" : "s"} ${verbo}.`;
  }

  if (stats.pendentes > 0) {
    const n = stats.pendentes;
    return `${base} · ${n} aviso${n === 1 ? "" : "s"} ainda em processamento pela operadora.`;
  }

  return base;
}

function resolveSummaryDelayMs(): number {
  const raw = Number(process.env.WA_GIRA_DISPATCH_SUMMARY_DELAY_MS || 240000);
  if (!Number.isFinite(raw)) return 240000;
  return Math.min(Math.max(raw, 60_000), 600_000);
}

async function resolveZeladorContact(
  sb: SupabaseClient,
  leaderId: string,
  fallbackNome?: string
): Promise<{ nome: string; phone: string } | null> {
  const { data, error } = await sb.auth.admin.getUserById(leaderId);
  if (error) {
    console.warn("[gira-summary] auth user:", error.message);
    return null;
  }

  const meta = (data.user?.user_metadata || {}) as Record<string, unknown>;
  const phone = normalizeBrazilMsisdn(String(meta.whatsapp || ""));
  if (!phone) return null;

  const nome = String(meta.nome_zelador || meta.name || fallbackNome || "Zelador").trim() || "Zelador";
  return { nome, phone };
}

async function fetchDispatchStats(
  sb: SupabaseClient,
  externalIds: string[],
  apiErrors: number
): Promise<GiraDispatchSummaryStats> {
  const ids = externalIds.filter(Boolean);
  if (!ids.length) {
    return {
      enviados: 0,
      entregues: 0,
      falhas: apiErrors,
      pendentes: 0,
      eligible: 0,
    };
  }

  const { data, error } = await sb
    .from("whatsapp_logs")
    .select("external_id, status")
    .in("external_id", ids);

  if (error) throw error;

  const rows = data || [];
  let entregues = 0;
  let falhas = apiErrors;
  let pendentes = 0;

  for (const row of rows) {
    const status = String((row as { status?: string }).status || "sent").toLowerCase();
    if (status === "delivered" || status === "read") entregues++;
    else if (status === "failed") falhas++;
    else pendentes++;
  }

  const missing = ids.length - rows.length;
  if (missing > 0) falhas += missing;

  return {
    enviados: ids.length,
    entregues,
    falhas,
    pendentes,
    eligible: ids.length,
  };
}

export async function sendGiraDispatchSummaryWhatsApp(
  sb: SupabaseClient,
  opts: {
    tenantId: string;
    leaderId: string;
    zeladorNome?: string;
    eventoRotulo: string;
    externalIds: string[];
    apiErrors: number;
    eligible: number;
    dispatchStatus: GiraWhatsAppDispatchResult["status"];
  }
): Promise<{ sent: boolean; reason?: string }> {
  if (opts.dispatchStatus === "channel_offline" || opts.dispatchStatus === "disabled") {
    return { sent: false, reason: opts.dispatchStatus };
  }

  const contact = await resolveZeladorContact(sb, opts.leaderId, opts.zeladorNome);
  if (!contact) {
    return { sent: false, reason: "no-zelador-phone" };
  }

  const stats =
    opts.eligible === 0
      ? {
          enviados: 0,
          entregues: 0,
          falhas: 0,
          pendentes: 0,
          eligible: 0,
        }
      : await fetchDispatchStats(sb, opts.externalIds, opts.apiErrors);

  stats.eligible = opts.eligible;

  const resumo = buildResumoDisparoGiraText(stats);
  const eventoRotulo = String(opts.eventoRotulo || "Gira/Evento").trim().slice(0, 200);

  const { isMetaCloudDirectConfigured, sendMetaCloudTemplate } = await import("./metaCloudSend.js");
  const {
    buildMetaTemplateComponents,
    buildResumoDisparoGiraComponents,
    resolveMetaTemplateLanguage,
    resolveResumoDisparoGiraTemplateName,
  } = await import("./whatsappMetaCloud.js");

  const dedicated = resolveResumoDisparoGiraTemplateName();
  const legacy = "aviso_geral_axecloud";
  let messageId: string | undefined;

  if (isMetaCloudDirectConfigured()) {
    try {
      const out = await sendMetaCloudTemplate(
        contact.phone,
        dedicated,
        resolveMetaTemplateLanguage(),
        buildResumoDisparoGiraComponents({
          nome_zelador: contact.nome,
          evento_rotulo: eventoRotulo,
          resumo,
        })
      );
      messageId = out.messageId;
    } catch (err: unknown) {
      console.warn(
        `[gira-summary] template ${dedicated} falhou:`,
        err instanceof Error ? err.message : err
      );
      if (dedicated !== legacy) {
        try {
          const packed = `Resumo disparo ${eventoRotulo}: ${resumo}`;
          const out = await sendMetaCloudTemplate(
            contact.phone,
            legacy,
            resolveMetaTemplateLanguage(),
            buildMetaTemplateComponents(contact.nome, packed)
          );
          messageId = out.messageId;
        } catch (fallbackErr: unknown) {
          console.warn(
            "[gira-summary] fallback aviso_geral falhou:",
            fallbackErr instanceof Error ? fallbackErr.message : fallbackErr
          );
        }
      }
    }
  }

  if (!messageId) {
    return { sent: false, reason: "send-failed" };
  }

  try {
    await sb.from("whatsapp_logs").insert({
      tenant_id: opts.tenantId,
      filho_id: null,
      tipo: "resumo_disparo_gira",
      telefone: contact.phone,
      mensagem: `Resumo disparo gira: ${eventoRotulo} · ${resumo}`,
      status: "sent",
      external_id: messageId,
    });
  } catch (logErr: unknown) {
    console.warn(
      "[gira-summary] log:",
      logErr instanceof Error ? logErr.message : logErr
    );
  }

  console.log(
    `[gira-summary] enviado → ${contact.phone.slice(0, 4)}… evento="${eventoRotulo}" ${resumo}`
  );
  return { sent: true };
}

export function scheduleGiraDispatchSummary(
  sb: SupabaseClient,
  opts: {
    tenantId: string;
    leaderId: string;
    zeladorNome?: string;
    eventoRotulo: string;
    externalIds: string[];
    apiErrors: number;
    eligible: number;
    dispatchStatus: GiraWhatsAppDispatchResult["status"];
  }
): void {
  const delayMs = resolveSummaryDelayMs();
  setTimeout(() => {
    void sendGiraDispatchSummaryWhatsApp(sb, opts).catch((err: unknown) => {
      console.error(
        "[gira-summary] delayed send:",
        err instanceof Error ? err.message : err
      );
    });
  }, delayMs);

  console.log(
    `[gira-summary] agendado em ${Math.round(delayMs / 1000)}s tenant=${opts.tenantId} evento="${opts.eventoRotulo}"`
  );
}
