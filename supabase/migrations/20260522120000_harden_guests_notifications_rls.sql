-- RLS para convidados de eventos e notificações (complemento ao harden_core_rls).

-- convidados_eventos — acesso via evento do calendário do terreiro
alter table if exists public.convidados_eventos enable row level security;

drop policy if exists "convidados via calendario tenant" on public.convidados_eventos;
create policy "convidados via calendario tenant"
  on public.convidados_eventos for all to authenticated
  using (
    exists (
      select 1
      from public.calendario_axe e
      where e.id = convidados_eventos.event_id
        and (
          e.tenant_id in (select auth_user_tenant_ids())
          or e.lider_id in (select auth_user_tenant_ids())
          or auth_is_global_admin()
        )
    )
  )
  with check (
    exists (
      select 1
      from public.calendario_axe e
      where e.id = convidados_eventos.event_id
        and (
          e.tenant_id in (select auth_user_tenant_ids())
          or e.lider_id in (select auth_user_tenant_ids())
          or auth_is_global_admin()
        )
    )
  );

-- notificacoes
alter table if exists public.notificacoes enable row level security;

drop policy if exists "notificacoes tenant access" on public.notificacoes;
create policy "notificacoes tenant access"
  on public.notificacoes for all to authenticated
  using (tenant_id in (select auth_user_tenant_ids()) or auth_is_global_admin())
  with check (tenant_id in (select auth_user_tenant_ids()) or auth_is_global_admin());

notify pgrst, 'reload schema';
