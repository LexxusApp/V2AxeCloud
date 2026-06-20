import {
  PLAN_PRICE_FOUNDER_LABEL,
  PLAN_PRICE_STANDARD_LABEL,
} from '../../lib/planPricing';

/** Programa Fundador — configuração central (portal + landing). */
export const FOUNDER_PROGRAM = {
  maxSlots: 20,
  freeMonths: 12,
  founderPriceLabel: PLAN_PRICE_FOUNDER_LABEL,
  standardPriceLabel: PLAN_PRICE_STANDARD_LABEL,
  futurePriceLabel: `${PLAN_PRICE_FOUNDER_LABEL} (fundador) · ${PLAN_PRICE_STANDARD_LABEL} (demais casas)`,
  pilotCity: 'Grande São Paulo',
  pilotRegionNote:
    'Começamos pelo eixo Grande São Paulo e região metropolitana. Casas de outras cidades também podem se inscrever — entraremos em contato conforme abrirmos novas vagas.',
  waComercial: 'https://wa.me/5511912276156',
  waComercialLabel: 'Falar no WhatsApp',
} as const;

export const FOUNDER_BENEFITS = [
  'Uso gratuito do Ilê Asé por 12 meses (todas as funcionalidades do plano Premium)',
  'Onboarding personalizado — configuramos a casa junto com você',
  'Prioridade no perfil público quando o diretório do portal estiver no ar',
  'Selo de Casa Fundadora Ilê Asé no perfil da casa',
  'Canal direto com a equipe para sugerir melhorias ao sistema',
] as const;

export const FOUNDER_REQUIREMENTS = [
  'Terreiro ou casa de axé em atividade (Umbanda, Candomblé, Jurema ou vertente afim)',
  'Zelador(a) ou responsável pela administração disponível para conversa inicial',
  'E-mail do zelador para criação do acesso ao painel (login do terreiro)',
  'Autorização para futuro perfil público no portal (nome, cidade e tradição — sem expor endereço sem consentimento)',
  'Disposição para dar feedback honesto nos primeiros 90 dias',
] as const;

export const TRADICAO_OPTIONS = [
  { value: 'umbanda', label: 'Umbanda' },
  { value: 'candomble', label: 'Candomblé' },
  { value: 'jurema', label: 'Jurema' },
  { value: 'mista', label: 'Tradição mista / outra vertente afro-brasileira' },
  { value: 'outra', label: 'Outra (descreva na mensagem)' },
] as const;

export const BRAZIL_UF = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const;

export type TradicaoValue = (typeof TRADICAO_OPTIONS)[number]['value'];
