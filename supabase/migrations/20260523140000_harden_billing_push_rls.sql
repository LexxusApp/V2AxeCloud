-- RLS em tabelas sensíveis ainda expostas via PostgREST (alertas Supabase + vazamento de chave PIX).

alter table if exists public.subscriptions enable row level security;

drop policy if exists "subscriptions tenant read" on public.subscriptions;
create policy "subscriptions tenant read"
  on public.subscriptions for select to authenticated
  using (
    id = auth.uid()
    or id in (select auth_user_tenant_ids())
    or auth_is_global_admin()
  );

alter table if exists public.configuracoes_pix enable row level security;

drop policy if exists "pix tenant read" on public.configuracoes_pix;
create policy "pix tenant read"
  on public.configuracoes_pix for select to authenticated
  using (
    terreiro_id in (select auth_user_tenant_ids())
    or auth_is_global_admin()
  );

drop policy if exists "pix zelador write" on public.configuracoes_pix;
create policy "pix zelador write"
  on public.configuracoes_pix for insert to authenticated
  with check (
    terreiro_id in (select auth_user_tenant_ids())
    or auth_is_global_admin()
  );

drop policy if exists "pix zelador update" on public.configuracoes_pix;
create policy "pix zelador update"
  on public.configuracoes_pix for update to authenticated
  using (
    terreiro_id in (select auth_user_tenant_ids())
    or auth_is_global_admin()
  )
  with check (
    terreiro_id in (select auth_user_tenant_ids())
    or auth_is_global_admin()
  );

drop policy if exists "pix zelador delete" on public.configuracoes_pix;
create policy "pix zelador delete"
  on public.configuracoes_pix for delete to authenticated
  using (
    terreiro_id in (select auth_user_tenant_ids())
    or auth_is_global_admin()
  );

alter table if exists public.push_subscriptions enable row level security;

drop policy if exists "push own rows" on public.push_subscriptions;
create policy "push own rows"
  on public.push_subscriptions for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
