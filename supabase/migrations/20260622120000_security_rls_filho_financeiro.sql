-- Restringe filhos ao próprio registro (filhos_de_santo) e lançamentos financeiros próprios.
-- Zeladores (perfil_lider) mantêm acesso ao tenant inteiro.

create or replace function public.auth_lider_tenant_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(p.tenant_id, p.id)
  from public.perfil_lider p
  where p.id = (select auth.uid());
$$;

create or replace function public.auth_filho_row_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select f.id
  from public.filhos_de_santo f
  where f.user_id = (select auth.uid());
$$;

grant execute on function public.auth_lider_tenant_ids() to authenticated;
grant execute on function public.auth_filho_row_ids() to authenticated;

-- filhos_de_santo: filho lê só o próprio; zelador lê/escreve o tenant
drop policy if exists "filhos tenant read" on public.filhos_de_santo;
create policy "filhos tenant read"
  on public.filhos_de_santo for select to authenticated
  using (
    user_id = (select auth.uid())
    or tenant_id in (select auth_lider_tenant_ids())
    or lider_id in (select auth_lider_tenant_ids())
    or (select auth_is_global_admin())
  );

drop policy if exists "filhos tenant write" on public.filhos_de_santo;
create policy "filhos tenant write"
  on public.filhos_de_santo for insert to authenticated
  with check (
    tenant_id in (select auth_lider_tenant_ids())
    or lider_id in (select auth_lider_tenant_ids())
    or (select auth_is_global_admin())
  );

create policy "filhos tenant update"
  on public.filhos_de_santo for update to authenticated
  using (
    tenant_id in (select auth_lider_tenant_ids())
    or lider_id in (select auth_lider_tenant_ids())
    or (select auth_is_global_admin())
  )
  with check (
    tenant_id in (select auth_lider_tenant_ids())
    or lider_id in (select auth_lider_tenant_ids())
    or (select auth_is_global_admin())
  );

create policy "filhos tenant delete"
  on public.filhos_de_santo for delete to authenticated
  using (
    tenant_id in (select auth_lider_tenant_ids())
    or lider_id in (select auth_lider_tenant_ids())
    or (select auth_is_global_admin())
  );

-- financeiro: filho lê só registros com filho_id próprio; escrita só zelador
drop policy if exists "financeiro tenant access" on public.financeiro;

create policy "financeiro select"
  on public.financeiro for select to authenticated
  using (
    (select auth_is_global_admin())
    or tenant_id in (select auth_lider_tenant_ids())
    or lider_id in (select auth_lider_tenant_ids())
    or filho_id in (select auth_filho_row_ids())
  );

create policy "financeiro insert"
  on public.financeiro for insert to authenticated
  with check (
    (select auth_is_global_admin())
    or tenant_id in (select auth_lider_tenant_ids())
    or lider_id in (select auth_lider_tenant_ids())
  );

create policy "financeiro update"
  on public.financeiro for update to authenticated
  using (
    (select auth_is_global_admin())
    or tenant_id in (select auth_lider_tenant_ids())
    or lider_id in (select auth_lider_tenant_ids())
  )
  with check (
    (select auth_is_global_admin())
    or tenant_id in (select auth_lider_tenant_ids())
    or lider_id in (select auth_lider_tenant_ids())
  );

create policy "financeiro delete"
  on public.financeiro for delete to authenticated
  using (
    (select auth_is_global_admin())
    or tenant_id in (select auth_lider_tenant_ids())
    or lider_id in (select auth_lider_tenant_ids())
  );
