import { TRIAL_DAYS } from '../../lib/planPricing';
import { BRAND_NAME } from './seoBrandKeywords';

export type CommercialPageKey = 'system' | 'financial' | 'dues' | 'members';

export type CommercialPageContent = {
  key: CommercialPageKey;
  path: string;
  kicker: string;
  title: string;
  description: string;
  h1: string;
  lead: string;
  promise: string;
  eyebrow: string;
  proof: readonly { value: string; label: string }[];
  contrast: {
    beforeTitle: string;
    before: readonly string[];
    afterTitle: string;
    after: readonly string[];
  };
  workflowTitle: string;
  workflowLead: string;
  workflow: readonly { number: string; title: string; body: string }[];
  capabilities: readonly { title: string; body: string; tag: string }[];
  faq: readonly { q: string; a: string }[];
};

export const COMMERCIAL_ROUTES = {
  system: '/sistema-de-gestao-para-terreiros',
  financial: '/financeiro-para-terreiros',
  dues: '/mensalidades-para-terreiros',
  members: '/gestao-de-filhos-de-santo',
} as const;

const sharedProof = [
  { value: '24', label: 'módulos conectados' },
  { value: `${TRIAL_DAYS} dias`, label: 'para testar sem cartão' },
  { value: '1 só', label: 'ambiente privado por casa' },
] as const;

