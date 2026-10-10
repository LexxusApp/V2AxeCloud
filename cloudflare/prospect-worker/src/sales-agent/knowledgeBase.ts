/**
 * Base de Conhecimento Oficial do AxéCloud para o Agente Comercial
 * Regra: NUNCA inventar planos, preços ou recursos inexistentes.
 * Não existe plano gratuito (apenas 30 dias de teste grátis com tudo liberado).
 * O único plano comercial é o Premium: R$ 69,90/mês ou R$ 699,00/ano.
 */

export interface KnowledgeBaseData {
  productName: string;
  shortDescription: string;
  fullDescription: string;
  features: Array<{ name: string; description: string }>;
  plans: Array<{ name: string; priceMonthly: string; priceAnnual?: string; description: string; trialDays: number }>;
  registrationUrl: string;
  websiteUrl: string;
  supportHours: string;
  faq: Array<{ question: string; answer: string }>;
}

export const AXECLOUD_KNOWLEDGE_BASE: KnowledgeBaseData = {
  productName: 'AxéCloud',
  shortDescription: 'Sistema completo de gestão administrativa e operacional desenvolvido com respeito e fundamento para terreiros, centros e casas de axé.',
  fullDescription:
    'O AxéCloud é a plataforma mais completa do Brasil desenvolvida especificamente para as necessidades de terreiros de Umbanda, Candomblé (Ketu, Angola, Jeje), Jurema Sagrada, Quimbanda e demais tradições de matriz africana. O sistema organiza filhos da corrente, giras, financeiro com Pix, atendimentos de consulentes, almoxarifado, biblioteca e presença pública com total segurança e respeito às tradições.',
  features: [
    {
      name: 'Radar do AxéCloud e Presença Pública',
      description: 'Presença da casa no Mapa Nacional e Diretório de Terreiros. Permite que consulentes encontrem o terreiro por localização, consultem dias e horários de giras públicas e atendimentos (passes, consultas, desobsessão), com painel de métricas para o zelador acompanhar quantas pessoas visualizaram a casa nos últimos 7 dias, 30 dias e total.',
    },
    {
      name: 'Gestão de Filhos de Santo e Médiuns',
      description: 'Ficha cadastral completa da corrente: dados civis, contatos de emergência, orixás de cabeça (frente, juntó, ancestral), entidades chefes de trabalho, datas de iniciação, feitura, coroação, batismo, cargos litúrgicos (Ogãs, Ekedis, Cambonos, Pais/Mães Pequenos, Curimbeiros) e histórico espiritual.',
    },
    {
      name: 'Obrigações Litúrgicas, Camarinha e Preceitos',
      description: 'Acompanhamento detalhado do ciclo de obrigações de cada filho (Bori, Feitura, 1 ano, 3 anos, 7 anos, 14 anos, 21 anos), com prazos, alertas para o zelador, listas de preceitos e resguardos, controle de médiuns recolhidos em camarinha e emissão de Ficha de Obrigação oficial em PDF.',
    },
    {
      name: 'Financeiro Completo e Mensalidades com Pix',
      description: 'Gestão das mensalidades da corrente com geração de chave Pix, QR Code dinâmico e código Pix Copia e Cola para cada filho. Envio de lembrete amigável por WhatsApp, conferência automática de comprovantes com proteção antifraude, fluxo de caixa (entradas e despesas do terreiro) e relatórios de prestação de contas transparentes.',
    },
    {
      name: 'Calendário de Giras, Festas e Eventos',
      description: 'Agenda oficial da casa para giras públicas, giras de desenvolvimento, toques e festas de Orixás. Conta com confirmação de presença (RSVP) pelos médiuns, escalas de trabalho e disparo automático de lembretes via WhatsApp na véspera da gira.',
    },
    {
      name: 'Frequência e Portaria com QR Code',
      description: 'Chamada digital rápida dos médiuns nas giras, check-in na portaria por leitura de QR Code direto no celular do médium (carteirinha digital) e relatórios de assiduidade para acompanhamento do desenvolvimento mediúnico.',
    },
    {
      name: 'Atendimento de Consulentes e Fila de Senhas',
      description: 'Sistema moderno de senhas com QR Code para giras públicas. O consulente acompanha a fila em tempo real pelo próprio celular ou em monitor na sala de espera, com triagem e prontuário histórico dos atendimentos com as entidades da casa.',
    },
    {
      name: 'Mural de Comunicados e Transmissão WhatsApp',
      description: 'Mural de avisos oficiais do terreiro com opção de envio em massa direto para o WhatsApp de toda a corrente com um único clique, além de notificações push no celular dos filhos.',
    },
    {
      name: 'Mensagens Internas e Pedidos de Reza',
      description: 'Canal seguro de comunicação entre a administração e os médiuns, além de recepção e organização de pedidos de oração e reza enviados por consulentes e filhos.',
    },
    {
      name: 'Biblioteca, Curimba e Fundamentos',
      description: 'Acervo digital seguro da casa com letras de pontos cantados por linha/orixá com opção de áudio para a curimba, pontos riscados com significados, guia de ervas litúrgicas e apostilas de estudo em PDF com leitor integrado.',
    },
    {
      name: 'Almoxarifado e Estoque do Terreiro',
      description: 'Controle de estoque de materiais de sustentação do terreiro: velas (7 dias, palito, cores), pembas, charutos, defumações, ervas secas e frescas, fitas e alguidares, com alerta automático de estoque crítico antes do material faltar.',
    },
    {
      name: 'Loja do Terreiro',
      description: 'Catálogo interno para que médiuns e consulentes adquiram artigos próprios da casa (guias, banhos preparados, roupas brancas, camisetas de eventos e livros), com controle de pedidos e entregas.',
    },
    {
      name: 'Galeria de Fotos Privada e Segura',
      description: 'Álbuns de fotos das festas, rituais e toques com armazenamento isolado na nuvem, garantindo a privacidade das imagens sagradas da casa apenas para os membros autorizados.',
    },
    {
      name: 'Secretaria e Documentos Oficiais',
      description: 'Emissão e guarda de atas de reuniões, termos de consentimento/LGPD, estatuto do terreiro, certidões espirituais (batismo, feitura, casamento) e controle do patrimônio físico da casa.',
    },
    {
      name: 'Portal do Filho (App do Médium no Celular)',
      description: 'Aplicativo PWA leve para Android e iPhone. Cada médium tem seu login individual gratuito para ver sua ficha, suas mensalidades com chave Pix, confirmar presença nas giras, conferir seus preceitos e acessar o mural e a biblioteca.',
    },
    {
      name: 'Automações Oficiais via Meta Cloud WhatsApp',
      description: 'Envio de lembretes automáticos de gira, avisos de mensalidade com Pix Copia e Cola e comunicados da casa usando a API Oficial da Meta, sem risco de bloqueio do chip da casa.',
    },
  ],
  plans: [
    {
      name: 'Premium',
      priceMonthly: 'R$ 69,90/mês',
      priceAnnual: 'R$ 699,00/ano (economia de 2 meses)',
      description: 'Acesso completo a todas as ferramentas do sistema: filhos e médiuns ilimitados, financeiro, giras, lembretes de WhatsApp, senhas de consulentes, almoxarifado, biblioteca, Radar e portal do filho.',
      trialDays: 30,
    },
  ],
  registrationUrl: 'https://axecloud.com.br/register',
  websiteUrl: 'https://axecloud.com.br',
  supportHours: 'Segunda a sexta das 09h às 18h',
  faq: [
    {
      question: 'O AxéCloud tem plano gratuito?',
      answer: 'Não. O AxéCloud não possui plano gratuito. Oferecemos um teste completo e gratuito por 30 dias com todos os recursos liberados, sem precisar cadastrar cartão de crédito e sem cobrança automática. Após os 30 dias de teste, o plano para continuar é o Premium, por apenas R$ 69,90 por mês (ou R$ 699,00 no plano anual).',
    },
    {
      question: 'O que é o Radar do AxéCloud?',
      answer: 'O Radar é a ferramenta de presença pública do terreiro no mapa nacional do AxéCloud. Ele permite que consulentes da sua região encontrem o terreiro, vejam dias e horários de giras públicas e atendimentos (passes, consultas com entidades), além de fornecer métricas de quantas pessoas visualizaram a sua casa nos últimos 7 e 30 dias.',
    },
    {
      question: 'Precisa de cartão de crédito para testar?',
      answer: 'Não! O teste do AxéCloud é 100% gratuito por 30 dias, sem pedir cartão de crédito no cadastro e sem nenhuma cobrança surpresa.',
    },
    {
      question: 'Existe limite de filhos de santo ou médiuns cadastrados?',
      answer: 'Não! O plano Premium permite cadastrar quantos filhos e médiuns você tiver na casa (10, 50, 100, 300 ou mais), sem nenhuma cobrança adicional por médium.',
    },
    {
      question: 'Os filhos da casa pagam para usar o portal do médium?',
      answer: 'Não. Apenas o terreiro assina a plataforma. Todos os médiuns e filhos da casa usam o aplicativo do portal do filho gratuitamente.',
    },
    {
      question: 'O zelador precisa mandar link para os filhos da casa?',
      answer: 'Não precisa mandar links manuais nem ficar criando grupos! Quando você cadastra o médium no AxéCloud (informando nome e WhatsApp), o próprio sistema gera o Registro oficial da casa e envia as instruções e dados de acesso direto no WhatsApp do médium com um clique. O filho entra no Portal do Filho pelo celular com o seu Registro e os 6 primeiros dígitos do CPF, de forma super simples e sem complicações.',
    },
    {
      question: 'Como os filhos de santo entram no sistema?',
      answer: 'Os filhos acessam o Portal do Filho (um aplicativo PWA leve para Android e iPhone que não ocupa espaço na memória). O médium entra com o número do seu Registro na casa + os 6 primeiros dígitos do CPF (ou senha) e já consegue ver as datas das giras, confirmar presença, pegar a chave Pix da mensalidade, ver seus preceitos e acessar o mural de avisos da casa.',
    },
    {
      question: 'Como funciona a cobrança de mensalidades dos médiuns?',
      answer: 'O sistema gera automaticamente para cada médium a chave Pix e o QR Code dinâmico com o valor da mensalidade da casa. O sistema envia lembrete no WhatsApp do médium antes do vencimento com o Pix Copia e Cola, e quando o médium paga, o sistema confere e dá baixa na mensalidade da corrente, tudo organizado no painel financeiro sem o zelador precisar cobrar ninguém.',
    },
    {
      question: 'Funciona no celular?',
      answer: 'Sim! O AxéCloud funciona perfeitamente em qualquer celular (Android ou iPhone) como um aplicativo (PWA), sem precisar baixar arquivos pesados que ocupam memória.',
    },
    {
      question: 'Os dados do meu terreiro ficam seguros e sigilosos?',
      answer: 'Sim, total sigilo e respeito às tradições. Todos os dados são confidenciais, com criptografia de ponta e armazenamento isolado para cada terreiro. Ninguém fora da administração da sua casa tem acesso às informações dos médiuns ou da casa.',
    },
    {
      question: 'Como faço para começar o teste gratuito?',
      answer: 'É super simples: você pode liberar seu acesso de 30 dias grátis agora mesmo por aqui no WhatsApp, só informando seu melhor e-mail e o nome do terreiro, sem precisar preencher formulários. Se preferir se cadastrar pelo site, o endereço é https://axecloud.com.br/register.',
    },
  ],
};
