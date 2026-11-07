# Prévia local do menu e das páginas AxéCloud

Status atual — etapa 14, 31/10/2026: os 19 destinos continuam disponíveis e o Radar oferece o estúdio completo do perfil público em `http://localhost:5188/#radar`. A etapa 13 fica preservada como histórico; sua composição de Radar foi superada pela etapa 14 ao final deste documento. Menu e cabeçalho aprovados; Dashboard com aceite provisório; todas as extensões com avaliação visual pendente. Laplace encerrou somente três correções do Radar com `ship`, sem novo parecer geral. Continuidade local não autoriza integração ou publicação.

Direção: verde profundo na navegação, dourado pontual, conteúdo claro e tipografia Inter. O foco é a hierarquia do menu e a consistência entre computador e celular.

## Abrir

Na raiz interna do projeto, execute:

```powershell
node design-systems/menu-local-20261029/serve.mjs
```

Acesse http://localhost:5188. O servidor escuta apenas o próprio computador. Não usa a configuração de produção, não registra service worker e não faz chamadas à API.

## Escopo

- Menu expandido/recolhido; grupos Casa e Financeiro; Gestão da casa e Conta e suporte.
- Navegação inferior no celular, com Mais abrindo o menu completo.
- Busca de módulos, notificações locais, navegação por hash e histórico do navegador.
- 19 páginas locais: Início, Filhos de Santo, Giras, Obrigações, Frequência, Comunicados, Mensagens, Financeiro/Visão geral, Mensalidades, Cantina, Configurações Pix, Galeria, Almoxarifado, Biblioteca de Estudos, Loja da Casa, Radar, Minha assinatura, Configurações e Suporte.
- Todos os dados são ilustrativos e estão identificados. Ações de demonstração afetam apenas o estado em memória, que reinicia ao recarregar.
- Nome da casa, conexão simulada e visibilidade do Radar são compartilhados pelo componente pai com a Dashboard; os novos módulos carregam sob demanda.

Não há importação desta pasta pelo aplicativo, alteração de rotas reais, autenticação, pagamentos, envio de mensagens, commit, push ou publicação. O menu reaproveita a definição atual de `src/constants/appNav.ts`; não constitui teste de permissões de produção.

## Validação

Validar aparência e navegação antes de qualquer integração. O primeiro aceite é do menu e cabeçalho; páginas adicionais podem evoluir separadamente. As seções abaixo preservam o histórico: a etapa 13 completou os 19 destinos; a etapa 14 amplia o Radar dentro desse conjunto.

## Dashboard — segunda etapa

Menu e cabeçalho já aprovados e preservados. A nova Dashboard está disponível em `http://localhost:5188/#dashboard` para avaliação visual, com:

- Boas-vindas, indicadores, gira e Radar com informações de períodos distintos.
- WhatsApp identificado com ícone e situação de conexão; detalhes demonstrativos.
- Preceito, pendências e atalhos, incluindo Cantina.
- Ativação com seis passos: ao concluir a foto de demonstração, torna-se uma faixa compacta. Recarregar reinicia o exemplo.
- Linha do tempo com filtros Recentes/Próximos, datas e horários de Brasília.
- Controle “Testar estados desta página” no final para simular ausência de registros, carregamento e falha.

Na segunda etapa, as outras páginas ainda permaneciam na versão anterior e alguns destinos indicavam etapa futura; essa limitação foi superada pelas extensões até a etapa 13. Todos os números e nomes continuam ilustrativos. Verificações e limites daquela etapa: [DASHBOARD-VALIDATION.md](DASHBOARD-VALIDATION.md).

## Filhos de Santo — terceira etapa

Dashboard validada provisoriamente pelo usuário em 29/10/2026. A lista e o perfil de membros estão em `http://localhost:5188/#children`, com busca sem acentos, filtros, ordenação, cadastro e edição demonstrativos, seções de dados/evolução/financeiro/anotações e layout próprio para celular. Alterações ficam em memória e reiniciam ao recarregar. Novo cadastro não gera cobrança ou acesso. Dados de demonstração são compartilhados com o restante da prévia; nenhuma API de produção é utilizada. Evidências em [MEMBERS-VALIDATION.md](MEMBERS-VALIDATION.md).

## Giras — quarta etapa

