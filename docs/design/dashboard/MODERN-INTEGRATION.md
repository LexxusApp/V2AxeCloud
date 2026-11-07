# Integração da interface aprovada

Iniciada em 31/10/2026, a pedido do usuário. Referência: `design-systems/menu-local-20261029`. Operate; preservar a composição aprovada (Inter, verde floresta, dourado, superfícies claras e layouts próprios por módulo). Não importar estado, exemplos ou confirmações simuladas do protótipo para produção.

## Contrato
- Manter sessão, isolamento entre casas, papéis, rotas públicas, portal do filho, assinatura e APIs existentes.
- Liberação local explícita por `?interface=modern`; ambiente publicado só ativa com `VITE_MODERN_DASHBOARD=true` depois da validação. O parâmetro local não muda acesso ou permissões.
- Incorporar menu/cabeçalho ao shell autenticado; nunca trocar a entrada do aplicativo pelo protótipo independente.
- Reutilizar controladores e ações reais. Indicador global acompanha requisições em andamento, sem porcentagem ou sucesso inventados.
- Corrigir as incompatibilidades documentadas em `SUBSTITUTION-AUDIT.md`, com testes de contratos e autorização.
- Não publicar, alterar dados reais ou derrubar sessões durante implementação local.

## Estado em 01/11/2026

**Substituição de produção ainda não liberada.** A implementação reutiliza a aplicação autenticada, sem importar a entrada de demonstração. A navegação e a visão geral financeira modernas estão integradas; isso não significa que as 19 composições aprovadas já foram portadas integralmente.

### Correção de fidelidade após os prints do usuário

O usuário rejeitou a aplicação 5191 porque o menu moderno havia sido combinado com a página inicial antiga. A aprovação visual é a prévia **5188**, e os testes funcionais anteriores não constituem aprovação de fidelidade. A porta 5190 é somente uma ferramenta interna de conferência, não uma entrega alternativa de design.

Em 01/11, o Início passou a renderizar `ModernDashboard.tsx` com o controlador e os dados existentes de `Dashboard.tsx`. A estrutura foi portada de `design-systems/menu-local-20261029/DashboardPage.tsx`: título, boas-vindas claras, quatro indicadores, gira/Radar, faixa de preceito, atenção/atalhos, ativação e linha do tempo. O script `scripts/sync-modern-dashboard-style.mjs` copia e isola os estilos aprovados em `modern-dashboard.css`, sem importar dados, estado ou ações simuladas. A marca do shell também passou a usar o tridente e o nome da referência.

- Preceito abre o mesmo formulário completo existente; a variante visual não substitui o fluxo por um alternador local.
- O indicador WhatsApp consulta o status real; ausência de falhas não é tratada como conexão confirmada. Atalho abre o histórico real.
- Métricas, setup e linha do tempo recebem dados reais. Não foram copiados nomes, contagens de presença, datas, alcance ou eventos de demonstração. O mapa decorativo é identificado como ilustrativo.
- Conferência 1280/390 px em harness de leitura: capturas `artifacts/modern-integration/fidelity/desktop.png`, `mobile.png` e `mobile-features.png`. Sem rolagem lateral em 390 px; modal completo de preceito abriu e foi cancelado, sem gravação. A dimensão temporária do navegador foi restaurada nesta conferência.
- TypeScript focado passou; 18 testes de dashboard/escopo/carregamento/atalhos passaram, incluindo intenção de criação consumida uma única vez e bloqueio após troca de conta/casa ou expiração. A revisão de código não encontrou bug material nos trechos lidos, mas a leitura foi truncada e não certifica o arquivo completo.
- O botão Novo movimento foi corrigido após revisão: abre as três escolhas da 5188. Registrar no financeiro abre o formulário real, Organizar uma gira abre a criação existente e Cantina leva ao balcão. Intenção transitória em memória, limitada à conta/casa por 60 segundos; não grava dados. A abertura efetiva do formulário financeiro foi conferida no harness e cancelada. O formulário de gira está conectado em código; a execução autenticada continua pendente.
- Evidências complementares: `desktop-features.png`, `desktop-care.png`, `desktop-timeline.png` e `mobile-movement.png` na mesma pasta de fidelidade. O fundo do modal estava acima do conteúdo e interceptava o clique; camadas corrigidas e fluxo financeiro refeito com sucesso. Controles pequenos da referência foram adaptados para mínimo de 44 px. Não houve comparação automatizada de pixels nem criação de spec medida; a fidelidade integral permanece em revisão, sem homologar produção.

**O restante das páginas ainda precisa de portabilidade e comparação visual próprias.** Esta correção não aprova o conjunto das 19 páginas nem o backend novo, e não foi publicada.

Parecer independente desta correção: **disposition: fix**. O fluxo de Novo movimento foi considerado resolvido; as seções inferiores foram confirmadas nas capturas. Permanecem pendentes evidências do setup em 100%, timeline preenchida, rastreabilidade medida/diffs e execução autenticada. A compilação final passou com 4.218 módulos. A leitura documental manteve DESIGN.md global intacto por se tratar de feature local opt-in.

