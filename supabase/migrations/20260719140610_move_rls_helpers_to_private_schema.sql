-- Remove helpers SECURITY DEFINER da superfície RPC do schema public.
-- As policies existentes dependem dos OIDs das funções; ALTER ... SET SCHEMA
-- preserva essas dependências sem reabrir recursão de RLS.

create schema if not exists axecloud_private;

revoke all on schema axecloud_private from public, anon;
grant usage on schema axecloud_private to authenticated, service_role;

do $$
begin
  if to_regprocedure('public.auth_user_tenant_ids()') is not null then
    alter function public.auth_user_tenant_ids() set schema axecloud_private;
  end if;
  if to_regprocedure('public.auth_lider_tenant_ids()') is not null then
    alter function public.auth_lider_tenant_ids() set schema axecloud_private;
  end if;
  if to_regprocedure('public.auth_filho_row_ids()') is not null then
    alter function public.auth_filho_row_ids() set schema axecloud_private;
  end if;
  if to_regprocedure('public.auth_is_global_admin()') is not null then
    alter function public.auth_is_global_admin() set schema axecloud_private;
  end if;
  if to_regprocedure('public.auth_user_conversation_ids()') is not null then
    alter function public.auth_user_conversation_ids() set schema axecloud_private;
  end if;
end
$$;

revoke all on function axecloud_private.auth_user_tenant_ids() from public, anon;
revoke all on function axecloud_private.auth_lider_tenant_ids() from public, anon;
revoke all on function axecloud_private.auth_filho_row_ids() from public, anon;
revoke all on function axecloud_private.auth_is_global_admin() from public, anon;
revoke all on function axecloud_private.auth_user_conversation_ids() from public, anon;

grant execute on function axecloud_private.auth_user_tenant_ids() to authenticated, service_role;
grant execute on function axecloud_private.auth_lider_tenant_ids() to authenticated, service_role;
grant execute on function axecloud_private.auth_filho_row_ids() to authenticated, service_role;
grant execute on function axecloud_private.auth_is_global_admin() to authenticated, service_role;
grant execute on function axecloud_private.auth_user_conversation_ids() to authenticated, service_role;
