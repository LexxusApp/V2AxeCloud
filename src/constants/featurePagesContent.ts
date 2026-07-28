import { BRAND_NAME } from './seoBrandKeywords';
import { TRIAL_DAYS } from '../../lib/planPricing';

export type FeatureFaq = { q: string; a: string };

export type FeaturePageContent = {
  slug: string;
  title: string;
  h1: string;
  description: string;
  lead: string;
  sections: readonly { heading: string; body: string }[];
  faq: readonly FeatureFaq[];
};

export const FEATURE_HUB = {
  title: `Recursos de gestão de terreiros | ${BRAND_NAME}`,
  h1: `Recursos do ${BRAND_NAME} para a rotina da casa`,
  description:
    `Conheça os módulos do ${BRAND_NAME}: financeiro Pix, calendário de giras, portal do filho, WhatsApp oficial e app PWA. Teste ${TRIAL_DAYS} dias grátis.`,
  lead:
    'Cada recurso abaixo existe hoje no plano Premium — sem módulo escondido. Escolha o que responde à dor da sua casa e compare no detalhe.',
} as const;

export const FEATURE_PAGES: readonly FeaturePageContent[] = [
  {
    slug: 'financeiro-pix-mensalidades',
    title: `Financeiro Pix e mensalidades para terreiro | ${BRAND_NAME}`,
    h1: 'Financeiro com Pix e mensalidades para terreiro',
    description:
      `Cobrança de mensalidade com Pix, histórico e portal do filho — sem constranger no grupo. Veja o financeiro do ${BRAND_NAME} e teste ${TRIAL_DAYS} dias.`,
    lead:
      'Mensalidade é contribuição, não cobrança fria. O módulo financeiro registra Pix, pendências e histórico com respeito — fora do grupo público.',
    sections: [
      {
        heading: 'Pix integrado à mensalidade',
        body: `O filho de santo paga pelo portal; a diretoria vê o crédito no painel. Menos print perdido no WhatsApp. Detalhes em https://axecloud.com.br/conteudo/gestao-financeira-terreiro-pix-mensalidades.`,
      },
      {
        heading: 'Lembretes privados',
        body: `Com WhatsApp via API oficial Meta, o aviso de mensalidade chega de forma privada — template aprovado, nome da casa na mensagem. Veja https://axecloud.com.br/recursos/whatsapp-oficial.`,
      },
      {
        heading: 'Relatórios da casa',
        body: 'Entradas, despesas e saldo em um só lugar. A prestação de contas deixa de depender de planilhas com versões conflitantes.',
      },
      {
        heading: 'Compare e teste',
        body: `Veja o comparativo com planilha em https://axecloud.com.br/por-que-axecloud/vs-planilhas e teste o plano Premium em https://axecloud.com.br/register.`,
      },
    ],
    faq: [
      {
        q: 'Como cobrar mensalidade de terreiro sem constranger?',
        a: `Use cobrança privada (portal + Pix ou WhatsApp oficial), nunca no grupo público. O ${BRAND_NAME} centraliza pendências e comprovantes no painel.`,
      },
      {
        q: 'O Pix fica registrado no sistema?',
        a: 'Sim. O pagamento via portal gera histórico vinculado ao filho de santo, visível para a diretoria autorizada.',
      },
    ],
  },
  {
    slug: 'calendario-giras',
    title: `Calendário de giras e obrigações | ${BRAND_NAME}`,
    h1: 'Calendário de giras, festas e obrigações',
    description:
      `Organize giras, festas e obrigações com convite e confirmação de presença. Calendário litúrgico da casa no ${BRAND_NAME} — teste ${TRIAL_DAYS} dias.`,
    lead:
      'A agenda da casa não cabe só no grupo. O calendário mostra giras, festas e obrigações — com convite e presença para a diretoria acompanhar.',
    sections: [
      {
        heading: 'Giras e eventos no mesmo lugar',
        body: 'A diretoria cria o evento; filhos de santo veem no portal. Menos “fiquei sabendo depois”.',
      },
      {
        heading: 'Confirmação de presença',
        body: 'Convites com confirmar/declinar ajudam a planejar a corrente e a portaria. Ideal para casas que cresceram além do “manda no grupo”.',
      },
      {
        heading: 'Lembretes e mural',
        body: `Avisos importantes podem ir ao mural e, quando configurado, ao WhatsApp oficial. Veja também https://axecloud.com.br/conteudo/giras-festas-e-calendario-da-casa.`,
      },
      {
        heading: 'Comece agora',
        body: `Compare módulos em https://axecloud.com.br/por-que-axecloud e teste em https://axecloud.com.br/register.`,
      },
    ],
    faq: [
      {
        q: 'Como organizar presença em gira?',
        a: `Crie o evento no calendário, envie convite com confirmar/declinar e acompanhe a lista no painel. O ${BRAND_NAME} substitui a lista no caderno.`,
      },
      {
        q: 'Filhos de santo veem a agenda?',
        a: 'Sim. Cada integrante vê o calendário da casa no portal, separado do painel administrativo.',
      },
    ],
  },
  {
    slug: 'portal-filho-de-santo',
    title: `Portal do filho de santo | ${BRAND_NAME}`,
    h1: 'Portal do filho de santo no celular',
    description:
      `Portal próprio para mensalidades, mural, calendário e biblioteca — separado do painel do zelador. ${BRAND_NAME} com app PWA. Teste ${TRIAL_DAYS} dias.`,
    lead:
      'Cada filho de santo merece um espaço claro: avisos, agenda, mensalidade e estudos — sem misturar com a administração da diretoria.',
    sections: [
      {
        heading: 'Acesso separado',
        body: 'Zelador e diretoria usam o painel; o filho entra com ID da casa e CPF. Sigilo por perfil.',
      },
      {
        heading: 'No celular, como app',
        body: `Instale o PWA na tela inicial — sem loja de aplicativos. Guia em https://axecloud.com.br/recursos/app-pwa-terreiro.`,
      },
      {
        heading: 'O que o filho encontra',
        body: 'Mural, calendário, mensalidades, biblioteca e obrigações conforme a casa liberar.',
      },
      {
        heading: 'Teste na sua casa',
        body: `Cadastre o terreiro em https://axecloud.com.br/register e veja o portal na prática.`,
      },
    ],
    faq: [
      {
        q: 'Como ter portal do filho de santo no celular?',
        a: `Com o ${BRAND_NAME}, o filho acessa pelo navegador ou instala o PWA. Não precisa App Store nem Google Play.`,
      },
      {
        q: 'O filho vê dados financeiros de outros?',
        a: 'Não. Cada portal mostra apenas o que a diretoria liberou para aquele integrante.',
      },
    ],
  },
  {
    slug: 'whatsapp-oficial',
    title: `WhatsApp oficial para terreiro | ${BRAND_NAME}`,
    h1: 'WhatsApp oficial (API Meta) para comunicação da casa',
    description:
      `Avisos e lembretes de mensalidade via WhatsApp oficial Meta — privado e rastreável. Diferença de grupos manuais no ${BRAND_NAME}.`,
    lead:
      'Grupo serve para convivência. Canal oficial serve para aviso, cobrança privada e histórico. O AxéCloud usa a API oficial da Meta.',
    sections: [
      {
        heading: 'Templates aprovados',
        body: 'Mensagens de cobrança e aviso seguem templates — com o nome da casa e registro no sistema.',
      },
      {
        heading: 'Privacidade',
        body: 'Lembrete de mensalidade não precisa ir no grupo. O respeito com a corrente aumenta.',
      },
      {
        heading: 'Grupos vs oficial',
        body: `Entenda a diferença em https://axecloud.com.br/conteudo/whatsapp-oficial-vs-grupos-comunicacao-terreiro.`,
      },
      {
        heading: 'Ative no teste',
        body: `Compare em https://axecloud.com.br/por-que-axecloud e comece em https://axecloud.com.br/register.`,
      },
    ],
    faq: [
      {
        q: 'WhatsApp oficial substitui o grupo da casa?',
        a: 'Não. O grupo continua para convivência. O canal oficial tira do grupo a responsabilidade de ser “sistema”.',
      },
      {
        q: 'Preciso de número comercial Meta?',
        a: `A integração usa a API oficial. No onboarding do ${BRAND_NAME} a casa configura o canal conforme o plano.`,
      },
    ],
  },
  {
    slug: 'app-pwa-terreiro',
    title: `App PWA para terreiro | ${BRAND_NAME}`,
    h1: 'App instalável (PWA) para gestão de terreiro',
    description:
      `Instale o ${BRAND_NAME} na tela inicial do celular sem App Store. PWA para zelador e filho de santo — guia e benefícios.`,
    lead:
      'Acesso no navegador e ícone na home: o Progressive Web App entrega a rotina da casa no bolso, sem loja de apps.',
    sections: [
      {
        heading: 'Como instalar',
        body: `Abra o site, entre na conta e use “Adicionar à tela inicial”. Passo a passo em https://axecloud.com.br/conteudo/como-instalar-axecloud-celular-pwa e no comparativo https://axecloud.com.br/por-que-axecloud#pwa-head.`,
      },
      {
        heading: 'Zelador e filho',
        body: 'O mesmo app serve ao painel e ao portal — cada um com seu login.',
      },
      {
        heading: 'Atualizações automáticas',
        body: 'Sem baixar versão nova na loja: o service worker mantém a experiência atualizada.',
      },
      {
        heading: 'Teste agora',
        body: `Crie a conta em https://axecloud.com.br/register e fixe o ícone no celular durante o trial.`,
      },
    ],
    faq: [
      {
        q: 'Funciona no iPhone e no Android?',
        a: 'Sim. Safari, Chrome e Edge permitem adicionar à tela inicial. A experiência é a mesma do navegador, com ícone dedicado.',
      },
      {
        q: 'Ocupa muito espaço?',
        a: 'Menos que um app nativo pesado. É a interface web com cache inteligente.',
      },
    ],
  },
] as const;

export function featurePagePath(slug: string): string {
  return `/recursos/${slug}`;
}

export const FEATURE_PAGE_PATHS: readonly string[] = FEATURE_PAGES.map((p) => featurePagePath(p.slug));

export function getFeaturePageBySlug(slug: string): FeaturePageContent | undefined {
  return FEATURE_PAGES.find((p) => p.slug === slug);
}

export function parseFeaturePageSlug(path: string): string | null {
  const normalized = path.replace(/\/+$/, '') || '/';
  const prefix = '/recursos/';
  if (!normalized.startsWith(prefix)) return null;
  const slug = normalized.slice(prefix.length);
  if (!slug || slug.includes('/')) return null;
  return getFeaturePageBySlug(slug) ? slug : null;
}
