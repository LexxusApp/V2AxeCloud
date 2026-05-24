-- RLS tenant-scoped para caixinha e ritual_tasks (remove policies auth.role() permissivas).

-- caixinha_metas
drop policy if exists "Enable all access for authenticated users on metas" on public.caixinha_metas;
drop policy if exists "Enable read access for all authenticated users on metas" on public.caixinha_metas;

alter table if exists public.caixinha_metas enable row level security;

drop policy if exists "caixinha_metas tenant access" on public.caixinha_metas;
create policy "caixinha_metas tenant access"
  on public.caixinha_metas for all to authenticated
  using (tenant_id in (select auth_user_tenant_ids()) or auth_is_global_admin())
  with check (tenant_id in (select auth_user_tenant_ids()) or auth_is_global_admin());

-- caixinha_doacoes (via meta do terreiro)
drop policy if exists "Enable read access for all authenticated users on doacoes" on public.caixinha_doacoes;
drop policy if exists "Enable insert for authenticated users on doacoes" on public.caixinha_doacoes;
drop policy if exists "Enable update for authenticated users on doacoes" on public.caixinha_doacoes;
drop policy if exists "Enable delete for authenticated users on doacoes" on public.caixinha_doacoes;

alter table if exists public.caixinha_doacoes enable row level security;

drop policy if exists "caixinha_doacoes tenant access" on public.caixinha_doacoes;
create policy "caixinha_doacoes tenant access"
  on public.caixinha_doacoes for all to authenticated
  using (
    exists (
      select 1
      from public.caixinha_metas m
      where m.id = caixinha_doacoes.meta_id
        and (m.tenant_id in (select auth_user_tenant_ids()) or auth_is_global_admin())
    )
    or auth_is_global_admin()
  )
  with check (
    exists (
      select 1
      from public.caixinha_metas m
      where m.id = caixinha_doacoes.meta_id
        and (m.tenant_id in (select auth_user_tenant_ids()) or auth_is_global_admin())
    )
    or auth_is_global_admin()
  );

-- ritual_tasks (via evento do calendário)
drop policy if exists "Enable read access for all users" on public.ritual_tasks;
drop policy if exists "Enable insert for authenticated users only" on public.ritual_tasks;
drop policy if exists "Enable update for authenticated users only" on public.ritual_tasks;
drop policy if exists "Enable delete for authenticated users only" on public.ritual_tasks;

alter table if exists public.ritual_tasks enable row level security;

drop policy if exists "ritual_tasks via calendario tenant" on public.ritual_tasks;
create policy "ritual_tasks via calendario tenant"
  on public.ritual_tasks for all to authenticated
  using (
    exists (
      select 1
      from public.calendario_axe e
      where e.id = ritual_tasks.event_id
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
      where e.id = ritual_tasks.event_id
        and (
          e.tenant_id in (select auth_user_tenant_ids())
          or e.lider_id in (select auth_user_tenant_ids())
          or auth_is_global_admin()
        )
    )
  );

notify pgrst, 'reload schema';
