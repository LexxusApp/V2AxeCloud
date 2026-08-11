# AxéCloud Android — matriz de paridade

Esta matriz é o contrato de conclusão do aplicativo. Um item só muda para `CONCLUÍDO` depois de funcionar com dados reais, ter tratamento de erro e ser validado em aparelho.

## Zeladoria

| Módulo | Funções do Web que precisam existir no Android | Estado |
|---|---|---|
| Início | resumo da casa, pendências, próxima ação, atalhos, notificações | PARCIAL — painel nativo usa dados reais da casa e a Central de Notificações agora sincroniza leitura individual e coletiva com o servidor; validação real pendente |
| Filhos de Santo | listar, pesquisar, filtrar, ordenar, cadastrar, visualizar, editar, excluir, foto, acesso e situação financeira | PARCIAL — lista, busca, filtros inclusive sem acesso, três ordenações, cadastro, edição, exclusão, foto de perfil, mensalidade, envio individual e coletivo de acesso compilados; validação real pendente |
| Giras | agenda, calendário, criar/editar/excluir, detalhes, confirmações, senhas, mapa de velas, QR Code e presença | PARCIAL — agenda e operação nativas compiladas com confirmação da corrente, aprovação, senhas de visitantes, fila de atendimento, mapa de velas, portaria e QR; validação real pendente |
| Frequência | relatório, histórico e indicadores por filho/gira; operação de presença por evento | PARCIAL — relatório e histórico detalhado nativos; operação por gira fica no Centro de Gira; validação real pendente |
| Comunicados | lista, categorias, criar/excluir, publicação, reenvio e histórico de transmissões | PARCIAL — mural, busca, categorias, publicação, compartilhamento, reenvio, exclusão e histórico real de entregas/falhas compilados; validação no aparelho pendente |
| Conversas | lista, mensagens, envio de texto, imagem e áudio, leitura e tempo real | PARCIAL — texto, imagem, vídeo, seleção/gravação nativa de áudio, players Media3, leitura e Realtime autenticado do Supabase compilados, com contingência periódica; validação real pendente |
| Financeiro | resumo, lançamentos, filtros, criar/excluir, relatório e caixinha | PARCIAL — caixa, lançamentos, exclusão, relatório CSV pelo compartilhamento nativo, Pix, metas e validação de doações compilados; edição não existe na API web atual e validação real está pendente |
| Mensalidades | pendentes/pagas, cobrar, liquidar, estornar, comprovantes e histórico | PARCIAL — zeladoria consulta, cobra pelo canal oficial, liquida e estorna; filho consulta Pix/QR/histórico e envia comprovante para validação automática; validação real pendente |
| Configuração Pix | cobrança ativa, valor, vencimento, chave, beneficiário e validação | PARCIAL — formulário e persistência nativos; validação em aparelho pendente |
| Galeria | álbuns, filtros, criar/excluir, upload múltiplo, visualização, Axé e remoção de mídia | PARCIAL — paridade funcional Web compilada com reprodução Media3 nativa; upload e vídeo em aparelho real pendentes |
| Almoxarifado | estoque, busca/filtros, cadastro, edição, ajuste, alertas e exclusão | PARCIAL — filtros por categoria e situação, níveis mínimo/atual, ajuste rápido, cadastro, edição, alerta e exclusão compilados; validação real no aparelho pendente |
| Biblioteca | materiais, categorias, acesso controlado, upload, leitura/download, exclusão e discussões | PARCIAL — PDFs, Acervo de Fundamentos e comentários/respostas com moderação nativos compilados; validação real pendente |
| Atendimentos | pedidos de reza, busca, status, detalhes, notas, contato e conclusão | PARCIAL — paridade funcional Web compilada em central nativa de acolhimento; validação em aparelho real pendente |
| Loja | produtos, categorias, cadastro/edição, estoque e pedidos | PARCIAL — vitrine, busca, cadastro/edição/exclusão, sugestão automática de imagem, estoque, sacola, reserva, Pix, mensalidade e pedidos recentes compilados; validação transacional no aparelho pendente |
| Preceitos | criar, ativar para corrente/grupos/indivíduos, rascunho, instruções, ciência, orientação, dispensa e encerramento | PARCIAL — central nativa completa compilada; API agora permite reabrir o rascunho e ativá-lo com proteção contra ciclos coletivos duplicados; validação real pendente |
| Configurações | identidade, conta, casa, foto, segurança, plano, WhatsApp, portal público e exclusão | PARCIAL — identidade, portal com tradição/status/métricas/prévia/compartilhamento, pedidos de reza, notificações, e-mail, senha e exclusão protegida compilados; assinatura consulta plano/ciclo/validade/preços reais e renova em Custom Tab segura; Central WhatsApp nativa consulta canal, edita automações, testa envio e exibe histórico; validação real pendente |
| Suporte | dados da conta, WhatsApp, descrição, validação, envio e confirmação | PARCIAL — fluxo nativo autenticado compilado; envio real e validação em aparelho pendentes |

