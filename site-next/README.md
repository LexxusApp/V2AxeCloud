# AxéCloud — site institucional cinematográfico

Nova experiência pública do AxéCloud, construída em Next.js/Vinext com Manrope local, GSAP, ScrollTrigger, Lenis e Framer Motion.

## Rodar localmente

```bash
npm install
npm run dev -- --hostname localhost --port 4173
```

Acesse `http://localhost:4173`.

## Verificação antes de publicar

```bash
npm run check
```

O comando valida lint, build, HTML renderizado, metadados, JSON-LD, robots, sitemap e arquivos de descoberta.

O build gera o bundle consumido pelo Worker do Cloudflare.

```bash
npm run build
npx wrangler deploy --config ../wrangler.site-home.jsonc
```

## Limites de produção

Este projeto substitui somente a experiência institucional da raiz (`/`). O aplicativo autenticado, o login real, cadastro, checkout, diretório, eventos, conteúdo, páginas legais, APIs e sitemap dinâmico continuam pertencendo ao sistema principal.

Antes de publicar, valide as rotas canônicas, assets, sitemap e o gateway de produção.
