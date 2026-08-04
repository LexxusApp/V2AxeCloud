export type WhatsAppTemplateType =
  | 'dados_acesso'
  | 'cobranca_mensalidade'
  | 'financeiro'
  | 'mensalidade_confirmada'
  | 'transmissao_aviso'
  | 'mural_aviso'
  | 'convite_evento'
  | 'senha_evento_visitante'
  | 'estoque_critico'
  | 'pedido_reza_novo_zelador'
  | 'pedido_reza_aceito_fiel';

export const WHATSAPP_TEMPLATE_DEFAULTS: Record<WhatsAppTemplateType, string> = {
  dados_acesso:
    'Olá, {{nome_filho}}! Sua conta no AxéCloud de {{nome_terreiro}} está ativa.\n\n' +
    '🔐 *Acesso:*\nRegistro: {{filho_login_id}}\nSenha: {{senha_acesso}} (6 primeiros dígitos do CPF)\nEntrar: {{login_url}}\n\n' +
    'No app: giras, mensalidade, obrigações, recados e chat com a casa.\n' +
    'Guia: https://axecloud.com.br/instrucoes/membro',
  cobranca_mensalidade:
    'Olá, {{nome_filho}}! Lembrete privado da mensalidade de {{mes_ano}} (R$ {{valor}}) no {{nome_terreiro}}. Sua contribuição fortalece a casa — qualquer dúvida, fale com a diretoria. Axé!',
  financeiro:
    'Olá, {{nome_filho}}! Lembrete da mensalidade de R$ {{valor_mensalidade}} (venc. {{data_vencimento}}) no {{nome_terreiro}}. Contribuição com respeito e privacidade. Axé!',
  mensalidade_confirmada:
    'Olá, {{nome_filho}}! Recebemos sua mensalidade de {{competencia}} (R$ {{valor}}) no {{nome_terreiro}}. Gratidão pela contribuição. Axé!',
  transmissao_aviso:
    'Paz e Luz, {{nome_filho}}!\n\n*{{titulo_aviso}}*\n\n{{conteudo_aviso}}\n\nDetalhes no portal AxéCloud. Axé!',
  mural_aviso:
    'Paz e Luz, {{nome_filho}}!\n\n*{{titulo_aviso}}*\n\n{{conteudo_aviso}}\n\nDetalhes no portal AxéCloud. Axé!',
  convite_evento:
    'Convite: {{nome_convidado}} — {{nome_evento}} ({{data_evento}} {{hora_evento}}) · {{nome_terreiro}} · {{local_evento}}',
  senha_evento_visitante:
    'Olá, {{nome_visitante}}!\n\n' +
    'Sua senha para {{nome_evento}} no {{nome_terreiro}} é: {{numero_senha}}.\n' +
    '{{data_evento}} às {{hora_evento}}\n\n' +
    'No dia do evento, na portaria, abra este link — a câmera do celular abre para você apontar no QR Code do tablet e confirmar sua presença:\n' +
    '{{link_checkin}}\n\n' +
    'AxéCloud',
  estoque_critico:
    '⚠️ *ALERTA DE ESTOQUE* ⚠️\nOlá! O item *{{item_nome}}* atingiu o nível crítico no {{nome_terreiro}}.\nQuantidade atual: {{quantidade}}\nPor favor, providencie a reposição conforme necessário.',
  pedido_reza_novo_zelador:
    'Novo pedido de reza no {{nome_terreiro}}: {{nome_fiel}} — {{categoria}}. Acesse Atendimentos no AxéCloud para aceitar o pedido.',
  pedido_reza_aceito_fiel:
    'Saravá, {{nome_fiel}}! O zelador de {{nome_terreiro}} aceitou seu pedido. Sua reza será realizada na próxima gira. Axé!',
};

export const WHATSAPP_TEMPLATE_ORDER: WhatsAppTemplateType[] = [
  'dados_acesso',
  'cobranca_mensalidade',
  'financeiro',
  'mensalidade_confirmada',
  'transmissao_aviso',
  'mural_aviso',
  'convite_evento',
  'senha_evento_visitante',
  'estoque_critico',
  'pedido_reza_novo_zelador',
  'pedido_reza_aceito_fiel',
];

export function normalizeWhatsAppTemplates(input: unknown): Record<WhatsAppTemplateType, string> {
  const source = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  const out = {} as Record<WhatsAppTemplateType, string>;
  for (const key of WHATSAPP_TEMPLATE_ORDER) {
    const candidate = source[key];
    out[key] = typeof candidate === 'string' && candidate.trim() ? candidate : WHATSAPP_TEMPLATE_DEFAULTS[key];
  }
  return out;
}

export function resolveWhatsAppTemplate(templates: unknown, tipo: string): string {
  const normalized = String(tipo || '').trim().toLowerCase();
  if (normalized === 'dados_acesso') {
    return WHATSAPP_TEMPLATE_DEFAULTS.dados_acesso;
  }
  const merged = normalizeWhatsAppTemplates(templates);
  if (normalized === 'transmissao_aviso' || normalized === 'mural_aviso') {
    return merged.transmissao_aviso;
  }
  if (tipo in merged) return merged[tipo as WhatsAppTemplateType];
  return 'Mensagem do AxéCloud';
}
