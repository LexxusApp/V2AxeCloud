begin;
-- PROPOSTA: revisar com o principal; não aplicar isoladamente das rotas e da limpeza de caches.
-- Nenhum acesso de membro, nenhuma política abrangente, nenhum dado da Galeria interna.
create table if not exists public.piloto_radar_perfis (
 tenant_id uuid primary key check(tenant_id='fad75b91-d2eb-4805-b5a3-c19e8a073bed'::uuid),
 profile jsonb not null,revision bigint not null default 1 check(revision>0),updated_at timestamptz not null default now()
);
alter table public.piloto_radar_perfis drop constraint if exists piloto_radar_perfis_tenant_id_check;
alter table public.piloto_radar_perfis add constraint piloto_radar_perfis_tenant_id_check
 check(tenant_id='fad75b91-d2eb-4805-b5a3-c19e8a073bed'::uuid);
alter table public.piloto_radar_perfis enable row level security;
revoke all on public.piloto_radar_perfis from public,anon,authenticated;
grant select on public.piloto_radar_perfis to authenticated;
drop policy if exists piloto_radar_owner_read on public.piloto_radar_perfis;
create policy piloto_radar_owner_read on public.piloto_radar_perfis for select to authenticated
 using(tenant_id=auth.uid() and auth.uid()='fad75b91-d2eb-4805-b5a3-c19e8a073bed'::uuid
 and exists(select 1 from public.perfil_lider p where p.id=auth.uid() and p.deleted_at is null
 and coalesce(to_jsonb(p)->>'status','') not in ('blocked','deleted')));

create or replace function public.piloto_radar_autorizar(p_tenant uuid)
returns void language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
begin
 if p_tenant is distinct from 'fad75b91-d2eb-4805-b5a3-c19e8a073bed'::uuid or auth.uid() is distinct from p_tenant
 or not exists(select 1 from auth.users u where u.id=p_tenant and lower(u.email)='vendasmercadolivrev1@gmail.com')
 or not exists(select 1 from public.perfil_lider p where p.id=p_tenant and p.deleted_at is null
 and coalesce(to_jsonb(p)->>'status','') not in ('blocked','deleted') and coalesce(to_jsonb(p)->>'role','')<>'filho')
 then raise exception 'Radar restrito à zeladoria autorizada' using errcode='42501';end if;
end $$;

create or replace function public.piloto_radar_https(v text)
returns boolean language sql immutable set search_path=pg_catalog as $$
 select coalesce(length(v)<=2000 and v ~ '^https://[A-Za-z0-9][A-Za-z0-9.-]*(:[0-9]{1,5})?([/?#][^[:space:]]*)?$'
 and v !~ '[\\[:cntrl:]]',false)
