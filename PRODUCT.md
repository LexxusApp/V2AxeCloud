# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- Zeladores e dirigentes que administram terreiros e casas de axé.
- Filhos de santo e membros que acompanham a rotina da própria casa.
- Pessoas que procuram uma casa de Umbanda, Candomblé, Jurema ou outra tradição afro-brasileira para conhecer, participar ou solicitar atendimento.

## Product Purpose

O AxéCloud reúne a gestão interna da casa e sua presença pública. O sistema organiza financeiro, mensalidades, corrente, giras, comunicação, documentos, patrimônio e memória; o diretório ajuda a comunidade a encontrar casas por cidade, bairro e perfil público.

## Positioning

Uma plataforma brasileira feita especificamente para casas de axé, conectando organização administrativa, comunicação oficial e descoberta pública sem interferir no fundamento religioso de cada casa.

## Operating Context

O produto é usado no celular e no computador. A zeladoria trabalha no painel autenticado; membros acessam áreas próprias; visitantes chegam pelo Google, pelo mapa e pelas páginas públicas de cidades e terreiros. Dados públicos do diretório podem vir de fontes públicas ou ser atualizados após reivindicação da casa.

## Capabilities and Constraints

- As páginas públicas de cidades e terreiros precisam preservar URLs, metadados, conteúdo rastreável e dados estruturados para SEO.
- A listagem por cidade usa dados reais com nome, endereço, telefone, fotografia, situação de verificação e link para o perfil. O filtro por bairro aparece apenas quando esse dado estiver estruturado.
- A reivindicação permite que responsáveis assumam e atualizem o perfil público da casa.
- A experiência pública deve funcionar bem em celulares, inclusive com toque, navegação por teclado, carregamento progressivo e conexões móveis.
- Informações privadas de cada terreiro devem permanecer isoladas; o diretório exibe apenas dados destinados ao público.

## Brand Commitments

- Nome: AxéCloud.
- Símbolo: tridente dourado.
- Identidade reconhecível: verde profundo, dourado, acolhimento, confiança e respeito às casas de axé.
- Voz em português brasileiro, clara, humana e respeitosa, sem linguagem genérica de tecnologia.

## Evidence on Hand

- Código e componentes em `src/`, com o diretório público em `src/views/portal/`.
- Dados reais das cidades e casas carregados pelas APIs e snapshots do diretório.
- Conteúdo SEO e prerenderização em `lib/diretorioSeoShared.ts` e `scripts/prerender-diretorio.ts`.
- Não inventar depoimentos, números comerciais ou alegações que não venham do sistema.

## Product Principles

1. Ajudar a casa a se organizar sem interferir em sua tradição.
2. Tornar a descoberta de uma casa simples, respeitosa e útil.
3. Mostrar ao usuário o que está acontecendo e qual é o próximo passo.
4. Preservar privacidade, isolamento entre terreiros e controle da zeladoria.
5. Tratar SEO, acessibilidade e desempenho móvel como parte do produto.

## Accessibility & Inclusion

A interface deve usar linguagem simples, contraste legível, foco visível, alvos de toque adequados e alternativas a animações. O diretório deve permanecer utilizável por teclado e em telas pequenas.
