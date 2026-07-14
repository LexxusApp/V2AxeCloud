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
    'Registro: {{filho_login_id}}\nSenha: {{senha_acesso}}',
  cobranca_mensalidade:
    'Olá, {{nome_filho}}! Passando para lembrar da sua mensalidade de {{mes_ano}} no valor de R$ {{valor}} no {{nome_terreiro}}. Sua contribuição é fundamental para o nosso fundamento. Axé!',
  financeiro:
    'Olá, {{nome_filho}}! Lembramos do pagamento de sua mensalidade no valor de R$ {{valor_mensalidade}}, com vencimento em {{data_vencimento}}, para o terreiro {{nome_terreiro}}. Axé!',
  mensalidade_confirmada:
    'Olá, {{nome_filho}}! Confirmamos o recebimento da sua mensalidade de {{competencia}} no valor de R$ {{valor}} no {{nome_terreiro}}. Obrigado pela contribuição. Axé! 🙏',
  transmissao_aviso:
    'Paz e Luz, {{nome_filho}}!\n\n*{{titulo_aviso}}*\n\n{{conteudo_aviso}}\n\nAcesse o AxéCloud para ver o aviso completo. Axé!',
  mural_aviso:
    'Paz e Luz, {{nome_filho}}!\n\n*{{titulo_aviso}}*\n\n{{conteudo_aviso}}\n\nAcesse o AxéCloud para ver o aviso completo. Axé!',
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
