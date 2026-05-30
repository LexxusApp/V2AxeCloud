export type PortalContentSection = {
  title: string;
  body: string;
};

export const PORTAL_ARTICLE = {
  slug: 'como-o-axecloud-ajuda-terreiros',
  title: 'Como o AxéCloud ajuda terreiros a se organizar',
  summary:
    'Gestão financeira, calendário de giras, mural e portal do filho de santo — tecnologia a serviço do sagrado, sem perder a sensibilidade da casa.',
  publishedAt: '2026-05-29',
  readingMinutes: 6,
  sections: [
    {
      title: 'O desafio da administração na casa de axé',
      body:
        'Dirigir um terreiro exige cuidado espiritual e organização prática ao mesmo tempo: mensalidades dos filhos de santo, estoque de velas e ervas, convocação de giras, comunicação com a comunidade. Muitas casas ainda dependem de cadernos, planilhas espalhadas e grupos de WhatsApp — o que funciona no começo, mas se torna frágil quando a casa cresce.',
    },
    {
      title: 'Financeiro com transparência',
      body:
        'O AxéCloud registra mensalidades, doações e despesas com histórico claro. Filhos de santo podem pagar via Pix; a diretoria acompanha tudo em tempo real. Menos dúvida sobre quem está em dia, mais confiança na gestão da casa — sem transformar a contribuição em burocracia fria.',
    },
    {
      title: 'Almoxarifado do chão',
      body:
        'Velas, defumadores, ervas, guias e materiais de obrigação saem e entram o tempo todo. O módulo de almoxarifado centraliza entradas, saídas e alertas de estoque baixo, para ogãs, cambonos e zeladores terem leitura clara do que a casa precisa.',
    },
    {
      title: 'Calendário e mural integrados',
      body:
        'Giras, festas e obrigações ficam no calendário litúrgico da casa. Avisos importantes vão para o mural virtual — filhos de santo veem a agenda e os comunicados no mesmo fluxo, pelo celular ou computador, sem depender só de mensagens avulsas.',
    },
    {
      title: 'Portal do filho de santo',
      body:
        'Cada integrante acessa um espaço próprio: biblioteca de estudos, mensalidades, calendário e mural. Quem administra e quem vive a comunidade têm experiências separadas, mas conectadas — a casa gira com mais clareza para todos.',
    },
    {
      title: 'Privacidade e respeito',
      body:
        'Cada terreiro tem ambiente isolado na nuvem. Controles de acesso por perfil, criptografia em trânsito e políticas alinhadas à LGPD. O sagrado continua protegido; a organização ganha ferramentas profissionais.',
    },
    {
      title: 'Programa Fundador',
      body:
        'Estamos convidando as primeiras casas a usar o AxéCloud gratuitamente por 12 meses, com onboarding personalizado. É a fase de validação antes de abrir o portal público com diretório de terreiros e agenda cultural. Se sua casa quer participar, inscreva-se no Programa Fundador.',
    },
  ] satisfies readonly PortalContentSection[],
} as const;

export const GLOSSARY_TERMS = [
  {
    term: 'Axé',
    definition:
      'Energia vital, força e bênção presente nas práticas das religiões afro-brasileiras. Também usado como saudação de respeito entre praticantes.',
  },
  {
    term: 'Terreiro',
    definition:
      'Espaço físico e comunitário onde se realizam cultos, giras e obrigações. Também designa a comunidade ligada à casa.',
  },
  {
    term: 'Casa de axé',
    definition:
      'Sinônimo de terreiro ou centro religioso de Umbanda, Candomblé ou vertentes afins — a “casa” como lugar de culto e pertencimento.',
  },
  {
    term: 'Filho de santo',
    definition:
      'Integrante iniciado na tradição, vinculado a uma casa e a uma linha espiritual. Participa de giras, obrigações e vida comunitária do terreiro.',
  },
  {
    term: 'Zelador / zeladora',
    definition:
      'Responsável pela organização material e administrativa do terreiro — portas, limpeza, estoque, logística das giras e apoio à diretoria espiritual.',
  },
  {
    term: 'Pai de santo / Mãe de santo',
    definition:
      'Liderança espiritual da casa. No Candomblé, frequentemente babalorixá (pai) ou ialorixá (mãe). Na Umbanda, pai ou mãe de santo conforme a linha.',
  },
  {
    term: 'Gira',
    definition:
      'Ritual coletivo, especialmente na Umbanda, em que médiuns incorporam entidades e guias para consultas, passes e trabalhos espirituais.',
  },
  {
    term: 'Orixá',
    definition:
      'Divindade do panteão iorubá, presente no Candomblé e referenciado em diversas linhas. Cada orixá tem características, cores, elementos e dias sagrados.',
  },
  {
    term: 'Obrigação',
    definition:
      'Ritual de consagração, agradecimento ou renovação espiritual a que o filho de santo deve cumprir conforme orientação da casa e do axé recebido.',
  },
  {
    term: 'Umbanda e Candomblé',
    definition:
      'Duas das principais religiões afro-brasileiras. O Candomblé mantém forte vínculo com nações iorubás, jejes e bantos; a Umbanda nasceu no Brasil e integra elementos africanos, indígenes e católicos, conforme cada linha.',
  },
] as const;
