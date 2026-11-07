---
name: "AxéCloud — prévia local de menu e cabeçalho"
description: "Prévia local iniciada em 29/10/2026, etapa 14 com estúdio do Radar e 19 destinos: menu e cabeçalho aprovados, Dashboard com aceite provisório; extensões com avaliação visual pendente; sem publicação."
colors:
  usability-canvas: "#f3f5f6"
  usability-ink: "#192c25"
  usability-secondary: "#505e59"
  people-action: "#245ba1"
  people-surface: "#edf4ff"
  finance-action: "#88520b"
  finance-surface: "#fff4db"
  agenda-action: "#6942a0"
  agenda-surface: "#f3edfc"
  communication-action: "#09676a"
  communication-surface: "#e7f5f4"
  library-action: "#5e4694"
  commerce-action: "#984a2d"
  welcome-surface: "#dfeee4"
  welcome-action: "#efbe45"
  forest: "#122d23"
  financial-balance: "#153d2d"
  financial-pending: "#f6de98"
  financial-inflow: "#448566"
  financial-outflow: "#bf7156"
  monthly-open: "#f4dfa9"
  cantina-summary: "#f1e8d8"
  pix-preview: "#1a3b2c"
  obligation-next: "#e5ecd9"
  obligation-attention: "#f3d9bd"
  attendance-lead: "#213f45"
  notices-featured: "#ecd8c7"
  messages-canvas: "#eff3e8"
  messages-own: "#dfead5"
  messages-selected: "#e7eeda"
  gallery-filter: "#e6eedb"
  gallery-viewer: "#17231a"
  gallery-line: "#dfe5d5"
  inventory-replenish: "#f3e6d8"
  inventory-secondary: "#586f4f"
  inventory-clay-secondary: "#775338"
  library-private-surface: "#eee8f4"
  library-private-secondary: "#6a567b"
  library-sage-cover: "#e1e8d0"
  library-forest-cover: "#1e4233"
  store-ink: "#243c31"
  store-clay: "#875035"
  store-linen: "#eae2d5"
  store-bag: "#faf9f3"
  completion-secondary: "#5d6d60"
  completion-line: "#d9e1d4"
  radar-map-surface: "#d8e1c5"
  radar-chart-bars: "#92ab76"
  subscription-contract: "#183c2c"
  subscription-paper: "#fcfaf2"
  settings-selected: "#e7ecdf"
  settings-channel: "#e4f0e6"
  support-surface: "#eee9f2"
  support-action: "#665273"
  gold: "#e9bd53"
  ink: "#1d3027"
  canvas: "#f4f6f3"
  surface: "#fff"
  line: "#e6ebe5"
  muted: "#66746c"
  secondary-text: "#626f5d"
  nav-text: "#bbcec0"
  nav-icon: "#a3bba9"
  nav-active-text: "#203326"
  nav-child-active-text: "#f1d98f"
  dock-active: "#f4f0dd"
  dock-active-text: "#2c4631"
  primary-hover: "#284a36"
  secondary-hover: "#f3f6ed"
  gold-hover: "#f2cd72"
  positive-text: "#256448"
  positive-bg: "#eaf4ed"
  warning-text: "#8d600c"
  warning-bg: "#fdf3d9"
  negative-text: "#a76058"
  focus: "#b58419"
  search-focus: "#a57914"
  overlay: "#10251d52"
  disabled-bg: "#e9eee5"
  disabled-text: "#617158"
typography:
  body:
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "16px"
    fontWeight: 400
    lineHeight: "normal"
    letterSpacing: "normal"
  headline:
    fontFamily: "Inter"
    fontSize: "30px"
    fontWeight: 650
    lineHeight: 1.2
    letterSpacing: "-0.035em"
  title:
    fontFamily: "Inter"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "-0.02em"
  button:
    fontFamily: "Inter"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "normal"
  navigation-laptop:
    fontFamily: "Inter"
    fontSize: "14px"
    fontWeight: 450
    lineHeight: 1.4
    letterSpacing: "normal"
rounded:
  badge: "6px"
  field: "8px"
  control: "9px"
  card: "12px"
  surface-mobile: "14px"
  surface: "16px"
  dialog: "18px"
  sidebar: "20px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "20px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.forest}"
    textColor: "{colors.surface}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "10px 16px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-gold:
    backgroundColor: "{colors.gold}"
    textColor: "#183024"
    rounded: "{rounded.control}"
    padding: "10px 16px"
  nav-active:
    backgroundColor: "{colors.gold}"
    textColor: "{colors.nav-active-text}"
    rounded: "{rounded.control}"
    padding: "11px 14px"
  surface:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.surface}"
    padding: "25px"
  badge-positive:
    backgroundColor: "{colors.positive-bg}"
    textColor: "{colors.positive-text}"
    rounded: "{rounded.badge}"
    padding: "5px 8px"
---

# Design System: AxéCloud — prévia local

## Overview

