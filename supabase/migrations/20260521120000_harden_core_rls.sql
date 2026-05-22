-- RLS hardening for core multi-tenant tables (defesa em profundidade além da API).

create or replace function public.auth_user_tenant_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(p.tenant_id, p.id)
  from public.perfil_lider p
  where p.id = auth.uid()
  union
  select coalesce(f.tenant_id, f.lider_id)
  from public.filhos_de_santo f
  where f.user_id = auth.uid();
$$;

create or replace function public.auth_is_global_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select is_admin_global from public.perfil_lider where id = auth.uid()),
    false
  );
$$;

-- gallery
alter table if exists public.gallery_albums enable row level security;
alter table if exists public.gallery_media enable row level security;

drop policy if exists "gallery_albums tenant access" on public.gallery_albums;
create policy "gallery_albums tenant access"
  on public.gallery_albums for all to authenticated
  using (tenant_id in (select auth_user_tenant_ids()) or auth_is_global_admin())
  with check (tenant_id in (select auth_user_tenant_ids()) or auth_is_global_admin());

drop policy if exists "gallery_media tenant access" on public.gallery_media;
create policy "gallery_media tenant access"
  on public.gallery_media for all to authenticated
  using (tenant_id in (select auth_user_tenant_ids()) or auth_is_global_admin())
  with check (tenant_id in (select auth_user_tenant_ids()) or auth_is_global_admin());

-- filhos_de_santo
alter table if exists public.filhos_de_santo enable row level security;

drop policy if exists "filhos tenant read" on public.filhos_de_santo;
create policy "filhos tenant read"
  on public.filhos_de_santo for select to authenticated
  using (
    user_id = auth.uid()
    or tenant_id in (select auth_user_tenant_ids())
    or lider_id in (select auth_user_tenant_ids())
    or auth_is_global_admin()
  );

drop policy if exists "filhos tenant write" on public.filhos_de_santo;
create policy "filhos tenant write"
  on public.filhos_de_santo for all to authenticated
  using (
    tenant_id in (select auth_user_tenant_ids())
    or lider_id in (select auth_user_tenant_ids())
    or auth_is_global_admin()
  )
  with check (
    tenant_id in (select auth_user_tenant_ids())
    or lider_id in (select auth_user_tenant_ids())
    or auth_is_global_admin()
  );

-- perfil_lider
alter table if exists public.perfil_lider enable row level security;

drop policy if exists "perfil self read" on public.perfil_lider;
create policy "perfil self read"
  on public.perfil_lider for select to authenticated
  using (id = auth.uid() or tenant_id in (select auth_user_tenant_ids()) or auth_is_global_admin());

drop policy if exists "perfil self write" on public.perfil_lider;
create policy "perfil self write"
  on public.perfil_lider for update to authenticated
  using (id = auth.uid() or auth_is_global_admin())
  with check (id = auth.uid() or auth_is_global_admin());

-- almoxarifado
alter table if exists public.almoxarifado enable row level security;

drop policy if exists "almoxarifado tenant access" on public.almoxarifado;
create policy "almoxarifado tenant access"
  on public.almoxarifado for all to authenticated
  using (
    tenant_id in (select auth_user_tenant_ids())
    or lider_id in (select auth_user_tenant_ids())
    or auth_is_global_admin()
  )
  with check (
    tenant_id in (select auth_user_tenant_ids())
    or lider_id in (select auth_user_tenant_ids())
    or auth_is_global_admin()
  );

-- financeiro
alter table if exists public.financeiro enable row level security;

drop policy if exists "financeiro tenant access" on public.financeiro;
create policy "financeiro tenant access"
  on public.financeiro for all to authenticated
  using (
    tenant_id in (select auth_user_tenant_ids())
    or lider_id in (select auth_user_tenant_ids())
    or auth_is_global_admin()
  )
  with check (
    tenant_id in (select auth_user_tenant_ids())
    or lider_id in (select auth_user_tenant_ids())
    or auth_is_global_admin()
  );

-- mural_avisos
alter table if exists public.mural_avisos enable row level security;

drop policy if exists "mural tenant access" on public.mural_avisos;
create policy "mural tenant access"
  on public.mural_avisos for all to authenticated
  using (tenant_id in (select auth_user_tenant_ids()) or auth_is_global_admin())
  with check (tenant_id in (select auth_user_tenant_ids()) or auth_is_global_admin());

-- biblioteca
alter table if exists public.biblioteca enable row level security;

drop policy if exists "biblioteca tenant access" on public.biblioteca;
create policy "biblioteca tenant access"
  on public.biblioteca for all to authenticated
  using (tenant_id in (select auth_user_tenant_ids()) or auth_is_global_admin())
  with check (tenant_id in (select auth_user_tenant_ids()) or auth_is_global_admin());

-- calendario_axe
alter table if exists public.calendario_axe enable row level security;

drop policy if exists "calendario tenant access" on public.calendario_axe;
create policy "calendario tenant access"
  on public.calendario_axe for all to authenticated
  using (
    tenant_id in (select auth_user_tenant_ids())
    or lider_id in (select auth_user_tenant_ids())
    or auth_is_global_admin()
  )
  with check (
    tenant_id in (select auth_user_tenant_ids())
    or lider_id in (select auth_user_tenant_ids())
    or auth_is_global_admin()
  );

-- produtos (loja)
alter table if exists public.produtos enable row level security;

drop policy if exists "produtos tenant access" on public.produtos;
create policy "produtos tenant access"
  on public.produtos for all to authenticated
  using (tenant_id in (select auth_user_tenant_ids()) or auth_is_global_admin())
  with check (tenant_id in (select auth_user_tenant_ids()) or auth_is_global_admin());

notify pgrst, 'reload schema';
