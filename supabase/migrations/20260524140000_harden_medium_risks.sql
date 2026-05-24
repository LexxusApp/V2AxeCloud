-- Endurecimento médio: RLS comentários/preferências, revoke RPC sensível de anon/authenticated.

-- M6: biblioteca_comentarios — policy legada só via perfil_lider.tenant_id (filhos excluídos)
drop policy if exists "Comentarios_All" on public.biblioteca_comentarios;

alter table if exists public.biblioteca_comentarios enable row level security;

drop policy if exists "biblioteca_comentarios tenant access" on public.biblioteca_comentarios;
create policy "biblioteca_comentarios tenant access"
  on public.biblioteca_comentarios for all to authenticated
  using (
    tenant_id in (select auth_user_tenant_ids())
    or auth_is_global_admin()
    or user_id = (select auth.uid())
  )
  with check (
    tenant_id in (select auth_user_tenant_ids())
    or auth_is_global_admin()
    or user_id = (select auth.uid())
  );

-- M6: preferencias_usuario — remove policy SELECT duplicada
drop policy if exists "Users can view own preferences" on public.preferencias_usuario;

drop policy if exists "preferencias own rows" on public.preferencias_usuario;
create policy "preferencias own rows"
  on public.preferencias_usuario for all to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- M8: funções SECURITY DEFINER — não executáveis por anon/authenticated via PostgREST
revoke all on function public.processar_checkout(uuid, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.processar_checkout(uuid, uuid, text, jsonb) to service_role;

revoke all on function public.auth_user_tenant_ids() from public, anon, authenticated;
revoke all on function public.auth_is_global_admin() from public, anon, authenticated;

revoke all on function public.get_my_tenant_id() from public, anon, authenticated;
revoke all on function public.get_tenant_id() from public, anon, authenticated;
revoke all on function public.is_admin() from public, anon, authenticated;
revoke all on function public.is_admin_global() from public, anon, authenticated;
revoke all on function public.is_super_admin() from public, anon, authenticated;

revoke all on function public.log_system_event(text, text, text, text, text, text, text, jsonb) from public, anon, authenticated;

-- Triggers internos continuam com owner postgres/supabase_admin
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.prevent_admin_escalation() from public, anon, authenticated;

notify pgrst, 'reload schema';
