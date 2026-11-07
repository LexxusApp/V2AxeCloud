-- Local integration migration. Apply to validation before enabling private PDFs.
begin;
alter table public.biblioteca
  add column if not exists visibilidade text not null default 'casa',
  add column if not exists destinatarios uuid[] not null default '{}';
alter table public.biblioteca drop constraint if exists biblioteca_audience_valid;
alter table public.biblioteca add constraint biblioteca_audience_valid check (
  (visibilidade = 'casa' and cardinality(destinatarios) = 0)
  or (visibilidade = 'individual' and cardinality(destinatarios) between 1 and 500 and array_position(destinatarios, null) is null)
);

create or replace function public.can_read_library_material(p_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  with reader as (
    select id,lower(email) as email from auth.users where id=(select auth.uid())
  ), members as (
    select f.id,f.tenant_id,f.lider_id from public.filhos_de_santo f cross join reader r
    where f.user_id=r.id
      or (r.email is not null and r.email<>'' and lower(f.email)=r.email)
      or r.email='f_'||f.id::text||'@axecloud.internal'
      or r.email='filho_'||f.id::text||'@axecloud.com'
  ), house_refs as (
    select tenant_id as id from members where tenant_id is not null
    union select lider_id from members where lider_id is not null
  )
  select exists (
    select 1 from public.biblioteca b
    where b.id = p_id and (
      (select axecloud_private.auth_is_global_admin())
      or (
        not exists (select 1 from members)
        and exists (select 1 from public.perfil_lider p where p.id=(select auth.uid()) and b.tenant_id in (p.id,p.tenant_id))
      )
      or (
        (b.tenant_id in (select id from house_refs)
          or exists(select 1 from public.perfil_lider p where b.tenant_id in (p.id,p.tenant_id)
            and (p.id in (select id from house_refs) or p.tenant_id in (select id from house_refs))))
        and (
          b.visibilidade = 'casa'
          or exists (
            select 1 from members m where m.id = any(b.destinatarios)
          )
        )
      )
    )
  );
$$;
revoke all on function public.can_read_library_material(uuid) from public, anon;
grant execute on function public.can_read_library_material(uuid) to authenticated, service_role;

-- Restrictive policies also constrain any older permissive SELECT policy.
drop policy if exists "biblioteca private audience" on public.biblioteca;
create policy "biblioteca private audience" on public.biblioteca as restrictive
  for select to authenticated using (public.can_read_library_material(id));
drop policy if exists "biblioteca comments private audience" on public.biblioteca_comentarios;
create policy "biblioteca comments private audience" on public.biblioteca_comentarios as restrictive
  for all to authenticated
  using (public.can_read_library_material(arquivo_id))
  with check (public.can_read_library_material(arquivo_id));

-- Private PDFs are only served by the API proxy after checking the material.
update storage.buckets set public = false where id = 'biblioteca_estudos';
create index if not exists biblioteca_storage_path_idx on public.biblioteca(storage_path);
create index if not exists biblioteca_destinatarios_idx on public.biblioteca using gin(destinatarios);

-- Serialize finalization by uploaded object. Retries never publish a second copy
-- or silently change the audience of an already published material.
create or replace function public.finalizar_material_biblioteca(
  p_tenant uuid, p_path text, p_title text, p_category text,
  p_visibility text, p_recipients uuid[]
) returns public.biblioteca
language plpgsql security invoker set search_path = public, pg_temp as $$
declare v_row public.biblioteca; v_house uuid; v_child uuid;
begin
  if p_tenant is null or p_path is null or p_path not like p_tenant::text || '/%' or p_path ~ '(^|/)\.\.(/|$)'
    or nullif(btrim(p_title),'') is null or length(p_title)>300
    or nullif(btrim(p_category),'') is null or length(p_category)>80 then
    raise exception 'Dados do material inválidos' using errcode='22023';
  end if;
  if p_visibility is null or p_visibility not in ('casa','individual') or p_recipients is null
    or array_position(p_recipients,null) is not null
    or (p_visibility='casa' and cardinality(p_recipients)<>0)
    or (p_visibility='individual' and cardinality(p_recipients) not between 1 and 500) then
    raise exception 'Público do material inválido' using errcode='22023';
  end if;
  select id into v_house from public.perfil_lider where id=p_tenant or tenant_id=p_tenant order by (id=p_tenant) desc limit 1;
  if v_house is null then raise exception 'Terreiro inválido' using errcode='22023'; end if;
  foreach v_child in array p_recipients loop
    if not exists(select 1 from public.filhos_de_santo where id=v_child and (tenant_id in (p_tenant,v_house) or lider_id in (p_tenant,v_house))) then
      raise exception 'Destinatário não pertence à casa' using errcode='42501';
    end if;
  end loop;
  perform pg_advisory_xact_lock(hashtextextended('library:'||p_path,0));
  select * into v_row from public.biblioteca where storage_path=p_path limit 1;
  if found then
    if v_row.tenant_id is distinct from p_tenant or v_row.titulo is distinct from p_title
      or v_row.categoria is distinct from p_category or v_row.visibilidade is distinct from p_visibility
      or v_row.destinatarios is distinct from p_recipients then
      raise exception 'Este arquivo já foi publicado com outros dados' using errcode='23505';
    end if;
    return v_row;
  end if;
  insert into public.biblioteca(titulo,categoria,arquivo_url,tenant_id,storage_path,visibilidade,destinatarios)
    values(p_title,p_category,'',p_tenant,p_path,p_visibility,p_recipients) returning * into v_row;
  return v_row;
end; $$;
revoke all on function public.finalizar_material_biblioteca(uuid,text,text,text,text,uuid[]) from public,anon,authenticated;
grant execute on function public.finalizar_material_biblioteca(uuid,text,text,text,text,uuid[]) to service_role;
commit;
