export type PortalContentSection = {
  title: string;
  body: string;
};

export type PortalArticle = {
  slug: string;
  title: string;
  summary: string;
  publishedAt: string;
  readingMinutes: number;
  sections: readonly PortalContentSection[];
};

export function contentArticlePath(slug: string): string {
  return `/conteudo/${slug}`;
}

export const PORTAL_ARTICLES: readonly PortalArticle[] = [
  {
    slug: 'como-o-axecloud-ajuda-terreiros',
    title: 'Como o AxéCloud ajuda terreiros a se organizar',
    summary:
      'Gestão financeira, calendário de giras, galeria de fotos, mural e portal do filho de santo — tecnologia a serviço do sagrado, sem perder a sensibilidade da casa.',
    publishedAt: '2026-05-29',
    readingMinutes: 6,
    sections: [
      {
        title: 'O desafio da administração na casa de axé',
        body:
          'Dirigir um terreiro exige cuidado espiritual e gestão de terreiros no dia a dia: mensalidades dos filhos de santo, registro de giras e momentos da casa, convocação de eventos, comunicação com a comunidade. Muitas casas ainda dependem de cadernos, planilhas espalhadas e grupos de WhatsApp — o que funciona no começo, mas se torna frágil quando a casa cresce. O software de gestão de terreiros do AxéCloud centraliza essa rotina em https://axecloud.com.br/.',
      },
      {
        title: 'Financeiro com transparência',
        body:
          'O AxéCloud registra mensalidades, doações e despesas com histórico claro. Filhos de santo podem pagar via Pix; a diretoria acompanha tudo em tempo real. Menos dúvida sobre quem está em dia, mais confiança na gestão da casa — sem transformar a contribuição em burocracia fria.',
      },
      {
        title: 'Galeria de fotos da casa',
        body:
          'Giras, festas de santo, obrigações e momentos da comunidade merecem memória. A galeria do AxéCloud organiza álbuns e fotos do terreiro em um só lugar — a diretoria guarda o registro com respeito, e filhos de santo podem reviver a história da casa sem depender de grupos espalhados no celular.',
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
        title: 'Comece com teste grátis',
        body:
          `Todo terreiro novo pode testar o AxéCloud por 30 dias grátis — plano Premium completo, sem cartão de crédito. Cadastre-se em https://axecloud.com.br/register e configure financeiro, calendário, mural e portal do filho de santo no seu ritmo. Veja o comparativo de módulos em https://axecloud.com.br/por-que-axecloud.`,
      },
    ],
  },
  {
    slug: 'o-que-e-um-terreiro-guia-para-iniciantes',
    title: 'O que é um terreiro — guia para quem está começando',
    summary:
      'Entenda o que é uma casa de axé, quem são os filhos de santo, o papel do zelador e como a comunidade se organiza — com linguagem respeitosa para quem está conhecendo a tradição.',
    publishedAt: '2026-06-01',
    readingMinutes: 7,
    sections: [
      {
        title: 'Mais que um endereço',
        body:
          'Terreiro, casa de axé ou centro religioso: são nomes para o espaço onde se cultua, se aprende e se vive a comunidade das religiões afro-brasileiras. Não é só o terreno ou o barracão — é a família espiritual formada em torno de uma linha, de uma nação ou de uma tradição específica de Umbanda, Candomblé, Jurema ou vertentes afins.',
      },
      {
        title: 'Quem faz a casa girar',
        body:
          'Na liderança espiritual estão o pai ou a mãe de santo (no Candomblé, babalorixá ou ialorixá conforme a nação). O zelador ou a zeladora cuida da parte material: portas, limpeza, estoque, logística das giras. Os filhos de santo são os iniciados que participam dos cultos, das obrigações e da vida comunitária. Consulentes são quem busca orientação espiritual nas giras, sem necessariamente ser iniciado.',
      },
      {
        title: 'Linha, nação e tradição',
        body:
          'Cada casa tem sua linha de trabalho — entidades, orixás ou mistérios que guiam o culto. No Candomblé, fala-se em nação (Ketu, Jeje, Angola, etc.). Na Umbanda, as linhas costumam integrar preto velhos, caboclos, exus, orixás e outras entidades conforme a firma do terreiro. Não existe um único modelo: o respeito começa por reconhecer que cada casa tem sua história e suas regras.',
      },
      {
        title: 'O que acontece em uma gira',
        body:
          'A gira é o momento coletivo de culto — especialmente na Umbanda — em que médiuns incorporam guias espirituais para passes, consultas e trabalhos. No Candomblé, os rituais públicos podem ser festas de santo, toques e obrigações em datas do calendário sagrado. Em ambos os casos, há preparo, vestimenta adequada, silêncio quando necessário e orientação de quem já está na casa.',
      },
      {
        title: 'Como se aproximar de uma casa',
        body:
          'Se você está buscando um terreiro, o caminho costuma ser indicação de alguém da comunidade, visita respeitosa ou contato com a diretoria. Evite comparar casas, fotografar sem permissão ou tratar o espaço como turismo. Pergunte, ouça e observe. A relação com uma casa de axé se constrói com tempo e compromisso — não há atalho.',
      },
      {
        title: 'Organização e espiritualidade',
        body:
          'Casas que crescem precisam de gestão de terreiros com registro de mensalidades, calendário de eventos e comunicação clara com os filhos de santo. Ferramentas como o AxéCloud ajudam a diretoria a cuidar da parte prática sem misturar o sagrado com planilhas desorganizadas — sempre com privacidade e respeito aos dados da comunidade. Saiba mais em https://axecloud.com.br/.',
      },
    ],
  },
  {
    slug: 'mensalidade-na-casa-de-axe-organizacao',
    title: 'Mensalidade na casa de axé — organização sem perder a fé',
    summary:
      'Por que as casas cobram contribuição mensal, como evitar conflitos na cobrança e o que muda quando a gestão financeira fica transparente para filhos de santo e diretoria.',
    publishedAt: '2026-06-01',
    readingMinutes: 8,
    sections: [
      {
        title: 'Para que serve a mensalidade',
        body:
          'A mensalidade dos filhos de santo não é “mensalidade de clube” no sentido comercial frio. É a contribuição regular que mantém o terreiro: luz, água, velas, ervas, manutenção do espaço, café da gira, materiais de limpeza e o trabalho invisível do dia a dia. Cada casa define o valor e a forma de cobrança conforme sua realidade e sua orientação espiritual.',
      },
      {
        title: 'Quando a cobrança vira problema',
        body:
          'Conflitos aparecem quando não há registro claro: quem pagou, quem está em atraso, quem foi isento por orientação. Planilhas no WhatsApp se perdem; filhos de santo ficam constrangidos; a diretoria gasta energia cobrando manualmente. A falta de transparência não é falta de fé — é falta de ferramenta.',
      },
      {
        title: 'Transparência gera confiança',
        body:
          'Quando cada filho de santo vê suas mensalidades no portal, paga via Pix com comprovante registrado e a diretoria acompanha o saldo em tempo real, a conversa muda de “você deve” para “a casa está organizada”. Isso não substitui o diálogo humano — complementa, para que o zelador e a diretoria foquem no cuidado da comunidade.',
      },
      {
        title: 'Casas que não cobram mensalidade',
        body:
          'Alguns terreiros funcionam só com doações, rifas, bazares ou contribuições espontâneas. O AxéCloud permite desativar a cobrança de mensalidade para essas casas, mantendo financeiro, calendário e mural ativos. Não há um modelo único de gestão — o sistema se adapta à forma da casa.',
      },
      {
        title: 'Boas práticas na diretoria',
        body:
          'Combine valores em assembleia ou com a orientação do pai ou da mãe de santo. Registre isenções e acordos. Não exponha débitos em grupo público. Use canais privados e, quando possível, um sistema que cada filho acesse só o próprio histórico. Respeito e clareza andam juntos.',
      },
      {
        title: 'Tecnologia a serviço da casa',
        body:
          'O financeiro do AxéCloud foi pensado para terreiros: mensalidades, Pix, histórico, relatórios e configuração por casa. Menos tempo em cobrança manual, mais tempo para o que importa — girar, acolher e cuidar do axé. Compare funcionalidades e módulos reais em https://axecloud.com.br/por-que-axecloud.',
      },
      {
        title: 'Mensalidade com Pix no celular',
        body:
          'Quando o filho de santo paga via Pix direto no portal, o comprovante fica registrado e a diretoria vê o crédito em tempo real — sem print perdido no WhatsApp. O zelador acompanha quem está em dia, quem está pendente e o saldo da casa num painel único. Para casas que ainda usam planilha, o artigo sobre mensalidade e Pix complementa este tema; veja também o comparativo entre planilha e software em https://axecloud.com.br/conteudo/planilha-ou-software-quando-migrar-gestao-terreiro.',
      },
      {
        title: 'Lembretes sem constranger',
        body:
          'Cobrança em grupo público gera desconforto. Com WhatsApp via API oficial Meta, o AxéCloud envia lembrete de mensalidade de forma privada — template aprovado, nome do terreiro na mensagem, histórico no sistema. A comunicação fica profissional; o respeito com filhos de santo continua. Saiba mais em https://axecloud.com.br/conteudo/whatsapp-oficial-vs-grupos-comunicacao-terreiro.',
      },
    ],
  },
  {
    slug: 'giras-festas-e-calendario-da-casa',
    title: 'Giras, festas e calendário da casa — entenda as datas',
    summary:
      'Diferença entre gira de consulta, festa de santo e obrigação; como as casas organizam o calendário litúrgico e por que avisar a comunidade com antecedência.',
    publishedAt: '2026-06-01',
    readingMinutes: 7,
    sections: [
      {
        title: 'Cada data tem um sentido',
        body:
          'No terreiro, nem todo culto é igual. Há a gira semanal ou quinzenal de atendimento, a festa pública de um orixá ou entidade, a obrigação fechada de um filho de santo, o batizado na linha, a lavagem de terreiro. Confundir esses momentos gera desrespeito — quem chega em festa fechada sem convite, ou quem espera consulta em dia só de preparação interna.',
      },
      {
        title: 'Gira de consulta',
        body:
          'É o encontro em que consulentes e filhos de santo participam das incorporações, passes e orientações. Costuma ter horário de abertura, fila ou senha, regras de vestimenta e silêncio no salão. Na Umbanda, é o formato mais familiar para quem busca uma primeira orientação espiritual.',
      },
      {
        title: 'Festa de santo e toque',
        body:
          'No Candomblé, as festas públicas de orixá seguem o calendário sagrado da casa — com cantigas, oferendas, rodas de dança e, em muitos casos, comunidade ampla. Na Umbanda, festas de linha ou de entidade específica também reúnem a comunidade. São momentos de celebração e renovação do axé da casa.',
      },
      {
        title: 'Obrigações e ritos fechados',
        body:
          'Obrigações, iniciações e trabalhos fechados não são abertos ao público geral. Participam quem foi chamado, quem já está na casa e quem tem função naquele ritual. Divulgar data e horário desses eventos exige critério da diretoria — o calendário interno da casa pode ser diferente do que vai para o mural público.',
      },
      {
        title: 'Por que o calendário importa',
        body:
          'Filhos de santo precisam saber com antecedência: há gira nesta semana? Preciso de roupa branca? A casa está em festa ou em resguardo? Um calendário centralizado — com mural para avisos — evita que cada informação se perca em dezenas de mensagens de WhatsApp.',
      },
      {
        title: 'Convites e confirmação de presença',
        body:
          'Para eventos com convidados, algumas casas enviam link de confirmação por WhatsApp. O AxéCloud permite RSVP de convidados: quem recebe o link confirma ou declina sem precisar entrar no sistema. A diretoria enxerga quem vem e organiza o salão com mais tranquilidade.',
      },
      {
        title: 'Organize sem perder o sagrado',
        body:
          'Registrar datas, tipos de evento e avisos no calendário do AxéCloud não “automatiza” o ritual — libera a diretoria do trabalho de repetir a mesma informação dez vezes. O sagrado continua no terreiro; a organização fica na ferramenta certa.',
      },
    ],
  },
  {
    slug: 'como-visitar-um-terreiro-com-respeito',
    title: 'Como visitar um terreiro com respeito — etiqueta para consulentes',
    summary:
      'Vestimenta, comportamento, fotos, oferendas e o que evitar na primeira (e nas próximas) visitas a uma casa de axé de Umbanda ou Candomblé.',
    publishedAt: '2026-06-01',
    readingMinutes: 6,
    sections: [
      {
        title: 'Você está entrando em um espaço sagrado',
        body:
          'Um terreiro não é ponto turístico nem cenário para redes sociais. É morada de entidades, orixás e da comunidade que cultua ali. Chegar com curiosidade é natural; chegar com humildade e discrição é fundamental. Trate o espaço como trataria a casa de alguém que você respeita profundamente.',
      },
      {
        title: 'Vestimenta e higiene',
        body:
          'Na maioria das casas, pede-se roupa clara e comprida — saia longa ou calça clara para mulheres, camisa clara para homens, conforme orientação local. Evite perfume forte, álcool em excesso antes da gira e celular no volume alto. Algumas casas pedem descalço no salão; outras não. Quando em dúvida, pergunte ao zelador ou à recepção.',
      },
      {
        title: 'Fotos, vídeos e redes sociais',
        body:
          'Não fotografe ou filme sem permissão explícita. Muitos terreiros proíbem imagens das incorporações, do altar ou de filhos de santo em transe. Respeitar essa regra protege a casa e as pessoas. O que é sagrado não precisa virar conteúdo.',
      },
      {
        title: 'Na fila de atendimento',
        body:
          'Aguarde sua vez em silêncio. Não interrompa incorporações nem diálogos entre guia e consulente. Perguntas diretas ao médium em transe costumam ser mediadas por quem está auxiliando na gira. Siga as orientações que receber — inclusive sobre retorno, firma ou trabalho de casa.',
      },
      {
        title: 'Oferendas e contribuições',
        body:
          'Muitas casas têm caixa para manutenção do terreiro ou orientação sobre oferendas às entidades. Pergunte onde deixar contribuição; não exponha valores nem compare o que você deu com o que outros deram. A relação espiritual não é competição.',
      },
      {
        title: 'Pedido de reza à distância',
        body:
          'Se você não pode ir presencialmente, algumas casas parceiras aceitam pedido de reza pelo Portal de Gestão AxéCloud — com vela virtual e acompanhamento do altar. É outro caminho de conexão, sempre com o mesmo respeito à orientação de cada terreiro.',
      },
      {
        title: 'Depois da visita',
        body:
          'Se a casa orientou retorno, firma ou mudança de hábito, leve a sério. Se você busca aprofundamento na tradição, converse com a diretoria sobre caminhos de permanência — iniciação e vida de terreiro não se decidem em uma única noite. O respeito se constrói na constância.',
      },
    ],
  },
  {
    slug: 'planilha-ou-software-quando-migrar-gestao-terreiro',
    title: 'Planilha ou software: quando migrar a gestão do terreiro',
    summary:
      'Sinais de que cadernos e WhatsApp não bastam mais, o que um software de gestão de terreiro resolve na prática e como fazer a transição sem trauma na casa.',
    publishedAt: '2026-06-28',
    readingMinutes: 7,
    sections: [
      {
        title: 'Planilha funciona — até certo ponto',
        body:
          'No começo, uma planilha no Google Sheets ou anotações no caderno resolvem: poucos filhos de santo, uma gira fixa por semana, mensalidade simbólica. O problema não é a ferramenta — é o momento em que a casa cresce e a informação se espalha entre grupos, prints de Pix e listas de presença em papel.',
      },
      {
        title: 'Sinais de que chegou a hora',
        body:
          'Vale considerar um sistema quando: (1) ninguém sabe ao certo quem pagou a mensalidade; (2) avisos de gira se perdem no WhatsApp; (3) fotos de festas ficam em celulares diferentes; (4) mais de uma pessoa precisa administrar e cada um usa um método; (5) filhos de santo pedem transparência sobre contribuições. São sinais de maturidade da casa, não de “frieza”.',
      },
      {
        title: 'O que muda com um software de gestão',
        body:
          'Um software para terreiro centraliza filhos de santo, calendário, financeiro com Pix, mural, galeria e portal do filho de santo — cada um vê o que precisa, sem expor o que é sigiloso. O zelador deixa de repetir a mesma informação dez vezes e ganha tempo para cuidar do chão do terreiro. Veja como o AxéCloud faz gestão de terreiros em https://axecloud.com.br/.',
      },
      {
        title: 'Como migrar sem assustar a comunidade',
        body:
          'Comece pela diretoria: cadastre filhos de santo, importe o que já existe na planilha e teste o financeiro por um mês. Explique que o sistema não substitui o pai ou a mãe de santo — organiza a burocracia. Ofereça 30 dias de teste antes de cobrar mensalidade do software. No AxéCloud, o trial é completo e sem cartão de crédito.',
      },
      {
        title: 'Compare antes de decidir',
        body:
          'Nem todo software de terreiro entrega o mesmo: alguns cobram por médium, outros não têm portal público ou galeria. Veja o comparativo explícito — planilha vs AxéCloud vs outros sistemas — em https://axecloud.com.br/por-que-axecloud, com tabela de funcionalidades e lista dos 14 módulos reais do plano Premium.',
      },
    ],
  },
  {
    slug: 'como-instalar-axecloud-celular-pwa',
    title: 'Como instalar o AxéCloud no celular (PWA passo a passo)',
    summary:
      'Guia para fixar o AxéCloud na tela inicial do Android ou iPhone como app (PWA) — sem baixar na App Store ou Google Play.',
    publishedAt: '2026-06-28',
    readingMinutes: 5,
    sections: [
      {
        title: 'O que é um PWA',
        body:
          'PWA significa Progressive Web App: o AxéCloud abre no navegador, mas pode ser fixado na tela inicial como um ícone — igual a um app instalado. Funciona para zelador e filho de santo, no Android, iPhone ou computador, com atualizações automáticas quando a casa publica novidades.',
      },
      {
        title: 'No Android (Chrome)',
        body:
          'Abra https://axecloud.com.br no Chrome, faça login como zelador ou filho de santo. Toque no menu (⋮) e escolha “Adicionar à tela inicial” ou “Instalar app”. Confirme o nome — pronto, o ícone aparece na home. Abra por ele nas próximas vezes; a experiência é de app nativo.',
      },
      {
        title: 'No iPhone (Safari)',
        body:
          'Abra o site no Safari (não no Chrome do iOS para este passo). Toque em Compartilhar (quadrado com seta) e “Adicionar à Tela de Início”. O ícone do AxéCloud ficará ao lado dos outros apps. Filhos de santo acompanham mural, giras e mensalidades por ali; zeladores acessam o painel completo.',
      },
      {
        title: 'No computador',
        body:
          'No Chrome ou Edge, acesse o site e clique no ícone de instalação na barra de endereço (ou menu → “Instalar AxéCloud”). Útil para o zelador que administra a casa no notebook do terreiro e quer janela dedicada, sem abas misturadas.',
      },
      {
        title: 'Notificações e atualizações',
        body:
          'Com o PWA instalado, o AxéCloud pode enviar notificações push quando há aviso no mural ou novidade da casa — se você autorizar no navegador. Não precisa atualizar manualmente: o service worker mantém a versão mais recente. Detalhes e comparativo com outros apps de terreiro em https://axecloud.com.br/por-que-axecloud#pwa-head.',
      },
    ],
  },
  {
    slug: 'whatsapp-oficial-vs-grupos-comunicacao-terreiro',
    title: 'WhatsApp oficial vs grupos: comunicação na casa de axé',
    summary:
      'Por que grupos de WhatsApp falham na gestão do terreiro, o que muda com a API oficial Meta e como avisar giras e mensalidades sem spam.',
    publishedAt: '2026-06-28',
    readingMinutes: 6,
    sections: [
      {
        title: 'O limite dos grupos',
        body:
          'Grupos de WhatsApp são ótimos para conversa informal — mas péssimos como sistema de gestão de terreiros: mensagens somem, quem entrou tarde perde avisos, cobrança de mensalidade vira constrangimento público e fotos de gira poluem a timeline. Quando a casa passa de 30 filhos de santo, o caos é quase inevitável. Veja alternativas em https://axecloud.com.br/.',
      },
      {
        title: 'WhatsApp Business vs API Meta',
        body:
          'WhatsApp Business no celular do zelador ajuda, mas ainda depende de uma pessoa enviando manualmente. A API oficial Meta (Cloud API) permite automação controlada: templates aprovados para lembrete de gira, convite com link de confirmar presença, aviso de mensalidade e alerta de estoque crítico — sempre com o nome do terreiro e opt-in do filho.',
      },
      {
        title: 'O que o AxéCloud envia',
        body:
          'Com WhatsApp Meta integrado, o AxéCloud dispara: lembrete quando uma gira é criada ou quando o filho é convidado; aviso antes do vencimento da mensalidade; confirmação quando o pagamento é registrado; alerta de estoque baixo no almoxarifado. Cada terreiro usa seu próprio canal — sem misturar casas.',
      },
      {
        title: 'Privacidade e respeito',
        body:
          'Mensagens vão só para filhos com WhatsApp cadastrado e consentimento da casa. Não é spam em massa: são templates revisados, horários adequados e conteúdo ligado à rotina litúrgica. Cobrança sensível fica no portal privado do filho; o WhatsApp complementa, não expõe.',
      },
      {
        title: 'Grupos ainda têm lugar',
        body:
          'O software não proíbe grupos para conversa fraterna — só tira deles a responsabilidade de ser “sistema oficial”. Use o AxéCloud para avisos, calendário e financeiro; deixe o grupo para acolhimento espiritual e bate-papo. Veja módulos e comparativo em https://axecloud.com.br/por-que-axecloud.',
      },
    ],
  },
  {
    slug: 'melhor-software-terreiro-2026-o-que-avaliar',
    title: 'Melhor software para terreiro em 2026 — o que avaliar',
    summary:
      'Checklist objetivo para escolher sistema de gestão de terreiro: preço, módulos, PWA, portal do filho, WhatsApp, liturgia e prova de que o produto existe de verdade.',
    publishedAt: '2026-06-28',
    readingMinutes: 8,
    sections: [
      {
        title: 'Por que “melhor” depende da sua casa',
        body:
          'Não existe ranking universal. Um terreiro pequeno de Umbanda precisa de calendário, mensalidade e mural; uma casa grande pode exigir loja do axé, almoxarifado, portal público e pedidos de reza. O melhor software para gestão de terreiros em 2026 é o que cobre sua rotina real — sem cobrar extra por cada filho de santo. Compare opções em https://axecloud.com.br/por-que-axecloud.',
      },
      {
        title: 'Checklist de funcionalidades',
        body:
          'Avalie se o sistema tem: financeiro com Pix integrado; portal do filho de santo; calendário de giras com convite RSVP; galeria de fotos; biblioteca de estudos; loja ou cantina; almoxarifado; WhatsApp oficial (não só grupo); app instalável (PWA); termos litúrgicos da sua tradição; ambiente isolado por terreiro (multi-tenant seguro).',
      },
      {
        title: 'Preço e trial',
        body:
          'Desconfie de preço oculto ou cobrança por médium. No mercado brasileiro, planos ficam entre R$ 50 e R$ 120/mês para gestão completa. O AxéCloud cobra R$ 69,90/mês, tudo incluso, com 30 dias grátis sem cartão. Compare valores e módulos em https://axecloud.com.br/por-que-axecloud.',
      },
      {
        title: 'Prova de produto vs promessa',
        body:
          'Peça demo, teste no celular, instale o PWA e veja se os módulos existem hoje — não só no roadmap. Telas reais, comparativo explícito e artigos técnicos (como este hub em https://axecloud.com.br/conteudo) indicam maturidade. Evite sistemas genéricos de “gestão empresarial” adaptados com nomes trocados.',
      },
      {
        title: 'Portal público e visibilidade',
        body:
          'Poucos softwares de terreiro oferecem diretório público, eventos divulgados e portal de pedidos de reza. Se sua casa quer ser encontrada com respeito no Google — sem expor endereço sem consentimento — vale priorizar plataformas que pensam além do ERP interno. O AxéCloud combina gestão + portal AxéCloud em um só produto.',
      },
      {
        title: 'Próximo passo',
        body:
          'Use o comparativo em https://axecloud.com.br/por-que-axecloud e teste 30 dias grátis em https://axecloud.com.br/register — plano Premium completo, sem cartão de crédito.',
      },
    ],
  },
  {
    slug: 'sistema-para-terreiro-guia-completo',
    title: 'Sistema para terreiro: guia completo para organizar sua casa',
    summary:
      'Entenda como escolher um sistema para terreiro de Umbanda ou Candomblé, quais módulos realmente importam e como migrar cadernos, planilhas e grupos sem perder a identidade da casa.',
    publishedAt: '2026-07-18',
    readingMinutes: 9,
    sections: [
      {
        title: 'O que é um sistema para terreiro',
        body:
          'Um sistema para terreiro é uma plataforma criada para centralizar a administração de uma casa de Umbanda, Candomblé, Jurema ou tradição mista. Diferentemente de um ERP genérico, ele precisa entender filhos de santo, giras, obrigações, mensalidades, comunicação da corrente e privacidade litúrgica. O AxéCloud reúne essas rotinas em https://axecloud.com.br/.',
      },
      {
        title: 'Os módulos essenciais',
        body:
          'Antes de contratar, verifique se existem de verdade: cadastro de filhos de santo com permissões, financeiro e mensalidades com Pix, calendário de giras, mural, confirmações de presença, galeria de fotos e vídeos, estoque, biblioteca e portal individual. No AxéCloud, esses módulos fazem parte do mesmo plano e podem ser comparados em https://axecloud.com.br/por-que-axecloud.',
      },
      {
        title: 'Software para terreiro deve funcionar no celular',
        body:
          'A rotina da casa não acontece apenas no escritório. Dirigentes e auxiliares precisam registrar informações pelo celular, enquanto filhos de santo consultam avisos e mensalidades no próprio portal. Um aplicativo instalável como PWA reduz atrito e não depende de loja de aplicativos. Veja como funciona em https://axecloud.com.br/conteudo/como-instalar-axecloud-celular-pwa.',
      },
      {
        title: 'Privacidade e acesso por função',
        body:
          'Dados religiosos, financeiros e pessoais não podem ficar expostos em planilhas compartilhadas. Exija isolamento entre casas, conexão HTTPS, perfis de acesso e trilha de alterações. A pessoa responsável pelo financeiro não precisa enxergar todos os registros litúrgicos; cada filho deve acessar apenas seus próprios dados.',
      },
      {
        title: 'Como migrar sem interromper a casa',
        body:
          'Comece pelo cadastro da diretoria e da corrente, depois configure calendário e financeiro. Importe ou registre os saldos atuais, comunique o novo canal aos filhos e mantenha o processo antigo apenas durante uma transição curta. O objetivo não é digitalizar a desorganização, mas criar uma fonte única e confiável.',
      },
      {
        title: 'Quanto custa e como testar',
        body:
          'Compare preço total, limite de usuários, armazenamento e taxas extras. O AxéCloud oferece plano Premium por R$ 69,90 ao mês, sem cobrança por filho de santo, com 100 GB para fotos e vídeos de cada terreiro. O teste de 30 dias é gratuito e sem cartão em https://axecloud.com.br/register.',
      },
    ],
  },
  {
    slug: 'software-para-terreiro-de-umbanda-recursos',
    title: 'Software para terreiro de Umbanda: recursos que a casa precisa',
    summary:
      'Financeiro, médiuns, giras, comunicação e memória da casa: veja os recursos que diferenciam um software feito para terreiro de Umbanda de uma ferramenta genérica.',
    publishedAt: '2026-07-18',
    readingMinutes: 8,
    sections: [
      {
        title: 'A rotina de uma casa de Umbanda é específica',
        body:
          'Uma casa de Umbanda organiza corrente mediúnica, giras públicas e fechadas, atendimentos, contribuições, materiais e comunicação com muitas pessoas. Por isso, um software para terreiro de Umbanda precisa falar a linguagem da casa e simplificar a rotina sem tentar padronizar sua tradição.',
      },
      {
        title: 'Cadastro de médiuns e filhos de santo',
        body:
          'O cadastro deve reunir contatos, função, vínculo com a casa e permissões de acesso. Cada integrante precisa de um portal privado para acompanhar avisos, calendário e mensalidades. A diretoria mantém a visão administrativa sem expor informações de uma pessoa para toda a corrente.',
      },
      {
        title: 'Giras, calendário e confirmação de presença',
        body:
          'Datas de gira, desenvolvimento, festas e obrigações precisam estar em um calendário único. Convites e confirmações ajudam a organizar escala, assistência e preparo do espaço. O histórico também evita que decisões importantes desapareçam em conversas antigas de WhatsApp.',
      },
      {
        title: 'Financeiro com respeito e transparência',
        body:
          'Mensalidades, doações, entradas e despesas devem ter registros claros e acesso restrito. Pix e comprovantes ligados ao histórico reduzem cobrança manual e constrangimento. A casa ganha previsibilidade sem tratar a contribuição religiosa como uma relação comercial fria.',
      },
      {
        title: 'Comunicação oficial, não só grupos',
        body:
          'Grupos continuam úteis para convivência, mas avisos importantes e lembretes privados pedem um canal rastreável. A integração oficial com WhatsApp evita mensagens perdidas e mantém histórico. Entenda a diferença em https://axecloud.com.br/conteudo/whatsapp-oficial-vs-grupos-comunicacao-terreiro.',
      },
      {
        title: 'Memória da casa com 100 GB',
        body:
          'Fotos e vídeos de giras, festas e momentos importantes formam a memória da comunidade. O AxéCloud inclui 100 GB de galeria para cada terreiro, organizados em álbuns sob controle da gestão. Veja todos os diferenciais e teste o sistema em https://axecloud.com.br/.',
      },
    ],
  },
  {
    slug: 'gestao-financeira-terreiro-pix-mensalidades',
    title: 'Gestão financeira de terreiro: mensalidades, Pix e transparência',
    summary:
      'Guia prático para organizar entradas, despesas, mensalidades e comprovantes Pix do terreiro com privacidade, prestação de contas e menos cobrança manual.',
    publishedAt: '2026-07-18',
    readingMinutes: 9,
    sections: [
      {
        title: 'Por que organizar o financeiro do terreiro',
        body:
          'Água, luz, manutenção, materiais de gira, alimentos e ações sociais dependem de recursos. Quando entradas e despesas ficam em cadernos diferentes, a diretoria perde previsibilidade e a comunidade perde clareza. Gestão financeira é cuidado com a continuidade da casa.',
      },
      {
        title: 'Separe mensalidades, doações e outras entradas',
        body:
          'Registre a origem de cada valor em categorias distintas. Mensalidade ou contribuição recorrente não deve se confundir com doação para uma festa, venda da cantina ou campanha específica. Essa separação permite entender o caixa real e prestar contas sem reconstruir meses de mensagens.',
      },
      {
        title: 'Pix com comprovante ligado ao lançamento',
        body:
          'O pagamento por Pix facilita a contribuição, mas o comprovante não pode ficar perdido no WhatsApp. O ideal é vinculá-lo ao mês, à pessoa e ao lançamento correspondente. Assim a diretoria confere pendências com segurança e o filho de santo consulta o próprio histórico.',
      },
      {
        title: 'Cobrança privada e respeitosa',
        body:
          'Nunca exponha inadimplência em grupo. Use lembretes individuais, registre isenções e acordos e mantenha espaço para conversa humana. O sistema deve apoiar a diretoria, não substituir o bom senso nem a orientação espiritual da casa.',
      },
      {
        title: 'Relatórios para decidir melhor',
        body:
          'Acompanhe saldo, entradas por categoria, despesas recorrentes e evolução mensal. Esses dados ajudam a planejar festas, manutenção e compras sem depender de memória. Permissões por função garantem que apenas pessoas autorizadas acessem valores e comprovantes.',
      },
      {
        title: 'Comece com uma fonte única',
        body:
          'Defina uma data de corte, registre o saldo inicial e passe a lançar toda movimentação em um único lugar. O financeiro do AxéCloud integra mensalidades, Pix e histórico ao portal do filho. Compare com planilhas em https://axecloud.com.br/conteudo/planilha-ou-software-quando-migrar-gestao-terreiro e teste em https://axecloud.com.br/register.',
      },
    ],
  },
] as const;

