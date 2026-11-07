begin;

-- Reconcile the afternoon pilot expansion with the approved single-house scope.
-- This migration removes no business rows and does not change the interface.
alter table public.piloto_biblioteca_privada drop constraint if exists piloto_biblioteca_privada_tenant_id_check;
alter table public.piloto_biblioteca_privada add constraint piloto_biblioteca_privada_tenant_id_check
 check(tenant_id='fad75b91-d2eb-4805-b5a3-c19e8a073bed'::uuid);
alter table public.piloto_comunicados drop constraint if exists piloto_comunicados_tenant_id_check;
alter table public.piloto_comunicados add constraint piloto_comunicados_tenant_id_check
 check(tenant_id='fad75b91-d2eb-4805-b5a3-c19e8a073bed'::uuid);
alter table public.piloto_comunicados_envios drop constraint if exists piloto_comunicados_envios_tenant_id_check;
alter table public.piloto_comunicados_envios add constraint piloto_comunicados_envios_tenant_id_check
 check(tenant_id='fad75b91-d2eb-4805-b5a3-c19e8a073bed'::uuid);
alter table public.piloto_radar_perfis drop constraint if exists piloto_radar_perfis_tenant_id_check;
alter table public.piloto_radar_perfis add constraint piloto_radar_perfis_tenant_id_check
 check(tenant_id='fad75b91-d2eb-4805-b5a3-c19e8a073bed'::uuid);

create or replace function public.piloto_validar_zelador(p_tenant uuid)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid:=auth.uid();
begin
 if actor is distinct from 'fad75b91-d2eb-4805-b5a3-c19e8a073bed'::uuid
    or p_tenant is distinct from actor
    or not exists(select 1 from public.perfil_lider where id=actor) then
   raise exception 'Operação restrita ao zelador autorizado no piloto' using errcode='42501';
 end if;
 return actor;
end $$;
revoke all on function public.piloto_validar_zelador(uuid) from public,anon,authenticated;

-- Remove the broader bigint overload introduced by the temporary expansion and
-- restore the original, unambiguous RPC contract.
drop function if exists public.piloto_finalizar_pdf(uuid,uuid,text,text,text,text,bigint);
create or replace function public.piloto_finalizar_pdf(p_id uuid,p_destinatario uuid,p_titulo text,p_descricao text,p_categoria text,p_sha256 text,p_size integer)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare owner_id uuid;path text;previous public.piloto_biblioteca_privada;object_meta jsonb;
begin
 owner_id:=public.piloto_validar_zelador('fad75b91-d2eb-4805-b5a3-c19e8a073bed');
 if p_id is null or p_destinatario is null or not exists(
  select 1 from public.filhos_de_santo where id=p_destinatario
   and (tenant_id=owner_id or lider_id=owner_id)
   and lower(btrim(coalesce(status::text,''))) in ('ativo','active')) then
  raise exception 'Selecione um membro ativo desta casa' using errcode='42501';end if;
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

do $$ declare tab text;begin
 foreach tab in array array['piloto_capas_galeria','piloto_gira_preparacao','piloto_entregas_pedidos','piloto_chat_preferencias','piloto_suporte_chamados','piloto_suporte_complementos','piloto_avisos_cantina'] loop
  execute format('drop policy if exists pilot_owner_read on public.%I',tab);
  execute format('create policy pilot_owner_read on public.%I for select to authenticated using(tenant_id=auth.uid() and auth.uid()=''fad75b91-d2eb-4805-b5a3-c19e8a073bed''::uuid)',tab);
 end loop;
end $$;

drop policy if exists piloto_estoque_metadata_read on public.piloto_estoque_itens;
create policy piloto_estoque_metadata_read on public.piloto_estoque_itens for select to authenticated
 using(tenant_id=auth.uid() and auth.uid()='fad75b91-d2eb-4805-b5a3-c19e8a073bed'::uuid);
drop policy if exists piloto_estoque_history_read on public.piloto_estoque_movimentos;
create policy piloto_estoque_history_read on public.piloto_estoque_movimentos for select to authenticated
 using(tenant_id=auth.uid() and auth.uid()='fad75b91-d2eb-4805-b5a3-c19e8a073bed'::uuid);
