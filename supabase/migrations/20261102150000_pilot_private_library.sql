begin;
-- Separate pilot data and bucket: legacy library handlers cannot enumerate or
-- download these files. No existing library table, bucket or policy is changed.
create table if not exists public.piloto_biblioteca_privada(
 id uuid primary key,
 tenant_id uuid not null check(tenant_id='fad75b91-d2eb-4805-b5a3-c19e8a073bed'),
 destinatario uuid not null references public.filhos_de_santo(id),
 titulo text not null check(length(btrim(titulo)) between 1 and 300),
 descricao text not null default '' check(length(descricao)<=4000),
 categoria text not null check(categoria in ('Cantigas','História','Ervas','Orixás','Fundamentos')),
 storage_path text not null unique,
 sha256 text not null check(sha256 ~ '^[0-9a-f]{64}$'),
 size_bytes integer not null check(size_bytes between 5 and 20971520),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(storage_path=tenant_id::text||'/private/'||id::text||'.pdf')
);
alter table public.piloto_biblioteca_privada enable row level security;
revoke all on public.piloto_biblioteca_privada from public,anon,authenticated;
grant select,delete on public.piloto_biblioteca_privada to authenticated;
grant update(titulo,descricao,categoria,updated_at) on public.piloto_biblioteca_privada to authenticated;

create or replace function public.piloto_pode_ler_pdf(p_id uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.piloto_biblioteca_privada b where b.id=p_id and
  (auth.uid()=b.tenant_id or exists(select 1 from public.filhos_de_santo f join auth.users u on u.id=auth.uid()
    where f.id=b.destinatario and (f.tenant_id=b.tenant_id or f.lider_id=b.tenant_id) and
      (f.user_id=u.id or lower(f.email)=lower(u.email) or lower(u.email) in ('f_'||f.id::text||'@axecloud.internal','filho_'||f.id::text||'@axecloud.com')))));
$$;
revoke all on function public.piloto_pode_ler_pdf(uuid) from public,anon;
grant execute on function public.piloto_pode_ler_pdf(uuid) to authenticated;

drop policy if exists pilot_library_read on public.piloto_biblioteca_privada;
create policy pilot_library_read on public.piloto_biblioteca_privada for select to authenticated using(public.piloto_pode_ler_pdf(id));
drop policy if exists pilot_library_update on public.piloto_biblioteca_privada;
create policy pilot_library_update on public.piloto_biblioteca_privada for update to authenticated
 using(tenant_id=auth.uid()) with check(tenant_id=auth.uid());
drop policy if exists pilot_library_delete on public.piloto_biblioteca_privada;
create policy pilot_library_delete on public.piloto_biblioteca_privada for delete to authenticated using(tenant_id=auth.uid());

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('piloto_biblioteca_privada','piloto_biblioteca_privada',false,20971520,array['application/pdf']) on conflict(id) do nothing;
drop policy if exists pilot_pdf_insert on storage.objects;
create policy pilot_pdf_insert on storage.objects for insert to authenticated with check(
 bucket_id='piloto_biblioteca_privada' and auth.uid()='fad75b91-d2eb-4805-b5a3-c19e8a073bed'::uuid
 and name ~ '^fad75b91-d2eb-4805-b5a3-c19e8a073bed/private/[0-9a-f-]{36}\.pdf$');
drop policy if exists pilot_pdf_read on storage.objects;
create policy pilot_pdf_read on storage.objects for select to authenticated using(bucket_id='piloto_biblioteca_privada' and
 (auth.uid()='fad75b91-d2eb-4805-b5a3-c19e8a073bed'::uuid or exists(select 1 from public.piloto_biblioteca_privada b where b.storage_path=name and public.piloto_pode_ler_pdf(b.id))));
drop policy if exists pilot_pdf_delete on storage.objects;
create policy pilot_pdf_delete on storage.objects for delete to authenticated using(bucket_id='piloto_biblioteca_privada'
 and auth.uid()='fad75b91-d2eb-4805-b5a3-c19e8a073bed'::uuid and name like auth.uid()::text||'/private/%');
-- Also constrain any older permissive storage policies, only for this new bucket.
drop policy if exists pilot_pdf_read_guard on storage.objects;
create policy pilot_pdf_read_guard on storage.objects as restrictive for select to authenticated using(bucket_id<>'piloto_biblioteca_privada' or
 auth.uid()='fad75b91-d2eb-4805-b5a3-c19e8a073bed'::uuid or exists(select 1 from public.piloto_biblioteca_privada b where b.storage_path=name and public.piloto_pode_ler_pdf(b.id)));
