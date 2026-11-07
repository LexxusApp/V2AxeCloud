# Mensagens — prévia local

Etapa concluída em 30/10/2026. Escopo restrito a `design-systems/menu-local-20261029`. Pedido: próxima página, com visual e organização próprios. Menu, cabeçalho e barra inferior aprovados preservados. Tela de Mensagens ainda em avaliação visual.

## Composição e conteúdo

Caixa de conversas e histórico lado a lado no computador. No celular, abrir uma conversa troca a lista pelo histórico; voltar restaura a lista e o foco no título. Superfície contínua com seleção em sálvia, mensagens recebidas brancas e mensagens próprias em verde suave. Sem grade de indicadores ou abertura idêntica às outras páginas.

Dados de exemplo com datas absolutas, agrupadas por dia e horários de Brasília. Mensagens próprias indicam “Na prévia”; nenhum visto de entrega, presença online ou leitura do destinatário foi inventado. Contagem do menu é calculada a partir das conversas não lidas e não arquivadas.

## Fluxos conferidos pela interface

- Rascunho de Mariana permaneceu ao abrir Joana e voltar. Enter adicionou uma única mensagem e limpou o campo; Shift+Enter manteve a quebra de linha.
- Abrir Joana reduziu não lidas de duas para uma no menu. Abrir Rafael zerou o número e removeu o badge. Filtro Não lidas mostrou “Tudo lido por aqui”.
- Falha simulada preservou o conteúdo na mensagem com indicação de erro. Tentar novamente alterou o estado sem duplicar a mensagem.
- Anexo PNG usando apenas o símbolo público do projeto apareceu na prévia, com nome, tamanho e visualização. A imagem continuou disponível após remonte do componente. Nenhum arquivo privado foi utilizado.
- Arquivar conservou histórico e rascunho; abrir em Arquivadas exibiu orientação para restaurar. Restaurar retornou a conversa a Todas com o mesmo rascunho.
- Grupo sem nome/participantes suficientes foi recusado. Grupo “Equipe de organização” criado com Mariana e Joana; detalhes mostraram as duas participantes e uma mensagem local.
- Contato André, sem acesso no exemplo, permaneceu desabilitado; Beatriz, com acesso, pôde iniciar nova conversa. Seu rascunho continuou disponível ao navegar para Giras e voltar a Mensagens.
- Busca interna por “Segunda linha” exibiu uma mensagem correspondente. Fechar a busca devolveu foco ao botão Buscar nesta conversa.
- Vazio, erro, recuperação e carregamento por esqueleto foram exercitados. Os exemplos e rascunhos permaneceram preservados.

Anexos aceitos pela implementação: PNG, JPEG, WebP, PDF e TXT, até 5 MB. Apenas o fluxo PNG foi exercitado nesta etapa. Arquivos ficam como objetos File na memória; URLs de visualização têm limpeza no desmontar e são recriadas ao retornar. Não existe upload remoto.

## Responsividade e acessibilidade

Verificadas larguras 1920, 1366, 390 e 320px. Em 1366px, clientWidth/scrollWidth 1360; em 390px, 384; em 320px, 314. Nenhum overflow horizontal observado.

Em 320×740, compositor terminou em y=643 e a barra inferior começou em y=663. Em 390×500, o primeiro ensaio mostrou parte do compositor abaixo da barra; campos e espaçamentos foram compactados. Após correção, compositor em y=403 e barra em y=423, com as ações acessíveis. Avisos passaram a usar altura distribuída por flex; no cenário de falha testado após ajuste, não houve sobreposição observada. Em alturas ainda menores, a composição prevê rolagem interna como fallback, sem alegar teste em aparelho físico ou teclado real.

Lista e histórico têm rolagem nativa. Histórico focável por teclado. Diálogos incluem título/descrição e restauração de foco; retorno da conversa móvel levou foco a “Sua caixa de conversas”. Campos de escrita e busca mobile usam 16px. Movimento reduzido respeitado.

Contraste pontual: texto de mensagem própria 8,481:1; recebida 10,559:1; nota do compositor 5,110:1. Resumo da conversa selecionada foi escurecido após medir 4,227:1. Verificação pontual não constitui auditoria completa de acessibilidade.

## Verificação e limites

TypeScript focado e build Vite isolado concluídos sem erros; build com 1761 módulos. Detector Impeccable executado uma vez na nova página: `[]`. Console do navegador sem avisos ou erros durante os cenários.

Capturas em `.impeccable/review/messages/`: desktop, notebook, lista e conversa mobile, 320px e cenário de pouca altura. Algumas mostram operações de teste; a aba final usa novamente os exemplos iniciais.

Conferência própria em modo degradado, preservando a indisponibilidade de revisão independente das etapas anteriores. Parecer em `.impeccable/review/messages/SELF-REVIEW.md`. Não há aceite visual ou autorização de publicação desta página.

Protótipo em memória, reiniciado ao recarregar. Não integra API de mensagens, banco, envio, notificações, áudio, vídeo, disponibilidade online, confirmação de entrega ou leitura de destinatário. O número de não lidas é uma propriedade local da caixa da zeladoria. A fase não migra nem altera o chat de produção.
