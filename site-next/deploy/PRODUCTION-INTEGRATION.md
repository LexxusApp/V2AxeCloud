# Integração segura na produção

## Regra principal

O site novo deve assumir apenas:

- `/`
- `/_next/*` e os arquivos estáticos gerados por este serviço

O sistema atual deve continuar responsável por:

- `/entrar`, `/register`, `/recuperar-senha` e autenticação
- `/dashboard`, `/consulente` e demais áreas autenticadas
- `/terreiros`, `/terreiro`, `/eventos`, `/evento`, `/conteudo`, `/por-que-axecloud`, `/recursos`
- `/termos`, `/privacidade` e `/espaco-do-fiel`
- `/api/*`, `/.well-known/*`, `/openapi.json` e `/auth.md`
- `/sitemap.xml`, porque o sitemap dinâmico atual inclui milhares de páginas públicas

Isso evita que a página visual de acesso deste protótipo substitua o login funcional ou crie redirecionamento circular em produção.

## Ordem de roteamento no Caddy

As rotas específicas do sistema atual precisam ser avaliadas antes da raiz. Somente o `handle /` deve apontar para o novo serviço. Os assets `/_next/*` também devem apontar para ele. Não use um fallback geral para o site novo.

Exemplo conceitual:

```caddyfile
handle /sitemap.xml {
    reverse_proxy app:3000
}

handle /_next/* {
    reverse_proxy axecloud-site:3000
}

handle / {
    reverse_proxy axecloud-site:3000
}

handle {
    reverse_proxy app:3000
}
```

O arquivo Caddy real já possui regras de segurança, API, marketing e sitemap. A alteração final deve preservar essas regras e trocar apenas o destino exato da raiz.

## Checklist de publicação

1. Executar `npm ci`, `npm run check` e `npm audit --omit=dev`.
2. Gerar a imagem com `docker build -t axecloud-site .` e testar em uma porta interna da VPS.
3. Confirmar que `/entrar`, `/register`, `/sitemap.xml`, `/terreiros`, `/eventos` e `/conteudo` continuam vindo do sistema atual.
4. Confirmar `200` em `/`, `/_next/*`, `/robots.txt` e `/llms.txt`.
5. Validar canonical, Open Graph, JSON-LD e a imagem social da raiz.
6. Fazer o corte no proxy com rollback preparado.
7. Após publicar, enviar novamente o sitemap atual no Google Search Console e acompanhar indexação e conversões.

## Rollback

Reapontar somente o `handle /` para o container `marketing` atual. Nenhum dado, login ou rota interna precisa ser migrado para desfazer a troca.