Abra `http://localhost:5188/#calendar`. Agenda e calendário mensal, cadastro/edição, respostas da corrente, checklist de preparação, rascunho de aviso e fila de senhas de teste. Datas e presenças usam o mesmo estado local da Dashboard e do perfil do membro. As ações não enviam mensagens nem criam atendimento público. Exemplos reiniciam ao recarregar. Verificações em [GIRAS-VALIDATION.md](GIRAS-VALIDATION.md). Esta etapa ainda aguarda avaliação visual.

## Financeiro / Visão geral — quinta etapa

Em `http://localhost:5188/#financial`, a visão geral passa a ter uma composição própria: saldo verde profundo, pendências douradas, gráfico de entradas/saídas em verde e terracota e extrato expansível. Filtros por período, semana e movimento, lançamentos locais em centavos, edição, remover/desfazer e CSV filtrado. Valores pagos na Cantina e baixas simuladas de mensalidade atualizam o mesmo caixa. Mensalidades, Cantina e Pix foram ampliados na sexta etapa descrita abaixo. A navegação financeira mostra as quatro abas no celular. Nada publicado; avaliação visual pendente. Ver [FINANCIAL-VALIDATION.md](FINANCIAL-VALIDATION.md).


## Mensalidades, Cantina e Pix — sexta etapa

Três composições próprias, mantendo o menu, o cabeçalho e a barra inferior aprovados:

- `http://localhost:5188/#financial-mensalidades`: resumo de contribuições, progresso, busca, filtros, detalhes, baixa com confirmação e desfazer, e prévia de lembrete sem envio.
- `http://localhost:5188/#financial-cantina`: cardápio com cores por ilustração, novo item sem faixa de categorias, comanda, quantidades, recebimento e caderneta por membro com extrato detalhado e acerto.
- `http://localhost:5188/#financial-configs`: formulário em três etapas, prévia do que o membro verá, validação de formato, salvar e descartar alterações na sessão local, copiar chave.

A anotação na caderneta cria pendência; somente o recebimento entra no caixa. Valores da cantina são calculados em centavos. A configuração Pix não altera contribuições de outubro já criadas. Todos os dados de negócio ficam em memória; recarregar reinicia a demonstração. Nenhuma cobrança, QR Code ou mensagem é criada. Ver [WORKFLOWS-VALIDATION.md](WORKFLOWS-VALIDATION.md). A avaliação visual destas páginas ainda está pendente.


## Obrigações, Frequência e Comunicados — sétima etapa

As áreas de Casa receberam três composições próprias, seguindo a regra de variedade visual do usuário:

- `http://localhost:5188/#obligations`: próximo compromisso, acompanhamento de atrasos, agenda por membro, edição, conclusão e remoção com desfazer. Os compromissos também aparecem no histórico local do perfil.
- `http://localhost:5188/#frequencia`: chamada por encontro e histórico da corrente. Presença registrada é independente de confirmação de participação na gira. Apenas chamadas concluídas entram na assiduidade.
- `http://localhost:5188/#mural`: mural editorial, rascunhos, edição, público por membros e prévia de apresentação. Publicar altera somente o exemplo local; não envia mensagens ou notificações.

Menu, cabeçalho, barra inferior e páginas aprovadas mantidos. Dados de negócio continuam em memória e reiniciam ao recarregar; nenhum módulo de produção foi alterado. Estas três páginas ainda aguardam avaliação visual. Evidências e limites em [HOUSE-VALIDATION.md](HOUSE-VALIDATION.md).


## Mensagens — oitava etapa

Abra `http://localhost:5188/#chat`. A composição é uma caixa de conversas com leitura lado a lado no computador e uma conversa por tela no celular. Não usa a abertura de métricas das demais áreas.

Inclui busca por pessoa/grupo, filtros de não lidas/arquivadas, rascunhos por conversa, texto e anexos locais, nova conversa individual, criação de grupo, participantes, busca no histórico, arquivar/restaurar e falha de envio simulada com recuperação. Contagem do menu deriva das conversas não lidas, sem valor fixo. Anexos permanecem em memória como File; URLs de apresentação são revogadas ao desmontar e recriadas ao voltar.

A mensagem é adicionada somente à prévia. Não há contato com a API, gravação de áudio, indicação de presença online, entrega real ou confirmação de leitura do destinatário. Tudo reinicia ao recarregar. Página em avaliação; navegação aprovada preservada. Ver [MESSAGES-VALIDATION.md](MESSAGES-VALIDATION.md).


