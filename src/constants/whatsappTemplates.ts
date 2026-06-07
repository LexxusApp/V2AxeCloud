export type WhatsAppTemplateType =
  | 'boas_vindas'
  | 'cobranca_mensalidade'
  | 'financeiro'
  | 'mensalidade_confirmada'
  | 'mural_aviso'
  | 'convite_evento'
  | 'estoque_critico';

export const WHATSAPP_TEMPLATE_DEFAULTS: Record<WhatsAppTemplateType, string> = {
  boas_vindas:
    'Seja muito bem-vindo(a), porta de entrada do Axé, {{nome_filho}}! 🙏\n\nÉ uma alegria imensa ter você fazendo parte da família {{nome_terreiro}}. Que sua caminhada seja de muita luz, aprendizado e evolução sob a proteção dos nossos Orixás e Guias.\n\nEste é o nosso canal oficial de comunicação. Por aqui você receberá avisos, calendários e informações importantes do terreiro.\n\nAxé! ✨',
  cobranca_mensalidade:
    'Olá, {{nome_filho}}! Passando para lembrar da sua mensalidade de {{mes_ano}} no valor de R$ {{valor}} no {{nome_terreiro}}. Sua contribuição é fundamental para o nosso fundamento. Axé!',
  financeiro:
    'Olá, {{nome_filho}}! Lembramos do pagamento de sua mensalidade no valor de R$ {{valor_mensalidade}}, com vencimento em {{data_vencimento}}, para o terreiro {{nome_terreiro}}. Axé!',
  mensalidade_confirmada:
    'Olá, {{nome_filho}}! Confirmamos o recebimento da sua mensalidade de {{competencia}} no valor de R$ {{valor}} no {{nome_terreiro}}. Obrigado pela contribuição. Axé! 🙏',
  mural_aviso:
    'Paz e Luz, {{nome_filho}}! Há um novo aviso no Mural do terreiro {{nome_terreiro}}:\n\n*{{titulo_aviso}}*\n\nAcesse o sistema para ver os detalhes. Axé!',
  convite_evento:
    'Paz e Luz, {{nome_convidado}}!\nO terreiro {{nome_terreiro}} tem a honra de te convidar para o nosso próximo encontro:\n\n*{{nome_evento}}*\n📅 Data: {{data_evento}}\n⏰ Horário: {{hora_evento}}\n\n⏳ *Por favor, responda com SIM para confirmar sua presença, ou NÃO caso não possa comparecer.*\n\nAguardamos sua presença! Axé!',
  estoque_critico:
    '⚠️ *ALERTA DE ESTOQUE* ⚠️\nOlá! O item *{{item_nome}}* atingiu o nível crítico no {{nome_terreiro}}.\nQuantidade atual: {{quantidade}}\nPor favor, providencie a reposição conforme necessário.',
};

export const WHATSAPP_TEMPLATE_ORDER: WhatsAppTemplateType[] = [
  'boas_vindas',
  'cobranca_mensalidade',
  'financeiro',
  'mensalidade_confirmada',
  'mural_aviso',
  'convite_evento',
  'estoque_critico',
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
  const merged = normalizeWhatsAppTemplates(templates);
  if (tipo in merged) return merged[tipo as WhatsAppTemplateType];
  return 'Mensagem do AxéCloud';
}
