# Cantina — histórico, etapa 16

Pedido: a Cantina precisa ter histórico. Extensão Operate da prévia local em #financial-cantina; preservar menu/cabeçalho/dock, Balcão rápido, Caderneta e dados entre rotas. Sem produção, API, cobrança, Pix ou mensagem real.

Adicionar terceira aba Histórico. Duas visões: Comandas (data do consumo, situação atual, itens/quantidades/preços de origem) e Recebimentos (data do dinheiro recebido, valor, comandas vinculadas). Não somar os totais das duas visões: representam etapas da mesma operação. Começa vazio; gera registros somente pelas operações feitas na sessão. Sem inserir histórico fictício automaticamente.

Lista expansível em vez de nova estrutura de cards. Verde/floresta/areia/Inter vigentes. No celular, código/valor, pessoa/data e situação/detalhes empilhados. Busca por membro, código ou produto; período, origem e situação, contagem e total filtrados; seis registros por página; vazio recuperável. Horários absolutos de Brasília.

Confirmação de venda preserva nome do membro, nomes/preços/quantidades dos itens e horário. À vista cria comanda quitada e um recebimento atômico. Caderneta cria só consumo em aberto. Dar baixa quita apenas comandas ainda abertas e cria um recebimento único com seus vínculos; não reescreve baixas anteriores. Identificador por confirmação e operações puras idempotentes evitam repetição. Cancelar não cria registro.

O caixa local passa a receber um lançamento por recebimento da Cantina, com ID estável e data real de recebimento na sessão, substituindo a antiga soma agregada de data fixa. Não soma consumo pendente nem duplica valor quando se consulta o histórico. Compatibilidade numérica anterior do helper financeiro é preservada, sem migração ou acesso remoto.

Estado no pai entre rotas; recarregar reinicia a prévia. Metadados opcionais dos consumos antigos em memória recebem fallback honesto: horário de recebimento não registrado, sem inventar baixa. Nenhum controle de apagar/editar ou reabrir histórico foi adicionado. Integração persistente e autorização por casa serão posteriores à validação local.