## Galeria — nona etapa

Abra `http://localhost:5188/#gallery`. A página tem composição de imagens: álbum principal amplo e coleções ao lado no computador, cards empilhados no celular e visualizador com foto inteira. Menu, cabeçalho e barra inferior preservados.

Inclui criação/edição de álbuns, inclusão posterior, troca de capa, legendas, busca, categorias, ordenação, Meu Axé, remover e desfazer. Os fluxos testados usaram a biblioteca explícita de imagens de exemplo. As três capas foram geradas por IA e estão identificadas; procedência e prompts em [assets/gallery/ASSETS.md](assets/gallery/ASSETS.md).

Nada é publicado ou enviado ao sistema atual. Dados ficam em memória e reiniciam ao recarregar. Seletor nativo, vídeo, download e limites de tamanho ainda precisam de teste específico antes da integração. Galeria aguarda avaliação visual. Cenários, capturas e limites em [GALLERY-VALIDATION.md](GALLERY-VALIDATION.md).

## Almoxarifado — décima etapa

Abra `http://localhost:5188/#inventory`. A bancada usa lista contínua de estoque e painel de reposição areia/argila ao lado no desktop, empilhados até 1240px. Resumo inline, visões Prateleiras/Movimentações e controles compactos no celular antecipam os itens, mantendo menu, cabeçalho e barra inferior aprovados.

Inclui cadastro, edição, localização, categorias, busca, filtros, ordenação, detalhes, remoção com confirmação e desfazer. Entradas, saídas e conferências exigem motivo e mostram saldo antes/depois. O histórico preserva nome e unidade do registro e exibe horários de Brasília. Editar o cadastro preserva saldo e unidade; alterações de saldo passam por movimentação.

Unidades diferentes não são somadas. O cálculo usa milésimos inteiros: kg, L e m aceitam até três casas decimais; un., maços e garrafas exigem inteiros. A lista de compras calcula a diferença até o mínimo por item e pode ser copiada. Repor registra somente uma entrada local; não cria compra, despesa ou pagamento.

Dados de negócio ficam em memória e reiniciam ao recarregar, sem APIs, autenticação ou integração financeira. Menu e cabeçalho seguem aprovados e a Dashboard tem aceite provisório; o Almoxarifado aguarda aceitação visual. Build Vite com 1770 módulos, TypeScript focado, verificações puras de quantidade e detector executado uma vez (`[]`) constam dos registros existentes. A revisão independente encerrou todos os papéis de texto apontados com `ship` apenas no escopo da correção de contraste; o aviso de tamanho do bundle permanece. Nenhuma dessas verificações foi reexecutada nesta passagem documental. Ver [INVENTORY-BRIEF.md](INVENTORY-BRIEF.md), [INVENTORY-VALIDATION.md](INVENTORY-VALIDATION.md), [REVIEW.md](.impeccable/review/inventory/REVIEW.md) e [DOCUMENTATION.md](.impeccable/review/inventory/DOCUMENTATION.md).

## Biblioteca de Estudos — décima primeira etapa

Abra `http://localhost:5188/#library`. O novo pedido permite à zeladoria reservar um PDF a um único filho escolhido. Acervo da casa e Acervo privado têm índice de assuntos e capas tipográficas por categoria, que identificam o material sem representar a primeira página do PDF. Lilás sinaliza a área individual; menu, cabeçalho e barra inferior aprovados permanecem.

Todo cadastro começa privado e exige destinatário por ID estável. A prévia de membro limita listas, contagens, assuntos, busca, detalhe, leitor e download ao conjunto autorizado da simulação; destinatário ausente ou inválido não libera conteúdo comum. Transferir um privado para outro filho ou ampliar para toda a casa exige confirmação Antes/Depois; cancelar conserva a edição e o acesso salvo. Inclui cadastro/edição, filtros, ordenação, remoção com desfazer, seleção nativa de PDF de até 20 MB e leitor real com página, zoom, texto extraído e download.

Estado e Files ficam em memória entre rotas e reiniciam ao recarregar. Os fluxos registrados usaram PDFs sintéticos próprios; nenhum arquivo privado real foi utilizado. A simulação local não implementa autenticação nem proteção de armazenamento. O compartilhamento individual é distinto do catálogo de produção FundamentosAcervo e das regras de plano, que não foram modificados; Fundamentos aqui é apenas um assunto. A integração futura deve aplicar sessão, casa, vínculo e autorização no servidor e no armazenamento privado, conforme [LIBRARY-INTEGRATION.md](LIBRARY-INTEGRATION.md).