drop policy if exists pilot_pdf_insert_guard on storage.objects;
create policy pilot_pdf_insert_guard on storage.objects as restrictive for insert to authenticated with check(bucket_id<>'piloto_biblioteca_privada' or auth.uid()='fad75b91-d2eb-4805-b5a3-c19e8a073bed'::uuid);
drop policy if exists pilot_pdf_update_guard on storage.objects;
create policy pilot_pdf_update_guard on storage.objects as restrictive for update to authenticated using(bucket_id<>'piloto_biblioteca_privada' or auth.uid()='fad75b91-d2eb-4805-b5a3-c19e8a073bed'::uuid)
 with check(bucket_id<>'piloto_biblioteca_privada' or auth.uid()='fad75b91-d2eb-4805-b5a3-c19e8a073bed'::uuid);
drop policy if exists pilot_pdf_delete_guard on storage.objects;
create policy pilot_pdf_delete_guard on storage.objects as restrictive for delete to authenticated using(bucket_id<>'piloto_biblioteca_privada' or auth.uid()='fad75b91-d2eb-4805-b5a3-c19e8a073bed'::uuid);
drop policy if exists pilot_pdf_anonymous_guard on storage.objects;
create policy pilot_pdf_anonymous_guard on storage.objects as restrictive for all to anon using(bucket_id<>'piloto_biblioteca_privada') with check(bucket_id<>'piloto_biblioteca_privada');

create or replace function public.piloto_finalizar_pdf(p_id uuid,p_destinatario uuid,p_titulo text,p_descricao text,p_categoria text,p_sha256 text,p_size integer)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare owner_id uuid; path text; previous public.piloto_biblioteca_privada; object_meta jsonb;
begin
 owner_id:=public.piloto_validar_zelador('fad75b91-d2eb-4805-b5a3-c19e8a073bed');
 if p_id is null or p_destinatario is null or not exists(select 1 from public.filhos_de_santo where id=p_destinatario and (tenant_id=owner_id or lider_id=owner_id)) then
  raise exception 'Selecione um membro desta casa' using errcode='42501';end if;
 if p_titulo is null or length(btrim(p_titulo)) not between 1 and 300 or p_descricao is null or length(p_descricao)>4000
  or p_categoria is null or p_categoria not in ('Cantigas','História','Ervas','Orixás','Fundamentos')
  or p_sha256 is null or p_sha256 !~ '^[0-9a-f]{64}$' or p_size is null or p_size not between 5 and 20971520 then
  raise exception 'Confira os dados do PDF' using errcode='22023';end if;
 path:=owner_id::text||'/private/'||p_id::text||'.pdf';
 perform pg_advisory_xact_lock(hashtextextended('pilot-private-pdf:'||p_id::text,0));
 select * into previous from public.piloto_biblioteca_privada where id=p_id;
 if found then
  if previous.tenant_id<>owner_id or previous.destinatario<>p_destinatario or previous.titulo<>btrim(p_titulo)
   or previous.descricao<>p_descricao or previous.categoria<>p_categoria or previous.sha256<>p_sha256 or previous.size_bytes<>p_size then
   raise exception 'Esta tentativa já foi usada com outros dados. Confira o material antes de repetir.' using errcode='23505';end if;
  return jsonb_build_object('id',previous.id,'visibilidade','individual','replayed',true);
 end if;
 select metadata into object_meta from storage.objects where bucket_id='piloto_biblioteca_privada' and name=path;
 if object_meta is null or coalesce(object_meta->>'mimetype','')<>'application/pdf' or (object_meta->>'size')::bigint is distinct from p_size::bigint then
  raise exception 'O armazenamento ainda não confirmou este PDF' using errcode='23505';end if;
 insert into public.piloto_biblioteca_privada(id,tenant_id,destinatario,titulo,descricao,categoria,storage_path,sha256,size_bytes)
 values(p_id,owner_id,p_destinatario,btrim(p_titulo),p_descricao,p_categoria,path,p_sha256,p_size);
 return jsonb_build_object('id',p_id,'visibilidade','individual','replayed',false);
end $$;
revoke all on function public.piloto_finalizar_pdf(uuid,uuid,text,text,text,text,integer) from public,anon,authenticated;
grant execute on function public.piloto_finalizar_pdf(uuid,uuid,text,text,text,text,integer) to authenticated;
notify pgrst,'reload schema';
commit;