export const COMMERCIAL_PAGES: readonly CommercialPageContent[] = [
  {
    key: 'system',
    path: COMMERCIAL_ROUTES.system,
    kicker: 'Sistema de gestão para terreiros',
    title: `Sistema de gestão para terreiros | ${BRAND_NAME}`,
    description:
      `Organize financeiro, mensalidades, filhos de santo, giras, estoque e memória em um sistema feito para terreiros. Teste o ${BRAND_NAME} por ${TRIAL_DAYS} dias.`,
    h1: 'A gestão da casa inteira, sem tirar a casa do seu fundamento.',
    lead:
      'O AxéCloud reúne a rotina administrativa de terreiros de Umbanda, Candomblé e Jurema em um único ambiente: claro para a zeladoria, simples para a corrente e respeitoso com o que é privado.',
    promise: 'Menos improviso administrativo. Mais tempo para cuidar da casa e das pessoas.',
    eyebrow: 'Uma casa · uma gestão',
    proof: sharedProof,
    contrast: {
      beforeTitle: 'Quando cada assunto vive num lugar',
      before: ['Mensalidades em uma planilha', 'Giras perdidas no grupo', 'Fichas em cadernos', 'Comprovantes no celular de alguém'],
      afterTitle: 'Quando a rotina passa a conversar',
      after: ['Financeiro e Pix no mesmo fluxo', 'Agenda com presença e avisos', 'Histórico individual da corrente', 'Documentos e memória protegidos'],
    },
    workflowTitle: 'O sistema acompanha o ritmo real da casa.',
    workflowLead: 'Cada módulo resolve uma tarefa, mas todos usam a mesma base de pessoas, datas e registros. A informação entra uma vez e continua útil no restante da gestão.',
    workflow: [
      { number: '01', title: 'A casa é organizada', body: 'Cadastre a identidade do terreiro, a corrente, as datas e os responsáveis.' },
      { number: '02', title: 'A rotina ganha fluxo', body: 'Financeiro, calendário, comunicação, patrimônio e memória deixam de funcionar separados.' },
      { number: '03', title: 'Cada pessoa vê o necessário', body: 'A zeladoria administra; filhos de santo acompanham apenas o que foi liberado para eles.' },
    ],
    capabilities: [
      { tag: 'Administração', title: 'Financeiro e mensalidades', body: 'Entradas, despesas, Pix, pendências e prestação de contas com histórico.' },
      { tag: 'Corrente', title: 'Filhos de santo e caminhada', body: 'Cadastro, vínculos, obrigações, presença e marcos de cada integrante.' },
      { tag: 'Ritmo', title: 'Giras, festas e comunicação', body: 'Agenda, confirmações, mural e avisos oficiais para reduzir ruído no grupo.' },
      { tag: 'Continuidade', title: 'Patrimônio, documentos e memória', body: 'O que pertence à casa permanece organizado, contextualizado e protegido.' },
    ],
    faq: [
      { q: 'O AxéCloud serve para terreiros pequenos?', a: 'Sim. A casa pode começar com os módulos de que precisa hoje e usar os demais conforme a rotina cresce, sem trocar de plano ou de sistema.' },
      { q: 'É necessário instalar algum programa?', a: 'Não. O acesso funciona pelo navegador no computador e no celular. Também é possível instalar o AxéCloud como aplicativo PWA na tela inicial.' },
      { q: 'Os filhos de santo acessam o painel administrativo?', a: 'Não. A zeladoria usa o painel de gestão e cada integrante recebe um acesso separado, limitado às informações liberadas para o seu perfil.' },
      { q: 'Os dados de um terreiro ficam misturados com os de outro?', a: 'Não. Cada casa possui ambiente próprio e isolado, com autenticação e regras de acesso aos seus registros.' },
    ],
  },
  {
    key: 'financial',
    path: COMMERCIAL_ROUTES.financial,
    kicker: 'Financeiro para terreiros',
    title: `Financeiro para terreiros com Pix | ${BRAND_NAME}`,
    description:
      `Controle entradas, despesas, mensalidades e Pix do terreiro com histórico e prestação de contas. Conheça o financeiro do ${BRAND_NAME}.`,
    h1: 'Clareza financeira sem transformar a casa em empresa fria.',
    lead:
      'Registre o movimento da casa, acompanhe o caixa e encontre cada lançamento sem depender de cadernos, mensagens ou versões diferentes da mesma planilha.',
    promise: 'A diretoria entende o presente e presta contas com mais tranquilidade.',
    eyebrow: 'Caixa visível · contexto preservado',
    proof: [
      { value: 'Pix', label: 'integrado ao fluxo' },
      { value: '1 histórico', label: 'de entradas e despesas' },
      { value: 'Privado', label: 'para a diretoria autorizada' },
    ],
    contrast: {
      beforeTitle: 'O financeiro fragmentado',
      before: ['Comprovantes na conversa', 'Despesa anotada depois', 'Planilha sem versão certa', 'Saldo difícil de explicar'],
      afterTitle: 'O financeiro com contexto',
      after: ['Lançamentos categorizados', 'Pix ligado à contribuição', 'Histórico consultável', 'Leitura clara do caixa'],
    },
    workflowTitle: 'Do movimento ao entendimento, sem atalhos escondidos.',
    workflowLead: 'O AxéCloud organiza o caminho completo do dinheiro: registro, conciliação, acompanhamento e leitura para a diretoria.',
    workflow: [
      { number: '01', title: 'Registre', body: 'Entradas e despesas recebem data, categoria, descrição e vínculo com a rotina da casa.' },
      { number: '02', title: 'Acompanhe', body: 'O painel mostra caixa, mensalidades e pendências sem precisar cruzar arquivos.' },
      { number: '03', title: 'Preste contas', body: 'O histórico permanece disponível para conferir períodos e explicar movimentações.' },
    ],
    capabilities: [
      { tag: 'Caixa', title: 'Entradas e despesas', body: 'Movimentações organizadas por categoria, período e descrição.' },
      { tag: 'Contribuições', title: 'Mensalidades conectadas', body: 'A situação de cada contribuição conversa com o cadastro do integrante.' },
      { tag: 'Pagamento', title: 'Pix no próprio sistema', body: 'O pagamento pode acontecer na experiência do AxéCloud, com confirmação vinculada ao ciclo.' },
      { tag: 'Leitura', title: 'Relatórios objetivos', body: 'Indicadores essenciais para acompanhar a saúde financeira sem excesso de tela.' },
    ],
    faq: [
      { q: 'O sistema substitui a planilha financeira do terreiro?', a: 'Sim. Entradas, despesas, contribuições e histórico ficam na mesma base, evitando arquivos duplicados e versões conflitantes.' },
      { q: 'O Pix é identificado por filho de santo?', a: 'Quando usado no fluxo de mensalidade, o pagamento fica relacionado ao integrante e ao ciclo correspondente.' },
      { q: 'Qualquer filho de santo pode ver o caixa?', a: 'Não. A gestão financeira fica no ambiente administrativo e segue as permissões da casa.' },
    ],
  },
  {
    key: 'dues',
    path: COMMERCIAL_ROUTES.dues,
    kicker: 'Mensalidades para terreiros',
    title: `Controle de mensalidades para terreiros | ${BRAND_NAME}`,
    description:
      `Acompanhe mensalidades de filhos de santo, gere Pix e envie lembretes privados com respeito. Controle de contribuições no ${BRAND_NAME}.`,
    h1: 'Mensalidade organizada. Relação preservada.',
    lead:
      'A contribuição sustenta a rotina da casa, mas a cobrança não precisa virar exposição. O AxéCloud mostra vencimentos, pagamentos e pendências em um fluxo privado e respeitoso.',
    promise: 'Cada integrante acompanha a própria situação. A diretoria acompanha o todo.',
    eyebrow: 'Contribuição sem constrangimento',
    proof: [
      { value: 'Privado', label: 'fora do grupo público' },
      { value: 'Pix', label: 'gerado no fluxo' },
      { value: 'Ciclo', label: 'com histórico e vencimento' },
    ],
    contrast: {
      beforeTitle: 'Cobrar pelo grupo desgasta',
      before: ['Lista exposta', 'Print como comprovante', 'Cobrança sem contexto', 'Dúvida sobre quem pagou'],
      afterTitle: 'Um fluxo respeitoso resolve',
      after: ['Aviso individual', 'Pagamento vinculado', 'Situação atualizada', 'Histórico por integrante'],
    },
    workflowTitle: 'Uma linha do tempo simples para cada contribuição.',
    workflowLead: 'A casa define o ciclo; o integrante consulta e paga; a diretoria acompanha a confirmação sem sair da página.',
    workflow: [
      { number: '01', title: 'A casa define o ciclo', body: 'Valor, vencimento e período ficam claros para toda a gestão.' },
      { number: '02', title: 'O integrante recebe o caminho', body: 'No portal, cada pessoa vê apenas a própria mensalidade e as opções disponíveis.' },
      { number: '03', title: 'A confirmação fecha o registro', body: 'O pagamento atualiza o ciclo e preserva o histórico para futuras consultas.' },
    ],
    capabilities: [
      { tag: 'Visão da diretoria', title: 'Pagos e pendentes', body: 'Acompanhe o mês sem montar listas manuais ou procurar conversas.' },
      { tag: 'Portal do integrante', title: 'Situação individual', body: 'Cada filho de santo consulta vencimento, histórico e pagamento em seu acesso.' },
      { tag: 'Comunicação', title: 'Lembretes privados', body: 'Avisos podem ser enviados individualmente, sem exposição no grupo da casa.' },
      { tag: 'Continuidade', title: 'Ciclos registrados', body: 'O histórico não desaparece quando muda o mês ou a pessoa responsável pelo caixa.' },
    ],
    faq: [
      { q: 'Como cobrar mensalidade sem expor o filho de santo?', a: 'Use o portal individual e lembretes privados. A situação financeira não precisa aparecer em grupos ou listas compartilhadas.' },
      { q: 'O filho de santo consegue pagar na própria página?', a: 'Sim. O fluxo de mensalidade permite escolher o ciclo e seguir para o pagamento sem depender de um checkout externo genérico.' },
      { q: 'A diretoria consegue conferir meses anteriores?', a: 'Sim. Os ciclos e pagamentos permanecem associados ao histórico do integrante.' },
    ],
  },
  {
    key: 'members',
    path: COMMERCIAL_ROUTES.members,
    kicker: 'Gestão de filhos de santo',
    title: `Gestão de filhos de santo para terreiros | ${BRAND_NAME}`,
    description:
      `Cadastre filhos de santo, vínculos, presença, obrigações e caminhada mediúnica com privacidade. Conheça a gestão da corrente no ${BRAND_NAME}.`,
    h1: 'Cada pessoa tem uma caminhada. A casa precisa lembrar dela inteira.',
    lead:
      'O cadastro deixa de ser apenas nome e telefone. O AxéCloud conecta vínculos, presença, obrigações, documentos e marcos para que a zeladoria cuide de cada trajetória com contexto.',
    promise: 'Organização para o presente. Memória para quem continuará a casa.',
    eyebrow: 'Corrente viva · história cuidada',
    proof: [
      { value: '1 perfil', label: 'por integrante' },
      { value: 'Linha do tempo', label: 'da caminhada' },
      { value: 'Acesso próprio', label: 'separado da gestão' },
    ],
    contrast: {
      beforeTitle: 'Quando a memória depende de alguém',
      before: ['Fichas incompletas', 'Datas lembradas de cabeça', 'Documentos espalhados', 'História perdida na troca de gestão'],
      afterTitle: 'Quando a casa preserva o contexto',
      after: ['Perfil individual', 'Obrigações e alertas', 'Presença e desenvolvimento', 'Linha do tempo da caminhada'],
    },
    workflowTitle: 'Da chegada à continuidade, cada marco encontra seu lugar.',
    workflowLead: 'A zeladoria registra a pessoa uma vez e constrói o histórico com o tempo, sem duplicar dados em módulos diferentes.',
    workflow: [
      { number: '01', title: 'Identidade e vínculo', body: 'Dados essenciais, contato, cargo, entrada na casa e relações importantes.' },
      { number: '02', title: 'Rotina e desenvolvimento', body: 'Presença, atividades, estudos, obrigações e responsabilidades acompanhadas.' },
      { number: '03', title: 'Memória e acesso', body: 'A trajetória fica preservada; o integrante acessa somente o que a casa libera.' },
    ],
    capabilities: [
      { tag: 'Cadastro', title: 'Ficha individual completa', body: 'Contatos, vínculos, cargos e informações necessárias à rotina da casa.' },
      { tag: 'Caminhada', title: 'Marcos e obrigações', body: 'Entrada, iniciações, obrigações, funções e acontecimentos numa linha do tempo.' },
      { tag: 'Participação', title: 'Presença e desenvolvimento', body: 'Frequência em giras, turmas, atividades e evolução formativa da corrente.' },
      { tag: 'Autonomia', title: 'Portal do filho de santo', body: 'Agenda, avisos, mensalidade e materiais em uma experiência separada da administração.' },
    ],
    faq: [
      { q: 'O cadastro aceita informações da caminhada religiosa?', a: 'Sim. A casa pode registrar vínculos, cargos, datas, obrigações e marcos conforme sua própria tradição e necessidade.' },
      { q: 'O filho de santo vê anotações privadas da zeladoria?', a: 'Não. O portal do integrante é separado do painel administrativo e exibe somente as informações destinadas a ele.' },
      { q: 'É possível acompanhar presença em giras?', a: 'Sim. O cadastro conversa com frequência, calendário e atividades para manter o histórico de participação.' },
    ],
  },
] as const;

export const COMMERCIAL_PAGE_PATHS = COMMERCIAL_PAGES.map((page) => page.path);

export function getCommercialPageByPath(path: string): CommercialPageContent | undefined {
  const normalized = path.replace(/\/+$/, '') || '/';
  return COMMERCIAL_PAGES.find((page) => page.path === normalized);
}