Registro descritivo exclusivo deste protótipo local. **Menu e cabeçalho aprovados visualmente pelo usuário; Dashboard com aceite provisório; preservar essa base nas próximas páginas da prévia.** Todas as extensões, incluindo Loja, Biblioteca de Estudos e lista/perfil de Filhos de Santo, aguardam avaliação visual; integrações não foram realizadas; esses aceites não autorizam publicação nem alterações no aplicativo de produção.

A etapa 13 completou os 19 destinos, incluindo Radar, Minha assinatura, Configurações e Suporte, e permanece como histórico. Na etapa 14, o estúdio fotográfico de gestão pública supera a composição anterior do Radar dentro do mesmo mundo visual. A revisão limitada de Laplace encerra três correções, sem promover a extensão a desenho aprovado; o aceite visual do usuário permanece pendente.

Extração de `style.css` e `main.tsx`, ampliada pelas folhas locais das extensões, incluindo `completion.css` e, na etapa 14, `radar-studio.css`, com limites operacionais conferidos nos registros de `serve.mjs` e `README.md`. Referência de formato: `.agents/skills/impeccable/reference/document.md` do workspace. Os valores acima registram a implementação; não são uma nova proposta de tokens. O sidecar contém somente extensões. Evidências e pendências estão em `VALIDATION.md`.

Diretriz adicional do usuário em 29/10/2026: as próximas páginas devem ter mais ousadia visual, elementos, cor e organização própria, mantendo a essência da casa e a navegação comum. As páginas anteriores permanecem para revisão posterior; não devem ser uniformizadas automaticamente com cada nova composição.

**Key Characteristics:**

- Navegação verde profunda com dourado pontual e corpo claro.
- Inter obrigatória; hierarquia compacta para tarefas da casa.
- Barra inferior preservada no celular; Mais abre o menu completo em drawer.
- Dados e operações identificados como demonstração local.

## Colors

### Primary

`forest` estrutura lateral, drawer, barra inferior e ação principal. `gold` destaca o item principal ativo e ações pontuais. Subitem ativo usa `nav-child-active-text` sobre branco translúcido (`#ffffff09`), preservando a hierarquia do grupo; não recebe o mesmo preenchimento do item principal.

### Neutral

`canvas`, `surface`, `ink` e `line` separam fundo, painéis, leitura e divisórias. `secondary-text` é a correção final aplicada às descrições, rodapés de métricas e outros textos auxiliares; `muted` ainda existe e é usado, por exemplo, nos detalhes do perfil. Não confundir a declaração original com a cor efetiva após a cascata.

### Estados

Badges positivos e de atenção usam os pares `positive-*` e `warning-*`; saídas do livro financeiro usam `negative-text`. Seleção mobile usa `dock-active` e `dock-active-text`. Foco geral usa `focus`; buscas usam `search-focus`. Desabilitados mantêm opacidade plena com `disabled-bg` e `disabled-text`.

### Extensão local do Almoxarifado

Os três tokens `inventory-*` registram papéis reutilizados somente nesta página em avaliação: `inventory-replenish` é a superfície areia do painel de reposição; `inventory-secondary` identifica textos auxiliares verdes, incluindo abas inativas, localização, mínimo, cabeçalhos e rótulos de saldo; `inventory-clay-secondary` identifica descrição, notas e detalhes auxiliares no painel areia. Os dois textos secundários correspondem à correção de contraste registrada em `.impeccable/review/inventory/REVIEW.md`. Não substituem `secondary-text`, `muted` ou os papéis das outras páginas e não constituem aprovação de identidade de produção.

### Extensão local da Biblioteca

Os quatro tokens `library-*` descrevem somente a Biblioteca em avaliação: `library-private-surface` é a superfície lilás da nota de acervo individual; `library-private-secondary` é o texto auxiliar dessa nota; `library-sage-cover` identifica capas de Cantigas e o tom padrão; `library-forest-cover` identifica capas de Fundamentos. Areia, menta e lilás também distinguem assuntos nas capas existentes. São capas tipográficas de identificação, não miniaturas do PDF. Esses papéis não substituem os tokens globais, não indicam proteção de arquivo e não alteram catálogo ou plano de produção.

**The Acervo individual local Rule.** Na Biblioteca local, usar lilás para sinalizar o acervo individual e manter a audiência explícita no card e no leitor. Iniciar cadastros como privados, exigir destinatário por ID e confirmar transferência ou ampliação de acesso. Na prévia de membro, limitar listas, contagens, assuntos, busca, detalhe, leitura e download ao conjunto permitido. Preservar o shell aprovado e o aceite visual pendente; a cor e o filtro local não constituem autenticação ou proteção de armazenamento.

### Extensão local da Loja

Os quatro tokens `store-*` registram somente a etapa 12 em avaliação. `store-ink` corresponde ao texto verde da página; `store-clay` ao destaque editorial e aos preços; `store-linen` ao fundo das imagens e do estado Sem foto; `store-bag` à superfície clara da sacola. Os dois primeiros vêm das variáveis locais de `store.css`, os demais de superfícies repetidas nessa folha. Preservam os valores implementados e não substituem `forest`, `gold`, `ink`, `canvas`, `surface`, tipografia, raios ou espaçamentos existentes. Imagens de exemplo são identificadas como IA, sem representar produtos reais da casa.

