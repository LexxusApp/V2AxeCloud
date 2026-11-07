# Visão geral do Financeiro — 29/10/2026

## Direção e escopo

O usuário pediu mais ousadia, cor e organização própria para cada página, preservando as telas anteriores para revisão posterior. Esta etapa aplica a regra à visão geral do Financeiro: saldo em verde profundo, pendências em dourado, fluxo em verde/terracota e extrato com detalhes expansíveis. Menu, cabeçalho, barra inferior e desenho das páginas anteriores foram preservados. As quatro abas financeiras passam a uma grade no celular para ficarem visíveis sem a barra de rolagem apertada.

Implementação em `FinancialOverview.tsx`, `financial-overview.css` e `finance.ts`; integração de estado em `main.tsx`. Nada foi publicado ou integrado ao sistema real. Mensalidades, Cantina e Pix continuam acessíveis, mas seus desenhos não foram reformulados nesta etapa.

## Modelo demonstrativo

Valores internos em centavos inteiros. O caixa inicial deriva de seis mensalidades recebidas de R$ 200,00 menos despesas de R$ 280,00 e R$ 120,00: saldo de R$ 800,00. Os dois membros pendentes somam R$ 400,00 a receber e não entram no saldo disponível. Recebimentos da Cantina e baixas simuladas usam o mesmo estado da prévia. Não existe chamada à API, transferência, cobrança ou envio de mensagem.

O período filtra gráfico e extrato; o saldo total inclui todos os períodos e o bloco de pendências mostra contribuições e consumos ainda em aberto. As reservas litúrgicas permanecem identificadas como integradas ao caixa, sem inventar saldos ou percentuais separados. Exemplos reiniciam ao recarregar.

O formulário registra valores já recebidos ou pagos. Vincular um membro identifica o lançamento no extrato; não cria nem quita mensalidade. A interface explica que mensalidades pendentes ficam na aba própria. Datas futuras são impedidas no cenário de referência de 29/10/2026.

## Verificações executadas

Os cenários abaixo foram feitos separadamente; os valores de um cenário não são somados aos de outro.

| Cenário | Resultado observado |
| --- | --- |
| Entrada com centavos | Doação de R$ 150,25 vinculada a Mariana: saldo R$ 800,00 → R$ 950,25; extrato identifica membro e categoria. |
| Editar | Doação alterada para R$ 180,10: saldo R$ 980,10. |
| Remover e desfazer | Saldo R$ 980,10 → R$ 800,00 → R$ 980,10. |
| Atalho de despesa | Velas e defumação abre saída/Insumos preenchida; R$ 19,90 resulta em saldo R$ 960,20 no cenário com doação. |
| Períodos | Entrada de setembro de R$ 50,00: saldo total R$ 1.010,20; extrato de setembro com apenas R$ 50,00. |
| Gráfico interativo | Semana 2 filtra R$ 400,00 de entradas e R$ 280,00 de saídas: resultado R$ 120,00. |
| Busca e filtros | Saídas filtradas e busca sem resultado; Limpar filtros restaura o extrato. |
| Exportação | CSV contém somente linhas exibidas, ambiente de demonstração e valores negativos numéricos. Textos com prefixos de fórmula são protegidos sem transformar o valor monetário em texto. Arquivo exportado lido para conferir cabeçalho e linhas. |
| Valor inválido | Valor zero apresenta orientação de preenchimento; valor com vírgula e centavos é aceito. |
| Saldo negativo | Despesa de R$ 900,00 partindo de R$ 800,00: saldo −R$ 100,00 e estado de atenção. A descrição não afirma disponibilidade quando o saldo é negativo. |
| Mensalidade | Após reiniciar os exemplos, baixa de André: saldo R$ 800,00 → R$ 1.000,00; pendências R$ 400,00 → R$ 200,00. |
| Cantina | Recebimento de café de R$ 3,50 após a baixa: caixa R$ 1.003,50 e entradas R$ 1.403,50. |
| Estados | Novembro sem movimento mantém saldo total e identifica extrato vazio; simulação sem dados zera os exemplos visíveis. Falha e carregamento permitem recuperação sem exibir valores indisponíveis como zero. |
| Foco | Escape no formulário retorna a Novo lançamento. Formulário mobile de 358px em viewport de 390px. |

## Responsividade e contraste

Conferidas larguras de 1920, 1366, 390 e 320px, sem overflow horizontal do documento. Em 320px, clientWidth e scrollWidth de 314px. As áreas empilham na ordem saldo, fluxo, pendências, extrato e atalhos; as quatro abas financeiras ficam em duas colunas. A barra inferior mantém os destinos aprovados.

Escala do gráfico abreviada com unidade visível em reais, evitando quebra dos rótulos em celular. Valores completos continuam nos dados e nomes acessíveis dos botões.

Medições pontuais via estilos do DOM: descrição do saldo 7,71:1; descrição das pendências 4,70:1; valores de saída do gráfico 5,87:1; descrição de seção 5,09:1. Não constituem auditoria completa de acessibilidade ou teste em aparelho físico.

## Compilação e evidências

TypeScript focado: código 0. Build Vite isolado: código 0, 1740 módulos. Detector Impeccable executado uma vez no novo componente: `[]`.

Capturas em `.impeccable/review/financial/`: `desktop.jpg`, `desktop-ledger.jpg`, `laptop.jpg`, `mobile.jpg`, `mobile-flow.jpg`, `mobile-320.jpg`. Algumas mostram a posição de rolagem do extrato ou gráfico; imagens de viewport podem excluir a barra de rolagem.

Conferência própria substitui a revisão independente indisponível, conforme o procedimento degradado da skill Impeccable. Resultado restrito à apresentação local; detalhes em `.impeccable/review/financial/SELF-REVIEW.md`. A visão financeira ainda aguarda avaliação do usuário. Autenticação, banco real, conciliação, permissões e publicação estão fora desta etapa.

## Registro visual

Paleta: verde profundo para saldo, dourado para pendências e terracota para saídas.
Tipo: Inter; saldo 39–60px no cenário inicial, leitura de linhas 12–14px e campos mobile 16px.
Composição: grade assimétrica dedicada à tarefa financeira, sem repetir a faixa de quatro indicadores das outras páginas.
Componentes: gráfico filtrável, extrato expansível, atalhos de caixa e formulário de entrada/saída.
Estados: saldo positivo/negativo, foco, erro, carregamento, vazio, desfazer e movimento reduzido.
