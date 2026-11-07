# Documentação — Loja da Casa, etapa 12

Registro de 31/10/2026, restrito à extensão local `#store`. Menu e cabeçalho aprovados; Dashboard provisória; todas as extensões com aceite visual pendente. Cada página conserva composição própria dentro do shell aprovado.

## Evidências conferidas

- `PRODUCT.md` da raiz interna, `DESIGN.md` do artefato, `STORE-BRIEF.md`, `STORE-VALIDATION.md` e referência `.agents/skills/impeccable/reference/document.md` do workspace.
- Leitura de `StorePage.tsx`, `store.css`, `shopLogic.ts`, `shop.ts`, verificação pura escrita em `shopLogic.check.mjs` e ligação local em `main.tsx`, `FinancialOverview.tsx` e `finance.ts`. Nenhum código executado nesta passagem.
- `STORE-VALIDATION.md`: oito grupos puros passaram; TypeScript saída 0 e Vite com 1789 módulos após os ajustes. StorePage 20,67 kB, CSS 12,18 kB; entrada geral 532,94 kB com aviso acima de 500 kB. Detector original `[]`, sem repetição.
- `REVIEW.md` escrito pela principal: McClintock encerrou somente os dois achados de `tune` com `ship` limitado à correção local. Não é aprovação visual ou parecer geral de entrega. A principal exercitou o navegador; o revisor não repetiu os testes.
- Correção de edição lida em `save`: `archived` vem do produto existente; `false` somente quando novo. A principal arquivou o colar, editou/salvou, verificou que continuava Arquivado e restaurou explicitamente.
- Correção mobile lida na regra final até 640px: quantidade/Remover e fechar têm mínimo de 44px nos dois eixos. Medições DOM registradas: fechar/menos/mais 44×44px; Remover 57,875×44px. Captura `store-bag-mobile-390-fixed.jpg`.
- `assets/store/ASSETS.md` e fechamento da validação: três imagens de IA identificadas; PNGs originais e WebPs sem perdas, sem edição de pixels. Scan relatado de seis rasters, zero sem metadados; prompts nos PNGs e sidecars WebP. Cerca de 5,2 MiB, sem comprovação de otimização de rede. Scan não reexecutado pelo documentador.

## Capturas locais

Metadados lidos nos arquivos, sem browser. Inspeção visual documental de abertura desktop, sacola mobile corrigida e revisão em 320px; as outras capturas foram inventariadas. Não é novo teste funcional.

| Arquivo | JPEG: largura × altura |
| --- | --- |
| `store-desktop-1920.jpg` | 1914 × 1077 |
| `store-catalog-desktop-1366.jpg` | 1360 × 896 |
| `store-orders-mobile-390.jpg` | 384 × 831 |
| `store-order-detail-mobile-390.jpg` | 384 × 831 |
| `store-bag-mobile-390.jpg` | 390 × 844 |
| `store-bag-mobile-390-fixed.jpg` | 390 × 844 |
| `store-bag-mobile-320.jpg` | 320 × 740 |
| `store-review-mobile-320.jpg` | 320 × 740 |
| `store-local-final.jpg` | 1360 × 1513 |

Os nomes referem-se aos cenários/viewports relatados; as dimensões do JPEG não provam o viewport nem a execução dos fluxos. A principal registra que a captura final mostra o catálogo inicial reiniciado após os testes, viewport restaurado e logs de erro/aviso `[]`. A captura corrigida de 390px documenta o ajuste mobile; as anteriores não foram tratadas como prova posterior ao ajuste.

## Tokens e decisões preservados

Comparação com `style.css` e `store.css`: Inter e os tokens existentes de verde profundo, dourado, canvas, tipografia, raios e espaçamento permanecem. O frontmatter recebeu apenas quatro cores locais adicionais: `store-ink` (`#243c31`), `store-clay` (`#875035`), `store-linen` (`#eae2d5`) e `store-bag` (`#faf9f3`). Não substituem papéis incumbentes nem alteram outras páginas. O sidecar conserva as extensões existentes e acrescenta a regra local, sombra da sacola, hover da foto e dois breakpoints específicos, sem duplicar os primitivos.

Catálogo editorial em três/duas/uma coluna, pedidos expansíveis e sacola lateral/inteira no celular descrevem somente esta página. Centavos inteiros, cópias dos itens, revisão por assinatura e identidade estável do recebimento fundamentam a simulação. Reserva separa estoque sem dívida/receita; cancelar antes da entrega devolve uma vez; reabrir baixa preserva entrega. O pai conserva o estado entre rotas, reiniciado ao recarregar.

## Limites e arquivos alterados

Sem API, armazenamento de negócio, produção, upload real ou Pix real. Caderneta sem crédito compartilhado com Cantina; estoque sem integração com Almoxarifado. Evidências de browser são emulação, sem aparelho físico. Não se conclui prontidão de produção, auditoria integral ou otimização de rede. Todas as extensões continuam com aceite visual pendente.

Escrita exclusiva em `README.md`, `VALIDATION.md`, `DESIGN.md`, `.impeccable/design.json` e este `.impeccable/review/store/DOCUMENTATION.md`, dentro do artefato. `STORE-VALIDATION.md`, `REVIEW.md`, fontes e ativos foram apenas lidos. Sem browser, testes/build, detector/contexto, git ou ações de produção nesta atuação.
