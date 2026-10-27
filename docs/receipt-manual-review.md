# Comprovantes de mensalidade: revisão pelo zelador

O envio do membro cria um protocolo em análise ligado a uma mensalidade específica. A dívida continua pendente; somente seus lembretes automáticos ficam pausados. A IA auxilia a leitura e nunca confirma que o dinheiro entrou na conta.

Em **Financeiro → Mensalidades → Comprovantes**, o zelador pode abrir a imagem privada, conferir os alertas, corrigir a leitura e confirmar o recebimento integral. Confirmação explícita, data efetiva, identificador bancário e beneficiário são obrigatórios. Com alertas ou IA indisponível, é necessária justificativa. A rejeição exige motivo e retoma a elegibilidade no próximo agendamento normal de cobrança.

O membro acompanha protocolo, status e motivo em **Minha mensalidade → Seus comprovantes**. CPF incompleto ou leitura indisponível não impedem o envio. Apenas imagens JPEG/PNG/WebP estáticas válidas de até 5 MB são aceitas. O bucket é privado e links de visualização expiram em 5 minutos.

A decisão é transacional: grava auditoria, baixa uma única dívida e registra evento, ou não grava nada. SHA do arquivo e identificador bancário não podem quitar duas dívidas. Repetir uma decisão confirmada é idempotente. Pagamento por outra via encerra a revisão aberta. A data do recebimento é preservada separadamente do vencimento/competência.

Comprovantes históricos continuam no histórico; não possuem imagem retroativa. Clientes antigos recebem mensagem explícita de revisão, sem anunciar pagamento confirmado. WhatsApp de confirmação é acionado somente após a aprovação persistida, sujeito à disponibilidade e às regras do canal.

## Validação

- 28 cenários SQL no banco vinculado, todos em transação com rollback: autorização, tenants, repetição, setembro pago em outubro, valor integral, duplicidade, pagamento por outra via e rollback de atualização sem linha afetada.
- 47 testes automatizados de API/regras/financeiro/notificações/lembretes: formato real de imagem, IA indisponível, CPF incompleto, resposta perdida, clientes antigos e acesso privado.
- Navegador com dados locais ilustrativos: upload, seleção de mensalidade, aprovação, rejeição e larguras 320/390/1440 pixels.

Não foram enviados comprovantes reais para a IA nem confirmados pagamentos reais durante os testes. A imagem, isoladamente, não autentica uma transferência bancária.
