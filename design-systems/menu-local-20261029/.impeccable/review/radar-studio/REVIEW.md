# Revisão independente — Radar, etapa 14

Laplace recebeu o pedido, as cinco capturas do usuário, quatro capturas desktop/mobile locais, fontes e contrato local. Sem herdar conversa, navegador, edição ou nova execução do detector. Fontes de documentação consultadas na revisão: PRODUCT raiz e código do protótipo. Sem comp aprovado, revisão de extensão code-led. O cartão formal QUALITY BAR e a saída do detector não estavam disponíveis; isso limita o parecer sobre o teto de expressão.

## Disposição inicial: fix

Cinco seções entregues: persistence, fidelity, ceiling, material_fixes, keep. Capturas válidas. Cobertura de identidade, endereço, redes, rotina e galeria independente considerada correspondente ao pedido. Shell aprovado, identidade fotográfica, privacidade e separação salvo/rascunho devem permanecer.

Três correções materiais:

1. Remover foto, descartar rascunho e depois desfazer podia duplicar a foto já restaurada e seu ID.
2. Editar capa e foto apenas selecionava a seção inicial, sem rolar até o editor nem transferir foco.
3. No celular, rotina/localização apareciam somente depois de toda a galeria, notícias e atendimentos.

## Correção em lote

RadarMedia limpa o registro removido quando seu ID volta à galeria e oculta o desfazer nessa situação. Navegador: duas fotos, remover uma, confirmar descarte => duas fotos, zero botão de desfazer, salvar desabilitado por ausência de alteração.

RadarPage mantém ref da região do editor, tabindex -1 e efeito acionado pelo botão de capa: seleciona Identidade, foca a região e rola seu início para a margem do cabeçalho. Navegador: activeElement Identidade pública, topo 110,09px. editor-focus-desktop.jpg inspecionado.

RadarVisitor coloca a lateral antes do conteúdo principal no DOM; CSS mantém as colunas desktop e empilha primeiro próxima gira, horários e localização no mobile. visitor-mobile-fixed.jpg em 390×844 mostra a próxima gira logo após identidade/contato, antes da galeria. visitor-desktop-fixed.jpg confirma a composição desktop preservada. Ambas abertas e inspecionadas.

Após o lote: TypeScript focado saída 0; Vite 1801 módulos concluído em 11,81s. Radar JS 47,24 kB / 13,60 kB gzip, CSS 24,16 kB. Entrada geral 538,35 kB e aviso acima de 500 kB mantidos. Scanner de procedência: seis rasters, zero ausentes. Sem segunda execução do detector.

## Veredito final: ship, limitado aos três ajustes

Laplace marcou os três ajustes como resolved. Confirmou fontes e três capturas novas válidas; reprodução interativa foi reportada pela principal, sem execução independente do revisor. Remaining clear para essa lista, sem regressão material identificada no lote. Não é nova auditoria geral, aceite visual do usuário ou garantia de produção.

A principal restaurou os exemplos, inspecionou radar-final.jpg em 1366×900 e deixou o protótipo disponível para avaliação. Nada foi publicado em produção.
