# AxéCloud Command — painel admin paralelo

Aplicação **separada** do SPA principal (`src/`). SPA Vite/React que consome o backend `/api/*` do projecto AxéCloud principal.

## Início rápido local

Dê dois cliques em `INICIAR-ADMIN-LOCAL.bat`. O inicializador abre o backend do AxeCloud e o **Control Center** em `http://localhost:5174`.

O redesign administrativo é local e mantém as APIs, permissões, auditoria e ações existentes.

- **Dev local:** `http://localhost:5174` (proxy `/api` → `http://localhost:3000`).
- **Produção:** publica-se como **segundo projecto Vercel**; o `vercel.json` reescreve `/api/*` para a API do app principal (`https://axecloud-app.vercel.app`).

## Acesso de administrador

O backend autoriza o utilizador se **uma** destas condições for verdadeira:

1. e-mail listado em `ADMIN_CONSOLE_EMAILS` (ou `ADMIN_EMAILS`) no `.env` do servidor, **ou**
2. `perfil_lider.is_admin_global = true` para o utilizador autenticado.

Define no `.env` da raiz do AxéCloud, por exemplo:

```env
ADMIN_CONSOLE_EMAILS=teu@email.com
```

Reinicia o servidor depois de alterar.

## Configuração local

1. Copia `axecloud-admin/.env.example` para `axecloud-admin/.env` e preenche `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (iguais ao app principal).
2. Na raiz: `npm run dev` (API Express em `:3000`).
3. `npm run dev:admin` na raiz **ou** `cd axecloud-admin && npm run dev`.

## Publicação no Vercel (segundo projecto)

Pré-requisitos:

- O app principal (`axecloud-app`) já está publicado em `https://axecloud-app.vercel.app` — o `axecloud-admin/vercel.json` redirige `/api/*` para lá. Se o domínio do app principal for outro, edita esse ficheiro.

Passos no painel Vercel:

1. **New Project → Import Git Repository** e escolhe o repo `LexxusApp/V2AxeCloud`.
2. Em **Root Directory** seleciona `axecloud-admin`.
3. **Framework Preset:** Vite (preenche automaticamente; o `vercel.json` força os comandos).
4. **Environment Variables** (escopo *Production* e *Preview*):

   - `VITE_SUPABASE_URL` — `https://<projecto>.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` — anon key do mesmo projecto Supabase

   Não definas `VITE_PROXY_API` em produção (não é usada — vai pelos rewrites do Vercel).
5. **Deploy.** O Vercel constrói com `npm run build` e serve `dist/`.

### Domínio recomendado

Em **Settings → Domains** atribui um subdomínio dedicado, ex.: `admin.axecloud.com.br` ou `axecloud-admin.vercel.app`.

### CORS

Não é preciso configurar nada extra. O `axecloud-admin/vercel.json` faz proxy edge-side:

- O navegador vê `https://axecloud-admin.vercel.app/api/...`
- O Vercel reescreve para `https://axecloud-app.vercel.app/api/...`

Como é mesma origem do ponto de vista do browser, **não há pré-flight CORS**. Os headers `Authorization`, `Content-Type`, etc. são propagados.

### Service Worker

Não há PWA neste subprojecto; o painel admin não regista service worker (evita estado preso por cache). Se algum dia for adicionado, considera prefixar com um version bump idêntico ao do app principal.

## Rotas API consumidas

Todas em `/api/admin-console/*` e `/api/admin/*`, definidas em `api/admin-console-routes.ts`, `api/index.ts` e `server.ts`. **Nunca** coloques `service_role` no frontend.