$$;

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
 or p->>'coverPosition' is null or p->>'coverPosition' not in ('top','center','bottom')
 then raise exception 'Identidade inválida' using errcode='22023';end if;
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
 if jsonb_typeof(p->'socials') is distinct from 'array' then raise exception 'Redes inválidas' using errcode='22023';end if;
 if jsonb_array_length(p->'socials')>5 then raise exception 'Redes demais' using errcode='22023';end if;
 for r in select value from jsonb_array_elements(p->'socials') loop
  field_name:=r->>'network';host:=lower(substring(r->>'url' from '^https://([^/:?#]+)'));
  if jsonb_typeof(r) is distinct from 'object' or exists(select 1 from jsonb_object_keys(r) t(f) where f not in ('id','network','url')) then raise exception 'Rede inválida' using errcode='22023';end if;
  if jsonb_typeof(r->'id') is distinct from 'string' or length(r->>'id') not between 1 and 80 or field_name is null or field_name not in ('instagram','facebook','tiktok','youtube','website') or field_name=any(seen) or not public.piloto_radar_https(r->>'url')
  or (field_name='instagram' and host !~ '(^|[.])instagram[.]com$') or (field_name='facebook' and host !~ '(^|[.])(facebook|fb)[.]com$')
  or (field_name='tiktok' and host !~ '(^|[.])tiktok[.]com$') or (field_name='youtube' and host !~ '(^|[.])(youtube[.]com|youtu[.]be)$')
  then raise exception 'Rede inválida ou repetida' using errcode='22023';end if;
  seen:=array_append(seen,field_name);
 end loop;
 if jsonb_typeof(p->'schedules') is distinct from 'array' then raise exception 'Horários inválidos' using errcode='22023';end if;
 if jsonb_array_length(p->'schedules')>14 then raise exception 'Horários demais' using errcode='22023';end if;
 seen:='{}';
 for r in select value from jsonb_array_elements(p->'schedules') loop
  if jsonb_typeof(r) is distinct from 'object' or exists(select 1 from jsonb_object_keys(r) t(f) where f not in ('id','day','start','end','title','enabled')) then raise exception 'Horário inválido' using errcode='22023';end if;
  if jsonb_typeof(r->'id') is distinct from 'string' or length(r->>'id') not between 1 and 80 or jsonb_typeof(r->'day') is distinct from 'number' or r->>'day' !~ '^[0-6]$'
  or coalesce(r->>'start','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or jsonb_typeof(r->'end') is distinct from 'string'
  or (r->>'end'<>'' and r->>'end' !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
  or jsonb_typeof(r->'enabled') is distinct from 'boolean' or jsonb_typeof(r->'title') is distinct from 'string' or length(trim(r->>'title')) not between 3 and 80
  then raise exception 'Horário inválido' using errcode='22023';end if;
  schedule_key:=(r->>'day')||'-'||(r->>'start');if schedule_key=any(seen) then raise exception 'Horário repetido' using errcode='22023';end if;seen:=array_append(seen,schedule_key);
 end loop;
 if jsonb_typeof(p->'gallery') is distinct from 'array' then raise exception 'Galeria inválida' using errcode='22023';end if;
 if jsonb_array_length(p->'gallery')>6 then raise exception 'Fotos demais' using errcode='22023';end if;
 if p->'cover' is null or p->'portrait' is null then raise exception 'Imagens inválidas' using errcode='22023';end if;
 for media in select value from jsonb_array_elements(jsonb_build_array(p->'cover',p->'portrait')||(p->'gallery')) loop
  if media='null'::jsonb then continue;end if;
  if jsonb_typeof(media) is distinct from 'object' or exists(select 1 from jsonb_object_keys(media) t(f) where f not in ('id','source','caption','illustrative')) then raise exception 'Imagem inválida' using errcode='22023';end if;
  if jsonb_typeof(media) is distinct from 'object' or not public.piloto_radar_https(media->>'source')
  or jsonb_typeof(media->'id') is distinct from 'string' or length(media->>'id') not between 1 and 80
  or jsonb_typeof(media->'caption') is distinct from 'string' or length(media->>'caption')>500 or jsonb_typeof(media->'illustrative') is distinct from 'boolean'
  then raise exception 'Imagem inválida' using errcode='22023';end if;
 end loop;
 if exists(select 1 from jsonb_array_elements(p->'gallery') m where m='null'::jsonb) or
 (select count(*)<>count(distinct m->>'id') from jsonb_array_elements(p->'gallery') m) then raise exception 'Galeria inválida ou repetida' using errcode='22023';end if;
end $$;

create or replace function public.piloto_radar_ler(p_tenant uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,pg_temp as $$
declare result jsonb;
begin
 perform public.piloto_radar_autorizar(p_tenant);
 select jsonb_build_object('profile',profile,'revision',revision) into result from public.piloto_radar_perfis where tenant_id=p_tenant;
 return coalesce(result,jsonb_build_object('profile',null,'revision',0,'legacy',(select jsonb_build_object('cep',cep) from public.terreiros_diretorio where claimed_by_tenant_id=p_tenant order by verified_at desc nulls last,updated_at desc limit 1)));
end $$;

create or replace function public.piloto_radar_salvar(p_tenant uuid,p_profile jsonb,p_revision bigint)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare old public.piloto_radar_perfis;next_revision bigint;
begin
 perform public.piloto_radar_autorizar(p_tenant);perform public.piloto_radar_validar(p_profile);
 perform pg_advisory_xact_lock(hashtextextended(p_tenant::text||':radar',0));
 if not exists(select 1 from public.terreiros_diretorio where claimed_by_tenant_id=p_tenant and slug is not null) then raise exception 'Perfil não reivindicado' using errcode='42501';end if;
 select * into old from public.piloto_radar_perfis where tenant_id=p_tenant for update;
 -- A lost receipt can be retried, without overwriting a concurrent change.
 if old.profile=p_profile then return jsonb_build_object('profile',old.profile,'revision',old.revision);end if;
 if p_revision is null or p_revision<>coalesce(old.revision,0) then raise exception 'O perfil mudou. Atualize antes de salvar.' using errcode='23505';end if;
 next_revision:=coalesce(old.revision,0)+1;
 insert into public.piloto_radar_perfis(tenant_id,profile,revision) values(p_tenant,p_profile,next_revision)
 on conflict(tenant_id) do update set profile=excluded.profile,revision=excluded.revision,updated_at=now();
 -- The private structured record is canonical. The additive triggers below project
 -- only this tenant into legacy readers, including direct PostgREST readers.
 update public.terreiros_diretorio set updated_at=now() where claimed_by_tenant_id=p_tenant;
 update public.perfil_lider set bairro_publico=case when (p_profile->>'showAddress')::boolean and (p_profile->>'published')::boolean then p_profile->>'neighborhood' else null end where id=p_tenant;
 return jsonb_build_object('profile',p_profile,'revision',next_revision);
end $$;

create or replace function public.piloto_radar_projetar_legado()
returns trigger language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare p jsonb;visible boolean;insta text;
begin
 -- Guard both OLD and NEW so a legacy update cannot evade redaction by unlinking.
 if tg_op='UPDATE' and old.claimed_by_tenant_id='fad75b91-d2eb-4805-b5a3-c19e8a073bed'::uuid then
  if new.claimed_by_tenant_id is distinct from old.claimed_by_tenant_id and exists(select 1 from public.piloto_radar_perfis where tenant_id=old.claimed_by_tenant_id) then raise exception 'Revise o vínculo do piloto antes de transferir o perfil' using errcode='42501';end if;
 end if;
 if new.claimed_by_tenant_id is distinct from 'fad75b91-d2eb-4805-b5a3-c19e8a073bed'::uuid then return new;end if;
 select profile into p from public.piloto_radar_perfis where tenant_id=new.claimed_by_tenant_id;if not found then return new;end if;
 visible:=(p->>'showAddress')::boolean and (p->>'published')::boolean;
 new.nome:=p->>'publicName';new.cidade:=p->>'city';new.estado:=p->>'uf';
 new.cidade_slug:=trim(both '-' from regexp_replace(translate(lower(p->>'city'),'áàâãäéèêëíìîïóòôõöúùûüç','aaaaaeeeeiiiiooooouuuuc'),'[^a-z0-9]+','-','g'));
 new.endereco:=case when visible then concat_ws(', ',nullif(p->>'address',''),case when (p->>'noNumber')::boolean then 's/n' else nullif(p->>'number','') end,nullif(p->>'complement',''),nullif(p->>'neighborhood',''),nullif(p->>'cep','')) else null end;
 new.bairro:=case when visible then nullif(p->>'neighborhood','') else null end;new.bairro_slug:=null;
 new.cep:=case when visible then nullif(replace(p->>'cep','-',''),'') else null end;
 new.latitude:=case when visible then nullif(p->>'latitude','')::double precision else null end;
 new.longitude:=case when visible then nullif(p->>'longitude','')::double precision else null end;
 -- The legacy Maps URL has a unique constraint. Aliases retain their URLs while
 -- only one linked row stores the public map URL; public projection serves all aliases.
 new.link_maps:=case when visible and new.id=(select id from public.terreiros_diretorio where claimed_by_tenant_id=new.claimed_by_tenant_id order by id limit 1) then nullif(p->>'mapsUrl','') else null end;new.coordinate_source:=null;
 new.telefone:=nullif(p->>'phone','');new.whatsapp_atendimento:=nullif(p->>'servicePhone','');
 select r->>'url' into insta from jsonb_array_elements(p->'socials') r where r->>'network'='instagram';new.instagram_url:=insta;
 new.owner_photo_url:=p->'portrait'->>'source';new.foto_url:=new.owner_photo_url;new.cover_photo_url:=p->'cover'->>'source';
 select coalesce(jsonb_agg(r->>'source'),'[]'::jsonb) into new.gallery_photo_urls from jsonb_array_elements(p->'gallery') r;
 new.descricao_publica:=p->>'description';new.orientacoes_visita:=p->>'instructions';
 new.tradicao:=case p->>'tradition' when 'Candomblé' then 'candomble' else lower(p->>'tradition') end;
 new.publicacao_status:=case when (p->>'published')::boolean then 'publicado' else 'oculto' end;
 select coalesce(jsonb_agg(jsonb_build_object('diaSemana',r->'day','horario',r->>'start','titulo',r->>'title')),'[]'::jsonb) into new.gira_horarios from jsonb_array_elements(p->'schedules') r where (r->>'enabled')::boolean;
 return new;
end $$;
drop trigger if exists piloto_radar_legado on public.terreiros_diretorio;
create trigger piloto_radar_legado before insert or update on public.terreiros_diretorio for each row execute function public.piloto_radar_projetar_legado();

create or replace function public.piloto_radar_proteger_bairro_portal()
returns trigger language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare p jsonb;
begin
 if new.id='fad75b91-d2eb-4805-b5a3-c19e8a073bed'::uuid then
  select profile into p from public.piloto_radar_perfis where tenant_id=new.id;
  if found then new.bairro_publico:=case when (p->>'showAddress')::boolean and (p->>'published')::boolean then p->>'neighborhood' else null end;end if;
 end if;return new;
end $$;
drop trigger if exists piloto_radar_bairro_portal on public.perfil_lider;
create trigger piloto_radar_bairro_portal before insert or update on public.perfil_lider for each row execute function public.piloto_radar_proteger_bairro_portal();

create or replace function public.piloto_radar_publicos()
returns jsonb language sql stable security definer set search_path=pg_catalog,public,pg_temp as $$
 with aliases as (
 select id,slug,'directory' as kind from public.terreiros_diretorio where claimed_by_tenant_id='fad75b91-d2eb-4805-b5a3-c19e8a073bed'::uuid and slug is not null
 union select id,public_slug,'portal' as kind from public.perfil_lider where id='fad75b91-d2eb-4805-b5a3-c19e8a073bed'::uuid and public_slug is not null
 ), data as (
 select a.id,a.slug,a.kind,r.revision,r.profile,
 exists(select 1 from public.perfil_lider p where p.id=r.tenant_id and p.deleted_at is null and coalesce(to_jsonb(p)->>'status','') not in ('blocked','deleted')) as active
 from aliases a left join public.piloto_radar_perfis r on r.tenant_id='fad75b91-d2eb-4805-b5a3-c19e8a073bed'::uuid
 ) select coalesce(jsonb_agg(jsonb_build_object('id',id,'slug',slug,'kind',kind,'managed',revision is not null,'revision',revision,'profile',
 case when active and (profile->>'published')::boolean then
 (select jsonb_object_agg(k,case when k='schedules' then (select coalesce(jsonb_agg(s),'[]'::jsonb) from jsonb_array_elements(v) s where (s->>'enabled')::boolean) else v end) from jsonb_each(profile) e(k,v) where k=any(array['publicName','tradition','description','instructions','city','uf','phone','servicePhone','showAddress','socials','schedules','cover','portrait','gallery','coverPosition','published'])
 or ((profile->>'showAddress')::boolean and k=any(array['address','number','noNumber','complement','neighborhood','cep','latitude','longitude','mapsUrl'])))
 else null end)),'[]'::jsonb) from data
$$;
revoke all on function public.piloto_radar_autorizar(uuid),public.piloto_radar_https(text),public.piloto_radar_validar(jsonb),public.piloto_radar_projetar_legado(),public.piloto_radar_proteger_bairro_portal(),public.piloto_radar_ler(uuid),public.piloto_radar_salvar(uuid,jsonb,bigint),public.piloto_radar_publicos() from public,anon,authenticated;
grant execute on function public.piloto_radar_ler(uuid),public.piloto_radar_salvar(uuid,jsonb,bigint) to authenticated;
grant execute on function public.piloto_radar_publicos() to anon,authenticated;
notify pgrst,'reload schema';
commit;
