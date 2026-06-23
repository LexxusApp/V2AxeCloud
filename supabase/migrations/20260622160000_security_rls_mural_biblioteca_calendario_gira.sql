-- Escrita restrita a zeladores em mural, biblioteca, calendário e operações de gira.
-- Filhos mantêm leitura no tenant (onde aplicável).

-- mural_avisos
drop policy if exists "mural tenant access" on public.mural_avisos;

create policy "mural tenant read"
  on public.mural_avisos for select to authenticated
  using (tenant_id in (select auth_user_tenant_ids()) or (select auth_is_global_admin()));

create policy "mural lider insert"
  on public.mural_avisos for insert to authenticated
  with check (tenant_id in (select auth_lider_tenant_ids()) or (select auth_is_global_admin()));

create policy "mural lider update"
  on public.mural_avisos for update to authenticated
  using (tenant_id in (select auth_lider_tenant_ids()) or (select auth_is_global_admin()))
  with check (tenant_id in (select auth_lider_tenant_ids()) or (select auth_is_global_admin()));

create policy "mural lider delete"
  on public.mural_avisos for delete to authenticated
  using (tenant_id in (select auth_lider_tenant_ids()) or (select auth_is_global_admin()));

-- biblioteca
drop policy if exists "biblioteca tenant access" on public.biblioteca;

create policy "biblioteca tenant read"
  on public.biblioteca for select to authenticated
  using (tenant_id in (select auth_user_tenant_ids()) or (select auth_is_global_admin()));

create policy "biblioteca lider insert"
  on public.biblioteca for insert to authenticated
  with check (tenant_id in (select auth_lider_tenant_ids()) or (select auth_is_global_admin()));

create policy "biblioteca lider update"
  on public.biblioteca for update to authenticated
  using (tenant_id in (select auth_lider_tenant_ids()) or (select auth_is_global_admin()))
  with check (tenant_id in (select auth_lider_tenant_ids()) or (select auth_is_global_admin()));

create policy "biblioteca lider delete"
  on public.biblioteca for delete to authenticated
  using (tenant_id in (select auth_lider_tenant_ids()) or (select auth_is_global_admin()));

-- biblioteca_comentarios: leitura no tenant; insert próprio ou zelador; mutação só zelador
drop policy if exists "biblioteca_comentarios tenant access" on public.biblioteca_comentarios;

create policy "biblioteca_comentarios tenant read"
  on public.biblioteca_comentarios for select to authenticated
  using (
    tenant_id in (select auth_user_tenant_ids())
    or user_id = (select auth.uid())
    or (select auth_is_global_admin())
  );

create policy "biblioteca_comentarios insert"
  on public.biblioteca_comentarios for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (
      tenant_id in (select auth_user_tenant_ids())
      or (select auth_is_global_admin())
    )
  );

create policy "biblioteca_comentarios lider update"
  on public.biblioteca_comentarios for update to authenticated
  using (tenant_id in (select auth_lider_tenant_ids()) or (select auth_is_global_admin()))
  with check (tenant_id in (select auth_lider_tenant_ids()) or (select auth_is_global_admin()));

create policy "biblioteca_comentarios lider delete"
  on public.biblioteca_comentarios for delete to authenticated
  using (
    user_id = (select auth.uid())
    or tenant_id in (select auth_lider_tenant_ids())
    or (select auth_is_global_admin())
  );

-- calendario_axe
drop policy if exists "calendario tenant access" on public.calendario_axe;

create policy "calendario tenant read"
  on public.calendario_axe for select to authenticated
  using (
    tenant_id in (select auth_user_tenant_ids())
    or lider_id in (select auth_user_tenant_ids())
    or (select auth_is_global_admin())
  );

create policy "calendario lider insert"
  on public.calendario_axe for insert to authenticated
  with check (
    tenant_id in (select auth_lider_tenant_ids())
    or lider_id in (select auth_lider_tenant_ids())
    or (select auth_is_global_admin())
  );

create policy "calendario lider update"
  on public.calendario_axe for update to authenticated
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

create policy "calendario lider delete"
  on public.calendario_axe for delete to authenticated
  using (
    tenant_id in (select auth_lider_tenant_ids())
    or lider_id in (select auth_lider_tenant_ids())
    or (select auth_is_global_admin())
  );

-- evento_participantes / evento_senhas / gira_velas
drop policy if exists "evento_participantes tenant access" on public.evento_participantes;
drop policy if exists "evento_senhas tenant access" on public.evento_senhas;
drop policy if exists "gira_velas tenant access" on public.gira_velas;

create policy "evento_participantes tenant read"
  on public.evento_participantes for select to authenticated
  using (tenant_id in (select auth_user_tenant_ids()) or (select auth_is_global_admin()));

create policy "evento_participantes lider write"
  on public.evento_participantes for insert to authenticated
  with check (tenant_id in (select auth_lider_tenant_ids()) or (select auth_is_global_admin()));

create policy "evento_participantes lider update"
  on public.evento_participantes for update to authenticated
  using (tenant_id in (select auth_lider_tenant_ids()) or (select auth_is_global_admin()))
  with check (tenant_id in (select auth_lider_tenant_ids()) or (select auth_is_global_admin()));

create policy "evento_participantes lider delete"
  on public.evento_participantes for delete to authenticated
  using (tenant_id in (select auth_lider_tenant_ids()) or (select auth_is_global_admin()));

create policy "evento_senhas tenant read"
  on public.evento_senhas for select to authenticated
  using (tenant_id in (select auth_user_tenant_ids()) or (select auth_is_global_admin()));

create policy "evento_senhas lider insert"
  on public.evento_senhas for insert to authenticated
  with check (tenant_id in (select auth_lider_tenant_ids()) or (select auth_is_global_admin()));

create policy "evento_senhas lider update"
  on public.evento_senhas for update to authenticated
  using (tenant_id in (select auth_lider_tenant_ids()) or (select auth_is_global_admin()))
  with check (tenant_id in (select auth_lider_tenant_ids()) or (select auth_is_global_admin()));

create policy "evento_senhas lider delete"
  on public.evento_senhas for delete to authenticated
  using (tenant_id in (select auth_lider_tenant_ids()) or (select auth_is_global_admin()));

create policy "gira_velas tenant read"
  on public.gira_velas for select to authenticated
  using (tenant_id in (select auth_user_tenant_ids()) or (select auth_is_global_admin()));

create policy "gira_velas lider insert"
  on public.gira_velas for insert to authenticated
  with check (tenant_id in (select auth_lider_tenant_ids()) or (select auth_is_global_admin()));

create policy "gira_velas lider update"
  on public.gira_velas for update to authenticated
  using (tenant_id in (select auth_lider_tenant_ids()) or (select auth_is_global_admin()))
  with check (tenant_id in (select auth_lider_tenant_ids()) or (select auth_is_global_admin()));

create policy "gira_velas lider delete"
  on public.gira_velas for delete to authenticated
  using (tenant_id in (select auth_lider_tenant_ids()) or (select auth_is_global_admin()));
