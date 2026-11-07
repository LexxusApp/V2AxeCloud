# Almoxarifado — prévia local

Etapa de 30/10/2026. Escopo restrito a esta pasta e à rota local #inventory. Menu, cabeçalho e barra inferior aprovados preservados. Nova composição em avaliação visual; nenhuma publicação ou integração de produção autorizada nesta etapa.

## Composição

Lista contínua de estoque, com quantidade, unidade, mínimo e localização. Área de reposição em areia/argila ao lado no desktop; abaixo da lista no celular. Resumo inline e duas visões: Prateleiras e Movimentações. Sem repetir a grade de quatro indicadores. Categorias do sistema atual preservadas: Camarinha, Rituais, Cozinha de Santo, Vestuário e Limpeza.

Todos os exemplos são sintéticos. Unidades diferentes não são somadas. Quantidades são inteiros em milésimos de cada unidade, evitando erros acumulados de ponto flutuante. kg, L e m aceitam até três casas; unidades, maços e garrafas exigem inteiro. A lista de reposição calcula somente o que falta para o mínimo cadastrado.

## Fluxos exercitados pela interface

- Repor Água mineral 500 ml abriu entrada de 12 garrafas. Motivo vazio foi recusado. Após confirmar, saldo 0→12; itens a repor passaram de 3 para 2 e esgotados de 1 para 0. Histórico guardou item, motivo, antes/depois e horário de Brasília.
- Saída de 2 kg de café com saldo de 1,5 kg foi recusada. Saída de 0,125 kg resultou em 1,375 kg, com movimento −0,125 e saldo anterior/final exatos no detalhe.
- Conferência do café para zero foi aceita com motivo e gerou novo histórico. Não admite estoque negativo.
- Nome duplicado “cafe em po” foi recusado apesar da ausência de acentos. Unidade indivisível com quantidade 1,5 foi recusada.
- Novo “Material de teste” com seis unidades e mínimo dez foi criado. Editar mínimo para quatro preservou saldo e unidade, que ficam bloqueados no cadastro existente. O item ficou Em dia.
- Remover exigiu confirmação, preservou histórico e permitiu Desfazer. Ao navegar para Galeria e voltar, o registro restaurado permaneceu com seis unidades. Busca por localização sem acento encontrou o item.
- Busca sem resultado mostrou recuperação por Limpar filtros. Categoria Vestuário exibiu Toalha branca. Atenção primeiro apresentou esgotados antes dos demais.
- Copiar lista mostrou confirmação e o clipboard foi conferido: café 1 kg, arruda 2 maços, vela 6 unidades, com saldo e mínimo por item. Nenhuma mensagem ou compra enviada.
- Vazio, carregamento, erro e Tentar novamente foram exercitados. Os controles de demonstração alteram somente a exibição.
- Em 320px, entrada de água com motivo e quantidade foi confirmada pela interface. Histórico mostrou +12 garrafas e 0→12. A entrega final foi reiniciada nos oito exemplos iniciais.

## Responsividade e foco

Conferidas larguras 1920, 1440, 1366, 390 e 320px. ScrollWidth observado 1914, 1360, 384 e 314 nas quatro larguras registradas por medição. Sem overflow horizontal observado. Capturas em .impeccable/review/inventory/.

A primeira composição mobile deixava o primeiro item em y≈924. A abertura foi compactada sem mudar a topbar: resumo em uma linha, controle Movimentar com ícone e nome acessível, subtítulo repetido omitido, categoria e ordenação lado a lado. O primeiro item passou a y≈629 em 390px. A barra inferior é preservada e conteúdo abaixo dela permanece alcançável por rolagem nativa com padding do shell.

Em 320×740, diálogo tem largura 288px entre x=16 e x=304, sem overflow horizontal e com rolagem vertical interna. Quantidade, motivo, saldo antes/depois e confirmação continuam alcançáveis. Fechar Lista de reposição devolveu foco a Ver lista de compras. Rótulos acessíveis nos botões de entrada, saída, edição e movimento. Busca e formulário mobile usam 16px. Movimento reduzido previsto no CSS. Não é teste em aparelho físico ou auditoria completa de acessibilidade.

## Verificações e limites

TypeScript focado e build Vite isolado concluídos. Detector Impeccable rodado uma vez em InventoryPage.tsx: []. Console sem erros ou avisos nos cenários exercitados. inventory.check.mjs passou: cálculo fracionado exato, formato, limites, estoque negativo, zero, mínimo e ausência de mutação no cálculo.

O build de toda a prévia avisa que a entrada principal passou de 500 kB após minificação (aprox. 504 kB, 142 kB gzip). É um aviso de tamanho, não erro de compilação. Divisão de código deverá ser considerada na integração; não alteramos a arquitetura da aplicação real para silenciar esse aviso.

Registros de negócio somente em memória; recarregar reinicia exemplos. Reposição não cria compra ou despesa no financeiro. Não há API, permissões reais, banco, envio de WhatsApp ou sincronização com Cantina/Loja. O histórico guarda snapshots de nome/unidade mesmo após edição ou remoção do cadastro. Não há teste de volume grande ou uso simultâneo.

Revisão independente e eventuais correções registradas em .impeccable/review/inventory/REVIEW.md após conclusão.


## Fechamento da revisão

Revisão independente por McClintock: primeira leitura solicitou correção de textos secundários com contraste abaixo de 4,5:1. A correção foi aplicada em um lote, o build refeito e as cinco capturas atualizadas. Parecer final ship no escopo dessa correção; todas as funções de texto apontadas foram resolvidas, com razões de 4,877:1 a 5,561:1. Evidência em [REVIEW.md](.impeccable/review/inventory/REVIEW.md). Não se infere novo aceite visual. O aviso de tamanho do bundle permanece documentado acima.