Menu/cabeçalho aprovados, Dashboard com aceite provisório e Biblioteca com avaliação visual pendente. Hume retornou `ship` somente no escopo local, sem correções materiais. TypeScript focado, verificações puras de acesso, build de 1782 módulos e detector uma vez por TSX (`[]` em ambos) constam das evidências existentes, sem reexecução nesta passagem. Permanece o aviso da entrada geral de aproximadamente 525 kB. Ver [LIBRARY-BRIEF.md](LIBRARY-BRIEF.md), [LIBRARY-VALIDATION.md](LIBRARY-VALIDATION.md), [ASSETS.md](assets/library/ASSETS.md), [REVIEW.md](.impeccable/review/library/REVIEW.md) e [DOCUMENTATION.md](.impeccable/review/library/DOCUMENTATION.md).

## Loja da Casa — décima segunda etapa

Abra `http://localhost:5188/#store`. Catálogo editorial com imagens ilustrativas sobre linho bege, preços argila e controles verdes, sem reproduzir a abertura de métricas. Grade de três colunas, duas até 1150px e uma até 640px; sacola lateral no computador e de largura inteira no celular. Pedidos usam lista expansível com membro, horário de Brasília, quantidades, valores unitários e subtotais. Menu, cabeçalho e barra inferior aprovados permanecem.

Inclui criar/editar produtos, arquivar/restaurar, busca, categoria, disponibilidade e ordenação. Editar conserva o estado arquivado; restaurar é uma ação explícita. A sacola limita quantidades ao estoque livre e a 99 por produto, exige revisão antes de confirmar e oferece Já recebido, Aguardar Pix, Caderneta ou Só reservar. Reserva exige membro e separa estoque sem dívida ou receita. Pix e caderneta ficam pendentes; receber gera uma entrada por pedido no Financeiro local. Entrega exige pagamento; cancelar pedido pendente/reservado ainda não entregue devolve estoque uma única vez. Reabrir baixa retira a entrada do caixa, preserva a entrega e não faz devolução bancária. Pedidos conservam nome/preço dos itens do momento da confirmação.

O estado permanece no componente pai entre rotas e reinicia ao recarregar. Caderneta da Loja não compartilha limite de crédito com Cantina; estoque não é compartilhado com Almoxarifado. Imagens de IA são identificadas; cadastro oferece exemplos correspondentes ou Sem foto. Sem upload real, API, armazenamento de negócio, Pix real, cobranças, portal do membro ou ações de produção.

Menu/cabeçalho aprovados, Dashboard provisória e todas as extensões, incluindo Loja, com aceite visual pendente. A revisão independente encerrou com `ship` **somente os dois ajustes**: preservar arquivado ao editar e mínimo mobile de 44×44px nos controles de quantidade/remoção/fechar. A principal verificou esses fluxos no navegador e registrou TypeScript saída 0 e build Vite de 1789 módulos após as correções; StorePage 20,67 kB, CSS 12,18 kB, entrada geral 532,94 kB com aviso acima de 500 kB. Oito grupos de verificações puras constam da validação. Esta documentação conferiu registros, código e capturas locais, sem reexecutar testes. Ver [STORE-BRIEF.md](STORE-BRIEF.md), [STORE-VALIDATION.md](STORE-VALIDATION.md), [REVIEW.md](.impeccable/review/store/REVIEW.md), [ASSETS.md](assets/store/ASSETS.md) e [DOCUMENTATION.md](.impeccable/review/store/DOCUMENTATION.md).

## Radar e Conta — décima terceira etapa, fechamento dos 19 destinos

Registro histórico da etapa 13: os quatro destinos que faltavam receberam páginas próprias, preservando menu, cabeçalho e barra inferior. O Radar desta seção foi ampliado e sua composição substituída pelo estúdio da etapa 14; os resultados e o detector abaixo pertencem apenas à etapa 13:

