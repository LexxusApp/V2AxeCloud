# Rituais no diretório

Piloto com Azazel (02/11/2026, R$ 57) e Rei Paimon (13/11/2026, R$ 127), do Templo de Quimbanda Maria Padilha das Almas. Datas de 2026 e WhatsApp 5511970697597 autorizados pelo usuário. A modalidade não é exibida; participação e dúvidas são tratadas diretamente com o templo. Não publicar local, horário ou modalidade sem confirmação.

## Direction contract

THESIS: conectar a busca por terreiros à descoberta de rituais com data e contato direto.

OWN-WORLD: extensão do diretório atual, com seus tokens de verde profundo, dourado, tipografia e raios. As artes fornecidas são o material de divulgação.

STORY: encontrar o destaque, conferir o ritual e conversar com o templo pelo WhatsApp.

FIRST VIEWPORT: busca preservada, dois cards compactos antes do mapa; em celular, faixa com rolagem horizontal nativa. Detalhe com título, templo, data, valor e botão de contato antes do cartaz no celular.

FORM: extensão pontual especificada na conversa, sem sorteio de conceito ou alteração do sistema visual. Movimento limitado ao feedback de ação.

FINISH: validar desktop, celular, links, assets, métricas e expiração. Revisão proporcional ao piloto.

## Cadastro e publicação

- Editar `cinematic-site/featured-rituals.json` para acrescentar, trocar ou remover divulgações; este piloto ainda não inclui cadastro no painel.
- Copiar a arte para `cinematic-site/assets/` e informar o caminho no catálogo. Artes atuais copiadas, sem alterações, dos anexos enviados pelo usuário.
- `posterText` contém os parágrafos do texto de divulgação fornecido pelo templo. No detalhe, a transcrição acessível aparece após o cartaz, no controle nativo “Ler o texto do cartaz”, com atribuição ao templo.
- `date` é a data pública; `expiresAt` é o início do dia seguinte em Brasília (`America/Sao_Paulo`, `-03:00`). O build omite destaques vencidos; o navegador os oculta ao carregar, a cada minuto e ao voltar a uma aba antiga, ocultando a seção quando não restam ativos. As páginas individuais permanecem acessíveis como arquivo, com aviso e links de WhatsApp para consultar próximos rituais.
- `npm run build:landing` gera os cards e as páginas estáticas em `/eventos/:slug`, com canonical e imagem social. O instalador pode ser executado sobre um `landing-dist` já preparado para prévia local.
- `ritual_promotion_view`, `ritual_promotion_details` e `ritual_promotion_whatsapp` usam a ponte existente `window.axeTrack`; `promotionId` identifica o ritual e `surface` distingue `directory` de `ritual_page`. A observação de impressões aguarda `DOMContentLoaded` para a ponte de métricas deferida (ou começa imediatamente se o documento já estiver completo). Uma impressão exige pelo menos 50% do elemento visível, sem `hidden`, e envio pela ponte; ocorre uma vez por elemento a cada carregamento. Sem `IntersectionObserver`, não há impressão. Cliques incluem `destination` e `archived`; não comprovam conversa ou inscrição.
- Preparar o build não publica o conteúdo. Publicação segue o fluxo de produção do projeto.

## Métricas no admin

Em **Visão geral → Anúncios de rituais**, escolher últimos 7 ou 30 dias e usar o botão de atualizar. Cada ritual mostra visualizações do destaque no diretório (pelo menos 50% visível), cliques para abrir detalhes e cliques no WhatsApp. Contagens são de ações, não de pessoas únicas ou inscrições confirmadas.

A consulta `/api/admin-console/ritual-promotions` é atendida pelo Worker admin: valida a sessão na API antes de consultar contagens exatas no Supabase, usando os secrets que já existem nesse Worker. Retorna somente agregados; não entrega identificadores nem dados de visitantes. Erros aparecem como indisponibilidade, sem apresentar zero como se fosse um resultado válido. Não exige alteração no container da API nem no banco.

## Validação do piloto

Instalador e validador geraram e validaram 11 páginas, com 15 rotas preservadas verificadas. Os 10 testes passaram após os ajustes finais, cobrindo expiração, WhatsApp, métricas, autenticação administrativa e filtros existentes do diretório. Conferidos desktop, celular e expansão da transcrição no navegador.

Publicado em 26/10/2026, após autorização do usuário e envio dos commits à main. Marketing: versão `31e486c7-d0b9-46a2-90b3-b18b142aa548`. Admin: versão `a0c7038f-e842-4ec9-b71d-09a634e78978`. Páginas dos dois rituais e cartazes responderam 200; admin entregue com o novo bundle e métricas sem sessão responderam 401. A conferência autenticada do painel fica disponível à sessão do usuário; nenhum acesso foi fabricado. A base administrativa anterior foi comparada ao bundle de produção por SHA-256 antes de acrescentar o painel, preservando as funções existentes.