### Extensões locais de Radar e Conta

Os tokens acrescentados na etapa 13 vêm de `completion.css` e valem somente para os quatro novos módulos em avaliação. `completion-secondary` e `completion-line` registram as variáveis de texto auxiliar e divisórias comuns dessas páginas. `radar-map-surface` distingue o mapa esquemático e `radar-chart-bars` as barras de dados ilustrativos. `subscription-contract` e `subscription-paper` separam contrato e revisão da renovação. `settings-selected` marca a seção ativa do índice e `settings-channel` o bloco de conexão simulada. `support-surface` e `support-action` identificam a orientação lilás e a ação de pedido local. Não substituem tokens do shell nem representam status de produção. Nenhuma nova escala de cor foi sintetizada.

Na etapa 14, os papéis de cor do mapa são históricos: o Radar atual usa a abertura fotográfica e o editor descritos abaixo; não se deve reconstruir sua abertura a partir dos tokens de mapa. Os valores locais de `radar-studio.css` preservam verdes, tons quentes e conteúdo claro; não foram promovidos a nova paleta global nem tiveram deriva incidental reparada.

## Typography

Inter é obrigatória em toda a prévia. A folha importa os pesos 400, 450, 500, 550, 600, 650, 700 e 750 via Google Fonts; os fallbacks do frontmatter são contingência. A disponibilidade da fonte depende desse carregamento externo, embora não haja integração de dados.

`body` descreve a base do documento, não um tamanho uniforme de todos os textos. Cabeçalho de página (`headline`): 30px no desktop intermediário, 34px a partir de 1600px, 28px até 920px e 26px abaixo de 360px. Título de seção (`title`): 16px de base, 19px no desktop amplo e 17px até 640px. Descrição de página: 13px em laptop e celular pequeno, 14px no desktop amplo; entre 641–920px permanece 12px.

Navegação: 14px entre 921–1599px, 15px a partir de 1600px; subitens 12px e 13px, respectivamente. Drawer: 15px, passando a 14px até 640px; subitens 13px. Rodapé das métricas: 11px no laptop, 12px no desktop amplo, 10px até 640px e 9px abaixo de 360px. Buscas e campos usam 16px no celular até 640px. Valores financeiros usam algarismos tabulares.

O Radar da etapa 14 mantém Inter. O nome salvo usa 32px na base, 38px a partir de 1700px e 23px até 760px; títulos do editor usam 27px e 24px até 760px. Na prévia pública, nome de 28px cai para 23px até 760px. São papéis locais observados em `radar-studio.css`, sem alteração da escala tipográfica normativa do shell.

## Layout

Lateral fixa: largura base 272px, 238px entre 921–1240px e 284px a partir de 1600px. O estado recolhido declara 76px; regras posteriores de mídia também redefinem essa variável. Cabeçalho sticky: 80px de base, 88px no desktop amplo, 72px até 920px e 68px até 640px. Conteúdo com máximo de 1700px, deslocado pela largura da lateral mais 24px; padding horizontal de 36px de base e 42px no desktop amplo.

Até 920px, a lateral desaparece, o conteúdo ocupa a largura e a barra inferior oferece Início, Corrente, Giras, Financeiro e Mais. O drawer mede `min(340px,90vw)`. Reservas inferiores de 104–105px no conteúdo e `safe-area-inset-bottom` na navegação evitam encobrir ações.

Métricas usam quatro colunas; até 640px, duas. Blocos de destaque, cuidados e cantina passam a uma coluna no celular; a linha do tempo fica vertical. Abas financeiras têm rolagem horizontal própria. Até 359px há redução adicional de margens e densidade. Breakpoints exatos estão no sidecar.

Na Loja, a grade editorial tem três colunas, duas até 1150px e uma até 640px; a abertura passa de duas colunas para uma no celular. A sacola fica à direita, com largura `min(510px,100%)`, conteúdo com rolagem interna e total/ações no rodapé. Até 640px, o atalho flutuante fica acima da navegação inferior com reserva de área segura. Até 360px, Catálogo/Pedidos/Sacola permitem quebra de linha. São regras desta página, sem alterar a composição das demais.

Historicamente, na etapa 13, Radar combinava apresentação e mapa na proporção 1:1,15, com gráfico e canais abaixo em 1,55:1. Configurações usa índice lateral de 240px e editor branco. Assinatura divide contrato e revisão em 0,9:1,3, seguida de histórico expansível. Suporte usa índice de 280px e lista de orientações/pedidos. Até 1100px, as colunas compactam e o gráfico do Radar passa a uma coluna; até 760px, os quatro arranjos se empilham e campos de formulário se reorganizam. A partir de 1700px, aumentam os espaços internos e os índices de Configurações/Suporte passam a 290/330px. Estes limites são locais; a navegação continua mudando no breakpoint aprovado de 920px.

