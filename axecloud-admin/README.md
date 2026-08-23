# AxéCloud Command — painel admin paralelo

Aplicação **separada** do SPA principal (`src/`). SPA Vite/React que consome o backend `/api/*` do projecto AxéCloud principal.

## Início rápido local

Dê dois cliques em `INICIAR-ADMIN-LOCAL.bat`. O inicializador abre o backend do AxeCloud e o **Control Center** em `http://localhost:5174`.

O redesign administrativo é local e mantém as APIs, permissões, auditoria e ações existentes.

- **Dev local:** `http://localhost:5174` (proxy `/api` → `http://localhost:3000`).
- **Produção:** container Docker `admin` na VPS, servido em `https://admin.axecloud.com.br`. O Caddy faz proxy de `/api/*` para o container `app`.

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

## Publicação na VPS

O painel entra no stack Docker (`deploy/docker-compose.yml`, serviço `admin`) e no Caddy (`admin.axecloud.com.br`).

DNS (Cloudflare): registo **A** `admin` → IP da VPS, proxy ligado.

Para actualizar:

```bash
cd /opt/axecloud && git pull
docker compose -f deploy/docker-compose.yml --env-file .env build admin app
docker compose -f deploy/docker-compose.yml --env-file .env up -d admin app
```

O browser chama `/api/...` no mesmo host; o Caddy encaminha para o container `app`. Não é preciso `VITE_API_BASE_URL` em produção.

### Service Worker

Não há PWA neste subprojecto; o painel admin não regista service worker (evita estado preso por cache).

## Rotas API consumidas

Todas em `/api/admin-console/*` e `/api/admin/*`, definidas em `api/admin-console-routes.ts`, `api/index.ts` e `server.ts`. **Nunca** coloques `service_role` no frontend.