drop policy if exists piloto_financeiro_own_read on public.piloto_financeiro_acoes;
create policy piloto_financeiro_own_read on public.piloto_financeiro_acoes for select to authenticated
 using(actor=auth.uid() and tenant_id=auth.uid() and auth.uid()='fad75b91-d2eb-4805-b5a3-c19e8a073bed'::uuid);
drop policy if exists piloto_radar_owner_read on public.piloto_radar_perfis;
create policy piloto_radar_owner_read on public.piloto_radar_perfis for select to authenticated
 using(tenant_id=auth.uid() and auth.uid()='fad75b91-d2eb-4805-b5a3-c19e8a073bed'::uuid
 and exists(select 1 from public.perfil_lider p where p.id=auth.uid() and p.deleted_at is null
 and coalesce(to_jsonb(p)->>'status','') not in ('blocked','deleted')));
drop policy if exists pilot_owner_store_images on storage.objects;
create policy pilot_owner_store_images on storage.objects for select to authenticated
 using(bucket_id='loja_imagens' and auth.uid()='fad75b91-d2eb-4805-b5a3-c19e8a073bed'::uuid
 and name like auth.uid()::text||'/%');

drop policy if exists pilot_pdf_insert on storage.objects;
create policy pilot_pdf_insert on storage.objects for insert to authenticated with check(
 bucket_id='piloto_biblioteca_privada' and auth.uid()='fad75b91-d2eb-4805-b5a3-c19e8a073bed'::uuid
 and name ~ '^fad75b91-d2eb-4805-b5a3-c19e8a073bed/private/[0-9a-f-]{36}\.pdf$');
drop policy if exists pilot_pdf_read on storage.objects;
create policy pilot_pdf_read on storage.objects for select to authenticated using(bucket_id='piloto_biblioteca_privada' and
 (auth.uid()='fad75b91-d2eb-4805-b5a3-c19e8a073bed'::uuid or exists(
  select 1 from public.piloto_biblioteca_privada b where b.storage_path=objects.name and public.piloto_pode_ler_pdf(b.id))));
drop policy if exists pilot_pdf_delete on storage.objects;
create policy pilot_pdf_delete on storage.objects for delete to authenticated using(bucket_id='piloto_biblioteca_privada'
 and auth.uid()='fad75b91-d2eb-4805-b5a3-c19e8a073bed'::uuid and name like auth.uid()::text||'/private/%');
drop policy if exists pilot_pdf_read_guard on storage.objects;
create policy pilot_pdf_read_guard on storage.objects as restrictive for select to authenticated using(
 bucket_id<>'piloto_biblioteca_privada' or auth.uid()='fad75b91-d2eb-4805-b5a3-c19e8a073bed'::uuid
 or exists(select 1 from public.piloto_biblioteca_privada b where b.storage_path=objects.name and public.piloto_pode_ler_pdf(b.id)));
drop policy if exists pilot_pdf_insert_guard on storage.objects;
create policy pilot_pdf_insert_guard on storage.objects as restrictive for insert to authenticated with check(
 bucket_id<>'piloto_biblioteca_privada' or auth.uid()='fad75b91-d2eb-4805-b5a3-c19e8a073bed'::uuid);
drop policy if exists pilot_pdf_update_guard on storage.objects;
create policy pilot_pdf_update_guard on storage.objects as restrictive for update to authenticated
 using(bucket_id<>'piloto_biblioteca_privada') with check(bucket_id<>'piloto_biblioteca_privada');
drop policy if exists pilot_pdf_delete_guard on storage.objects;
create policy pilot_pdf_delete_guard on storage.objects as restrictive for delete to authenticated using(
 bucket_id<>'piloto_biblioteca_privada' or auth.uid()='fad75b91-d2eb-4805-b5a3-c19e8a073bed'::uuid);
drop policy if exists pilot_pdf_anonymous_guard on storage.objects;
create policy pilot_pdf_anonymous_guard on storage.objects as restrictive for all to anon
 using(bucket_id<>'piloto_biblioteca_privada') with check(bucket_id<>'piloto_biblioteca_privada');
drop policy if exists pilot_pdf_operation_guard on storage.objects;
create policy pilot_pdf_operation_guard on storage.objects as restrictive for select to authenticated using(
 bucket_id<>'piloto_biblioteca_privada' or storage.allow_only_operation('object.get_authenticated')
 or (auth.uid()='fad75b91-d2eb-4805-b5a3-c19e8a073bed'::uuid
  and storage.allow_any_operation(array['object.upload','object.delete','object.delete_many'])));

