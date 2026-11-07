# Radar — validação da etapa 14

31/10/2026. Somente prévia em `http://localhost:5188/#radar`; testes com exemplos e arquivos sintéticos próprios. Nenhum dado de produção alterado.

## Verificação funcional no navegador

1366×900, 390×844 e 320×740. Sem transbordamento horizontal: em 320px, documento mediu 314px; em 390px, 384px. Menu, cabeçalho e barra inferior preservados. Barra de salvar fica acima do dock; campos e últimos controles da galeria são alcançáveis pela rolagem.

Endereço completo, Maps e duas redes foram editados. Link JavaScript foi recusado; links válidos HTTPS passaram. Antes de salvar, a prévia não continha o novo endereço; depois, endereço e redes apareceram. Ocultar endereço e salvar retirou rua e link Maps da prévia, preservando cidade/UF. Âncoras externas conferidas com target blank e noopener/noreferrer, sem navegação externa.

Capa e retrato selecionados por seletor nativo usando assets próprios. Galeria começou com dois exemplos e recebeu quatro arquivos de uma vez: seis fotos, inclusão desabilitada no limite. Legenda, mover para antes, remoção e desfazer conferidos. A Galeria interna não recebeu a legenda pública; sair e voltar preservou o rascunho. Antes de salvar, visitante continuou com duas fotos e o nome salvo; após salvar, seis fotos e novo nome. Conta privada permaneceu Casa de demonstração. README.md como capa foi recusado, preservando a capa válida anterior. Visualizador aninhado fecha por Escape e mantém a prévia pública aberta.

Horário duplicado foi recusado. Registro pausado saiu da rotina pública; horário de domingo salvo como 09:00–11:00 passou a ser a próxima gira de 01/11/2026. A inspeção encontrou atraso de atualização em campos nativos de horário que usavam somente onChange; ambos receberam onInput e foram reconferidos na prévia com 09:00–11:00. Em 320px, os controles e campos da segunda rotina cabem na largura disponível.

Cancelar descarte preservou o texto digitado; confirmar restaurou o nome salvo. Vazio, carregamento, falha e recuperação conferidos, preservando os exemplos. Logs de erro/aviso retornaram []. Cenários foram reiniciados ao final para deixar a entrega com exemplos identificados.

## Verificação de código

- TypeScript focado em main.tsx e dependências: saída 0 após o ajuste final.
- `node --experimental-strip-types .../radarLogic.check.mjs`: sete grupos aprovados (links, coordenadas/contatos/endereço, rascunho/Files, limites, duplicata/pausa/pernoite, semana/fuso e normalização). Node emite aviso experimental, sem falha.
- Build local Vite: 1801 módulos, concluído em 10,32s. Radar sob demanda 46,89 kB (13,49 kB gzip), CSS 23,95 kB. Entrada geral 538,35 kB, mantendo aviso de chunk acima de 500 kB. Não é build/deploy de produção.
- Detector invocado uma vez em cada um dos quatro TSX alterados. A saída dessa chamada se perdeu na truncagem da ferramenta; não é registrada como lista vazia ou aprovação e não houve segunda execução.
- Imagens reaproveitadas da Galeria: scanner encontrou metadados ausentes, embora ASSETS.md preservasse os prompts. Prompts exatos existentes foram incorporados aos seis PNG/WebP; não houve regeneração, edição de pixels ou utilização de imagens particulares.

## Evidências

`.impeccable/review/radar-studio/`: editor-desktop.jpg, visitor-desktop.jpg, visitor-mobile.jpg, gallery-mobile.jpg, schedule-320.jpg. Capturas iniciais/funcionais inspecionadas. A foto de instrumento e o retrato de flores em capturas de teste são uploads sintéticos, não o estado inicial da entrega.

Revisão independente completa solicitada a Laplace, sem herdar conversa. Resultado e eventual correção constarão em REVIEW.md. A avaliação visual final do usuário permanece pendente.

## Correções da revisão

As três correções materiais foram aplicadas em lote e reconferidas: descarte invalida desfazer para uma foto já restaurada; atalho de capa foca e rola até o editor; próxima gira/horários/localização antecedem a galeria no celular, preservando as colunas do computador. Capturas editor-focus-desktop.jpg, visitor-mobile-fixed.jpg e visitor-desktop-fixed.jpg abertas e inspecionadas. Após o lote, TypeScript saída 0 e build de 1801 módulos em 11,81s, Radar 47,24 kB / 13,60 kB gzip, CSS 24,16 kB; aviso de entrada geral de 538,35 kB mantido. Scanner de imagens: seis rasters, zero metadados ausentes.

Laplace encerrou com disposition ship somente para as três correções listadas, todas resolved; sem novo parecer geral. Captura de entrega radar-final.jpg, 1366×900, conferida com exemplos reiniciados e página no topo. Override de viewport removido e aba marcada como entrega. URL final http://localhost:5188/#radar. Nenhuma alteração de produção, commit ou deploy.