| Entrega | Evidência e limite |
| --- | --- |
| Shell, cabeçalho, conta e navegação | Implementados sobre os mesmos controladores, papéis e rotas da aplicação. Um recolhimento; conta com ações reais; dock móvel por papel. Percurso autenticado completo ainda pendente. |
| Feedback | Requisições de gravação/download acompanhadas até conclusão ou erro; sem sucesso ou percentual simulado. Estados locais de upload preservados. |
| Financeiro | Formulário real extraído para modal; mensalidade antiga, juros fixos/percentuais, vencimento e membro preservados. Pendência fora do caixa. Leitura completa versionada descarta páginas inconsistentes e impede saldo parcial. |
| Cantina/Loja | Mesmos serviços existentes; testes HTTP e prova SQL de comanda, baixa, estorno/cancelamento, estoque e limite compartilhado. Fluxo em duas sessões reais ainda pendente. |
| Pix | QR real, CRC e campos validados; dias 29–31 ajustados em meses curtos. Não houve pagamento bancário de teste. |
| Biblioteca privada | Público/destinatários validados no servidor, listagem/download/comentários protegidos, compatibilidade de PDF legado e bloqueio de perfil fantasma. Migração preparada e testada em transação revertida; não aplicada permanentemente. Edição do público de materiais existentes ainda não entregue. |
| Outras páginas | Controladores preservados e estilos limitados ao modo moderno. Restam composições específicas do protótipo e comparação de todos os modais/ações. |

## Verificações executadas

- Rodada consolidada: **86 testes, 86 aprovados**, em 17 arquivos. Inclui financeiro manual, mensalidades, revisão de comprovantes, Cantina, Loja, Pix, biblioteca, autorização, notificações e isolamento da interface moderna.
- Verificação TypeScript focada: `src/App.tsx`, `api/lib/libraryRoutes.ts` e `api/lib/transactionReadRoute.ts`, com suas dependências, passou. A verificação global anterior esgotou memória; não foi registrada como aprovada.
- Compilação Vite da aplicação: **4.215 módulos**, passou. Saída isolada em `artifacts/modern-integration/app`; não substituiu o `dist` publicado. Aviso não impeditivo de importação dinâmica/estática de `notificationPrefs` permanece.
- Empacotamento da entrada real da API com dependências externas: passou; artefato `artifacts/modern-integration/api-validation.mjs`, sem iniciar tarefas do servidor.
- Prova SQL ligada: `tests/modernDatabase.validation.sql`, preparada por `scripts/validate-modern-database.mjs`, passou em `BEGIN … ROLLBACK` na casa **Teste**, autorizada pelo e-mail informado pelo usuário. Exercitou mensalidade atrasada de R$ 102,00, vínculo com membro, idempotência, caixa, Cantina/Loja, estoque, limite, acervo privado/comentários e cadastro legado por e-mail. Registros e alterações de esquema revertidos; nenhuma mensagem/pagamento enviado.
- Revisão independente: os cinco achados anteriores foram considerados resolvidos. Parecer restrito a esses achados; não certifica produção nem os 19 módulos.
- Conferência visual móvel de componentes reais: 320 px, abas horizontais, formulário rolável e resumo R$ 100,00 + 2% = R$ 102,00. Capturas em `artifacts/modern-integration/review/mobile.png` e `modal-mobile.png`. Ambiente visual tem GETs de teste e bloqueia gravações; não é homologação autenticada.
- A inspeção visual pelo computador foi interrompida pelo controle do navegador, que não conseguiu confirmar a URL ativa com segurança. Captura desktop final e percurso autenticado continuam pendentes. As tentativas de restaurar a dimensão do navegador também não concluíram; não presumir reset realizado.

## Ambientes locais e dependências

- `http://localhost:5191/dashboard?interface=modern`: aplicação real, sessão normal, iniciada por `node scripts/start-modern-local.mjs`. Não cria sessão ou dados de demonstração. Atualmente encaminha `/api` para a API publicada, que ainda não oferece todos os novos contratos. Portanto **não é ambiente completo de homologação da nova API**: extrato paginado recusa resposta antiga em vez de mostrar saldo possivelmente truncado; acervo individual depende da capacidade anunciada pelo servidor.
- `http://localhost:5190/`: conferência visual isolada (`design-systems/modern-integration-review/start.mjs`), explicitamente identificada e sem gravações. Não publicar essa entrada.
- `design-systems/menu-local-20261029`: protótipo visual aprovado, independente da aplicação. Não publicar seu `dist` como substituto.

## Condições para concluir

1. Disponibilizar os novos contratos em ambiente de validação com as duas migrações: `20261031130000_library_private_audience.sql` e `20261101090000_finance_ledger_revision.sql`. O ensaio revertido não equivale à aplicação das migrações. Manter a ordem banco → API → interface; cliente antigo conserva seu contrato.
2. Concluir as composições e diferenças de formulários da matriz `SUBSTITUTION-AUDIT.md`, sem reduzir campos ou serviços reais.
3. Fazer o percurso autenticado zelador/membro da casa autorizada, incluindo recarga, duas sessões, falha de rede, PDFs privados, todos os modais e desktop/mobile. O pedido de login local já foi enviado ao usuário; nenhuma senha foi solicitada no chat.
4. Validar a interface integrada e a recuperação da versão existente antes de habilitar a flag em ambiente publicado. Nenhum deploy, commit/push, alteração de versão ou encerramento de sessão foi realizado nesta etapa.

A documentação global de design foi preservada: o modo moderno ainda é local e opt-in. A revisão documental não concluiu a leitura integral por truncamento; não é certificação do sistema de design.
