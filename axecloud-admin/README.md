# AxéCloud Command (painel admin paralelo)

Aplicação **separada** do SPA principal (`src/`). Corre em **http://localhost:5174** e usa o **mesmo backend** (`npm run dev` na raiz → porta 3000) via proxy `/api`.

## Acesso de administrador

O backend aceita quem tiver **uma** das condições:

1. E-mail listado em `ADMIN_CONSOLE_EMAILS` (ou `ADMIN_EMAILS`) no `.env` do servidor, **ou**
2. `perfil_lider.is_admin_global = true` para o utilizador autenticado.

Define no `.env` da raiz do AxéCloud, por exemplo:

```env
ADMIN_CONSOLE_EMAILS=teu@email.com
```

Reinicia o servidor após alterar.

## Configuração local

1. Copia `axecloud-admin/.env.example` para `axecloud-admin/.env` e preenche `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (iguais ao app principal).
2. Na raiz: `npm run dev` (API em :3000).
3. `npm run dev:admin` na raiz **ou** `cd axecloud-admin && npm run dev`.

## Produção

- Podes hospedar esta pasta como **segundo site** (outro domínio ou subdomínio `admin.…`) com `npm run build` e servir `axecloud-admin/dist`.
- O browser precisa de chamar a **mesma origem da API** ou configurar CORS no servidor para o domínio do admin.

## Rotas API usadas (`/api/admin-console/*`, `/api/admin/*`)

Implementadas no backend (`api/admin-console-routes.ts`, `api/index.ts`, `server.ts`). Não coloques `service_role` no frontend.
