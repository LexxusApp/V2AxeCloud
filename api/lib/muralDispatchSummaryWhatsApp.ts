import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeBrazilMsisdn } from "./welcomeMessage.js";
import { formatPhoneBr } from "./giraDispatchSummaryWhatsApp.js";

export type MuralDispatchFailedMember = {
  nome: string;
  telefone: string;
  motivo?: string;
};

export type MuralDispatchSummaryStats = {
  titulo: string;
  enviados: number;
  entregues: number;
  falhas: number;
  pendentes: number;
  eligible: number;
  failedMembers: MuralDispatchFailedMember[];
  deliveredMemberNames: string[];
};

export function buildResumoDisparoMuralText(stats: MuralDispatchSummaryStats): string {
  if (stats.eligible === 0) {
    return `Nenhum membro ativo com WhatsApp cadastrado para receber o comunicado "${stats.titulo}".`;
  }

  const lines: string[] = [];
  lines.push(`📢 Relatório do Comunicado: "${stats.titulo}"`);
  lines.push("");

  if (stats.entregues > 0) {
    const plural = stats.entregues === 1 ? "médium recebeu" : "médiuns receberam";
    lines.push(`✅ ${stats.entregues} ${plural} com sucesso no WhatsApp.`);
  }

  if (stats.falhas > 0) {
    const n = stats.falhas;
    const header = `⚠️ ${n} ${n === 1 ? "médium não recebeu" : "médiuns não receberam"}:`;
    lines.push(header);

    if (stats.failedMembers && stats.failedMembers.length > 0) {
      for (const m of stats.failedMembers.slice(0, 10)) {
        const nome = m.nome || "Membro";
        const tel = m.telefone ? ` (${formatPhoneBr(m.telefone)})` : "";
        const mot = m.motivo ? ` — ${m.motivo}` : "";
        lines.push(`• ${nome}${tel}${mot}`);
      }
      if (stats.failedMembers.length > 10) {
        lines.push(`• e mais ${stats.failedMembers.length - 10} membro(s)`);
      }
    }
    lines.push("");
    lines.push("💡 Você pode passar o aviso diretamente a eles no terreiro ou pedir que enviem um 'Oi' no WhatsApp do AxéCloud.");
  }

  if (stats.pendentes > 0) {
    const n = stats.pendentes;
    lines.push(`⏳ ${n} ${n === 1 ? "aviso ainda em trânsito de entrega" : "avisos ainda em trânsito de entrega"}.`);
  }

  return lines.join("\n");
}

function resolveMuralSummaryDelayMs(totalRecipients: number): number {
  const envVal = Number(process.env.WA_MURAL_DISPATCH_SUMMARY_DELAY_MS);
  if (Number.isFinite(envVal) && envVal >= 30_000) return envVal;
  // Para poucos contatos (<= 5), aguarda 60s; caso contrário, 120s para dar tempo da Meta processar webhooks
  return totalRecipients <= 5 ? 60_000 : 120_000;
}

async function resolveZeladorContact(
  sb: SupabaseClient,
  leaderId: string,
  fallbackNome?: string
): Promise<{ nome: string; phone: string } | null> {
  const { data, error } = await sb.auth.admin.getUserById(leaderId);
  if (error) {
    console.warn("[mural-summary] auth user:", error.message);
    return null;
  }

  const meta = (data.user?.user_metadata || {}) as Record<string, unknown>;
  const phone = normalizeBrazilMsisdn(String(meta.whatsapp || ""));
  if (!phone) return null;

  const nome = String(meta.nome_zelador || meta.name || fallbackNome || "Zelador").trim() || "Zelador";
  return { nome, phone };
}

function humanizeSummaryMetaError(msg?: string | null): string {
  const text = String(msg || "").toLowerCase();
  if (text.includes("131026") || text.includes("undeliverable")) {
    return "Número sem WhatsApp ativo (#131026)";
  }
  if (text.includes("131049") || text.includes("ecosystem")) {
    return "Bloqueio temporário pela Meta (#131049)";
  }
  if (text.includes("131047") || text.includes("re-engagement")) {
    return "Janela 24h fechada (#131047)";
  }
  return msg ? "Falha na entrega" : "Erro no envio";
}

