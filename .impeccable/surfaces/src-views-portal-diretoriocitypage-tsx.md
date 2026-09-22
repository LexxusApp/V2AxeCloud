---
version: 1
slug: "src-views-portal-diretoriocitypage-tsx"
primary_target: "src/views/portal/DiretorioCityPage.tsx"
related_targets: ["src/components/portal/DirectoryClaimAcquisitionCta.tsx", "src/components/portal/DiretorioTerreiroCard.tsx"]
---

# Diretório por cidade

## Scope

Rota pública `/terreiros/:estado/:cidade`. Visitor mode: Operate.

## Audience and job

Pessoas que procuram uma casa de axé precisam comparar resultados reais de uma cidade por nome, bairro e endereço, abrir um perfil e confirmar o contato. Responsáveis por uma casa podem localizar o próprio perfil e iniciar a reivindicação.

## Constraints

Preservar URLs, metadados, conteúdo rastreável, dados reais, navegação ao perfil e identidade verde profunda com dourado. A experiência deve ser rápida no celular, acessível por teclado e igual para todas as cidades.

## Direction contract

THESIS: Um guia local que coloca a descoberta antes da promoção. Recusa o carrossel que esconde dezenas de casas e a sequência de grandes blocos antes dos resultados.

OWN-WORLD: Verde profundo, dourado e superfícies claras do AxéCloud. Cantos de 12-16px, tipografia Manrope, ícones Lucide já adotados e controles com foco visível.

STORY: A pessoa reconhece a cidade, pesquisa, filtra por bairro, compara as casas e abre o perfil. A reivindicação aparece como ação secundária para responsáveis.

FIRST VIEWPORT: Cabeçalho compacto com cidade, total real e uma busca dominante. Logo abaixo, reivindicação secundária à esquerda e grade de resultados à direita. Quando a API fornece bairros estruturados, o filtro ocupa a lateral no desktop e vira uma faixa horizontal no celular.

FORM: Guia local pesquisável, candidato 4 da composição de superfície. Seed `a5a835d4`. A interação memorável é a transição direta entre bairro e resultados, sem esconder conteúdo em carrossel.

FINISH: A entrega termina com revisão independente, verificação responsiva e documentação dos padrões reutilizáveis.

## Unresolved decisions

Nenhuma decisão de conteúdo ou dados foi inventada. O mapa permanece na rota principal do diretório; esta página organiza a cidade.