| Destino local | Composição e operações de demonstração |
| --- | --- |
| `http://localhost:5188/#radar` | Mapa SVG explicitamente esquemático, visitas ilustrativas de 7/30 dias e canais; perfil de visitante, endereço opcional, atendimentos, rascunhos e publicação apenas local com confirmação. Ocultar preserva o conteúdo e o retira da prévia. |
| `http://localhost:5188/#subscription` | Contrato verde e livro de renovações areia. Ciclos Premium mensal/anual ilustrativos, revisão, registro pendente único, confirmação separada e idempotente, cancelamento e encerramento/reversão ao fim do período. Histórico e demonstrativo TXT sem validade fiscal; sem checkout ou entrada no caixa da casa. |
| `http://localhost:5188/#settings` | Índice lateral e editor de identidade, WhatsApp e acesso. Validação de contato, foto local PNG/JPG/WebP de até 5 MB, salvar/descartar e preferências. Conectar/desconectar é simulação, sem QR falso, aparelho ou credenciais reais. Reiniciar afeta somente as configurações locais. |
| `http://localhost:5188/#suporte` | Base de orientações lilás, busca e assuntos, passos e atalhos; pedido local com rascunho, histórico, complementos e encerrar/reabrir. Nenhuma solicitação é enviada e não há atendente ou SLA simulado. |

Dados salvos e rascunhos de Configurações ficam em `main.tsx`. O rascunho do perfil do Radar também fica no pai entre rotas; a prévia de visitante usa somente os valores salvos. Nome da casa, conexão simulada e visibilidade do Radar alimentam a Dashboard. A principal confirmou no navegador o detalhe do WhatsApp nos dois estados com simulação explícita e o rascunho do Radar preservado após visitar Configurações, enquanto a prévia manteve o conteúdo salvo. James encerrou com `ship` somente esses dois ajustes revisados, sem novo parecer geral ou aceite visual.

Evidências finais fornecidas pela principal após as correções: TypeScript focado saída 0 e Vite concluído em 17,04s, com 1795 módulos; entrada geral 537,34 kB (156,63 kB gzip), mantendo o aviso acima de 500 kB. Chunks sob demanda: Radar 16,56 kB, Configurações 13,30 kB, Assinatura 8,97 kB e Suporte 11,73 kB. Seis grupos puros passaram; detector uma vez por novo TSX, todos `[]`. Navegação desktop dos 19 destinos com título e hash corretos, logs `[]`; quatro novas páginas observadas em 320/390px e 1366/1920px. MapPin corrigido para 16×16px e interruptores WhatsApp com área de input de 44px no mobile. A principal inspecionou `radar-final.jpg` em 1366px, reiniciou os cenários e restaurou viewport/aba de entrega, com logs `[]`. Resultados recebidos, sem reexecução documental; aceite visual permanece pendente.

Não foram adicionados rasters à interface nesta etapa. Mapa, métricas, assinatura, conexão, publicação e pedidos são exemplos locais; sem API de negócio, autenticação, cobrança, envio, integração ou produção. Estado de negócio reinicia ao recarregar; somente o recolhimento do menu persiste na origem local. Ver [COMPLETION-BRIEF.md](COMPLETION-BRIEF.md), [COMPLETION-VALIDATION.md](COMPLETION-VALIDATION.md), [REVIEW.md](.impeccable/review/completion/REVIEW.md), [VALIDATION.md](VALIDATION.md) e [DOCUMENTATION.md](.impeccable/review/completion/DOCUMENTATION.md).

## Radar — décima quarta etapa, estúdio do perfil público

Abra `http://localhost:5188/#radar`. A abertura fotográfica mostra capa, retrato e identidade **salvos**, seguida do editor de sete seções: Identidade pública, Endereço e contato, Rotina de giras, Galeria do Radar, Desempenho, Publicações e Atendimentos. É extensão do mundo existente: Inter, verde profundo, dourado e navegação aprovada preservados. A apresentação centrada em mapa da etapa 13 é histórica; o mapa continua apenas esquemático, sem geocodificação.

