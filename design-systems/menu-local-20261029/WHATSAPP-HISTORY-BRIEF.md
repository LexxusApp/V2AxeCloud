# Histórico de disparos — etapa 15

Pedido do usuário: incluir na área de WhatsApp em Configurações um histórico de disparos bem-sucedidos e falhos. Extensão local do protótipo, preservando o menu/cabeçalho/dock aprovados, o formulário de automações e a conexão simulada.

Modo Operate, mesma identidade Inter/verde/dourado. Duas visões da área do WhatsApp: Automações e Histórico de disparos. O histórico usa uma lista contínua expansível, com resultado por texto e ícone, nome, tipo, telefone mascarado, data/hora de Brasília e detalhes inline. No mobile a mesma lista se reorganiza verticalmente, sem tabela larga ou rolagem horizontal.

Filtros combináveis por busca sem acento, tipo, período e resultado. Sucesso significa Entregue ou Lido; Enviado e Na fila seguem Em andamento. Contagens respeitam os filtros de busca/tipo/período; cada botão indica sua contagem sem depender da seleção de resultado. Lista em ordem de solicitação mais recente primeiro; eventos em ordem cronológica. Paginação de seis registros; trocar filtros retorna à primeira página. Sem resultados oferece recuperação.

Detalhes: identificação/template de exemplo, conteúdo, acompanhamento e motivo/orientação nas falhas. Não há botão que simule um reenvio como se fosse real. Nenhuma mensagem enviada, agendada ou cobrada. Os dez registros sintéticos têm datas fixas em um snapshot até 31/10/2026; abrir a página não gera datas novas. Telefone somente mascarado. Configurações, conexão e reset de preferências não alteram o conjunto de histórico; dados são fornecidos pelo pai e não pelo rascunho da configuração.

Somente `design-systems/menu-local-20261029`, sem produção, API, banco, webhook, Meta ou credenciais. Para integração futura, resultados devem vir do serviço de envio e respectivos callbacks, isolados por casa e com timestamps persistidos. Este protótipo não confirma o funcionamento desse serviço. Não há novo raster ou biblioteca.
