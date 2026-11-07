# Mensalidades, Cantina e Pix — prévia local

29/10/2026. Implementação restrita a `design-systems/menu-local-20261029`. Menu, cabeçalho e barra inferior aprovados preservados. Nenhuma alteração em produção, API, autenticação ou dados reais. As três novas composições aguardam avaliação do usuário.

## Composições

- Mensalidades: resumo dividido entre pendências e recebimentos, progresso da corrente, lista expansível e orientação lateral; pilha própria no celular.
- Cantina: resumo areia, cardápio com ilustrações e cores suaves, comanda lateral no desktop e abaixo do cardápio no celular. Sem categorias junto de Novo item. Caderneta em cartões por membro.
- Pix: formulário em três etapas e prévia em verde profundo, separando o preenchimento dos dados apresentados ao membro.

Inter e identidade verde/dourado preservadas. Os novos estilos têm escopo por página. Animações decorativas não foram acrescentadas; redução de movimento mantida.

## Fluxos conferidos pela interface

- Mensalidades inicialmente R$ 400 em aberto e R$ 1.200 recebidos. Baixa de André: R$ 200 em aberto, R$ 1.400 recebidos e saldo do caixa R$ 1.000. Baixa de Caio e desfazer restauraram a pendência sem duplicar o recebimento.
- Busca sem resultado, detalhes do membro, prévia de lembrete sem envio, estado de erro e retorno aos dados conferidos. Fechar o diálogo com Escape devolveu foco ao botão de lembrete.
- Cantina: dois cafés de R$ 3,50 e um salgado de R$ 7,50 totalizaram R$ 14,50. Anotação ficou vinculada ao identificador de André, com quantidades, preços unitários e totais no extrato. Trocar de página preservou o consumo. A anotação não alterou o saldo do caixa.
- Acerto de R$ 14,50 zerou a pendência e levou o saldo do caixa de R$ 1.000 a R$ 1.014,50. O mesmo consumo não continuou disponível para nova baixa.
- Novo produto Suco natural de R$ 6,00, com ilustração de bebida fria, entrou no cardápio. Venda avulsa recebida levou os recebimentos da Cantina a R$ 20,50. O histórico à vista permanece separado da caderneta.
- No celular, adicionar dois cafés e retirar um deixou uma unidade de R$ 3,50; anotação para Caio preservou o detalhe correto.
- Pix vazio exibiu erro de formato. E-mail `casa@example.invalid`, beneficiário Casa de demonstração, R$ 180 e vencimento dia 15 salvaram apenas em memória. A configuração foi mantida ao trocar de aba. Valor zero foi recusado; descartar restaurou R$ 180. A ação de copiar exibiu confirmação. Nenhuma chave ou conta bancária foi consultada.
- Contribuições existentes de outubro permanecem em R$ 200; o valor sugerido do Pix é configuração para demonstração, sem gerar novas cobranças.

## Responsividade e acessibilidade

Verificadas larguras de 1920, 1366, 390 e 320px. Nas três páginas, nenhum overflow horizontal observado: em 1366px, clientWidth/scrollWidth 1360; em 390px, 384; em 320px, 314. As quatro abas financeiras continuam visíveis e a barra inferior permanece acessível.

Formulários usam campos de 16px no celular. Diálogos Radix incluem título, descrição e retorno de foco. Controles desabilitados não executam ações; confirmações distinguem anotação de recebimento.

Medições pontuais do Pix antes do último ajuste de contraste: situação salva 5,42:1; ajuda dos campos 4,85:1; texto de orientação no cartão verde 7,35:1. A descrição introdutória foi escurecida após leitura limítrofe de 4,50:1. Estas verificações não substituem auditoria completa de acessibilidade ou aparelho físico.

## Compilação e revisão

TypeScript focado e build Vite isolado concluídos sem erros. Detector Impeccable executado uma vez para cada novo componente de página, retornando `[]`. Console do navegador sem avisos ou erros durante a conferência dos fluxos.

Conferência própria em modo degradado, mantendo a limitação de revisão independente indisponível registrada na etapa anterior. Parecer em `.impeccable/review/financial-workflows/SELF-REVIEW.md`; sem aprovação para produção.

Capturas na mesma pasta de revisão: desktop, notebook e celular de cada área, caderneta mobile e Pix em 320px. Algumas capturas mostram o cenário após as operações de teste, com valores explicitamente demonstrativos.

## Limites

Protótipo de interface com operações locais. Reinicia ao recarregar; não é migração dos módulos de produção. Catálogo, configuração Pix, caderneta e baixas usam memória compartilhada pela navegação. Sem QR Code pagável, mensagens, conciliação bancária, cobrança real, cadastro bancário verificado ou persistência no banco.