Na etapa 14, a capa salva tem 290px de altura (340px a partir de 1700px; 220px até 760px), identidade/retrato sobrepostos e ações de visitante/visibilidade. A bancada usa índice de 190px mais editor flexível, com intervalo de 28px; a partir de 1700px passa a 220px/38px, até 1100px a 175px/20px. Até 760px, o índice vira faixa de seções com rolagem horizontal própria e o formulário usa uma coluna. Galeria de edição: duas colunas, três a partir de 1700px e uma até 760px. Estes breakpoints coincidem com `completion-wide`, `completion-compact` e `completion-stacked` no sidecar, sem alterar a navegação a 920px.

A prévia pública usa largura `min(1100px,95vw)` e rolagem interna. Conteúdo principal e lateral ficam em 1,6:1 no desktop; embora a lateral venha primeiro no DOM, a grade a posiciona à direita. Até 760px, empilha próxima gira, horários e localização antes da galeria e demais conteúdos; o diálogo ocupa 98vw. A barra local de salvar fica sticky a 16px da base, passando a `calc(87px + env(safe-area-inset-bottom))` até 760px, acima do dock.

## Elevation & Depth

Painéis usam borda fina e separação tonal. Cabeçalho de base translúcido (`#ffffffbd`) com blur de 16px; no mobile, fundo branco. Sombras aplicadas ao diálogo, drawer, barra inferior e toast ficam no sidecar. A variável CSS `--shadow` existe, mas não é aplicada por referência nesta folha e não foi promovida a token de elevação usado.

Overlays e diálogos entram em 150–180ms, drawer em 200ms; hover apenas com ponteiro fino e suporte a hover. `prefers-reduced-motion: reduce` remove animações e transições. Não há animação obrigatória para compreender um estado.

A sacola da Loja usa sombra lateral própria, registrada no sidecar. Fotos usam ampliação discreta de 1,015 em hover e transição de 200ms; a preferência por movimento reduzido remove esse efeito. Isso descreve comportamento implementado, sem evidência de otimização de rede.

Na etapa 13, Radar e Conta usavam separação tonal e divisórias, sem nova sombra estrutural. O indicador do interruptor WhatsApp transita por 150ms com `ease`; a regra local de movimento reduzido remove transições e animações nas quatro páginas.

Na etapa 14, o diálogo de visitante acrescenta a sombra `radar-public-dialog` do sidecar, extraída literalmente de `radar-studio.css`; não altera a elevação do shell. Overlay público e visualizador usam camadas distintas (130/131 e 160/161), com visualizador de fundo verde profundo e imagem inteira em contain. A regra local de movimento reduzido remove animação, transição e rolagem suave nos três contextos.

## Shapes

Controles suavemente arredondados (`control`), badges menores (`badge`), métricas (`card`) e painéis (`surface`). Painéis no celular usam `surface-mobile`; diálogos e lateral têm raios próprios. Campos têm borda de 1px; avatares pequenos e marcadores usam círculos. Ícones Lucide mantêm traço de 1,7.

Na etapa 14, o Radar usa cantos de 16px na abertura salva, 12px no editor e 15px no diálogo público (11px até 760px); o retrato salvo tem cantos de 17px na base. São dimensões da composição local, sem substituir os raios globais.

## Components

- **Botões:** mínimo de 42px de altura na base e 44px no desktop amplo, com exceções contextuais. Primário verde; secundário branco com contorno interno; dourado em ações pontuais. Pressionar desloca 1px; estado desabilitado impede a ação.
- **Campos e busca:** campos com mínimo de 44px; busca de membros em contêiner de 42px. Foco geral: contorno de 3px com afastamento de 4px. Inputs de busca sobrescrevem para 2px, afastamento de 4px e raio de 2px. O título focável usa 2px com afastamento de 5px.
- **Painéis e métricas:** superfície branca, borda `line`, padding de painel 25px de base, 28px no desktop amplo e 22px no celular, reduzido a 20px abaixo de 360px. Métricas são botões que abrem a área correspondente.
- **Navegação e cabeçalho:** reutilizam `buildZeladorNavEntries('umbanda')` e `flattenZeladorNavEntries` de `src/constants/appNav.ts`. Mantêm nomes, destinos e grupos Casa/Financeiro, Gestão da casa e Conta e suporte. Nenhuma mudança de dados, rotas ou planos é autorizada por este documento. Busca de módulos via Ctrl/Cmd+K; navegação da prévia por hash e histórico.
- **Drawer e diálogos:** Radix Dialog, títulos e descrições acessíveis, restauração de foco ao acionador quando disponível e fallback para título da página. Escape deve devolver foco a Mais ou Buscar no sistema nos fluxos registrados em `VALIDATION.md`.
- **Demonstração:** todos os 19 destinos da navegação têm páginas locais na etapa 13; os avisos de destinos futuros pertencem ao histórico das primeiras etapas. Pix não gera cobrança nem QR Code. Avisos, preceito, baixa, caderneta, assinatura, publicação e pedidos só simulam estado.

