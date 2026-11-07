# Filhos de Santo — validação local de 29/10/2026

Dashboard validada provisoriamente pelo usuário: “beleza por enquanto validado. prossiga”. Menu e cabeçalho já aprovados foram preservados. Esta etapa amplia somente lista e perfil de membros no protótipo, sem publicação. Filhos de Santo ainda aguarda avaliação visual do usuário.

## Implementação

`MembersPage.tsx` e `members.css`: resumo da corrente, busca por nome/registro/função, filtros, ordenação, cuidados, aniversários, identificação do perfil e quatro seções. Cadastro, edição e anotações operam em memória; recarregar restaura os oito exemplos. Evolução espiritual explicita ausência de obrigações, sem inventar fundamentos. E-mail de exemplo usa o domínio reservado `example.invalid`; telefone, CPF e informações religiosas não são preenchidos automaticamente.

`main.tsx` mantém os membros em estado compartilhado. Alterar o nome ajusta referências da baixa e da caderneta na demonstração. Novo cadastro recebe registro DEMO e não cria cobrança ou acesso. O seletor de Cantina usa a mesma lista. Dashboard conserva o desenho validado; apenas seus contadores passam a acompanhar membros criados e a excluir cadastros sem cobrança do total pendente. `style.css` e navegação não foram redesenhados.

## Conferência executada

- Busca `andre` encontra André; termo inexistente mostra estado sem resultado; Limpar filtros restaura a lista.
- Filtro de mensalidade pendente retorna André e Caio; contagem inicial de dois.
- Ordenação por entrada retorna Caio e Davi (05/09/2026) antes dos demais.
- Editar André para André Nascimento Demo mantém o nome da mensalidade atualizado; a baixa simulada reduz pendentes para um e o perfil mostra Em dia.
- Cadastro Membro de Demonstração cria DEMO-0009, sem lançamento e sem acesso. Dashboard local mostra nove membros, seis com acesso e três sem app, sem nova cobrança.
- Nome duplicado apresenta erro no formulário. Nome tem rótulo, validação nativa e associação ao erro.
- Anotação de exemplo salva com data/hora de Brasília e reaparece no perfil durante a sessão.
- Foco vai ao título ao abrir perfil e retorna à linha ao voltar. Escape no acesso retorna ao acionador; Escape no cadastro retorna a Novo membro.
- Estados vazio, carregando e falha simulados; recuperação funciona. Esses controles alteram apenas o cenário exibido da página, sem apagar a coleção de exemplos.
- Lista e perfil sem rolagem horizontal nas larguras 1920, 1366, 390 e 320px. Em 320px, documento e scrollWidth de 314px; formulário de 288px sem overflow. Barra inferior mobile preservada.
- Detector Impeccable executado uma vez no novo componente: `[]`.
- TypeScript focado e build Vite isolado passaram. Último carregamento sem erros/avisos de console capturados.

## Evidências e revisão

Capturas em `.impeccable/review/members/`: `desktop-list.jpg`, `desktop-profile.jpg`, `laptop-list.jpg`, `mobile-list.jpg`, `mobile-profile.jpg`, `mobile-profile-sections.jpg`, `mobile-320-profile.jpg`. Capturas mostram viewports, incluindo posições de rolagem necessárias às seções; não são todas imagens do documento inteiro.

Conferência própria, seguindo o procedimento degradado da skill Impeccable; a revisão independente continua indisponível por limite de uso. Parecer limitado à apresentação local: composição, texto, controles e estados conferidos sem bloqueio material identificado. Não representa auditoria completa de acessibilidade, teste em aparelho físico, permissões, autenticação, financeiro real ou aprovação de produção.

## Registro do sistema visual

Paleta: verde profundo, dourado pontual e superfície clara já aprovados.
Tipografia: Inter; identidade do perfil 23–32px, leitura de linhas 12–15px e campos mobile 16px.
Layout: resumo em faixa, lista com cuidados laterais no desktop, linhas em duas partes no celular.
Componentes: identificação, estados de cobrança/acesso, controles de seção e formulários locais.
Interação: foco visível, Escape nos diálogos e redução de movimento respeitada.

Nenhum desvio visual novo foi promovido à identidade de produção. Este registro preserva as decisões aprovadas e documenta a extensão pendente de aceite.
