# Site cinematográfico — operação de produção

O site novo faz parte do build oficial de marketing. Ele não cria um segundo sistema e não assume autenticação, cadastro ou dados privados.

## Donos das rotas

| Rotas | Responsável |
| --- | --- |
| `/`, `/terreiros`, `/eventos`, `/conteudo`, `/conteudo/calendario-liturgico`, `/por-que-axecloud`, `/espaco-do-fiel` | HTML cinematográfico versionado |
| `/register`, `/termos`, `/privacidade`, artigos e páginas dinâmicas de cidade, terreiro e evento | React de marketing atual |
| `/entrar`, painel e APIs | aplicação principal |

O arquivo `__react_shell.html` é interno ao nginx e preserva rotas públicas dinâmicas que ainda não tenham HTML pré-renderizado.

## Build e conferência local

1. `npm run build:all`
2. `npm run preview:marketing:production`
3. Conferir desktop (1280×720), notebook (1024×768) e celular (390×844).
4. Conferir `/register`, `/entrar`, uma cidade, um terreiro, um artigo, termos e privacidade.
5. Conferir console, mapa, totais, eventos, preço e CTAs.

O `build:landing` falha automaticamente se uma página nova perder canonical/description, apontar para asset inexistente, sobrescrever cadastro/jurídico ou tentar assumir `/entrar`.

## Publicação e reversão

A publicação continua usando o fluxo Docker atual. O container `marketing` recebe `landing-dist`; Caddy mantém APIs e autenticação no container `app`. Em caso de regressão, volte para a imagem anterior do container de marketing e valide `/register` e `/entrar` antes de reabrir tráfego.
