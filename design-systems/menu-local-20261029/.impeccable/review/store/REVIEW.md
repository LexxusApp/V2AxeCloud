# Revisão independente — Loja local

McClintock, sem herdar histórico da conversa. Leu brief, validação, PRODUCT herdado da raiz, DESIGN local, fontes e seis capturas. Não editou arquivos nem usou navegador. Testes são evidências fornecidas pelo implementador, não reproduzidas pelo revisor.

## Disposição inicial

tune — dois ajustes delimitados: controles de sacola de 36px abaixo da meta de toque do projeto; editar produto arquivado o restaurava silenciosamente por gravar archived:false.

## Correções

1. store.css: botões de quantidade/remoção e fechar sacola com mínimo 44×44px em mobile. Medição DOM no navegador: fechar/minus/plus 44×44, remover 57,875×44. Captura store-bag-mobile-390-fixed.jpg.
2. StorePage.tsx save: preserva archived do registro existente, false somente no novo. Teste de navegador arquivou Colar, editou descrição e salvou; permaneceu Arquivado com ação Restaurar. Só a restauração explícita o ativou.

## Veredito sobre a lista de correções

ship no escopo do protótipo local. Os dois itens foram considerados resolvidos pela inspeção do código e captura final; o revisor não repetiu o teste de navegador. Não é uma nova auditoria geral ou validação de produção. Aceite visual é do usuário.

Preservar catálogo editorial, lista de pedidos e sacola adaptada; shell aprovado intacto. Reservas reduzem estoque livre sem dívida/receita; pendências separadas do caixa; recebimentos com identidade estável; cancelamento repetido não devolve estoque novamente. Inspeção estática não identificou bloqueador nesses caminhos. Limites de integração em STORE-BRIEF.md.
