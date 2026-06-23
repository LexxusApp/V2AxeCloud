-- Escrita em almoxarifado e galeria restrita a zeladores (perfil_lider).
-- Filhos e demais autenticados mantêm leitura no tenant via auth_user_tenant_ids().

-- almoxarifado
drop policy if exists "almoxarifado tenant access" on public.almoxarifado;

create policy "almoxarifado tenant read"
  on public.almoxarifado for select to authenticated
  using (
    tenant_id in (select auth_user_tenant_ids())
    or lider_id in (select auth_user_tenant_ids())
    or (select auth_is_global_admin())
  );

create policy "almoxarifado lider insert"
  on public.almoxarifado for insert to authenticated
  with check (
    tenant_id in (select auth_lider_tenant_ids())
    or lider_id in (select auth_lider_tenant_ids())
    or (select auth_is_global_admin())
  );

create policy "almoxarifado lider update"
  on public.almoxarifado for update to authenticated
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

create policy "almoxarifado lider delete"
  on public.almoxarifado for delete to authenticated
  using (
    tenant_id in (select auth_lider_tenant_ids())
    or lider_id in (select auth_lider_tenant_ids())
    or (select auth_is_global_admin())
  );

-- gallery_albums
drop policy if exists "gallery_albums tenant access" on public.gallery_albums;

create policy "gallery_albums tenant read"
  on public.gallery_albums for select to authenticated
  using (
    tenant_id in (select auth_user_tenant_ids())
    or (select auth_is_global_admin())
  );

create policy "gallery_albums lider write"
  on public.gallery_albums for insert to authenticated
  with check (
    tenant_id in (select auth_lider_tenant_ids())
    or (select auth_is_global_admin())
  );

create policy "gallery_albums lider update"
  on public.gallery_albums for update to authenticated
  using (
    tenant_id in (select auth_lider_tenant_ids())
    or (select auth_is_global_admin())
  )
  with check (
    tenant_id in (select auth_lider_tenant_ids())
    or (select auth_is_global_admin())
  );

create policy "gallery_albums lider delete"
  on public.gallery_albums for delete to authenticated
  using (
    tenant_id in (select auth_lider_tenant_ids())
    or (select auth_is_global_admin())
  );

-- gallery_media
drop policy if exists "gallery_media tenant access" on public.gallery_media;

create policy "gallery_media tenant read"
  on public.gallery_media for select to authenticated
  using (
    tenant_id in (select auth_user_tenant_ids())
    or (select auth_is_global_admin())
  );

create policy "gallery_media lider write"
  on public.gallery_media for insert to authenticated
  with check (
    tenant_id in (select auth_lider_tenant_ids())
    or (select auth_is_global_admin())
  );

create policy "gallery_media lider update"
  on public.gallery_media for update to authenticated
  using (
    tenant_id in (select auth_lider_tenant_ids())
    or (select auth_is_global_admin())
  )
  with check (
    tenant_id in (select auth_lider_tenant_ids())
    or (select auth_is_global_admin())
  );

create policy "gallery_media lider delete"
  on public.gallery_media for delete to authenticated
  using (
    tenant_id in (select auth_lider_tenant_ids())
    or (select auth_is_global_admin())
  );
