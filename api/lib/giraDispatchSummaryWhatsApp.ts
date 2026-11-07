import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeBrazilMsisdn } from "./welcomeMessage.js";
import type { GiraWhatsAppDispatchResult } from "./cronWhatsAppJobs.js";

export type GiraDispatchFailedMember = {
  nome: string;
  telefone: string;
};

export type GiraDispatchSummaryStats = {
  enviados: number;
  entregues: number;
  falhas: number;
  pendentes: number;
  eligible: number;
  failedMembers?: GiraDispatchFailedMember[];
};

export function formatPhoneBr(phone: string): string {
  const d = String(phone || "").replace(/\D/g, "");
  if (d.length === 13 && d.startsWith("55")) {
    return `${d.slice(2, 4)} ${d.slice(4, 9)}-${d.slice(9)}`;
  }
  if (d.length === 12 && d.startsWith("55")) {
    return `${d.slice(2, 4)} ${d.slice(4, 8)}-${d.slice(8)}`;
  }
  if (d.length === 11) {
    return `${d.slice(0, 2)} ${d.slice(2, 7)}-${d.slice(7)}`;
  }
  if (d.length === 10) {
    return `${d.slice(0, 2)} ${d.slice(2, 6)}-${d.slice(6)}`;
  }
  return phone;
}

export function buildResumoDisparoGiraText(stats: GiraDispatchSummaryStats): string {
  if (stats.eligible === 0) {
    return "Nenhum membro com WhatsApp cadastrado para receber o aviso.";
  }

  const lines: string[] = [];

  if (stats.entregues > 0) {
    const plural = stats.entregues === 1 ? "médium recebeu" : "médiuns receberam";
    lines.push(`✅ ${stats.entregues} ${plural} com sucesso.`);
  }

  if (stats.falhas > 0) {
    const n = stats.falhas;
    const header = `⚠️ ${n} ${n === 1 ? "número falhou" : "números falharam"} (sem WhatsApp ou número incorreto):`;
    lines.push(header);

    if (stats.failedMembers && stats.failedMembers.length > 0) {
      for (const m of stats.failedMembers.slice(0, 8)) {
        const nome = m.nome || "Membro";
        const tel = m.telefone ? ` (${formatPhoneBr(m.telefone)})` : "";
        lines.push(`• ${nome}${tel}`);
      }
      if (stats.failedMembers.length > 8) {
        lines.push(`• e mais ${stats.failedMembers.length - 8} membro(s)`);
      }
    }
  }

  if (stats.pendentes > 0) {
    const n = stats.pendentes;
    lines.push(`⏳ ${n} ${n === 1 ? "aviso ainda em processamento" : "avisos ainda em processamento"}.`);
  }

  return lines.join("\n");
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
    .select("external_id, status, filho_id, telefone")
    .in("external_id", ids);

  if (error) throw error;

  const rows = data || [];
  let entregues = 0;
  let falhas = apiErrors;
  let pendentes = 0;
  const failedFilhoIds: string[] = [];
  const failedMap = new Map<string, string>();

  for (const row of rows) {
    const status = String((row as { status?: string }).status || "sent").toLowerCase();
    if (status === "delivered" || status === "read") {
      entregues++;
    } else if (status === "failed") {
      falhas++;
      const fid = (row as { filho_id?: string | null }).filho_id;
      const tel = String((row as { telefone?: string | null }).telefone || "");
      if (fid) {
        failedFilhoIds.push(String(fid));
        failedMap.set(String(fid), tel);
      }
    } else {
      pendentes++;
    }
  }

  const missing = ids.length - rows.length;
  if (missing > 0) falhas += missing;

  const failedMembers: GiraDispatchFailedMember[] = [];
  if (failedFilhoIds.length) {
    const { data: filhos } = await sb
      .from("filhos_de_santo")
      .select("id, nome")
      .in("id", failedFilhoIds);
    for (const f of filhos || []) {
      failedMembers.push({
        nome: String(f.nome || "Membro").trim(),
        telefone: failedMap.get(String(f.id)) || "",
      });
    }
  }

  return {
    enviados: ids.length,
    entregues,
    falhas,
    pendentes,
    eligible: ids.length,
    failedMembers,
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
