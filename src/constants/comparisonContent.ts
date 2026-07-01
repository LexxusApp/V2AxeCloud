import { TRIAL_DAYS } from '../../lib/planPricing';
import { BRAND_NAME } from './seoBrandKeywords';
import { LANDING_MODULES } from './landingModules';

export type ComparisonCell = 'yes' | 'no' | 'partial' | 'rare';

export type ComparisonRow = {
  id: string;
  feature: string;
  planilha: ComparisonCell;
  axecloud: ComparisonCell;
  outros: ComparisonCell;
  note?: string;
};

export const COMPARISON_INTRO = {
  title: `Por que ${BRAND_NAME}?`,
  h1: `Gestão de terreiros: por que escolher o ${BRAND_NAME}`,
  description:
    `Compare o ${BRAND_NAME} com planilhas, WhatsApp e outros softwares de terreiro. Módulos reais, app PWA instalável, portal público e WhatsApp oficial Meta — tudo incluso.`,
  lead:
    'Zeladores merecem clareza antes de trocar o caderno por um sistema. Esta página mostra o que o AxéCloud já entrega hoje — sem prometer o que ainda não existe.',
} as const;

export const COMPARISON_VS_STATUS_QUO = [
  {
    heading: 'Planilha + WhatsApp + caderno',
    body:
      'Funciona no começo, mas mensalidades se perdem, fotos ficam espalhadas, avisos somem no grupo e ninguém sabe quem confirmou presença na gira. A casa cresce; o caos também.',
  },
  {
    heading: BRAND_NAME,
    body:
      'Um painel para a diretoria e um portal para filhos de santo. Financeiro com Pix, calendário, galeria, mural, biblioteca, loja, WhatsApp Meta e portal público — com sigilo por perfil e ambiente isolado por terreiro.',
  },
  {
    heading: 'Outros softwares de terreiro',
    body:
      'Há boas opções no mercado brasileiro. Muitas focam só na gestão interna; poucas combinam portal público, pedidos de reza, hub de conteúdo SEO e WhatsApp via API oficial Meta no mesmo produto.',
  },
] as const;

/** Comparativo explícito — linguagem factual, sem citar marcas concorrentes. */
export const COMPARISON_ROWS: readonly ComparisonRow[] = [
  {
    id: 'pix',
    feature: 'Mensalidade com Pix integrado',
    planilha: 'no',
    axecloud: 'yes',
    outros: 'partial',
    note: 'Alguns sistemas exigem link externo ou cobrança manual.',
  },
  {
    id: 'portal-filho',
    feature: 'Portal dedicado do filho de santo',
    planilha: 'no',
    axecloud: 'yes',
    outros: 'yes',
  },
  {
    id: 'galeria',
    feature: 'Galeria de fotos da casa',
    planilha: 'no',
    axecloud: 'yes',
    outros: 'rare',
  },
  {
    id: 'whatsapp-meta',
    feature: 'WhatsApp via API oficial Meta (templates)',
    planilha: 'no',
    axecloud: 'yes',
    outros: 'partial',
    note: 'Muitos usam grupos manuais ou automações não oficiais.',
  },
  {
    id: 'portal-publico',
    feature: 'Portal público + diretório de terreiros',
    planilha: 'no',
    axecloud: 'yes',
    outros: 'rare',
  },
  {
    id: 'pedidos-reza',
    feature: 'Pedidos de reza públicos (Espaço do Fiel)',
    planilha: 'no',
    axecloud: 'yes',
    outros: 'no',
  },
  {
    id: 'loja',
    feature: 'Loja do axé com estoque integrado',
    planilha: 'no',
    axecloud: 'yes',
    outros: 'partial',
  },
  {
    id: 'pwa',
    feature: 'App instalável (PWA) sem loja de apps',
    planilha: 'no',
    axecloud: 'yes',
    outros: 'partial',
  },
  {
    id: 'liturgico',
    feature: 'Termos litúrgicos reais (ogã, camarinha, guia…)',
    planilha: 'no',
    axecloud: 'yes',
    outros: 'partial',
  },
  {
    id: 'push',
    feature: 'Notificações push no celular',
    planilha: 'no',
    axecloud: 'yes',
    outros: 'partial',
  },
  {
    id: 'rsvp',
    feature: 'Convite de gira com confirmar/declinar presença',
    planilha: 'no',
    axecloud: 'yes',
    outros: 'partial',
  },
  {
    id: 'preco-modulo',
    feature: 'Tudo incluso — sem cobrar por módulo ou por filho',
    planilha: 'yes',
    axecloud: 'yes',
    outros: 'partial',
    note: 'Verifique se o concorrente cobra por médium ou módulo extra.',
  },
  {
    id: 'trial',
    feature: `Teste grátis de ${TRIAL_DAYS} dias sem cartão`,
    planilha: 'yes',
    axecloud: 'yes',
    outros: 'partial',
  },
] as const;

export const COMPARISON_PWA = {
  title: 'App instalável (PWA) — como funciona',
  lead:
    'O AxéCloud é um Progressive Web App: você acessa pelo navegador e pode fixar na tela inicial como um ícone — no Android, iPhone ou computador — sem passar pela App Store ou Google Play.',
  steps: [
    {
      title: 'Abra axecloud.com.br',
      body: 'Use Chrome, Safari ou Edge no celular ou no PC.',
    },
    {
      title: 'Entre com sua conta',
      body: 'Zelador: e-mail do terreiro. Filho de santo: ID e CPF da casa.',
    },
    {
      title: 'Adicionar à tela inicial',
      body: 'No menu do navegador, escolha “Adicionar à tela inicial” ou “Instalar app”. Pronto — ícone na home.',
    },
  ],
  benefits: [
    'Atualizações automáticas — sempre a versão mais recente',
    'Funciona em Android, iPhone e computador',
    'Sem ocupar espaço como app nativo pesado',
    'Mesma experiência do painel e do portal',
  ],
} as const;

export const COMPARISON_MODULE_LIST = LANDING_MODULES.map((m) => m.title);
