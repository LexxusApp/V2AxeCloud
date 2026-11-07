# Validação da integração local — etapa 17

Escopo e matriz de comparação de informações: INTEGRATION-BRIEF.md. Inventário de 57 estruturas de modal em 22 arquivos: MODAL-INVENTORY.json. Não equivale a homologação das APIs, do portal real ou de produção.

## Verificações automatizadas
- TypeScript focado passou (saída 0), incluindo módulos lazy da prévia.
- billing.check.mjs: 14 grupos passaram. Juros fixos/percentuais de aplicação única em centavos, arredondamento, validações de valores/membro/data/competência, duplicidade, edição pendente, baixa/data do acerto/receita única, reabertura, lançamento já quitado, renomeação por ID, cantina, loja, limite/bloqueio compartilhado e soma de entrada/saída.
- cantinaHistory.check.mjs: sete grupos passaram; snapshots e recebimentos idempotentes preservados.
- shopLogic.check.mjs com --experimental-strip-types: oito grupos passaram; reserva, conversão, estoque, recebimento, reabertura e entrega.
- completion.check.mjs com --experimental-strip-types: seis grupos passaram; datas, assinatura e validação de contato/pedido.
- libraryAccess.check.mjs com --experimental-strip-types passou; destinatário exato, público explícito e falha fechada quando não identificado.
- Build final Vite: 1.815 módulos. Aviso preexistente de entrada acima de 500 kB continua; não é falha de compilação. Resultado completo registrado no handoff.
- Detector: uma execução por arquivo, 24 arquivos, zero achados primários e 80 orientações consultivas. JSONs e detector-summary.json preservados; não houve segundo scan. Alterações posteriores de ligação de props não foram tratadas como uma nova aprovação do detector.

## Navegador — fluxos executados
- R$ 100 + 2% = R$ 102, com vencimento 10/09/2026 e vínculo a Mariana: pendentes R$ 400 → R$ 502, caixa manteve R$ 800. Mensalidades e prévia financeira do membro exibiram setembro/R$ 102/base100/juros2; outubro permaneceu quitado/R$200.
- Baixa do mesmo lançamento em 31/10: pendentes voltaram a R$400; quitadas R$1.302; caixa R$902; uma receita de R$102 em31/10, mantendo competência setembro.
- Entrada manual R$25,50: caixa800→825,50. SaídaR$5: caixa825,50→820,50. Vínculo de entrada identificado por membro, sem criar dívida.
- Cantina: 1 café R$3,50 anotado para Mariana com itens/quantidades no extrato. Aviso e limite abrem com os dados do mesmo membro.
- Limite compartilhado ajustado paraR$40: compraLojaR$45 recusada, considerando R$3,50 de Cantina. Reserva permitida semdívida; conversão dareserva emcaderneta também recusada pelolimite; recebimento àvista permitido.
- Upload local de foto da Loja decodificou, exibiu Lendo e verificando arquivo, impediu salvar durante leitura e gravou blob na peça. PDF demonstrativo emobrigação validou, salvou e abriu link local. Não houve upload remoto.
- Gira comlimite1: primeira senha emitida, segunda desabilitada. Formulário mantém destaque epreferência de lembrete.
- Pix: salvar sugestãoR$125,50/dia15 preencheu novo formulário com125,50 e15/10. As oito contribuições existentes mantiveramR$200; pendentes continuaramR$400. Dados dePix configurados também alimentam prévia do membro.
- Perfil junto aosino abriu conta ecasa e WhatsApp na seção correta, inclusive quando já estava emConfigurações. Botõesde assinatura esuporte navegam. Desktopcontou umrecolher/umexpandir, card.house-switch=0.
- Pedidos decriação usam confirmação deconsumo, evitando perder primeiroclique durante carregamento ou reabrir modal antigo aoretornar àrota. Editores deBiblioteca/Loja e oito outraspáginas abrem pelo primeirocomando na conferênciafinal.
- Logs de erro consultados ao final: [].

## Tamanhos e apresentação
Desktop1366×900 e monitor1920×1000. No celular390×844 e320×740, 14famílias de modal foram abertas efechadas porEscape: membro,gira,obrigação,comunicado,mensagens,galeria,estoque,biblioteca,produto,lançamento,mensalidade,suporte,assinatura e perfilpúblicoRadar. Todas dentro do viewport, semoverflowhorizontal. Registros emmobile-modal-checks.json e narrow-modal-checks.json; Suporte final tem6campos.

Janelas longas rolam internamente. Após inspeção desktop/mobile, um lote corrigiu o cabeçalho fixo para cobrir todo o topo, conservando título e fechar sem campos passando por cima. As capturas finais desktop.png e mobile.png foram abertas pela principal; narrow-320.png, user-1920.png e profile-mobile-320.png mostram formulário, monitor do usuário e perfil móvel. Dock preservado. Formulários têm erro, estado vazio/carregamento de avaliação, foco e retorno de conclusão; leitura de arquivos tem progresso real. Movimento reduzido por CSS, sem porcentagens fictícias.

## Limites preservados
Somente arquivos da prévia. Sem API, login real, cobrança, envio, backend, banco, deploy, commit, push ou desligamento do computador. Reload reinicia exemplos e arquivos em memória. A biblioteca privada e a visão financeira são simulações de interface; autorização real será implementada no servidor apenas na futura integração aprovada. Os demais dados de demonstração são identificados. Aceite visual do usuário permanece pendente.

## Correção da revisão independente

Bernoulli retornou **fix** por um caso material: editar uma receita manual e convertê-la em mensalidade manteria a receita antiga junto da cobrança. A conversão foi bloqueada: Mensalidade não aparece durante edição de movimento do caixa; uma guarda no salvamento também recusa o caso. A criação própria de mensalidade permanece disponível. Teste no navegador: entrada de R$ 100 elevou saldo de R$ 800 para R$ 900; editar e salvar manteve R$ 900 e as oito mensalidades anteriores. Nova cobrança própria de setembro, R$ 100 + 2%, elevou somente pendências de R$ 400 para R$ 502. Evidência: cash-edit.png e recapturas desktop.png/mobile.png.

A primeira recaptura móvel teve falha do mecanismo de captura após resize (390×257), detectada pela principal ao abrir a imagem; foi substituída no mesmo caminho pela captura válida de 390×844, também aberta visualmente. O veredito final deve considerar somente a captura corrigida. Não houve alteração visual adicional nem segundo detector.

Veredito final de Bernoulli: **ship**, restrito à correção material e sua evidência visual. A recaptura opaca de cash-edit.png foi aprovada. Build final após a guarda: 1.815 módulos / 11,37 s; entrada 586,20 kB (171,15 kB gzip); CSS 282,04 kB. TypeScript focado 0. Cantina e Loja foram novamente verificadas após a alteração do crédito compartilhado: sete e oito grupos passaram. Sem alteração de fonte após esse fechamento.