- Identidade pública independente da conta: nome, tradição, biografia, orientações, capa substituível/removível, enquadramento superior/central/inferior e foto própria. Copiar a foto da conta exige a ação explícita Usar foto da conta.
- Endereço completo: logradouro, número ou sem número, complemento, bairro, CEP, cidade/UF, link Google Maps e latitude/longitude validados. Ocultar endereço e salvar conserva os dados reservados e mostra somente cidade/UF, sem Maps na prévia.
- WhatsApp público e canal de atendimentos; até cinco tipos distintos de link: Instagram, Facebook, TikTok, YouTube e site. Todos exigem HTTPS sem credenciais; redes conhecidas exigem domínio correspondente. Site aceita endereço HTTPS, sem lista restrita de domínios.
- Até 14 horários semanais, com nome, dia, início, término opcional e pausa. Dia/início duplicados são recusados; próxima gira usa America/Sao_Paulo e ignora pausados. Término igual ou anterior ao início indica dia seguinte. A rotina pública não cria eventos na agenda interna.
- Galeria exclusiva do Radar: até seis fotos, inclusão múltipla, legendas, ordenar, remover/desfazer e imagem inteira. Registros independentes da Galeria interna/privada; apenas as ilustrações de exemplo compartilham arquivos. Desempenho ilustrativo, publicações e atendimentos continuam disponíveis.

Salvar atualiza somente o perfil local salvo; a abertura e a prévia de visitante usam esse estado. O rascunho de identidade/endereço/rotina/galeria e os Files permanecem no pai entre seções e rotas; recarregar reinicia os exemplos. Descartar pede confirmação. Publicações, atendimentos e visibilidade conservam seus próprios controles locais; não dependem do botão Salvar perfil.

Seleção nativa de PNG/JPEG/WebP: até 8 MB por capa/foto de galeria e 5 MB por retrato; decodificação exige pelo menos 64×64 pixels e até 24 megapixels. Arquivos ficam em memória e URLs temporárias são revogadas ao trocar a imagem/desmontar. Sem compressão ou upload remoto. Capa inicial de pátio e galeria inicial de pátio/flores são exemplos de IA identificados; prompts exatos e atualização de metadados/sidecars em [ASSETS.md](assets/gallery/ASSETS.md). O scan informado pela principal registrou seis rasters e zero metadados ausentes; não foi repetido nesta documentação.

As três correções da revisão estão encerradas: descarte impede desfazer que duplicaria foto restaurada; Editar capa e foto foca e rola até o editor; próxima gira, horários e localização antecedem a galeria no celular, preservando as colunas desktop. Laplace retornou `ship` somente para essa lista, com os três itens `resolved`; aceite visual do usuário permanece pendente.

Evidências finais recebidas: TypeScript focado saída 0, sete grupos puros aprovados e Vite de 1801 módulos em 11,81s; Radar 47,24 kB (13,60 kB gzip), CSS 24,16 kB. Entrada geral 538,35 kB mantém aviso acima de 500 kB. Detector invocado uma vez para cada um dos quatro TSX; saída indisponível por truncagem, sem afirmar `[]` ou aprovação e sem segunda execução. A principal registrou os fluxos em 1366/390/320px sem overflow e inspecionou `radar-final.jpg` em 1366×900, com exemplos iniciais e página no topo; removeu o override de viewport e marcou a aba de entrega. Este handoff conferiu fontes e registros, sem abrir capturas, navegador ou reexecutar verificações.

Somente local, sem API, autenticação, geocodificador, deploy, commit ou produção. Ver [RADAR-STUDIO-BRIEF.md](RADAR-STUDIO-BRIEF.md), [RADAR-STUDIO-VALIDATION.md](RADAR-STUDIO-VALIDATION.md), [REVIEW.md](.impeccable/review/radar-studio/REVIEW.md) e [DOCUMENTATION.md](.impeccable/review/radar-studio/DOCUMENTATION.md).


## WhatsApp — décima quinta etapa, histórico de disparos

Em http://localhost:5188/#settings, WhatsApp reúne Automações e Histórico de disparos. Dez exemplos sintéticos imutáveis do pai, snapshot fixo até 31/10/2026, oferecem busca sem acento, filtros combinados por tipo/período (7/30 dias ou todos)/resultado, contagens por grupo e paginação de seis. Detalhes inline exibem mensagem, motivo/orientação da falha e cronologia com datas absolutas de Brasília. Entregue/Lido são sucesso; Enviado/Na fila seguem em andamento. Rascunhos e histórico após desconexão são preservados; sem envios ou reenvios reais.

Evidências fornecidas registram 390/320px sem overflow, dock preservado e entrega restaurada com conexão/preferências iniciais e oito registros no período padrão. Hooke retornou ship no escopo local, sem correções materiais; aceite visual do usuário pendente.

