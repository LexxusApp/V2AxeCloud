/** Configuração de templates Meta Cloud API (WhatsApp Business). */
import type { MetaTemplateComponent } from "../../src/services/evolution.service.js";

export type { MetaTemplateComponent };

const DEFAULT_LANGUAGE = "pt_BR";
/** Template Meta: aviso_geral_axecloud — corpo: Olá, {{1}}! ... sistema {{2}} ... */
const DEFAULT_TEMPLATE = "aviso_geral_axecloud";

export function resolveMetaTemplateLanguage(): string {
  return String(process.env.WA_META_TEMPLATE_LANGUAGE || DEFAULT_LANGUAGE).trim() || DEFAULT_LANGUAGE;
}

/** Nome do template aprovado na Meta para o tipo de notificação. */
export function resolveMetaTemplateName(tipo: string): string {
  const key = String(tipo || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, "_");
  const perTipo = String(process.env[`WA_META_TEMPLATE_${key}`] || "").trim();
  if (perTipo) return perTipo;
  return String(process.env.WA_META_TEMPLATE_DEFAULT || DEFAULT_TEMPLATE).trim() || DEFAULT_TEMPLATE;
}

/**
 * Parâmetros posicionais Meta: {{1}} = nome do membro, {{2}} = nome do terreiro.
 * Parâmetros extras ({{3}}+) opcionais conforme template aprovado na Meta.
 */
export function buildMetaTemplateComponents(
  nomeMembro: string,
  nomeTerreiro: string,
  extraParams: string[] = []
): MetaTemplateComponent[] {
  const parameters = [
    { type: "text" as const, text: String(nomeMembro || "Membro").slice(0, 256) },
    { type: "text" as const, text: String(nomeTerreiro || "Terreiro").slice(0, 256) },
    ...extraParams
      .filter(Boolean)
      .map((value) => ({ type: "text" as const, text: String(value).slice(0, 1024) })),
  ];
  return [{ type: "body", parameters }];
}