## Filho de Santo

| Módulo | Funções do Web que precisam existir no Android | Estado |
|---|---|---|
| Central | resumo pessoal, pendências, agenda, avisos e atalhos | PARCIAL — central nativa ligada a dados pessoais reais e leitura de notificações sincronizada; validação real pendente |
| Perfil | cadastro civil, trajetória, coroa, quizilas, sacramentos, foto e contato | PARCIAL — identidade nativa, coroa, adjunto, cadastro civil, contato editável, quizilas, linha do tempo real e abertura autenticada de documentos compilados; validação no aparelho pendente |
| Obrigações | preceitos ativos, instruções, ciência e pedido de orientação | PARCIAL — leitura reservada, ciência e orientação integradas à mesma operação da zeladoria; validação real pendente |
| Mensalidade | situação, Pix/QR, copiar, comprovante e histórico | PARCIAL |
| Giras | agenda, detalhes e confirmação de presença | PARCIAL — agenda pessoal, detalhes, confirmação e recusa compilados; validação real pendente |
| Biblioteca | busca, categorias, permissões, leitura/download e discussões | PARCIAL — PDFs e fundamentos filtrados no servidor por tradição, cargo e autorização individual; dúvidas, respostas e exclusão autorizada compiladas; validação em aparelho pendente |
| Loja | vitrine, detalhes e pedidos | PARCIAL — vitrine, filtros, sacola, reserva, Pix e cobrança na mensalidade compilados; validação real em aparelho pendente |
| Comunicados | mural, categorias, busca, detalhes, compartilhamento e leitura | PARCIAL — experiência nativa compilada com os dados reais do mural; validação no aparelho pendente |
| Conversas | lista, texto, imagem, áudio, leitura e tempo real | PARCIAL — envio de mídia, gravação de voz, players Media3 e Realtime autenticado compilados; validação real pendente |
| Notificações | pendências reais, push, deep links, preferências e histórico | PARCIAL — inbox derivada das pendências reais, leitura sincronizada entre aparelhos, sincronização periódica Android em segundo plano e deep links para o módulo correto compilados; push instantâneo com entrega do servidor pendente |

## Qualidade obrigatória

- Acesso nativo: login de zeladoria e filho de santo, criação de terreiro com teste grátis e ciclo mensal/anual, restauração segura da sessão, visualização controlada da senha e solicitação de recuperação por e-mail compilados; conclusão do link ocorre no fluxo seguro de redefinição do AxéCloud.
- Navegação nativa e destinos independentes, sem WebView.
- Material 3 com identidade visual AxéCloud, componentes reutilizáveis e modo responsivo.
- Animações funcionais, continuidade entre lista/detalhe, estados vazios demonstrativos e feedback háptico onde fizer sentido.
- Acessibilidade, teclado, contraste, tamanhos de toque e suporte ao aumento de fonte.
- Rede e estados offline: detecção nativa, preservação da tela, aviso não bloqueante, recarga ao reconectar/retornar e cache estruturado Room criptografado pelo Android Keystore compilados; validação de restauração em aparelho pendente.
- Testes: suíte unitária cobre corrente, financeiro e preceitos; suíte instrumentada inicial valida identidade e alternância do login nativo e seu APK de testes compila; execução instrumentada, ampliação de cobertura, auditoria de segurança e validação no aparelho real ainda pendentes.
- Qualidade estática: Android Lint executado no aplicativo e nos testes sem erros; avisos de evolução de dependências permanecem registrados para atualização controlada.
- APK de desenvolvimento e AAB release otimizado gerados; configuração segura de assinatura, ícone adaptativo, splash e política de privacidade presentes. Chave privada, assinatura final e checklist da Play Store pendentes.
