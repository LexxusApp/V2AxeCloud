# Almoxarifado — direção da etapa local

Mode: Operate. Usuário autorizou prosseguir para a próxima página, mantendo a regra de visual e organização próprios, mais personalidade e alguma cor. Menu e cabeçalho estão aprovados. Somente a prévia em localhost:5188 pode mudar, sem produção, APIs, publicação ou dados reais.

Mundo existente: Inter, navegação verde profundo, dourado pontual e conteúdo claro. Estrutura escolhida: bancada de estoque em lista contínua e lista de reposição areia/argila ao lado; resumo inline, sem repetir quatro cards de indicadores. Cada registro traz unidade, saldo, mínimo e localização. Em celular, as áreas empilham e os controles compactam para antecipar os itens; barra inferior preservada.

Conteúdo herdado: cadastrar/editar/remover item, categorias Camarinha/Rituais/Cozinha de Santo/Vestuário/Limpeza, quantidade atual e mínima, entrada/saída, filtro e lista de compras. Ampliação demonstrativa: unidade explícita, localização, conferência e histórico antes/depois. Não é integração com o inventário ou financeiro real.

Primeiro viewport: identificar itens disponíveis e reposições necessárias, acessar a lista e cadastrar novo item sem banner decorativo. Interação central: registrar quantidade com motivo obrigatório, prévia de saldo e histórico coerente; impedir saldo negativo ou fração em unidade indivisível. Reposição calcula a diferença até o mínimo cadastrado, nunca inventa previsão de consumo.

Qualidade: dados demonstrativos identificados, nenhuma soma de unidades incompatíveis, horários de Brasília, ordenação por instante, busca sem acentos, foco restaurado nos diálogos, rolagem interna em celular, vazio/carregamento/falha operáveis. Estados em memória compartilhados entre rotas e reiniciados ao recarregar. Aceite visual desta página pendente.

Escopo de escrita: somente design-systems/menu-local-20261029. Arquivos da página: inventory.ts, InventoryPage.tsx, inventory.css. Inclusão na rota local em main.tsx. Sem novos pacotes ou assets raster.
