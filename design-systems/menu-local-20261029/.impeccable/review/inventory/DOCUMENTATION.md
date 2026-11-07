# Documentação — Almoxarifado local

Passagem documental de 30/10/2026, com o papel `impeccable_documenter` aplicado diretamente nesta conversa conforme as instruções degradadas. Extensão do mundo existente, sem redesign, edição de interface ou lançamento de produção. Menu/cabeçalho aprovados e Dashboard com aceite provisório; Almoxarifado aguarda aceitação visual.

## Evidências conferidas

- Instruções lidas antes da escrita: `C:/Users/Lucas A/Desktop/AxecloudV2/.agents/skills/impeccable/reference/degraded/documenter.md` e `reference/document.md`, além de `SKILL.md` e das regras do projeto.
- [INVENTORY-BRIEF.md](../../../INVENTORY-BRIEF.md): modo Operate, extensão do shell, lista contínua e reposição areia/argila, unidades explícitas, controles compactos, estado local e aceite pendente.
- [DESIGN.md](../../../DESIGN.md), [README.md](../../../README.md), [VALIDATION.md](../../../VALIDATION.md) e [sidecar](../../design.json): identidade Inter/verde profundo/dourado, histórico por etapa e schemaVersion 2 com regras em `narrative.rules` (`name`, `body`, `section`). Decisões e valores estabelecidos preservados.
- [inventory.css](../../../inventory.css): painel areia `#f3e6d8`, texto secundário verde `#586f4f` e argila `#775338` nos papéis corrigidos; grade lateral acima de 1240px, empilhamento até esse limite e sobrescritas compactas até 640px. Conferência da cascata por leitura, sem estilos computados ou nova medição de contraste.
- [inventory.ts](../../../inventory.ts): milésimos inteiros; parser com até três casas para kg/L/m e restrição a inteiros para un./maços/garrafas; limites de quantidade; recusa de saldo negativo ou movimento sem alteração; reposição pela diferença até o mínimo e horários de Brasília. O código não soma unidades diferentes.
- [InventoryPage.tsx](../../../InventoryPage.tsx): contadores de itens, filtros, motivo obrigatório, prévia e histórico antes/depois, snapshots de nome/unidade, edição que preserva saldo, remoção/desfazer e lista copiável. Repor abre entrada pré-preenchida; lista e movimento não criam operação financeira. Estado recebido por props/onChange, sem chamada de API ou autenticação nesta página.
- [INVENTORY-VALIDATION.md](../../../INVENTORY-VALIDATION.md): cenários de interface relatados pela principal, inclusive 1,5 − 0,125 = 1,375 kg, unidade indivisível recusada, foco e fluxo em 320px; TypeScript focado e verificações puras aprovados; detector executado uma vez com `[]`. Resultados registrados, não reexecutados.
- [REVIEW.md](REVIEW.md): `fix` inicial por contraste; `ship` final exclusivamente no escopo da correção. Todos os papéis de texto apontados foram resolvidos, com razões relatadas de 4,877:1 a 5,561:1. O revisor conferiu cinco capturas atualizadas e não apontou regressão material de cor. A principal confirmou depois o build Vite de 1770 módulos; o revisor ainda o tinha como pendente durante o parecer. Não equivale a aceite visual ou auditoria integral.
- Inventário de arquivos conferido em `.impeccable/review/inventory/`: `desktop-1920.jpg`, `notebook-1366.jpg`, `mobile-390.jpg`, `mobile-movement-320.jpg`, `mobile-history-320.jpg` e `REVIEW.md`. As imagens não foram abertas nem suas dimensões/frescor avaliados nesta passagem; a avaliação das cinco capturas é atribuída ao revisor.

## Alterações documentais

Resumo e links da décima etapa acrescentados ao README e à validação geral. DESIGN recebeu três tokens de cor com escopo de inventário, explicação de composição e uma regra por unidade. O sidecar recebeu somente essa regra, com o mesmo texto e a estrutura existente; nenhum token foi duplicado no JSON. Esta escrita não promove composição local às demais páginas.

Conferência documental após a escrita: JSON parseado com sucesso, schemaVersion 2 preservado, seis regras narrativas no total (uma nova), corpo da regra idêntico em DESIGN e sidecar e links locais dos cinco documentos resolvidos. Esta conferência apenas lê os documentos; não executa o protótipo ou suas verificações funcionais.

Arquivos escritos exclusivamente: `README.md`, `VALIDATION.md`, `DESIGN.md`, `.impeccable/design.json` e este `DOCUMENTATION.md`, dentro do artefato. `INVENTORY-VALIDATION.md` e `REVIEW.md` foram apenas lidos e continuam sob responsabilidade da principal. Nenhum navegador, build, TypeScript, teste de quantidade, detector, deploy ou comando git foi executado. O carregador de contexto não foi acionado; o contexto existente foi lido diretamente para respeitar o escopo documental e a fronteira de escrita.

## Resumo do sistema em cinco linhas

Paleta: verde profundo, dourado pontual e corpo claro; areia, verde secundário e argila restritos ao inventário.
Tipo: Inter herdada; título interno de estoque 26px na base, 29px no desktop amplo e 20px no celular após a cascata final; busca mobile de 16px e números tabulares.
Composição: bancada contínua e reposição lateral, empilhadas até 1240px; controles compactos até 640px.
Regra existente: Composição por função preserva a essência da casa e a navegação comum.
Regra adicionada: The Estoque por unidade Rule mantém unidade explícita, saldo antes/depois, lista sem operação financeira e aceite visual pendente.

## Pendências e divergências preexistentes preservadas

- Aceite visual do inventário pendente; `ship` fecha somente a constatação de contraste. Não há pendência remanescente dos papéis de texto apontados na revisão.
- Aviso de bundle acima de 500 kB (aproximadamente 504 kB minificados/142 kB gzip), ausência de teste em aparelho físico, volume grande e uso simultâneo permanecem nos limites relatados. Não foram tratados como novos tokens, regras ou autorização de integração.
- A descrição/abertura de DESIGN e o título do sidecar ainda descrevem Dashboard como validada sem explicitar o caráter provisório, e resumem apenas algumas áreas anteriores. README/Escopo e os parágrafos iniciais de VALIDATION também antecedem várias extensões e seus aceites. Os registros posteriores por etapa contextualizam essa evolução; não foram reescritos os resumos históricos nesta extensão.
- `generatedAt` do sidecar permanece em 29/10/2026 e não representa a data desta adição. A extensão mantém o sidecar mínimo existente; não migra nem completa metadados ou componentes de outras etapas.
- Nenhum defeito adicional foi canonizado ou corrigido: esta passagem é documental e não substitui inspeção visual, auditoria completa ou revisão de código independente.