A extensão de Filhos de Santo usa `MembersPage.tsx` e `members.css`, com regras restritas à página. O resumo superior é uma faixa dividida; a lista e os cuidados ficam lado a lado em desktop amplo. Até 1240px, os cuidados passam abaixo da lista; até 640px, cada linha mantém nome, função, registro, acesso e mensalidade em duas linhas. O perfil separa identidade, ações, registro e vínculo; no celular, as seções usam quatro botões em uma grade de duas colunas, sem depender de rolagem lateral. Campos e formulários usam 16px no celular. Novo cadastro, edição e anotações são simulações em memória compartilhadas entre as páginas locais. A ação de acesso apenas explica o fluxo; não gera credenciais ou mensagens. Obrigações não são inventadas na evolução espiritual. Nenhuma nova regra visual foi promovida a produção.

A extensão de Giras usa `GirasPage.tsx` e `giras.css`. Agenda e calendário ficam lado a lado em desktop amplo; até 1240px, empilham. O detalhe do encontro separa presenças, preparação, aviso e operação. No celular, os quatro controles de seção usam duas colunas. Campos mobile mantêm 16px. As datas têm referência explícita de Brasília, e os mesmos dados demonstrativos alimentam a Dashboard e o perfil. O calendário é navegação funcional, não uma textura decorativa. Rascunhos e senhas indicam sua condição local.

A visão geral financeira usa `FinancialOverview.tsx` e `financial-overview.css`. Os tokens `financial-*` são papéis desta área local, ainda pendente de aceite: verde no saldo, dourado nas pendências, verde/terracota no fluxo. A grade assimétrica dedica a primeira coluna a saldo e cuidados do caixa e a segunda ao movimento e extrato. No celular, a ordem é saldo, fluxo, pendências, extrato e atalhos. A faixa de quatro métricas das outras áreas não é usada aqui. Abas financeiras em duas colunas até 640px mantêm os quatro destinos visíveis. Gráfico, extrato e cálculos derivam dos mesmos dados sintéticos. A composição específica não é uma nova regra a copiar para todos os módulos.

As três áreas financeiras usam organização própria. `MonthlyPage.tsx` combina um resumo dividido dourado/branco com lista expansível e orientação lateral. `CantinaPage.tsx` usa uma faixa de totais areia, cardápio com ilustrações coloridas e uma comanda fixa ao lado no desktop, empilhada no celular. A caderneta agrupa consumos pelo identificador estável do membro e mantém itens, quantidades, preço unitário e total. `PixSettingsPage.tsx` separa formulário em etapas e prévia em verde profundo. Não se repete a grade da visão geral do caixa. As folhas CSS são restritas a cada área; `WorkflowUI.tsx` reúne apenas controles e diálogos comuns. Valores ilustrativos de outubro seguem em R$ 200,00; editar o valor sugerido do Pix não altera cobranças já criadas. A persistência continua em memória, inclusive catálogo e configuração de teste.

A etapa de Casa preserva o shell aprovado e usa três arranjos. `ObligationsPage.tsx` destaca próximo compromisso em sálvia, atrasos em damasco e lista com blocos de data, incluindo ano. Compromissos usam identificador do membro e aparecem na evolução do perfil sem preencher fundamentos religiosos. `AttendancePage.tsx` usa azul profundo esverdeado na abertura e separa seletor de encontro e chamada; o histórico usa linhas expansíveis e percentuais derivados dos registros concluídos. Confirmação de intenção e comparecimento têm estados independentes. `NoticesPage.tsx` usa uma abertura editorial em argila clara, arquivo de mensagens e rascunhos laterais; público e prévia são operáveis localmente. `house.ts` reúne somente modelos e exemplos sintéticos. No celular, a ordem é orientada à tarefa; todos os dados e controles continuam alcançáveis por rolagem nativa. Formulários usam controles de 16px e diálogos com altura limitada e rolagem interna. Não há envio nem publicação de produção.

`MessagesPage.tsx` usa uma composição de operação contínua: caixa de conversas clara à esquerda e histórico com leitura/escrita à direita. Seleção em sálvia, mensagem da zeladoria em verde suave e mensagem recebida branca; nenhuma indicação online ou de entrega é inventada. No celular, a lista e a conversa são etapas distintas. Ao abrir uma conversa, somente o título da página e a nota repetida cedem espaço ao histórico; cabeçalho e barra inferior aprovados permanecem. O estágio de conversa distribui aviso e conteúdo por flex, mantendo o compositor acima da barra; em pouca altura, os campos compactam e há rolagem interna como fallback. Datas são agrupadas por dia e exibidas em Brasília. Ordenação usa instantes numéricos, inclusive ao misturar dados de exemplo com offset e mensagens novas em UTC. Rascunhos e anexos são por conversa, em memória. O histórico é focável por teclado, e a busca devolve foco ao acionador ao fechar. Nenhum layout anterior foi substituído por este arranjo.

