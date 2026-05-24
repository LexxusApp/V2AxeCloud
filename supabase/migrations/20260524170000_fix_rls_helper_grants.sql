-- M8 revogou EXECUTE de auth_user_tenant_ids/auth_is_global_admin em authenticated.
-- As policies RLS dependem dessas funções; sem EXECUTE o PostgREST retorna 403.
-- Mantém revogado em public/anon (sem RPC anônimo); authenticated precisa EXECUTE interno.

grant execute on function public.auth_user_tenant_ids() to authenticated;
grant execute on function public.auth_is_global_admin() to authenticated;

notify pgrst, 'reload schema';