async function fetchMuralDispatchStats(
  sb: SupabaseClient,
  externalIds: string[],
  apiErrors: number,
  immediateFailures?: Array<{ nome: string; telefone: string; motivo?: string }>,
  titulo: string = "Comunicado"
): Promise<MuralDispatchSummaryStats> {
  const ids = externalIds.filter(Boolean);
  const failedMembers: MuralDispatchFailedMember[] = [...(immediateFailures || [])];
  const deliveredMemberNames: string[] = [];

  if (!ids.length) {
    return {
      titulo,
      enviados: 0,
      entregues: 0,
      falhas: apiErrors + failedMembers.length,
      pendentes: 0,
      eligible: failedMembers.length,
      failedMembers,
      deliveredMemberNames,
    };
  }

  const { data, error } = await sb
    .from("whatsapp_logs")
    .select("external_id, status, filho_id, telefone, mensagem")
    .in("external_id", ids);

  if (error) throw error;

  const rows = data || [];
  let entregues = 0;
  let falhas = apiErrors;
  let pendentes = 0;
  const failedFilhoIds: string[] = [];
  const failedMap = new Map<string, { telefone: string; motivo: string }>();

  for (const row of rows) {
    const status = String((row as { status?: string }).status || "sent").toLowerCase();
    if (status === "delivered" || status === "read") {
      entregues++;
    } else if (status === "failed") {
      falhas++;
      const fid = (row as { filho_id?: string | null }).filho_id;
      const tel = String((row as { telefone?: string | null }).telefone || "");
      const motivo = humanizeSummaryMetaError(String((row as { mensagem?: string | null }).mensagem || ""));
      if (fid) {
        failedFilhoIds.push(String(fid));
        failedMap.set(String(fid), { telefone: tel, motivo });
      } else if (tel) {
        failedMembers.push({ nome: "Membro", telefone: tel, motivo });
      }
    } else {
      pendentes++;
    }
  }

  const missing = ids.length - rows.length;
  if (missing > 0) falhas += missing;

  if (failedFilhoIds.length) {
    const { data: filhos } = await sb
      .from("filhos_de_santo")
      .select("id, nome")
      .in("id", failedFilhoIds);
    for (const f of filhos || []) {
      const info = failedMap.get(String(f.id));
      failedMembers.push({
        nome: String(f.nome || "Membro").trim(),
        telefone: info?.telefone || "",
        motivo: info?.motivo,
      });
    }
  }

  return {
    titulo,
    enviados: ids.length,
    entregues,
    falhas: falhas + (immediateFailures?.length || 0),
    pendentes,
    eligible: ids.length + (immediateFailures?.length || 0),
    failedMembers,
    deliveredMemberNames,
  };
}

export async function sendMuralDispatchSummaryWhatsApp(
  sb: SupabaseClient,
  opts: {
    tenantId: string;
    leaderId: string;
    zeladorNome?: string;
    tituloAviso: string;
    externalIds: string[];
    apiErrors: number;
    eligible: number;
    immediateFailures?: Array<{ nome: string; telefone: string; motivo?: string }>;
  }
): Promise<{ sent: boolean; reason?: string }> {
  const contact = await resolveZeladorContact(sb, opts.leaderId, opts.zeladorNome);
  if (!contact) {
    return { sent: false, reason: "no-zelador-phone" };
  }

  const stats = await fetchMuralDispatchStats(
    sb,
    opts.externalIds,
    opts.apiErrors,
    opts.immediateFailures,
    opts.tituloAviso
  );

  stats.eligible = Math.max(opts.eligible, stats.eligible);
  const resumoText = buildResumoDisparoMuralText(stats);

  const { isMetaCloudDirectConfigured, sendMetaCloudTemplate } = await import("./metaCloudSend.js");
  const {
    buildMetaTemplateComponents,
    resolveMetaTemplateLanguage,
  } = await import("./whatsappMetaCloud.js");

  let messageId: string | undefined;

  // 1. Tenta enviar como texto livre caso haja janela 24h aberta
  if (isMetaCloudDirectConfigured()) {
    try {
      const { sendMetaCloudText } = await import("./metaCloudSend.js");
      const out = await sendMetaCloudText(contact.phone, resumoText);
      messageId = out.messageId;
      console.log(`[mural-summary] enviado via texto livre para ${contact.phone.slice(0, 4)}…`);
    } catch {
      /* fallback para template oficial */
    }

    // 2. Fallback garantido: template universal aprovado aviso_geral_axecloud
    if (!messageId) {
      try {
        const resumoCurto = stats.falhas > 0
          ? `Comunicado "${stats.titulo}": ${stats.entregues} entregues com sucesso, ${stats.falhas} falharam. Confira a lista no painel.`
          : `Comunicado "${stats.titulo}": todos os ${stats.entregues} médiuns receberam com sucesso no WhatsApp!`;

        const out = await sendMetaCloudTemplate(
          contact.phone,
          "aviso_geral_axecloud",
          resolveMetaTemplateLanguage(),
          buildMetaTemplateComponents(contact.nome, resumoCurto)
        );
        messageId = out.messageId;
        console.log(`[mural-summary] enviado via aviso_geral_axecloud para ${contact.phone.slice(0, 4)}…`);
      } catch (templateErr: unknown) {
        console.warn(
          "[mural-summary] template aviso_geral falhou:",
          templateErr instanceof Error ? templateErr.message : templateErr
        );
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
      tipo: "resumo_disparo_mural",
      telefone: contact.phone,
      mensagem: `Resumo comunicado: "${opts.tituloAviso}" · ${resumoText}`,
      status: "sent",
      external_id: messageId,
    });
  } catch (logErr: unknown) {
    console.warn(
      "[mural-summary] log insert:",
      logErr instanceof Error ? logErr.message : logErr
    );
  }

  return { sent: true };
}

export function scheduleMuralDispatchSummary(
  sb: SupabaseClient,
  opts: {
    tenantId: string;
    leaderId: string;
    zeladorNome?: string;
    tituloAviso: string;
    externalIds: string[];
    apiErrors: number;
    eligible: number;
    immediateFailures?: Array<{ nome: string; telefone: string; motivo?: string }>;
  }
): void {
  const total = opts.externalIds.length + (opts.immediateFailures?.length || 0);
  const delayMs = resolveMuralSummaryDelayMs(total);

  setTimeout(() => {
    void sendMuralDispatchSummaryWhatsApp(sb, opts).catch((err: unknown) => {
      console.error(
        "[mural-summary] delayed send:",
        err instanceof Error ? err.message : err
      );
    });
  }, delayMs);

  console.log(
    `[mural-summary] agendado em ${Math.round(delayMs / 1000)}s tenant=${opts.tenantId} aviso="${opts.tituloAviso}"`
  );
}
