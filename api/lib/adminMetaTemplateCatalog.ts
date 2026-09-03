/** Templates Meta aprovados para disparo manual a zeladores (console admin). */

export type AdminMetaTemplateVarSource =
  | "zelador"
  | "terreiro"
  | "email"
  | "expires_date_br"
  | "manual";

export type AdminMetaTemplateVariable = {
  key: string;
  label: string;
  source: AdminMetaTemplateVarSource;
  placeholder: string;
  maxLength: number;
  hint?: string;
};

export type AdminMetaTemplateDefinition = {
  id: string;
  templateName: string;
  label: string;
  description: string;
  category: string;
  body: string;
  footer?: string;
  button?: { text: string; url: string };
  variables: AdminMetaTemplateVariable[];
  logTipo: string;
};

export const ADMIN_META_ZELADOR_TEMPLATES: AdminMetaTemplateDefinition[] = [
  {
    id: "teste_encerrando_zelador",
    templateName: "teste_encerrando_zelador_axecloud",
    label: "Teste gratuito encerrando",
    description: "Avisa o zelador que o período de teste está acabando.",
    category: "MARKETING",
    body:
      "Ola, {{1}}. O periodo de teste gratuito do painel do {{2}} encerra {{4}}, no dia {{3}}. Seus dados cadastrados serao preservados. Acesse o AxéCloud em Assinatura para escolher como continuar.",
    footer: "Mensagem automática. Não responda.",
    button: { text: "Abrir painel", url: "https://axecloud.com.br/entrar" },
    logTipo: "admin_teste_encerrando",
    variables: [
      { key: "1", label: "Nome do zelador", source: "zelador", placeholder: "Alex", maxLength: 60 },
      { key: "2", label: "Nome do terreiro", source: "terreiro", placeholder: "YLÊ EXU TIRIRI LONAN", maxLength: 80 },
      {
        key: "3",
        label: "Data de término",
        source: "expires_date_br",
        placeholder: "01/09/2026",
        maxLength: 20,
        hint: "Formato dd/mm/aaaa (fuso Brasília)",
      },
      {
        key: "4",
        label: "Prazo relativo",
        source: "manual",
        placeholder: "Amanhã",
        maxLength: 40,
        hint: "Ex.: Amanhã, em 3 dias, hoje",
      },
    ],
  },
  {
    id: "atualizacao_modulo_zelador",
    templateName: "atualizacao_modulo_zelador_axecloud",
    label: "Nova função no painel",
    description: "Comunica um módulo ou funcionalidade nova disponível para o zelador.",
    category: "MARKETING",
    body:
      "Ola, {{1}}. Uma nova funcao foi disponibilizada no painel do {{2}}: {{3}}. {{4}} Acesse o AxéCloud para conhecer e utilizar.",
    footer: "Mensagem automática. Não responda.",
    button: { text: "Abrir painel", url: "https://axecloud.com.br/entrar" },
    logTipo: "admin_novo_modulo",
    variables: [
      { key: "1", label: "Nome do zelador", source: "zelador", placeholder: "Alex", maxLength: 60 },
      { key: "2", label: "Nome do terreiro", source: "terreiro", placeholder: "Terreiro de Oxum", maxLength: 80 },
      {
        key: "3",
        label: "Nome do módulo",
        source: "manual",
        placeholder: "Loja do Axé",
        maxLength: 60,
      },
      {
        key: "4",
        label: "Breve explicação",
        source: "manual",
        placeholder: "Venda de artigos com controle de estoque.",
        maxLength: 150,
      },
    ],
  },
  {
    id: "boas_vindas_zelador",
    templateName: "boas_vindas_zelador_v2_axecloud",
    label: "Boas-vindas zelador",
    description: "Boas-vindas humanizadas no cadastro (teste + orientação de registro dos membros).",
    category: "UTILITY",
    body:
      "Ola, {{1}}!\n\nSeja bem-vindo(a) ao AxéCloud.\nDurante o periodo de teste, vamos acompanhar voce de perto para que tenha a melhor experiencia possivel no sistema. Em breve, o responsavel pelo acompanhamento do teste entrara em contato com voce.\n\nOriente seus membros: cada membro registrado recebe uma mensagem automatica no WhatsApp com o numero de Registro. Peca que guardem, pois esse e o acesso deles ao sistema.\n\nPara mais instrucoes, use o botao abaixo.",
    footer: "Mensagem automática. Não responda.",
    button: { text: "Ver instrucoes", url: "https://axecloud.com.br/instrucoes" },
    logTipo: "boas_vindas_zelador",
    variables: [
      { key: "1", label: "Nome do zelador", source: "zelador", placeholder: "Alex", maxLength: 60 },
    ],
  },
];

export function getAdminMetaTemplateById(id: string): AdminMetaTemplateDefinition | undefined {
  return ADMIN_META_ZELADOR_TEMPLATES.find((t) => t.id === id);
}

export function renderAdminMetaTemplatePreview(
  tpl: AdminMetaTemplateDefinition,
  values: Record<string, string>
): { body: string; footer?: string; button?: { text: string; url: string } } {
  let body = tpl.body;
  for (const v of tpl.variables) {
    const val = String(values[v.key] || v.placeholder).trim();
    body = body.split(`{{${v.key}}}`).join(val);
  }
  return { body, footer: tpl.footer, button: tpl.button };
}

export function buildAdminMetaTemplateComponents(
  tpl: AdminMetaTemplateDefinition,
  values: Record<string, string>
): Array<{ type: string; parameters: Array<{ type: string; text: string }> }> {
  const ordered = [...tpl.variables].sort((a, b) => Number(a.key) - Number(b.key));
  return [
    {
      type: "body",
      parameters: ordered.map((v) => ({
        type: "text",
        text: String(values[v.key] || "").trim().slice(0, v.maxLength),
      })),
    },
  ];
}

export function validateAdminMetaTemplateValues(
  tpl: AdminMetaTemplateDefinition,
  values: Record<string, string>
): string | null {
  for (const v of tpl.variables) {
    const raw = String(values[v.key] ?? "").trim();
    if (!raw) return `Preencha «${v.label}».`;
    if (raw.length > v.maxLength) {
      return `«${v.label}» excede ${v.maxLength} caracteres (Meta).`;
    }
  }
  return null;
}