-- Fix a PL/pgSQL variable/column ambiguity that prevented valid Radar profiles
-- from being checked by PostgreSQL.
create or replace function public.piloto_radar_validar(p jsonb)
returns void language plpgsql immutable set search_path=pg_catalog,public,pg_temp as $$
declare field_name text;lim integer;r jsonb;host text;seen text[]:='{}';schedule_key text;media jsonb;
begin
 if jsonb_typeof(p) is distinct from 'object' or octet_length(p::text)>50000 then raise exception 'Perfil inválido' using errcode='22023';end if;
 if exists(select 1 from jsonb_object_keys(p) as t(obj_key) where not(obj_key=any(array['publicName','tradition','description','instructions','address','number','noNumber','complement','neighborhood','cep','city','uf','phone','servicePhone','mapsUrl','latitude','longitude','showAddress','socials','schedules','cover','portrait','gallery','coverPosition','published']))) then raise exception 'Campo desconhecido' using errcode='22023';end if;
 for field_name,lim in select v.field_name,v.field_limit from (values('publicName',180),('tradition',80),('description',2000),('instructions',1500),('address',300),('number',30),('complement',120),('neighborhood',120),('cep',9),('city',120),('uf',2),('phone',20),('servicePhone',20),('mapsUrl',2000),('latitude',24),('longitude',24)) v(field_name,field_limit) loop
  if jsonb_typeof(p->field_name) is distinct from 'string' or length(p->>field_name)>lim then raise exception 'Campo inválido: %',field_name using errcode='22023';end if;
 end loop;
 foreach field_name in array array['published','showAddress','noNumber'] loop
  if jsonb_typeof(p->field_name) is distinct from 'boolean' then raise exception 'Visibilidade inválida' using errcode='22023';end if;
 end loop;
 if length(trim(p->>'publicName'))<3 or length(trim(p->>'description'))<15 or length(trim(p->>'instructions'))<10
 or length(trim(p->>'city'))<2 or p->>'uf' not in ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO')
 or p->>'tradition' not in ('Umbanda','Candomblé','Jurema','Mista','Outra','umbanda','candomble','jurema','mista','outra')
 or p->>'coverPosition' is null or p->>'coverPosition' not in ('top','center','bottom') then raise exception 'Identidade inválida' using errcode='22023';end if;
 if (p->>'showAddress')::boolean and (length(trim(p->>'address'))<3 or length(trim(p->>'neighborhood'))<2 or not(p->>'noNumber')::boolean and trim(p->>'number')='') then raise exception 'Endereço incompleto' using errcode='22023';end if;
 if p->>'cep'<>'' and p->>'cep' !~ '^[0-9]{5}-?[0-9]{3}$' then raise exception 'CEP inválido' using errcode='22023';end if;
 foreach field_name in array array['phone','servicePhone'] loop
  if p->>field_name<>'' and regexp_replace(p->>field_name,'[^0-9]','','g') !~ '^([0-9]{10,11}|55[0-9]{10,11})$' then raise exception 'Telefone inválido' using errcode='22023';end if;
 end loop;
 if ((p->>'latitude')='')<>((p->>'longitude')='') then raise exception 'Coordenadas incompletas' using errcode='22023';end if;
 foreach field_name in array array['latitude','longitude'] loop
  if p->>field_name<>'' then
   if p->>field_name !~ '^-?[0-9]{1,3}(\.[0-9]{1,8})?$' then raise exception 'Coordenada inválida' using errcode='22023';end if;
   if abs((p->>field_name)::numeric)>(case when field_name='latitude' then 90 else 180 end) then raise exception 'Coordenada inválida' using errcode='22023';end if;
  end if;
 end loop;
 if p->>'mapsUrl'<>'' and (not public.piloto_radar_https(p->>'mapsUrl') or p->>'mapsUrl' !~ '^https://(maps[.]app[.]goo[.]gl|maps[.]google[.]com)([/?#]|$)|^https://([A-Za-z0-9-]+[.])*google[.]com/maps|^https://goo[.]gl/maps') then raise exception 'Maps inválido' using errcode='22023';end if;
 if jsonb_typeof(p->'socials') is distinct from 'array' or jsonb_array_length(p->'socials')>5 then raise exception 'Redes inválidas' using errcode='22023';end if;
 for r in select value from jsonb_array_elements(p->'socials') loop
  field_name:=r->>'network';host:=lower(substring(r->>'url' from '^https://([^/:?#]+)'));
  if jsonb_typeof(r) is distinct from 'object' or exists(select 1 from jsonb_object_keys(r) t(f) where f not in ('id','network','url')) then raise exception 'Rede inválida' using errcode='22023';end if;
  if jsonb_typeof(r->'id') is distinct from 'string' or length(r->>'id') not between 1 and 80 or field_name is null or field_name not in ('instagram','facebook','tiktok','youtube','website') or field_name=any(seen) or not public.piloto_radar_https(r->>'url')
  or (field_name='instagram' and host !~ '(^|[.])instagram[.]com$') or (field_name='facebook' and host !~ '(^|[.])(facebook|fb)[.]com$')
  or (field_name='tiktok' and host !~ '(^|[.])tiktok[.]com$') or (field_name='youtube' and host !~ '(^|[.])(youtube[.]com|youtu[.]be)$') then raise exception 'Rede inválida ou repetida' using errcode='22023';end if;
  seen:=array_append(seen,field_name);
 end loop;
 if jsonb_typeof(p->'schedules') is distinct from 'array' or jsonb_array_length(p->'schedules')>14 then raise exception 'Horários inválidos' using errcode='22023';end if;
 seen:='{}';
 for r in select value from jsonb_array_elements(p->'schedules') loop
  if jsonb_typeof(r) is distinct from 'object' or exists(select 1 from jsonb_object_keys(r) t(f) where f not in ('id','day','start','end','title','enabled')) then raise exception 'Horário inválido' using errcode='22023';end if;
  if jsonb_typeof(r->'id') is distinct from 'string' or length(r->>'id') not between 1 and 80 or jsonb_typeof(r->'day') is distinct from 'number' or r->>'day' !~ '^[0-6]$'
  or coalesce(r->>'start','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or jsonb_typeof(r->'end') is distinct from 'string'
  or (r->>'end'<>'' and r->>'end' !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
  or jsonb_typeof(r->'enabled') is distinct from 'boolean' or jsonb_typeof(r->'title') is distinct from 'string' or length(trim(r->>'title')) not between 3 and 80 then raise exception 'Horário inválido' using errcode='22023';end if;
  schedule_key:=(r->>'day')||'-'||(r->>'start');if schedule_key=any(seen) then raise exception 'Horário repetido' using errcode='22023';end if;seen:=array_append(seen,schedule_key);
 end loop;
 if jsonb_typeof(p->'gallery') is distinct from 'array' or jsonb_array_length(p->'gallery')>6 then raise exception 'Galeria inválida' using errcode='22023';end if;
 if p->'cover' is null or p->'portrait' is null then raise exception 'Imagens inválidas' using errcode='22023';end if;
 for media in select value from jsonb_array_elements(jsonb_build_array(p->'cover',p->'portrait')||(p->'gallery')) loop
  if media='null'::jsonb then continue;end if;
  if jsonb_typeof(media) is distinct from 'object' or exists(select 1 from jsonb_object_keys(media) t(f) where f not in ('id','source','caption','illustrative')) then raise exception 'Imagem inválida' using errcode='22023';end if;
  if not public.piloto_radar_https(media->>'source') or jsonb_typeof(media->'id') is distinct from 'string' or length(media->>'id') not between 1 and 80
  or jsonb_typeof(media->'caption') is distinct from 'string' or length(media->>'caption')>500 or jsonb_typeof(media->'illustrative') is distinct from 'boolean' then raise exception 'Imagem inválida' using errcode='22023';end if;
 end loop;
 if exists(select 1 from jsonb_array_elements(p->'gallery') m where m='null'::jsonb)
 or (select count(*)<>count(distinct m->>'id') from jsonb_array_elements(p->'gallery') m) then raise exception 'Galeria inválida ou repetida' using errcode='22023';end if;
end $$;
revoke all on function public.piloto_radar_validar(jsonb) from public,anon,authenticated;

notify pgrst,'reload schema';
commit;
