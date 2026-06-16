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
/** Mural de avisos: novo comunicado publicado pelo zelador */
const MURAL_AVISO_TEMPLATE = "mural_aviso_axecloud";
/** Lembrete automático/manual de mensalidade (cron + financeiro) */
const FINANCEIRO_TEMPLATE = "financeiro_axecloud";
/** Cobrança manual no painel financeiro */
const COBRANCA_MENSALIDADE_TEMPLATE = "cobranca_mensalidade_axecloud";
/** Confirmação após pagamento registrado */
const MENSALIDADE_CONFIRMADA_TEMPLATE = "mensalidade_confirmada_axecloud";
/** Alerta de estoque crítico para o zelador */
const ESTOQUE_CRITICO_TEMPLATE = "estoque_critico_axecloud";
/** Transmissão / teste — corpo inclui texto do comunicado */
const COMUNICADO_TERREIRO_TEMPLATE = "comunicado_terreiro_axecloud";
/** Opcional: mensagem quase livre — corpo só {{1}} (texto + assinatura montados no código) */
const MENSAGEM_LIVRE_TERREIRO_TEMPLATE = "mensagem_livre_terreiro_axecloud";
const DEFAULT_EVENT_BANNER_URL = "https://axecloud.com.br/og-image.png";

function normalizeTipo(tipo: string): string {
  return String(tipo || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_");
}

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
  if (normalized === "mural_aviso") {
    return String(process.env.WA_META_TEMPLATE_MURAL_AVISO || "").trim() || MURAL_AVISO_TEMPLATE;
  }
  if (normalized === "boas_vindas") {
    return (
      String(process.env.WA_META_TEMPLATE_BOAS_VINDAS || "").trim() || DEFAULT_TEMPLATE
    );
  }
  if (normalized === "financeiro") {
    return String(process.env.WA_META_TEMPLATE_FINANCEIRO || "").trim() || FINANCEIRO_TEMPLATE;
  }
  if (normalized === "cobranca_mensalidade") {
    return (
      String(process.env.WA_META_TEMPLATE_COBRANCA_MENSALIDADE || "").trim() ||
      COBRANCA_MENSALIDADE_TEMPLATE
    );
  }
  if (normalized === "mensalidade_confirmada") {
    return (
      String(process.env.WA_META_TEMPLATE_MENSALIDADE_CONFIRMADA || "").trim() ||
      MENSALIDADE_CONFIRMADA_TEMPLATE
    );
  }
  if (normalized === "estoque_critico") {
    return (
      String(process.env.WA_META_TEMPLATE_ESTOQUE_CRITICO || "").trim() || ESTOQUE_CRITICO_TEMPLATE
    );
  }
  if (normalized === "broadcast" || normalized === "teste") {
    const livre = String(process.env.WA_META_TEMPLATE_MENSAGEM_LIVRE || "").trim();
    if (livre) return livre;
    return (
      String(process.env.WA_META_TEMPLATE_BROADCAST || process.env.WA_META_TEMPLATE_TESTE || "")
        .trim() || COMUNICADO_TERREIRO_TEMPLATE
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

export function isMuralAvisoTemplate(tipo: string): boolean {
  return resolveMetaTemplateName(tipo) === MURAL_AVISO_TEMPLATE;
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
  const text = sanitizeTemplateParam(String(value || "")).slice(0, max);
  return { type: "text", text: text || "-" };
}

/** Meta rejeita quebras de linha e espaços extras nas variáveis de template. */
export function sanitizeTemplateParam(value: string): string {
  return String(value || "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
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
 * mural_aviso_axecloud — corpo: {{1}} filho, {{2}} terreiro, {{3}} título do aviso
 * Botão URL estático (opcional no painel Meta): "Abrir AxéCloud" → https://axecloud.com.br/login
 */
export function buildMuralAvisoComponents(
  nomeMembro: string,
  nomeTerreiro: string,
  variables?: Record<string, string | number>
): MetaTemplateComponent[] {
  const titulo = String(variables?.titulo_aviso || variables?.titulo || "Novo aviso").trim() || "Novo aviso";
  return [
    {
      type: "body",
      parameters: [
        textParam(nomeMembro || "Membro"),
        textParam(nomeTerreiro || "Terreiro"),
        textParam(titulo, 120),
      ],
    },
  ];
}

/**
 * financeiro_axecloud — corpo: {{1}} filho, {{2}} valor, {{3}} vencimento, {{4}} terreiro
 */
export function buildFinanceiroComponents(
  nomeMembro: string,
  nomeTerreiro: string,
  variables?: Record<string, string | number>
): MetaTemplateComponent[] {
  const v = variables || {};
  return [
    {
      type: "body",
      parameters: [
        textParam(String(v.nome_filho || nomeMembro || "Membro")),
        textParam(String(v.valor_mensalidade || v.valor || "—")),
        textParam(String(v.data_vencimento || "—")),
        textParam(String(v.nome_terreiro || nomeTerreiro || "Terreiro")),
      ],
    },
  ];
}

/**
 * cobranca_mensalidade_axecloud — corpo: {{1}} filho, {{2}} mês/ano, {{3}} valor, {{4}} terreiro
 */
export function buildCobrancaMensalidadeComponents(
  nomeMembro: string,
  nomeTerreiro: string,
  variables?: Record<string, string | number>
): MetaTemplateComponent[] {
  const v = variables || {};
  return [
    {
      type: "body",
      parameters: [
        textParam(String(v.nome_filho || nomeMembro || "Membro")),
        textParam(String(v.mes_ano || "—")),
        textParam(String(v.valor || "—")),
        textParam(String(v.nome_terreiro || nomeTerreiro || "Terreiro")),
      ],
    },
  ];
}

/**
 * mensalidade_confirmada_axecloud — corpo: {{1}} filho, {{2}} competência, {{3}} valor, {{4}} terreiro
 */
export function buildMensalidadeConfirmadaComponents(
  nomeMembro: string,
  nomeTerreiro: string,
  variables?: Record<string, string | number>
): MetaTemplateComponent[] {
  const v = variables || {};
  return [
    {
      type: "body",
      parameters: [
        textParam(String(v.nome_filho || nomeMembro || "Membro")),
        textParam(String(v.competencia || "—")),
        textParam(String(v.valor || "—")),
        textParam(String(v.nome_terreiro || nomeTerreiro || "Terreiro")),
      ],
    },
  ];
}

/**
 * estoque_critico_axecloud — corpo: {{1}} item, {{2}} quantidade, {{3}} terreiro
 */
export function buildEstoqueCriticoComponents(
  nomeTerreiro: string,
  variables?: Record<string, string | number>
): MetaTemplateComponent[] {
  const v = variables || {};
  return [
    {
      type: "body",
      parameters: [
        textParam(String(v.item_nome || v.item || "Item")),
        textParam(String(v.quantidade ?? "—")),
        textParam(String(v.nome_terreiro || nomeTerreiro || "Terreiro")),
      ],
    },
  ];
}

export function isMensagemLivreTemplate(tipo: string): boolean {
  const name = resolveMetaTemplateName(tipo);
  return name === MENSAGEM_LIVRE_TERREIRO_TEMPLATE;
}

/** Assinatura automática da casa (única parte fixa além do texto do zelador). */
export function buildTerreiroAssinatura(
  zelador: string | undefined,
  nomeTerreiro: string
): string {
  const casa = String(nomeTerreiro || "Terreiro").trim();
  const lider = String(zelador || "").trim();
  if (lider) return `— ${lider} · ${casa}`;
  return `— ${casa}`;
}

/** Texto que o filho recebe: saudação opcional + mensagem do zelador + assinatura. */
export function buildSignedWhatsAppBody(
  nomeMembro: string,
  nomeTerreiro: string,
  userText: string,
  zelador?: string,
  options?: { includeGreeting?: boolean }
): string {
  const msg = String(userText || "").trim().replace(/\s+/g, " ");
  const assinatura = buildTerreiroAssinatura(zelador, nomeTerreiro);
  const lines: string[] = [];
  if (options?.includeGreeting !== false) {
    lines.push(`Paz e Luz, ${String(nomeMembro || "Membro").trim()}!`, "");
  }
  if (msg) lines.push(msg);
  lines.push("", assinatura);
  return lines.join("\n").trim().slice(0, 1024);
}

/** Corpo em uma linha para variáveis de template Meta (comunicado / mensagem livre). */
export function buildSignedWhatsAppTemplateParam(
  nomeTerreiro: string,
  userText: string,
  zelador?: string
): string {
  const msg = sanitizeTemplateParam(userText);
  const assinatura = sanitizeTemplateParam(buildTerreiroAssinatura(zelador, nomeTerreiro));
  if (!msg) return assinatura.slice(0, 1024) || "Comunicado do terreiro.";
  return `${msg} ${assinatura}`.slice(0, 1024);
}

/**
 * mensagem_livre_terreiro_axecloud — corpo: {{1}} texto completo (mensagem + assinatura)
 */
export function buildMensagemLivreComponents(signedBody: string): MetaTemplateComponent[] {
  return [
    {
      type: "body",
      parameters: [textParam(signedBody, 1024)],
    },
  ];
}

/**
 * comunicado_terreiro_axecloud — corpo: {{1}} membro, {{2}} terreiro, {{3}} mensagem + assinatura
 */
export function buildComunicadoTerreiroComponents(
  nomeMembro: string,
  nomeTerreiro: string,
  variables?: Record<string, string | number>
): MetaTemplateComponent[] {
  const v = variables || {};
  const rawMsg = String(
    v.comunicado || v.mensagem || v.message || v.texto || ""
  ).trim();
  const zelador = String(v.zelador || v.nome_zelador || "").trim() || undefined;
  const comunicado =
    buildSignedWhatsAppTemplateParam(nomeTerreiro, rawMsg, zelador) ||
    "Comunicado do terreiro. Acesse o AxéCloud para mais detalhes.";
  return [
    {
      type: "body",
      parameters: [
        textParam(nomeMembro || "Membro"),
        textParam(nomeTerreiro || "Terreiro"),
        textParam(comunicado, 1024),
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
  const t = normalizeTipo(tipo);

  if (isConviteEventoTemplate(tipo)) {
    return buildConviteEventoComponents(variables);
  }
  if (isAvisoGiraTemplate(tipo)) {
    return buildAvisoGiraComponents(variables);
  }
  if (isBoasVindasTemplate(tipo)) {
    return buildBoasVindasComponents(nomeMembro, variables);
  }
  if (isMuralAvisoTemplate(tipo)) {
    return buildMuralAvisoComponents(nomeMembro, nomeTerreiro, variables);
  }
  if (t === "financeiro") {
    return buildFinanceiroComponents(nomeMembro, nomeTerreiro, variables);
  }
  if (t === "cobranca_mensalidade") {
    return buildCobrancaMensalidadeComponents(nomeMembro, nomeTerreiro, variables);
  }
  if (t === "mensalidade_confirmada") {
    return buildMensalidadeConfirmadaComponents(nomeMembro, nomeTerreiro, variables);
  }
  if (t === "estoque_critico") {
    return buildEstoqueCriticoComponents(nomeTerreiro, variables);
  }
  if (t === "broadcast" || t === "teste") {
    if (isMensagemLivreTemplate(tipo)) {
      const signed = buildSignedWhatsAppTemplateParam(
        nomeTerreiro,
        String(variables?.comunicado || variables?.mensagem || variables?.message || ""),
        String(variables?.zelador || variables?.nome_zelador || "") || undefined
      );
      return buildMensagemLivreComponents(signed);
    }
    return buildComunicadoTerreiroComponents(nomeMembro, nomeTerreiro, variables);
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

  if (normalized === "mural_aviso") {
    const titulo = String(v.titulo_aviso || v.titulo || "Novo aviso");
    return `Mural: ${nomeMembro} · ${nomeTerreiro} · "${titulo}"`;
  }

  if (normalized === "financeiro") {
    return `Financeiro: ${v.nome_filho || nomeMembro} · R$ ${v.valor_mensalidade || v.valor || "—"} · venc. ${v.data_vencimento || "—"} · ${v.nome_terreiro || nomeTerreiro}`;
  }

  if (normalized === "cobranca_mensalidade") {
    return `Cobrança: ${v.nome_filho || nomeMembro} · ${v.mes_ano || "—"} · R$ ${v.valor || "—"} · ${v.nome_terreiro || nomeTerreiro}`;
  }

  if (normalized === "mensalidade_confirmada") {
    return `Confirmada: ${v.nome_filho || nomeMembro} · ${v.competencia || "—"} · R$ ${v.valor || "—"} · ${v.nome_terreiro || nomeTerreiro}`;
  }

  if (normalized === "estoque_critico") {
    return `Estoque: ${v.item_nome || v.item || "—"} · qty ${v.quantidade ?? "—"} · ${v.nome_terreiro || nomeTerreiro}`;
  }

  if (normalized === "broadcast" || normalized === "teste") {
    const msg = String(v.comunicado || v.mensagem || v.message || "").trim();
    return `Comunicado: ${nomeMembro} · ${nomeTerreiro}${msg ? ` · "${msg.slice(0, 80)}${msg.length > 80 ? "…" : ""}"` : ""}`;
  }

  return `[${tipo}] ${nomeMembro} · ${nomeTerreiro}`;
}