A Galeria usa `GalleryPage.tsx`, `gallery.ts` e `gallery.css`, com organização por imagens: álbum dominante e duas coleções laterais, depois pilha vertical no celular. Os tokens `gallery-*` são locais desta página, ainda em avaliação. Títulos e descrições ficam fora da foto; no visualizador verde profundo, a imagem aparece inteira. Capas geradas por IA são identificadas e não representam registros de uma casa real. O usuário pode criar álbum vazio, usar exemplos ou selecionar arquivos locais; não há upload remoto. Legenda, capa e Meu Axé alteram somente a sessão. Totais derivam dos registros; não há quota ou interações sociais fictícias. Formulários e visualizador usam rolagem interna em pouca altura, foco restaurado e respeito a movimento reduzido. Originais preservados, runtime WebP sem perdas. Detalhes de procedência e limites estão em assets/gallery/ASSETS.md e GALLERY-VALIDATION.md. Não há nova regra de layout promovida às outras páginas.

O Almoxarifado usa `InventoryPage.tsx`, `inventory.ts` e `inventory.css`: bancada branca em lista contínua, resumo inline e reposição em areia/argila, sem a faixa de quatro métricas. Cada linha associa item, categoria, localização, saldo, unidade e mínimo a ações de saída, entrada e edição. Prateleiras e Movimentações compartilham a área principal; o histórico mostra diferença e saldos antes/depois, com números tabulares e horários de Brasília. O cadastro existente preserva saldo e unidade; movimentar exige motivo. kg, L e m aceitam até três casas decimais por cálculo em milésimos inteiros; un., maços e garrafas exigem inteiros. A lista de compras pode ser copiada e calcula apenas a falta até o mínimo; Repor abre uma entrada local, sem compra ou despesa financeira.

A grade mantém reposição ao lado acima de 1240px e a empilha abaixo da lista até esse limite. Até 640px, o resumo fica em uma linha, Movimentar usa ícone com nome acessível, descrições repetidas cedem espaço aos itens e categoria/ordenação ficam lado a lado sob a busca. Inputs e seletores de busca usam 16px; ações de linha e movimento mantêm altura mínima de 44px no celular. As regras finais compactas prevalecem sobre as declarações mobile anteriores. A navegação aprovada permanece; a validação existente registra rolagem interna do diálogo em 320px, sem novo teste nesta documentação. Evidências e limites: `INVENTORY-VALIDATION.md` e `.impeccable/review/inventory/REVIEW.md`.

**The Estoque por unidade Rule.** No Almoxarifado local, usar lista contínua e painel de reposição areia/argila, com controles compactos no celular. Exibir quantidade e mínimo por unidade, sem somar unidades incompatíveis; registrar saldo antes/depois nas movimentações. Lista de compras não cria operação financeira. Preservar o shell aprovado, o estado de negócio em memória e o aceite visual pendente desta página.

A Biblioteca usa `LibraryPage.tsx`, `LibraryPdf.tsx`, `library.ts`, `libraryAccess.ts` e `library.css`: índice lateral de assuntos e capas tipográficas por categoria, com acervos comum/individual separados e lilás no privado. A grade tem três colunas, duas até 1450px e uma até 640px; até 1050px, o índice passa acima da coleção. Capas usam títulos Inter de 29px na base, 28px até 1450px e 32px até 640px (30px abaixo de 360px), com peso 500 e entrelinha 1,25. Cards e nota privada têm cantos de 12px; campos mobile usam 16px. Destinatário por ID, privado por padrão e confirmação Antes/Depois governam o fluxo local; ausência de destinatário bloqueia o cadastro e prévia inválida recebe vazio. O leitor modal exibe páginas reais via PDF.js sob demanda, com página, zoom, texto extraído e download; zoom rola dentro do quadro. Seleção nativa valida PDF de até 20 MB, e File/estado permanecem em memória entre rotas, reiniciando ao recarregar. Os exemplos são sintéticos próprios; capas não reproduzem páginas. O compartilhamento individual é distinto do FundamentosAcervo e do acesso por plano de produção, que não foram modificados. Autenticação e armazenamento privado dependem do contrato futuro em `LIBRARY-INTEGRATION.md`. Evidências em `LIBRARY-VALIDATION.md` e `.impeccable/review/library/REVIEW.md`: Hume retornou `ship` apenas no escopo local, sem correções materiais; avaliação visual da Biblioteca pendente, sem promoção deste arranjo às outras páginas.

