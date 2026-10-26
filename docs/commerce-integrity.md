# Loja, Cantina e Financeiro — 26/10/2026

## Regras implementadas

- A Loja cria pedido, itens, baixa de estoque, lançamento financeiro e histórico na mesma transação SQL. Os preços vêm do catálogo do servidor.
- A identificação da tentativa evita duplicidade após reenvio. Reutilizar a identificação com outro carrinho é recusado.
- Reserva segura o estoque e não cria débito. Pode virar venda por Pix, dinheiro ou caderneta, sem uma segunda baixa de estoque.
- Dinheiro entra como recebido. Pix e caderneta ficam pendentes até a confirmação do responsável. A geração ou cópia do QR Code não confirma pagamento.
- Pix utiliza a chave configurada pelo terreiro, com valor e referência do pedido. Não há confirmação bancária automática neste fluxo.
- Confirmar, estornar a baixa e cancelar usam o mesmo lançamento financeiro. Cancelamento devolve o estoque uma vez; pagamento já baixado precisa ser estornado antes do cancelamento. Estorno contábil não executa devolução bancária.
- Loja e Cantina compartilham o limite do membro, com bloqueio da linha do membro durante compras a crédito.
- O cardápio da Cantina fica no servidor, isolado por terreiro. A importação preserva o cadastro local antigo, sem reativar itens já removidos. Edições desatualizadas são recusadas.
- Venda e pagamento têm datas distintas. Baixar uma venda antiga não muda o mês da venda; o caixa usa a data de pagamento.
- Cancelamentos permanecem no histórico e saem dos totais. Excluir pelo Financeiro um lançamento vinculado é recusado para preservar estoque e histórico.

## Conciliação legada

A auditoria identificou duas compras antigas com um débito original criado pela função SQL e um débito extra criado pela API. A migração cancela somente os dois extras ainda pendentes, valida as condições auditadas e guarda os registros anteriores em `comercio_eventos`. As compras e os débitos originais são preservados.

Os três pedidos antigos de mensalidade conciliados recebem vínculo com o débito correspondente e status pendente. Um pedido Pix antigo sem evidência de recebimento permanece pendente e passa a aparecer na Loja para conferência pelo responsável.

## Verificação

- Testes de API com autenticação e autorização reais, banco simulado: compra, preços adulterados, Pix pendente, autorização do membro, rejeição de outra casa, cardápio compartilhado e edição concorrente.
- Testes de falhas nas telas: erros de rede e HTTP preservam comanda, catálogo e formulário.
- Testes SQL executados no banco vinculado dentro de BEGIN/ROLLBACK: repetição, estoque, cancelamento, conversão de reserva, bloqueio de fiado, crédito compartilhado e datas de venda/recebimento. As operações de teste não permanecem no banco.
- Verificação visual local com dados simulados: cadastro e releitura do cardápio, baixa com atualização dos indicadores, ações de histórico e abertura do QR Code.
- Não foi feito pagamento real nem envio de mensagem para terceiros.

Referência técnica do BR Code: [Manual de Padrões para Iniciação do Pix — Banco Central](https://www.bcb.gov.br/content/estabilidadefinanceira/pix/Regulamento_Pix/II_ManualdePadroesparaIniciacaodoPix.pdf).
