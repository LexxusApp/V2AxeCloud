# Rotinas de Casa — avaliação local

29/10/2026. Escopo: Obrigações, Frequência e Comunicados no protótipo de `design-systems/menu-local-20261029`. Menu, cabeçalho e barra inferior previamente aprovados preservados. As novas composições aguardam avaliação do usuário; continuidade não equivale a aceite visual. Nenhuma mudança em produção ou banco real.

## Desenho

- Obrigações: sálvia no próximo compromisso, damasco nos atrasos, acompanhamento lateral e lista com blocos de data. O ano também aparece nos registros. Compromissos genéricos de demonstração, sem inventar fundamento religioso.
- Frequência: abertura azul esverdeada, escolha de encontro e chamada em composição própria; histórico expansível separado da operação de registro.
- Comunicados: abertura editorial em argila clara, arquivo de mensagens e rascunhos laterais. Ações locais de edição, segmentação e prévia do membro.

Inter, navegação e cores institucionais preservadas. Não foi aplicada uma grade idêntica de métricas às três páginas. Campos de formulário mobile em 16px; movimento reduzido respeitado. Não foram acrescentadas bibliotecas.

## Fluxos conferidos

### Obrigações

Criado “Revisão de cuidados” para Mariana, em 02/11/2026 às 18:30 de Brasília. Data, horário, membro e orientações apareceram na lista filtrada. A conclusão alterou o estado para concluída. Remover/desfazer restaurou o registro. Navegar ao perfil de Mariana e abrir Evolução espiritual mostrou o novo compromisso concluído junto ao agendamento de 31/10. Vínculo usa ID; nomes são resolvidos a partir do estado compartilhado de membros.

As alterações ficam na memória da prévia. O formulário não notifica membros. Concluir é uma operação de acompanhamento local, sem inferir execução ou validade religiosa.

### Frequência

Chamada inicial de 24/10: sete presentes e uma ausência, marcada como concluída. Gira de 31/10: oito registros inicialmente vazios, embora seis membros já tenham confirmado intenção de participar. Concluir estava desabilitado enquanto havia registros pendentes.

Simulada chamada de 31/10 com seis presentes, uma ausência e uma justificativa. Ao concluir, o histórico de outubro passou a duas chamadas, média de 81% e Caio com uma presença/uma ausência, 50%. Reabrir permitiu alterar a marca de Mariana no celular; restaurar para presente e concluir manteve os totais corretos. A tela de Giras continuou com seis confirmados, duas pessoas sem resposta e nenhuma ausência de intenção: os dados de comparecimento não sobrescreveram RSVP.

Somente chamadas concluídas entram no histórico. Percentual local = presenças ÷ (presenças + ausências). Justificadas ficam separadas; sem denominador, mostra travessão. Membros entram em encontros a partir da data de ingresso. Esses modelos são demonstrativos e exigirão mapeamento explícito às regras de produção na futura integração.

### Comunicados

Publicação sem conteúdo foi recusada. Preparado aviso para Mariana, vinculado à Gira de Caboclo; salvar rascunho preservou título, texto e público. Desmarcar a única destinatária impediu publicar. Com Mariana selecionada, publicar adicionou a mensagem ao mural local com público de um membro. A prévia mostrou a mensagem completa, data/hora de Brasília, gira associada e somente Mariana no público.

Fechar com Escape restaurou foco a “Ver como membro”. Remover/desfazer restaurou a publicação. Nenhum WhatsApp, notificação, envio de portal ou confirmação de leitura foi gerado. O número de público vem dos membros do exemplo, não de métricas fictícias de entrega.

## Estados e responsividade

Nas três páginas, estados de falha, retorno aos exemplos, ausência de registros e restauração dos dados foram exercitados pela interface no celular. Os controles alteram somente a apresentação, sem apagar a memória.

Verificadas larguras de 1920, 1366, 390 e 320px. Sem overflow horizontal observado: em 1366px, clientWidth/scrollWidth de 1360; em 390px, 384; em 320px, 314. Em 320px, busca de elementos do conteúdo fora do documento retornou lista vazia nas três páginas. Menu da casa no drawer e barra inferior mantidos. Editor de comunicado em 390px: largura de 358px, altura limitada e rolagem interna para alcançar os campos.

Medições pontuais de contraste: texto principal do comunicado 4,518:1, metadados 4,627:1, texto de artigo 4,551:1; orientação de atraso 4,697:1; descrição da lista de obrigações 4,875:1; abertura de frequência 7,160:1, orientação da chamada 4,784:1, função do membro 4,527:1. O texto do próximo compromisso foi escurecido após medir 4,472:1. Verificação pontual não substitui auditoria completa de acessibilidade ou aparelho físico.

## Verificação técnica e evidências

TypeScript focado concluído sem erros. Build isolado Vite concluído, 1758 módulos. Detector Impeccable executado uma vez em cada nova página: `[]`. Console do navegador sem avisos ou erros durante os cenários registrados.

Capturas em `.impeccable/review/house/`: três páginas no desktop, notebook e 320px, mural e chamada em 390px e editor mobile. Algumas imagens mostram as operações de teste; a aba final é recarregada para os exemplos iniciais.

Conferência própria em modo degradado, mantendo a limitação de revisão independente indisponível das etapas anteriores. Parecer em `.impeccable/review/house/SELF-REVIEW.md`. Nenhuma aprovação de publicação inferida.

## Limites

Simulação local em memória. Recarregar reinicia os exemplos. Não integra API, PDF/anexos de produção, QR de check-in, envio de comunicado, leitura do membro, autenticação ou permissões reais. O restante das páginas não implementadas continua identificado como etapa futura. As telas anteriores permanecem disponíveis para revisão posterior.