A Loja usa `StorePage.tsx`, `store.css`, `shopLogic.ts` e `shop.ts`: catálogo editorial com fotografias ilustrativas em linho, preços argila, categorias em cápsulas e pedidos expansíveis. Fotografias usam `object-fit:contain`, cantos de 16px e identificação de IA fora da foto. O título editorial varia de 30–48px na base e usa 33px no celular; títulos dos produtos têm 22px, 25px a partir de 1700px e 23px até 640px. Campos mobile usam 16px. A sacola Radix tem título/descrição, Escape e retorno de foco ao acionador ou ao título da página como fallback. A regra final até 640px dá mínimo de 44×44px aos botões de quantidade, Remover e fechar a sacola; não é afirmação sobre todos os controles da página.

O estado de negócio fica em `main.tsx`, conservado entre rotas e reiniciado ao recarregar. Novo produto começa ativo; salvar um existente conserva `archived`, sem restaurá-lo implicitamente. Valores usam centavos inteiros; pedidos guardam cópias de nome/preço/quantidade. Revisão compara assinatura da sacola antes de confirmar. Reservas separam estoque sem dívida/receita; Pix e caderneta aguardam recebimento. O caixa deriva uma entrada estável por pedido pago; `FinancialOverview.tsx` recebe pendências da Loja separadas das reservas. Entrega, cancelamento antes da entrega e reabertura da baixa são estados locais; não há limite compartilhado com Cantina, estoque compartilhado com Almoxarifado, upload real ou Pix real. Evidências e limites: `STORE-VALIDATION.md` e `.impeccable/review/store/REVIEW.md`; o parecer final encerra somente as duas correções apontadas, sem aceite visual da extensão.

**The Catálogo e pedido local Rule.** Na Loja local, preservar catálogo editorial com imagens identificadas, preços argila, pedidos expansíveis e sacola adaptada. Editar conserva o estado arquivado; restaurar exige ação explícita. Reserva separa estoque sem dívida ou receita; recebimento gera uma entrada estável por pedido no caixa de teste. No celular, quantidade, Remover e fechar a sacola têm mínimo de 44×44px. Preservar o shell aprovado, o estado em memória e o aceite visual pendente.

Registro histórico da etapa 13, superado no Radar pela etapa 14 abaixo: o fechamento usava `RadarPage.tsx`, `SubscriptionPage.tsx`, `SettingsPage.tsx` e `SupportPage.tsx` sob demanda, com `completion.ts` e `completion.css`. Radar tinha mapa SVG identificado como ilustrativo, visitas de 7/30 dias, perfil, atendimentos e publicações; a regra de dimensionamento atingia apenas o SVG filho direto do mapa, preservando o MapPin de 16×16px na legenda. Sua prévia de visitante usava conteúdo salvo e escondia conteúdo quando o perfil estava oculto. Configurações tem índice e editor com salvar/descartar, foto File local, identidade, canal e acesso. A seleção usa borda lateral e fundo tonal; até 760px, a área do input do interruptor WhatsApp mede 48×44px, com trilho visual menor e label clicável. Isso não define um mínimo universal para toda a página.

Assinatura usa contrato verde, revisão areia, seleção de ciclo e histórico em linhas expansíveis; registro pendente e confirmação são etapas distintas. O demonstrativo TXT identifica simulação e ausência de validade fiscal. Suporte tem busca com foco lilás, assuntos, guias com passos e atalhos e pedidos locais com complementos e encerrar/reabrir. Nenhuma dessas composições deve substituir automaticamente as demais. Não há novo raster, mapa remoto ou integração.

Nome da casa, conexão WhatsApp simulada e visibilidade do Radar vêm do pai e alimentam a Dashboard. Configurações e o perfil do Radar mantêm rascunhos no pai entre rotas; a prévia usa apenas o salvo. O detalhe da Dashboard lê a conexão recebida e explica que nenhum aparelho ou envio real existe. A principal confirmou os dois estados da conexão e a separação entre rascunho preservado e prévia salva no navegador; James encerrou com `ship` somente os dois ajustes revisados, sem nova auditoria geral ou aceite visual. Todos os dados de negócio reiniciam ao recarregar, sem autenticação, cobrança ou envio real. Evidências e limites: `COMPLETION-BRIEF.md`, `COMPLETION-VALIDATION.md`, `.impeccable/review/completion/REVIEW.md` e `.impeccable/review/completion/DOCUMENTATION.md`.

**The Radar e Conta locais Rule.** Preservar o estúdio fotográfico do Radar da etapa 14, contrato e livro de renovações na Assinatura, índice e editor em Configurações e orientações lilás no Suporte. Manter rascunho separado do salvo e identificar conexão, publicação, renovação e pedido como simulações. Preservar os 19 destinos, o shell aprovado e o aceite visual pendente das extensões; a validação final cabe à principal.

### Radar — estúdio público, etapa 14

`RadarPage.tsx` coordena abertura salva, índice de sete seções, barra de salvar/descartar e estados demonstrativos; `RadarProfileEditor.tsx` edita identidade, endereço/contato, rotina e galeria. Desempenho, Publicações e Atendimentos conservam os fluxos locais. `RadarMedia.tsx` cuida de Files, leitura validada e URLs temporárias; `RadarVisitor.tsx` apresenta somente o estado salvo e imagem inteira em diálogo aninhado. `radarLogic.ts` concentra validações e próxima ocorrência em America/Sao_Paulo; `radar.ts` fornece pátio/flores ilustrativos identificados como IA. `radar-studio.css` amplia a composição existente, sem substituir shell ou tokens globais.

