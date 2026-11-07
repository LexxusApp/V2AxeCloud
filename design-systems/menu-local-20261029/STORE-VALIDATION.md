# Conferência da Loja local

Data: 31/10/2026, Brasília. Escopo: somente design-systems/menu-local-20261029, URL http://localhost:5188/#store. Nenhuma publicação, API, banco, cobrança ou mensagem real.

## Verificações executadas

- TypeScript focado em main.tsx: saída 0 após corrigir estreitamento da união ShopResult.
- shopLogic.check.mjs: 8 grupos passaram. Centavos, data local, quantidade/estoque inválidos, revisão desatualizada, membro obrigatório, imutabilidade, idempotência, snapshots, conversão de reserva, cancelamento único, entrega/reabertura e receita única.
- Build Vite: 1789 módulos, sucesso. Entrada geral 532,94 kB; aviso acima de 500 kB permanece. StorePage carregada separadamente. Imagens ~5,2 MiB sem otimização final de rede.
- Detector executado uma vez para StorePage.tsx: [] (não constitui auditoria completa).
- Navegador IAB: colar 1 × R$45 + vela 2 × R$12 = R$69; reserva exigiu membro; reserva não gerou pendência; convertida em caderneta gerou R$69; recebimento refletiu uma entrada Loja no Financeiro vinculada a Mariana; entrega preservada ao reabrir baixa. Cadastro sem foto R$19,90/3 unidades, arquivar, filtrar arquivados, restaurar e busca conferidos. Escape fecha sacola e devolve foco ao botão de abertura.
- Estados sem registros, carregando, falha e recuperação conferidos pela interface. Exibição de esgotado e botão indisponível presentes.
- 1920×1080, 1366×900, 390×844 e 320×740 inspecionados. A sacola cabe em 320. Excesso de largura no grupo Catálogo/Pedidos/Sacola corrigido com quebra abaixo de 360px; conferência posterior 314px de scrollWidth para viewport 320px. Barra inferior aprovada preservada, sacola móvel fica acima dela.

## Capturas

Em .impeccable/review/store/: store-desktop-1920.jpg (abertura); store-catalog-desktop-1366.jpg (rolado, produtos e botões, inclui produto cadastrado em teste); store-orders-mobile-390.jpg (abertura da visão Pedidos, não detalhe); store-order-detail-mobile-390.jpg (detalhe e ação alcançáveis); store-bag-mobile-390.jpg; store-bag-mobile-320.jpg; store-review-mobile-320.jpg (revisão e botão de confirmar).

Somente emulação de viewport; não teste em aparelho físico. Sem auditoria de concorrência, API, autenticação, autorização, persistência, integração bancária ou limite de crédito. Dados de negócio demonstrativos. Revisão independente e aceite visual são distintos.

## Fechamento da revisão

McClintock apontou dois itens, corrigidos: edição preserva o estado arquivado e controles de quantidade/remoção/fechar têm mínimo 44×44px em mobile. Conferidos pela interface; detalhes e veredito limitado à lista em .impeccable/review/store/REVIEW.md. Captura adicional store-bag-mobile-390-fixed.jpg. TypeScript e build reexecutados após as correções: sucesso, 1789 módulos, StorePage 20,67kB e CSS12,18kB; aviso da entrada geral continua. Detector não reexecutado.

Captura store-local-final.jpg mostra catálogo inicial completo, sem pedidos de teste, em desktop1366. O catálogo foi reiniciado após os testes, viewport restaurado e aba marcada para entrega. Logs de erro/aviso do navegador retornaram [].

Procedência dos ativos: prompts exatos em assets/store/*-prompt.txt, embutidos nos PNGs e sidecars de WebP pelo comando embed-prompt. Scan: 6 rasters, 0 missing. Nenhuma alteração de pixels nesta etapa de metadados.