/** Primeiro artigo — compatibilidade com imports antigos. */
export const PORTAL_ARTICLE = PORTAL_ARTICLES[0];

export const PORTAL_ARTICLE_PATHS: readonly string[] = PORTAL_ARTICLES.map((a) =>
  contentArticlePath(a.slug),
);

/** Artigos da fase SEO — gestão digital, PWA, comparativo (hub /conteudo). */
export const PORTAL_GESTAO_DIGITAL_SLUGS = [
  'planilha-ou-software-quando-migrar-gestao-terreiro',
  'como-instalar-axecloud-celular-pwa',
  'whatsapp-oficial-vs-grupos-comunicacao-terreiro',
  'melhor-software-terreiro-2026-o-que-avaliar',
  'sistema-para-terreiro-guia-completo',
  'software-para-terreiro-de-umbanda-recursos',
  'gestao-financeira-terreiro-pix-mensalidades',
] as const;

export function getPortalGestaoDigitalArticles(): PortalArticle[] {
  return PORTAL_GESTAO_DIGITAL_SLUGS.map((slug) => getPortalArticleBySlug(slug)).filter(
    (a): a is PortalArticle => Boolean(a),
  );
}

export function getPortalArticleBySlug(slug: string): PortalArticle | undefined {
  return PORTAL_ARTICLES.find((a) => a.slug === slug);
}