Capa usa cover e enquadramento selecionável; retrato usa contain. O atalho Editar capa e foto seleciona Identidade pública, foca a região e rola até ela, com margem superior de 110px. Foco local de botões/links e região usa contorno de 3px e afastamento de 4px. Botões de ordenar/remover e fechar os diálogos têm mínimos de 44px no CSS, sem afirmar esse mínimo para toda a página. Formulários e diálogos conservam rótulos e rolagem interna; a imagem inteira fecha sem encerrar a prévia subjacente nos cenários informados.

A foto pública é independente da conta; Usar foto da conta é ação explícita. Galeria pública tem até seis fotos, legendas, ordenação e remoção/desfazer; descarte elimina o desfazer residual se a foto já foi restaurada, impedindo duplicação. Capa/galeria aceitam PNG/JPEG/WebP de até 8 MB; retrato até 5 MB; decodificação entre 64×64 e 24 megapixels. Arquivos ficam em memória entre rotas; URLs são revogadas ao trocar/desmontar. Recarregar reinicia o exemplo.

Endereço completo/Maps/coordenadas são validados e reservados quando a visibilidade de endereço está desligada; visitante vê cidade/UF. Redes aceitam HTTPS sem credenciais, domínio correspondente nas quatro redes conhecidas e HTTPS para site. Até 14 horários semanais, pausa, duplicata de dia/início recusada e próxima gira calculada por fuso; término igual ou anterior ao início é dia seguinte. Não cria agenda interna nem geocodificação. Publicações/atendimentos/visibilidade têm controles próprios, enquanto Salvar perfil governa identidade/endereço/rotina/galeria. O pai conserva salvo e rascunho, e o visitante recebe apenas o salvo.

Exemplos reaproveitam os arquivos de pátio/flores da Galeria, mantendo registros públicos separados da coleção interna. Prompts exatos e procedência em `assets/gallery/ASSETS.md`; atualização de metadados PNG/sidecars WebP e scan seis/zero foram informados pela principal, sem nova execução documental. Sem compressão, upload remoto, autenticação, API ou produção. Evidências atuais: `RADAR-STUDIO-BRIEF.md`, `RADAR-STUDIO-VALIDATION.md` e `.impeccable/review/radar-studio/REVIEW.md`. Laplace encerrou três correções como `resolved` e `ship` somente nessa lista; sem nova aprovação geral ou visual do usuário.

**The Radar público salvo Rule.** No Radar local, abrir com capa, retrato e identidade salvos e organizar a gestão em sete seções. Exibir somente o salvo na prévia de visitante; manter a galeria pública independente da Galeria interna e copiar a foto da conta apenas por ação explícita. No celular, antecipar próxima gira, horários e localização à galeria. Preservar Inter, floresta, dourado e shell aprovado; a composição da etapa 14 aguarda aceite visual do usuário.

## Do's and Don'ts

- **Do** manter composição adequada à função e expressão de cor em cada página, conforme pedido do usuário, preservando a identidade e a navegação comuns.
- **Do** manter Inter, verde profundo, dourado pontual e conteúdo claro nesta prévia.
- **Do** preservar a barra inferior mobile e Mais abrindo o drawer com Financeiro/Cantina acessível.
- **Do** identificar dados simulados e manter operações em memória; somente o recolhimento persiste no localStorage da origem local.
- **Don't** promover estes tokens a identidade de produção sem aceite explícito do usuário.
- **Don't** modificar dados, rotas ou planos de produção ou tratar o fechamento dos 19 destinos locais como autorização de integração.
- **Don't** adicionar proxy de API, PWA, backend ou persistência de dados de negócio a este protótipo.


## Usabilidade do piloto publicado, 01/11/2026

A solicitação atual autoriza contraste e cores semânticas na interface original da 5188. `usability.css` amplia a paleta sem substituir os layouts: azul para pessoas, âmbar para financeiro, violeta para agenda/estudos, turquesa para comunicação/Radar e argila para comércio. Verde e dourado continuam na marca e navegação comum. O início abre diretamente no card de boas-vindas, com Ver corrente e Novo movimento. O menu móvel fica ao lado da logomarca, abre pela direita e usa grupos independentes, recolhidos a cada abertura. Banner, rodapé sobre a prévia e seletores de estados de demonstração deixam de integrar a interface. A ativação em produção permanece exclusiva do usuário e tenant autorizados, sem alteração de seleção ou rotas. Esta seção supera as restrições históricas de interface sem backend e sem publicação para esse piloto; não autoriza liberação geral. Evidências técnicas em artifacts/pilot-release-20261101; inspeção visual em navegador permanece pendente por indisponibilidade da ferramenta nesta sessão.
