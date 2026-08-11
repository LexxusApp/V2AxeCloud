# AxéCloud Android — matriz de paridade

Esta matriz é o contrato de conclusão do aplicativo. Um item só muda para `CONCLUÍDO` depois de funcionar com dados reais, ter tratamento de erro e ser validado em aparelho.

## Zeladoria

| Módulo | Funções do Web que precisam existir no Android | Estado |
|---|---|---|
| Início | resumo da casa, pendências, próxima ação, atalhos, notificações | PARCIAL |
| Filhos de Santo | listar, pesquisar, filtrar, ordenar, cadastrar, visualizar, editar, excluir, foto, acesso e situação financeira | PARCIAL — lista, busca, filtros inclusive sem acesso, três ordenações, cadastro, edição, exclusão, foto de perfil, mensalidade, envio individual e coletivo de acesso compilados; validação real pendente |
| Giras | agenda, calendário, criar/editar/excluir, detalhes, confirmações, QR Code e presença | PARCIAL |
| Frequência | relatório, histórico e indicadores por filho/gira; operação de presença por evento | PARCIAL — relatório e histórico detalhado nativos; operação por gira fica no Centro de Gira; validação real pendente |
| Comunicados | lista, categorias, criar/editar/excluir, anexos, publicação e histórico | PARCIAL |
| Conversas | lista, mensagens, envio de texto, imagem e áudio, leitura e tempo real | PARCIAL — texto, imagem, vídeo, seleção e gravação nativa de áudio, players Media3, leitura e atualização contínua a cada 5s compilados; realtime Supabase pendente |
| Financeiro | resumo, lançamentos, filtros, criar/excluir, relatório e caixinha | PARCIAL — caixa, lançamentos, exclusão, relatório CSV pelo compartilhamento nativo, Pix, metas e validação de doações compilados; edição não existe na API web atual e validação real está pendente |
| Mensalidades | pendentes/pagas, cobrar, liquidar, estornar, comprovantes e histórico | PARCIAL — zeladoria consulta, cobra pelo canal oficial, liquida e estorna; filho consulta Pix/QR/histórico e envia comprovante para validação automática; validação real pendente |
| Configuração Pix | cobrança ativa, valor, vencimento, chave, beneficiário e validação | PARCIAL — formulário e persistência nativos; validação em aparelho pendente |
| Galeria | álbuns, filtros, criar/editar/excluir, upload, visualização e remoção de mídia | PARCIAL — fluxo e reprodução Media3 nativos compilados; upload e vídeo em aparelho real pendentes |
| Almoxarifado | estoque, busca/filtros, cadastro, edição, movimentação, alertas e exclusão | PARCIAL |
| Biblioteca | materiais, categorias, acesso controlado, upload, edição, leitura/download e exclusão | PARCIAL — PDFs e Acervo de Fundamentos nativos; banhos/ervas/rituais, tradição, cargo, acesso individual, rascunho/publicação/arquivo compilados; validação real pendente |
| Atendimentos | agenda, pedidos de reza, status, detalhes, cadastro e histórico | PARCIAL — central nativa de pedidos, busca, acolhimento, oração, notas, WhatsApp e conclusão compilados; agenda/cadastro/histórico dependem de API Web equivalente |
| Loja | produtos, categorias, cadastro/edição, estoque, pedidos e status | PARCIAL — vitrine, busca, sacola, checkout, catálogo, edição, exclusão e pedidos recentes nativos; gestão de status dos pedidos pendente |
| Preceitos | criar, ativar para corrente/grupos/indivíduos, rascunho, instruções, ciência, orientação, dispensa e encerramento | PARCIAL — central nativa completa compilada; API agora permite reabrir o rascunho e ativá-lo com proteção contra ciclos coletivos duplicados; validação real pendente |
| Configurações | identidade, conta, casa, foto, segurança, plano, WhatsApp, portal público e exclusão | PARCIAL — identidade, portal, pedidos de reza, notificações, e-mail, senha e exclusão protegida compilados; assinatura consulta plano/ciclo/validade/preços reais e renova em Custom Tab segura; Central WhatsApp nativa consulta canal, edita automações, testa envio e exibe histórico; validação real pendente |
| Suporte | dados da conta, WhatsApp, descrição, validação, envio e confirmação | PARCIAL — fluxo nativo autenticado compilado; envio real e validação em aparelho pendentes |

## Filho de Santo

| Módulo | Funções do Web que precisam existir no Android | Estado |
|---|---|---|
| Central | resumo pessoal, pendências, agenda, avisos e atalhos | PARCIAL |
| Perfil | cadastro civil, trajetória, coroa, quizilas, sacramentos, foto e contato | PARCIAL — identidade nativa, coroa, adjunto, cadastro civil, contato editável, quizilas e linha do tempo de obrigações reais compilados; abertura de documentos e validação no aparelho pendentes |
| Obrigações | preceitos ativos, instruções, ciência e pedido de orientação | PARCIAL — leitura reservada, ciência e orientação integradas à mesma operação da zeladoria; validação real pendente |
| Mensalidade | situação, Pix/QR, copiar, comprovante e histórico | PARCIAL |
| Giras | agenda, detalhes e confirmação de presença | PARCIAL |
| Biblioteca | busca, categorias, permissões, leitura e download | PARCIAL — PDFs e fundamentos filtrados no servidor por tradição, cargo e autorização individual; validação em aparelho pendente |
| Loja | vitrine, detalhes e pedidos | PARCIAL — vitrine, filtros, sacola, reserva e cobrança na mensalidade nativos; validação real em aparelho pendente |
| Comunicados | mural, categorias, anexos e leitura | PARCIAL |
| Conversas | lista, texto, imagem, áudio, leitura e tempo real | PARCIAL — envio de mídia, gravação de voz, players Media3 e atualização contínua compilados; realtime Supabase pendente |
| Notificações | pendências reais, push, deep links, preferências e histórico | PARCIAL — inbox, leitura e deep links nativos validados; transporte push em segundo plano pendente |

## Qualidade obrigatória

- Navegação nativa e destinos independentes, sem WebView.
- Material 3 com identidade visual AxéCloud, componentes reutilizáveis e modo responsivo.
- Animações funcionais, continuidade entre lista/detalhe, estados vazios demonstrativos e feedback háptico onde fizer sentido.
- Acessibilidade, teclado, contraste, tamanhos de toque e suporte ao aumento de fonte.
- Rede e estados offline: detecção nativa, preservação da tela, aviso não bloqueante, recarga ao reconectar e ao retornar ao app compilados; cache local estruturado ainda pendente.
- Testes: suíte unitária inicial cobre corrente, financeiro e preceitos e está passando; testes de repositório/UI, instrumentados, auditoria de segurança e validação em aparelho real ainda pendentes.
- APK e AAB assináveis, ícone adaptativo, splash, política de privacidade e checklist da Play Store.