/** Slug do artigo em `/conteudo/{slug}`; null se não for rota de artigo. */
export function parseContentArticleSlug(path: string): string | null {
  const normalized = path.replace(/\/+$/, '') || '/';
  const prefix = '/conteudo/';
  if (!normalized.startsWith(prefix)) return null;
  const slug = normalized.slice(prefix.length);
  if (!slug || slug.includes('/') || slug === 'glossario') return null;
  return getPortalArticleBySlug(slug) ? slug : null;
}

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
    term: 'Umbanda',
    definition:
      'Religião afro-brasileira que integra, conforme cada linha, elementos de cultos africanos, indígenas e católicos. As giras de incorporação e o trabalho com linhas de entidades são marcas centrais.',
  },
  {
    term: 'Candomblé',
    definition:
      'Religião de matriz africana com nações (Ketu, Jeje, Angola, etc.), culto aos orixás e ritos transmitidos de geração em geração. Cada nação tem liturgia, língua ritual e calendário próprios.',
  },
  {
    term: 'Preto velho',
    definition:
      'Entidade da Umbanda associada à sabedoria, paciência e ancestrality escravizada. Manifesta-se em incorporação com linguagem, postura e conselhos característicos.',
  },
  {
    term: 'Caboclo',
    definition:
      'Entidade da Umbanda ligada à força da mata, ao índio e ao caminho de firmeza. Cada caboclo tem nome, cor e características próprias na linha da casa.',
  },
  {
    term: 'Exu',
    definition:
      'Entidade mensageira entre mundos, guardião de encruzilhadas e caminhos. Na Umbanda e no Candomblé ocupa papel central — não deve ser confundido com estereótipos de mídia; exige respeito e conhecimento da casa.',
  },
  {
    term: 'Ponto',
    definition:
      'Cantiga ou invocação ritmada cantada no início ou durante o culto para chamar entidades, orixás ou linhas. O “ponto riscado” abre a gira em muitas casas de Umbanda.',
  },
  {
    term: 'Firma',
    definition:
      'Conjunto de elementos sagrados — guias, colares, ferramentas, roupas e orientações — que identificam a linha e o compromisso de um filho de santo com sua casa e com o axé recebido.',
  },
  {
    term: 'Iniciação',
    definition:
      'Rito pelo qual alguém passa a integrar oficialmente a casa como filho de santo, com deveres, obrigações e vínculos espirituais definidos pela diretoria e pela tradição daquele terreiro.',
  },
  {
    term: 'Nação',
    definition:
      'No Candomblé, tradição litúrgica de origem (por exemplo Ketu, Jeje, Angola), com repertório de toques, orixás enfatizados e regras ritualísticas próprias.',
  },
  {
    term: 'Ogã',
    definition:
      'No Candomblé, iniciado que toca os atabaques e conduz ritmicamente o toque sagrado, com anos de aprendizado. Função essencial nas festas de santo.',
  },
  {
    term: 'Consulente',
    definition:
      'Pessoa que busca orientação espiritual em uma gira ou consulta, sem ser necessariamente filho de santo daquela casa. Pode tornar-se integrante com o tempo e a orientação da diretoria.',
  },
] as const;