Extensão Operate da identidade vigente, paleta floresta/estados local, sem novos tokens aprovados. DESIGN.md e .impeccable/design.json preservados integralmente. Sem API, autenticação, produção, deploy ou novos ativos. Ver [brief](WHATSAPP-HISTORY-BRIEF.md), [validação](WHATSAPP-HISTORY-VALIDATION.md), [revisão](.impeccable/review/whatsapp-history/REVIEW.md) e [handoff](.impeccable/review/whatsapp-history/DOCUMENTATION.md). Verificações recebidas, sem reexecução documental.

## Cantina — décima sexta etapa, histórico local

Em http://localhost:5188/#financial-cantina, a terceira aba Histórico reúne Comandas e Recebimentos. Começa vazio: operações da sessão geram snapshots de membro, produtos, preço unitário em centavos, quantidade e horário. Venda à vista cria comanda/recebimento atomicamente; caderneta fica pendente, sem caixa; baixa de membro reúne apenas comandas abertas em um recebimento, preservando baixas anteriores. Confirmação por token e operações puras idempotentes evitam duplicação. Financeiro recebe uma entrada por ID/data/valor do recebimento; helper numérico anterior continua compatível.

Períodos hoje/7/30 dias/todos, origem e situação de comandas, busca normalizada por pessoa/produto/código, seis registros por página com retorno à primeira ao filtrar e vazio recuperável. Detalhes inline mostram preços unitários, quantidades, subtotais, datas de Brasília e vínculos completos. Estado no pai conserva dados entre rotas; reload reinicia a prévia, com limite indicado. Extensão Operate preserva Inter, floresta/dourado/areia e shell, com composição vertical mobile; DESIGN.md e .impeccable/design.json inalterados, sem novos tokens globais.

Evidências reportadas: oito comandas (R$ 40,00), seis recebimentos (R$ 36,50), R$ 3,50 pendentes fora do caixa. Anscombe: `ship` delimitado, sem correções materiais; aceite visual pendente. Principal informa history-final.jpg aberto em 1366×900, três resultados de Caderneta e detalhe de item, registros da própria sessão preservados, viewport restaurado e aba de entrega marcada. Sem dinheiro real, API, backend ou deploy. Ver [brief](CANTINA-HISTORY-BRIEF.md), [validação](CANTINA-HISTORY-VALIDATION.md), [revisão](.impeccable/review/cantina-history/REVIEW.md) e [handoff](.impeccable/review/cantina-history/DOCUMENTATION.md); sem reexecução documental.


## Integração e paridade dos modais — décima sétima etapa

A prévia local agora usa registros compartilhados para mensalidades antigas, juros fixos ou percentuais, baixa/reabertura, perfil do membro e caixa. Cantina e Loja compartilham limite e bloqueio da caderneta; reservas não geram dívida e só recebimentos confirmados entram no caixa. Configurações Pix sugerem valor e vencimento apenas para novos lançamentos.

O cabeçalho mantém um único recolhimento do menu. O cartão lateral Casa de demonstração foi removido e o perfil junto ao sino abre conta/casa, WhatsApp, assinatura e suporte. Campos ausentes foram completados nos formulários de membro, gira, obrigações, comunicado, produto, cantina e suporte. Ações têm feedback de atualização; arquivos mostram leitura real; títulos e fechamento permanecem acessíveis nos formulários longos. O primeiro comando de criação durante carregamento é preservado.

Inventário: 57 estruturas em 22 arquivos, com matriz comparativa de informações do código atual. Testes de integração e regressão passaram; 14 famílias de modal couberam em 390 e 320 px sem overflow, com dock mantido. TypeScript e build passaram. A revisão independente corrigiu um caso de duplicação ao converter receita em mensalidade e retornou **ship** restrito a essa correção e sua evidência. Não é homologação de todas as combinações nem de produção.

Somente local, sem API, banco, envio, pagamento ou deploy. Recarregar reinicia os exemplos. DESIGN.md e o sidecar permanecem inalterados; nenhum token global novo. Abra [Mensalidades](http://localhost:5188/#financial-mensalidades). Referências: [brief](INTEGRATION-BRIEF.md), [validação](INTEGRATION-VALIDATION.md), [inventário](MODAL-INVENTORY.json), [revisão](.impeccable/review/integration/REVIEW.md) e [handoff](.impeccable/review/integration/DOCUMENTATION.md).
