/** Templates Meta Cloud API (WhatsApp Business) — payloads Evolution v2. */
import type { MetaTemplateComponent } from "../../src/services/evolution.service.js";

export type { MetaTemplateComponent };

const DEFAULT_LANGUAGE = "pt_BR";
/** Fallback genérico: Olá, {{1}}! … sistema {{2}} … */
const DEFAULT_TEMPLATE = "aviso_geral_axecloud";
/** Convidados (RSVP): corpo 5 vars + 2 botões URL dinâmicos */
const CONVITE_EVENTO_TEMPLATE = "convite_evento_axecloud";
/** Membros / corrente: aviso de gira ou evento no calendário */
const AVISO_GIRA_TEMPLATE = "aviso_gira_axecloud";
const DEFAULT_EVENT_BANNER_URL = "https://axecloud.com.br/og-image.png";

export function resolveMetaTemplateLanguage(): string {
  return String(process.env.WA_META_TEMPLATE_LANGUAGE || DEFAULT_LANGUAGE).trim() || DEFAULT_LANGUAGE;
}

/** Nome do template aprovado na Meta para o tipo de notificação. */
export function resolveMetaTemplateName(tipo: string): string {
  const normalized = String(tipo || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_");

  if (normalized === "convite_evento") {
    return (
      String(process.env.WA_META_TEMPLATE_CONVITE_EVENTO || "").trim() || CONVITE_EVENTO_TEMPLATE
    );
  }
  if (normalized === "aviso_gira") {
    return String(process.env.WA_META_TEMPLATE_AVISO_GIRA || "").trim() || AVISO_GIRA_TEMPLATE;
  }
  if (normalized === "boas_vindas") {
    return (
      String(process.env.WA_META_TEMPLATE_BOAS_VINDAS || "").trim() || DEFAULT_TEMPLATE
    );
  }

  const key = normalized.toUpperCase();
  const perTipo = String(process.env[`WA_META_TEMPLATE_${key}`] || "").trim();
  if (perTipo) return perTipo;
  return String(process.env.WA_META_TEMPLATE_DEFAULT || DEFAULT_TEMPLATE).trim() || DEFAULT_TEMPLATE;
}

export function isConviteEventoTemplate(tipo: string): boolean {
  return resolveMetaTemplateName(tipo) === CONVITE_EVENTO_TEMPLATE;
}

export function isAvisoGiraTemplate(tipo: string): boolean {
  return resolveMetaTemplateName(tipo) === AVISO_GIRA_TEMPLATE;
}

export function isBoasVindasTemplate(tipo: string): boolean {
  return String(tipo || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_") === "boas_vindas";
}

/** ID de login do filho (4 caracteres do UUID, como na tela /login). */
export function filhoLoginIdShort(uuid: string): string {
  return String(uuid || "")
    .replace(/-/g, "")
    .slice(0, 4)
    .toUpperCase();
}

export function resolveLoginPublicUrl(): string {
  const base = String(
    process.env.WA_APP_LOGIN_URL || process.env.VITE_APP_URL || "https://axecloud.com.br"
  )
    .trim()
    .replace(/\/$/, "");
  return base.startsWith("http") ? `${base}/login` : "https://axecloud.com.br/login";
}

function resolveSistemaName(variables?: Record<string, string | number>): string {
  return String(variables?.nome_sistema || process.env.WA_META_SYSTEM_NAME || "AxéCloud").trim();
}

function textParam(value: string, max = 256): { type: "text"; text: string } {
  return { type: "text", text: String(value || "").slice(0, max) };
}

/** Extrai token RSVP (variável direta ou URL legada). */
export function extractRsvpToken(variables?: Record<string, string | number>): string {
  const direct = String(variables?.rsvp_token || "").trim();
  if (direct) return direct;
  for (const key of ["link_confirmar", "link_declinar"]) {
    const link = String(variables?.[key] || "").trim();
    const match = link.match(/\/convite\/([^/?#]+)\//i);
    if (match?.[1]) return decodeURIComponent(match[1]);
  }
  return "";
}

function rsvpButtonSuffix(token: string, action: "confirmar" | "declinar"): string {
  const clean = String(token || "").trim();
  if (!clean) return action;
  return `${clean}/${action}`;
}

/** URL pública HTTPS do banner (header obrigatório no convite_evento_axecloud). */
export function resolveEventBannerUrl(variables?: Record<string, string | number>): string {
  const fromVars = String(variables?.banner_url || variables?.bannerUrl || "").trim();
  if (fromVars.startsWith("https://")) return fromVars.slice(0, 2048);
  const fromEnv = String(process.env.WA_META_EVENT_DEFAULT_BANNER_URL || "").trim();
  if (fromEnv.startsWith("https://")) return fromEnv.slice(0, 2048);
  return DEFAULT_EVENT_BANNER_URL;
}

/**
 * convite_evento_axecloud
 * Header: imagem (banner do evento)
 * Corpo: {{1}} terreiro, {{2}} título, {{3}} data, {{4}} horário, {{5}} local
 * Botões URL (base https://axecloud.com.br/convite/): {token}/confirmar | {token}/declinar
 */
export function buildConviteEventoComponents(
  variables?: Record<string, string | number>
): MetaTemplateComponent[] {
  const nomeTerreiro = String(variables?.nome_terreiro || "Terreiro");
  const titulo = String(variables?.nome_evento || variables?.titulo_evento || "Evento");
  const data = String(variables?.data_evento || "");
  const hora = String(variables?.hora_evento || "");
  const local = String(
    variables?.local_evento || variables?.descricao_evento || variables?.descricao || "A confirmar"
  );
  const token = extractRsvpToken(variables);
  const bannerUrl = resolveEventBannerUrl(variables);

  const components: MetaTemplateComponent[] = [
    {
      type: "header",
      parameters: [{ type: "image", image: { link: bannerUrl } }],
    },
    {
      type: "body",
      parameters: [
        textParam(nomeTerreiro),
        textParam(titulo),
        textParam(data || "—"),
        textParam(hora || "—"),
        textParam(local, 1024),
      ],
    },
  ];

  if (token) {
    components.push(
      {
        type: "button",
        sub_type: "url",
        index: "0",
        parameters: [textParam(rsvpButtonSuffix(token, "confirmar"), 1024)],
      },
      {
        type: "button",
        sub_type: "url",
        index: "1",
        parameters: [textParam(rsvpButtonSuffix(token, "declinar"), 1024)],
      }
    );
  }

  return components;
}

/**
 * aviso_gira_axecloud — header: banner do evento; corpo: {{1}} título, {{2}} data, {{3}} horário
 */
export function buildAvisoGiraComponents(
  variables?: Record<string, string | number>
): MetaTemplateComponent[] {
  const titulo = String(variables?.nome_evento || variables?.titulo_evento || variables?.titulo || "Gira");
  const data = String(variables?.data_evento || "");
  const hora = String(variables?.hora_evento || "");
  const bannerUrl = resolveEventBannerUrl(variables);

  return [
    {
      type: "header",
      parameters: [{ type: "image", image: { link: bannerUrl } }],
    },
    {
      type: "body",
      parameters: [textParam(titulo), textParam(data || "—"), textParam(hora || "—")],
    },
  ];
}

/**
 * aviso_geral_axecloud (boas-vindas) — corpo: {{1}} membro, {{2}} nome do sistema (AxéCloud)
 */
export function buildBoasVindasComponents(
  nomeMembro: string,
  variables?: Record<string, string | number>
): MetaTemplateComponent[] {
  return [
    {
      type: "body",
      parameters: [
        textParam(nomeMembro || "Membro"),
        textParam(resolveSistemaName(variables)),
      ],
    },
  ];
}

/**
 * aviso_geral_axecloud (fallback) — corpo: {{1}} membro, {{2}} terreiro ou sistema
 */
export function buildMetaTemplateComponents(
  nomeMembro: string,
  nomeTerreiro: string
): MetaTemplateComponent[] {
  return [
    {
      type: "body",
      parameters: [textParam(nomeMembro || "Membro"), textParam(nomeTerreiro || "Terreiro")],
    },
  ];
}

/** Monta components Evolution v2 conforme o template Meta do tipo. */
export function buildMetaTemplateComponentsForTipo(
  tipo: string,
  nomeMembro: string,
  nomeTerreiro: string,
  variables?: Record<string, string | number>
): MetaTemplateComponent[] {
  if (isConviteEventoTemplate(tipo)) {
    return buildConviteEventoComponents(variables);
  }
  if (isAvisoGiraTemplate(tipo)) {
    return buildAvisoGiraComponents(variables);
  }
  if (isBoasVindasTemplate(tipo)) {
    return buildBoasVindasComponents(nomeMembro, variables);
  }
  return buildMetaTemplateComponents(nomeMembro, nomeTerreiro);
}

/** Texto legível para whatsapp_logs (não é enviado à Meta). */
export function buildWhatsAppAuditMessage(
  tipo: string,
  variables: Record<string, string | number> | undefined,
  nomeMembro: string,
  nomeTerreiro: string
): string {
  const v = variables || {};
  const normalized = String(tipo || "").toLowerCase();

  if (normalized === "convite_evento") {
    const convidado = String(v.nome_convidado || nomeMembro);
    const evento = String(v.nome_evento || "Evento");
    const data = String(v.data_evento || "");
    const hora = String(v.hora_evento || "");
    const terreiro = String(v.nome_terreiro || nomeTerreiro);
    const local = String(v.local_evento || v.descricao_evento || v.descricao || "");
    const token = extractRsvpToken(v);
    const rsvp = token ? ` · RSVP ${token}` : "";
    const localPart = local ? ` · ${local}` : "";
    return `Convite: ${convidado} — ${evento} (${data} ${hora}) · ${terreiro}${localPart}${rsvp}`;
  }

  if (normalized === "aviso_gira") {
    const titulo = String(v.nome_evento || v.titulo_evento || "Gira");
    const banner = String(v.banner_url || "");
    const bannerPart = banner ? ` · banner` : "";
    return `Gira (corrente): ${titulo} — ${v.data_evento || ""} ${v.hora_evento || ""}${bannerPart}`.trim();
  }

  if (normalized === "boas_vindas") {
    const nome = String(v.nome_filho || nomeMembro);
    const loginId = String(v.filho_login_id || "");
    const loginUrl = String(v.login_url || resolveLoginPublicUrl());
    const idPart = loginId ? ` · ID: ${loginId}` : "";
    return `Boas-vindas: ${nome} · ${loginUrl}${idPart} · CPF: 6 primeiros dígitos`;
  }

  return `[${tipo}] ${nomeMembro} · ${nomeTerreiro}`;
}
