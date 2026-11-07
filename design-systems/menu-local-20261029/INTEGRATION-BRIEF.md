# Revisão da integração local — etapa 17

Pedido: comparar informações modal por modal com o sistema atual, ligar o financeiro, remover recolhimento duplicado e o cartão Casa de demonstração, tornar perfil funcional, lançar mensalidades antigas com juros e oferecer andamento/retorno visível.

Escopo: somente esta prévia local em localhost:5188. Nenhuma API, autenticação, transação, mensagem, banco, deploy, commit ou alteração em produção. Contratos são comparados ao código atual em src/views e src/components, não a respostas de serviços reais.

Modo Operate. Extensão do shell já aprovado: Inter, floresta/dourado/areia, navegação móvel mantida. Sem uma nova composição visual ou tokens globais aprovados. O trabalho fecha os fluxos existentes e as lacunas de informações, sem substituir o mundo visual.

## Direção
- THESIS: uma cobrança deve ter um único registro que explique todos os seus reflexos.
- OWN-WORLD: manter a identidade local aprovada, com números em centavos e estados legíveis.
- STORY: lançar, conferir o vínculo no membro, receber, verificar o caixa e desfazer se necessário.
- FIRST VIEWPORT: navegação com apenas um recolhimento e perfil funcional; dados coerentes entre telas.
- FORM: formulários focados, roláveis, com validação, título/fechar acessíveis, cálculo explicado antes da confirmação e feedback de processamento sem porcentagens inventadas.

## Contratos conferidos
| Grupo de modais | Fonte do sistema atual | Resultado da revisão local |
| --- | --- | --- |
| Entrada, saída, mensalidade antiga | lib/manualFinance.ts; src/components/financial/SacredOverviewView.tsx; src/views/Financial.tsx | Descrição, categoria, tipo, valor base, vencimento/referência, membro obrigatório para mensalidade, pendente/quitada, juros fixos/percentuais de aplicação única; data do recebimento separada. |
| Baixa e reabertura de mensalidade | src/views/Financial.tsx | Registro único compartilhado; pendência fora do caixa, baixa em centavos e receita única, reversão devolve a pendência. |
| Cantina: item, consumo, baixa, aviso, limite, extrato | src/components/financial/CantinaView.tsx | Nome/preço/categoria/etiqueta/ícone, edição sem alterar histórico, avulso, itens/quantidades, membro, snapshots, limite/bloqueio compartilhado com Loja, mensagem apenas prévia local. Chips de categoria continuam ausentes conforme preferência anterior. |
| Configuração Pix | src/components/financial; src/views/Financial.tsx | Chave, tipo, beneficiário, valor sugerido e dia. Sugestões alimentam novos lançamentos, sem reescrever cobranças antigas. Não gera Pix real. |
| Loja: produto, sacola, revisão, ações do pedido | src/views/Store.tsx | Nome/descrição/preço/categoria/estoque/mínimo/foto local; pendência, reserva, recebimento e entrega; limite compartilhado, histórico e caixa. |
| Membro: cadastro, acesso, financeiro e anotações | src/views/Children.tsx; src/components/child-profile | CPF e situação acrescentados, vínculos por ID, financeiro compartilhado com mensalidades/cantina/loja/caixa e prévia local do membro. Acesso não cria login real. |
| Gira e operação | src/views/Calendar.tsx | Nome/tipo/data/hora/orientações/local, destaque, lembrete e limite de vagas; emissão de senhas respeita limite. |
| Obrigações | src/components/child-profile/ObligationScheduleModal.tsx | Membro/título/data/hora/orientações, PDF opcional validado e lembrete; PDF acessível também no histórico do membro. |
| Frequência | src/views e componentes de frequência | Presenças, ausências, justificativas, conclusão e reabertura conectadas ao histórico da corrente; confirmação não substitui chamada. |
| Comunicados | src/views/NoticeBoard.tsx | Categoria, expiração e preferência de WhatsApp acrescentadas aos campos existentes; conteúdo expirado não é mostrado na prévia de membro. |
| Mensagens | src/views/ChatInbox.tsx | Conversa, destinatários e anexos locais; rascunho preservado; estados locais/erro e indicadores de leitura. |
| Galeria | src/views/Gallery.tsx | Álbum, categoria, descrição, fotos/vídeos locais, visualização/legenda/remoção e restauração. |
| Estoque | src/views/Inventory.tsx | Nome/categoria/quantidade/mínimo e extras locais de unidade/local/observação; movimentos, histórico e lista de compras. |
| Biblioteca | src/views/Library.tsx | Título/categoria/PDF e extensão solicitada de acesso privado por filho; leitura, alteração de público, remoção e recuperação. |
| Radar | src/views/Radar e componentes públicos existentes | Identidade/endereço/redes/rotina/capa/retrato/galeria/publicações/serviços; editor e prévia usam o estado salvo. |
| Assinatura e suporte | src/views/Subscription.tsx; src/views/Support.tsx | Renovação/recebimento apenas de teste, separados do caixa da casa; orientação, pedido e complementos locais. Responsável, casa e WhatsApp são preenchidos a partir da conta, editáveis no pedido e preservados como snapshot. |
| Shell e configurações | navegação atual; src/views/Settings.tsx | Um recolhimento no cabeçalho, cartão removido, perfil com conta/WhatsApp/assinatura/suporte, foco/Escape; rascunhos preservados. |

MODAL-INVENTORY.json cataloga estruturas JSX, campos e ações. Estados condicionais do mesmo modal são agrupados; esse inventário é uma revisão de fonte e não uma declaração de execução de todas as combinações de estados.

## Processamento e limites
Retorno global acompanha a aplicação e a renderização das mudanças locais; arquivos mostram leitura real e impedem salvar enquanto são verificados. Não há latência de servidor simulada nem porcentagem artificial. Animações CSS usam transform/opacity, barra indeterminada e redução de movimento.

Ações de criar têm solicitação e confirmação de consumo compartilhadas: primeiro clique durante carregamento não se perde, e voltar à rota não reabre modal antigo. Recarregar continua reiniciando os exemplos e arquivos em memória, conforme o escopo do protótipo.
