import { normalizeBrazilMsisdn } from "./welcomeMessage.js";

function resolveOpsAlertPhones(): string[] {
  const raw = [
    process.env.WA_OPS_ALERT_PHONES,
    process.env.WA_OPS_ALERT_PHONE,
    process.env.AUTOPOST_WHATSAPP_TO,
  ]
    .map((v) => String(v || "").trim())
    .find(Boolean);
  if (!raw) return [];
  const out: string[] = [];
  for (const part of raw.split(/[,;\s]+/)) {
    const msisdn = normalizeBrazilMsisdn(part);
    if (msisdn && !out.includes(msisdn)) out.push(msisdn);
  }
  return out;
}

function packLegacyAlertLine(parts: Array<string | null | undefined>, max = 900): string {
  const text = parts
    .map((p) => String(p || "").trim())
    .filter(Boolean)
    .join(" · ")
    .replace(/\s+/g, " ")
    .trim();
  return text.slice(0, max) || "Novo cadastro no AxéCloud";
}

/**
 * Avisa o operador (WhatsApp) quando um terreiro novo é criado.
 * Preferência: template dedicado `novo_cadastro_terreiro_ops_axecloud`;
 * fallback legado: `aviso_geral_axecloud`; depois Evolution em texto livre.
 *
 * Destinos: `WA_OPS_ALERT_PHONES` (vírgula) ou `AUTOPOST_WHATSAPP_TO`.
 */
export async function notifyOpsNewTerreiro(opts: {
  nome_terreiro: string;
  nome_zelador?: string | null;
  email: string;
  whatsapp?: string | null;
  source: "public-register" | "admin-create";
  tenantId?: string | null;
}): Promise<{ sent: number; skipped: string }> {
  const phones = resolveOpsAlertPhones();
  if (!phones.length) {
    return { sent: 0, skipped: "no-ops-phone" };
  }

  const terreiro = String(opts.nome_terreiro || "Terreiro").trim().slice(0, 80);
  const zelador = String(opts.nome_zelador || "").trim().slice(0, 60);
  const email = String(opts.email || "").trim().toLowerCase().slice(0, 120);
  const waCadastro = normalizeBrazilMsisdn(opts.whatsapp || "") || "sem WA";
  const origem = opts.source === "admin-create" ? "admin" : "site";

  const legacyPacked = packLegacyAlertLine([
    `Terreiro: ${terreiro}`,
    zelador ? `Zelador: ${zelador}` : null,
    email ? `E-mail: ${email}` : null,
    `WA: ${waCadastro}`,
    `origem ${origem}`,
  ]);

  let sent = 0;
  const { isMetaCloudDirectConfigured, sendMetaCloudTemplate } = await import("./metaCloudSend.js");
  const {
    buildMetaTemplateComponents,
    buildOpsNovoCadastroComponents,
    resolveMetaTemplateLanguage,
    resolveOpsAlertTemplateName,
  } = await import("./whatsappMetaCloud.js");
  const dedicatedTemplate = resolveOpsAlertTemplateName();
  const legacyTemplate = "aviso_geral_axecloud";

  for (const msisdn of phones) {
    let delivered = false;

    if (isMetaCloudDirectConfigured()) {
      try {
        await sendMetaCloudTemplate(
          msisdn,
          dedicatedTemplate,
          resolveMetaTemplateLanguage(),
          buildOpsNovoCadastroComponents({
            nome_terreiro: terreiro,
            nome_zelador: zelador,
            email,
            whatsapp: waCadastro,
            origem,
          })
        );
        sent++;
        delivered = true;
        console.log(`[ops-alert] novo terreiro → ${msisdn} (meta ${dedicatedTemplate})`);
      } catch (err: unknown) {
        console.warn(
          `[ops-alert] Meta dedicado falhou (${msisdn}, ${dedicatedTemplate}):`,
          err instanceof Error ? err.message : err
        );
      }

      if (!delivered && dedicatedTemplate !== legacyTemplate) {
        try {
          await sendMetaCloudTemplate(
            msisdn,
            legacyTemplate,
            resolveMetaTemplateLanguage(),
            buildMetaTemplateComponents("AxéCloud Ops", legacyPacked)
          );
          sent++;
          delivered = true;
          console.log(`[ops-alert] novo terreiro → ${msisdn} (meta fallback ${legacyTemplate})`);
        } catch (err: unknown) {
          console.warn(
            `[ops-alert] Meta fallback falhou (${msisdn}):`,
            err instanceof Error ? err.message : err
          );
        }
      }
    }

    if (delivered) continue;

    try {
      const { sendEvolutionTextQueued } = await import("./evolutionSendQueue.js");
      const { CONSOLE_ADMIN_INSTANCE_NAME } = await import(
        "../../src/services/evolution.service.js"
      );
      const freeText =
        `🔔 *Novo terreiro no AxéCloud*\n\n` +
        `*${terreiro}*\n` +
        (zelador ? `Zelador: ${zelador}\n` : "") +
        `E-mail: ${email}\n` +
        `WhatsApp: ${waCadastro}\n` +
        `Origem: ${origem}` +
        (opts.tenantId ? `\nID: ${opts.tenantId}` : "");
      await sendEvolutionTextQueued(CONSOLE_ADMIN_INSTANCE_NAME, msisdn, freeText);
      sent++;
      console.log(`[ops-alert] novo terreiro → ${msisdn} (evolution)`);
    } catch (err: unknown) {
      console.error(
        `[ops-alert] Evolution falhou (${msisdn}):`,
        err instanceof Error ? err.message : err
      );
    }
  }

  return { sent, skipped: sent > 0 ? "" : "send-failed" };
}
