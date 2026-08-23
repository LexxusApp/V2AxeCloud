/** Rodapé visível no WhatsApp (também vai no FOOTER dos modelos Meta). */
export const WHATSAPP_AUTO_FOOTER = 'Mensagem automática. Não responda.';

function withAutoFooter(body: string): string {
  if (body.includes(WHATSAPP_AUTO_FOOTER)) return body;
  return `${body.trimEnd()}\n\n_${WHATSAPP_AUTO_FOOTER}_`;
}

export type WhatsAppTemplateType =
  | 'dados_acesso'
  | 'cobranca_mensalidade'
  | 'mensalidade_disponivel'
  | 'financeiro'
  | 'mensalidade_pendente'
  | 'mensalidade_vence_hoje'
  | 'mensalidade_confirmada'
  | 'transmissao_aviso'
  | 'mural_aviso'
  | 'convite_evento'
  | 'senha_evento_visitante'
  | 'estoque_critico'
  | 'pedido_reza_novo_zelador'
  | 'pedido_reza_aceito_fiel';

export const WHATSAPP_TEMPLATE_DEFAULTS: Record<WhatsAppTemplateType, string> = {
  dados_acesso: withAutoFooter(
    'Olá, {{nome_filho}}! Sua conta no AxéCloud de {{nome_terreiro}} está ativa.\n\n' +
      '🔐 *Acesso:*\nRegistro: {{filho_login_id}}\nSenha: {{senha_acesso}} (6 primeiros dígitos do CPF)\nEntrar: {{login_url}}\n\n' +
      'No app: giras, mensalidade, obrigações, recados e chat com a casa.\n' +
      'Guia: https://axecloud.com.br/instrucoes/membro',
  ),
  cobranca_mensalidade: withAutoFooter(
    'Olá, {{nome_filho}}! Lembrete privado da mensalidade de {{mes_ano}} (R$ {{valor}}) no {{nome_terreiro}}. Sua contribuição fortalece a casa — qualquer dúvida, fale com a diretoria. Axé!',
  ),
  mensalidade_disponivel: withAutoFooter(
    'Olá, {{nome_filho}}! A mensalidade de {{mes_ano}} no valor de R$ {{valor_mensalidade}} já está disponível para pagamento no {{nome_terreiro}}. Sua contribuição fortalece a casa. Axé!',
  ),
  financeiro: withAutoFooter(
    'Olá, {{nome_filho}}! Lembramos que sua mensalidade de {{mes_ano}} no valor de R$ {{valor_mensalidade}} ainda está pendente no {{nome_terreiro}}. Quando puder, regularize pelo portal da casa. Axé!',
  ),
  mensalidade_pendente: withAutoFooter(
    'Olá, {{nome_filho}}! Lembramos que sua mensalidade de {{mes_ano}} no valor de R$ {{valor_mensalidade}} ainda está pendente no {{nome_terreiro}}. Quando puder, regularize pelo portal da casa. Axé!',
  ),
  mensalidade_vence_hoje: withAutoFooter(
    'Olá, {{nome_filho}}! Sua mensalidade de {{mes_ano}} no valor de R$ {{valor_mensalidade}} vence hoje no {{nome_terreiro}}. Quando puder, regularize pelo portal da casa. Axé!',
  ),
  mensalidade_confirmada: withAutoFooter(
    'Olá, {{nome_filho}}! Recebemos sua mensalidade de {{competencia}} (R$ {{valor}}) no {{nome_terreiro}}. Gratidão pela contribuição. Axé!',
  ),
  transmissao_aviso: withAutoFooter(
    'Paz e Luz, {{nome_filho}}!\n\n*{{titulo_aviso}}*\n\n{{conteudo_aviso}}\n\nDetalhes no portal AxéCloud. Axé!',
  ),
  mural_aviso: withAutoFooter(
    'Paz e Luz, {{nome_filho}}!\n\n*{{titulo_aviso}}*\n\n{{conteudo_aviso}}\n\nDetalhes no portal AxéCloud. Axé!',
  ),
  convite_evento: withAutoFooter(
    'Convite: {{nome_convidado}} — {{nome_evento}} ({{data_evento}} {{hora_evento}}) · {{nome_terreiro}} · {{local_evento}}',
  ),
  senha_evento_visitante: withAutoFooter(
    'Olá, {{nome_visitante}}!\n\n' +
      'Sua senha para {{nome_evento}} no {{nome_terreiro}} é: {{numero_senha}}.\n' +
      '{{data_evento}} às {{hora_evento}}\n\n' +
      'No dia do evento, na portaria, abra este link — a câmera do celular abre para você apontar no QR Code do tablet e confirmar sua presença:\n' +
      '{{link_checkin}}\n\n' +
      'AxéCloud',
  ),
  estoque_critico: withAutoFooter(
    '⚠️ Alerta de estoque crítico — {{nome_terreiro}}\n\nOs seguintes itens estão abaixo do mínimo:\n{{lista_itens}}\n\nTotal: {{quantidade_itens}} item(s) precisam de reposição.',
  ),
  pedido_reza_novo_zelador: withAutoFooter(
    'Novo pedido de reza no {{nome_terreiro}}: {{nome_fiel}} — {{categoria}}. Acesse Atendimentos no AxéCloud para aceitar o pedido.',
  ),
  pedido_reza_aceito_fiel: withAutoFooter(
    'Saravá, {{nome_fiel}}! O zelador de {{nome_terreiro}} aceitou seu pedido. Sua reza será realizada na próxima gira. Axé!',
  ),
};

export const WHATSAPP_TEMPLATE_ORDER: WhatsAppTemplateType[] = [
  'dados_acesso',
  'cobranca_mensalidade',
  'mensalidade_disponivel',
  'financeiro',
  'mensalidade_pendente',
  'mensalidade_vence_hoje',
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
  if (normalized === 'mensalidade_pendente') return merged.mensalidade_pendente || merged.financeiro;
  if (normalized === 'financeiro') return merged.financeiro || merged.mensalidade_pendente;
  if (tipo in merged) return merged[tipo as WhatsAppTemplateType];
  return 'Mensagem do AxéCloud';
}
