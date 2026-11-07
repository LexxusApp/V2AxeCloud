begin;

-- VALIDATED ROLLOUT PACKAGE. Move into supabase/migrations only after explicit
-- authorization to release the modern manager interface to every tenant.
-- Authorization foundation for a future manager-wide rollout. Applying this
-- migration does not select the modern interface; the Worker rollout flag stays
-- disabled until the entire release gate has passed.
create or replace function public.piloto_zelador_ativo(p_tenant uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select p_tenant is not null and auth.uid()=p_tenant and exists(
  select 1 from public.perfil_lider p
  where p.id=auth.uid()
   and coalesce(nullif(to_jsonb(p)->>'tenant_id',''),p.id::text)=p_tenant::text
   and lower(coalesce(nullif(to_jsonb(p)->>'role',''),'')) in ('admin','zelador','lider','leader')
   and lower(coalesce(to_jsonb(p)->>'status','')) not in ('blocked','deleted')
   and coalesce((to_jsonb(p)->>'is_blocked')::boolean,false)=false
   and nullif(to_jsonb(p)->>'deleted_at','') is null
   and not exists(
    select 1 from public.subscriptions s where s.id=auth.uid()
     and (lower(coalesce(to_jsonb(s)->>'status','')) in ('blocked','deleted')
      or lower(coalesce(to_jsonb(s)->>'role',''))='filho')
   )
 );
$$;
revoke all on function public.piloto_zelador_ativo(uuid) from public,anon;
grant execute on function public.piloto_zelador_ativo(uuid) to authenticated;

create or replace function public.piloto_validar_zelador(p_tenant uuid)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not public.piloto_zelador_ativo(p_tenant) then
  raise exception 'Operação restrita à zeladoria desta casa' using errcode='42501';
 end if;
 return auth.uid();
end $$;
revoke all on function public.piloto_validar_zelador(uuid) from public,anon,authenticated;

-- Tenant ownership is enforced by the validated actor and RLS instead of a
-- deployment-time list of account IDs.
alter table public.piloto_biblioteca_privada drop constraint if exists piloto_biblioteca_privada_tenant_id_check;
alter table public.piloto_comunicados drop constraint if exists piloto_comunicados_tenant_id_check;
alter table public.piloto_comunicados_envios drop constraint if exists piloto_comunicados_envios_tenant_id_check;
alter table public.piloto_radar_perfis drop constraint if exists piloto_radar_perfis_tenant_id_check;

-- Notices keep the same conflict/idempotency protocol, but authorization and
-- member projection are now derived from the authenticated tenant binding.
create or replace function public.piloto_comunicados_zelador_ativo(p_tenant uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select public.piloto_zelador_ativo(p_tenant)
$$;
revoke all on function public.piloto_comunicados_zelador_ativo(uuid) from public,anon;
grant execute on function public.piloto_comunicados_zelador_ativo(uuid) to authenticated;

create or replace function public.piloto_comunicados_membro(p_tenant uuid)
returns uuid language sql stable security definer set search_path=public,pg_temp as $$
 select f.id from public.filhos_de_santo f
 where auth.uid() is not null and f.user_id=auth.uid()
  and (f.tenant_id=p_tenant or f.lider_id=p_tenant)
  and lower(btrim(coalesce(f.status::text,''))) in ('ativo','active')
 order by f.id limit 1
$$;
revoke all on function public.piloto_comunicados_membro(uuid) from public,anon,authenticated;

create or replace function public.piloto_comunicados_autorizar(p_tenant uuid,p_manager boolean default false)
returns uuid language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if public.piloto_zelador_ativo(p_tenant) then return auth.uid();end if;
 if not p_manager and public.piloto_comunicados_membro(p_tenant) is not null then return auth.uid();end if;
 raise exception 'Conta não autorizada ou vínculo inativo' using errcode='42501';
end $$;
revoke all on function public.piloto_comunicados_autorizar(uuid,boolean) from public,anon;
grant execute on function public.piloto_comunicados_autorizar(uuid,boolean) to authenticated;

drop policy if exists pilot_notice_owner_read on public.piloto_comunicados;
create policy pilot_notice_owner_read on public.piloto_comunicados for select to authenticated
 using(tenant_id=auth.uid() and public.piloto_zelador_ativo(tenant_id));
drop policy if exists pilot_notice_delivery_owner_read on public.piloto_comunicados_envios;
create policy pilot_notice_delivery_owner_read on public.piloto_comunicados_envios for select to authenticated
 using(tenant_id=auth.uid() and public.piloto_zelador_ativo(tenant_id));

create or replace function public.piloto_comunicados_listar(p_tenant uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare manager boolean;member_id uuid;rows jsonb;
begin
 perform public.piloto_comunicados_autorizar(p_tenant);
 manager:=public.piloto_zelador_ativo(p_tenant);
 if not manager then member_id:=public.piloto_comunicados_membro(p_tenant);end if;
 select coalesce(jsonb_agg(public.piloto_comunicados_json(n,manager)
  order by n.published_at desc nulls last,n.updated_at desc,n.id),'[]'::jsonb)
 into rows from public.piloto_comunicados n where n.tenant_id=p_tenant and n.deleted_at is null and (manager or
  (member_id is not null and n.dados->>'status'='published' and n.published_at is not null
   and (nullif(n.dados->>'expires','') is null or (n.dados->>'expires')::date>=(now() at time zone 'America/Sao_Paulo')::date)
   and (n.dados->>'audience'='all' or n.dados->'memberIds' ? member_id::text)));
 return jsonb_build_object('data',rows);
end $$;
revoke all on function public.piloto_comunicados_listar(uuid) from public,anon;
grant execute on function public.piloto_comunicados_listar(uuid) to authenticated;

-- Radar authorizes any active manager only for that manager's own tenant.
create or replace function public.piloto_radar_autorizar(p_tenant uuid)
returns void language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
begin
 perform public.piloto_validar_zelador(p_tenant);
end $$;
revoke all on function public.piloto_radar_autorizar(uuid) from public,anon,authenticated;

do $$ declare tab text;begin
 foreach tab in array array[
  'piloto_capas_galeria','piloto_gira_preparacao','piloto_entregas_pedidos',
  'piloto_chat_preferencias','piloto_suporte_chamados',
  'piloto_suporte_complementos','piloto_avisos_cantina'
 ] loop
  execute format('drop policy if exists pilot_owner_read on public.%I',tab);
  execute format(
   'create policy pilot_owner_read on public.%I for select to authenticated using(tenant_id=auth.uid() and public.piloto_zelador_ativo(tenant_id))',tab
  );
 end loop;
end $$;

drop policy if exists piloto_estoque_metadata_read on public.piloto_estoque_itens;
create policy piloto_estoque_metadata_read on public.piloto_estoque_itens for select to authenticated
 using(tenant_id=auth.uid() and public.piloto_zelador_ativo(tenant_id));
drop policy if exists piloto_estoque_history_read on public.piloto_estoque_movimentos;
create policy piloto_estoque_history_read on public.piloto_estoque_movimentos for select to authenticated
 using(tenant_id=auth.uid() and public.piloto_zelador_ativo(tenant_id));
drop policy if exists piloto_financeiro_own_read on public.piloto_financeiro_acoes;
create policy piloto_financeiro_own_read on public.piloto_financeiro_acoes for select to authenticated
 using(actor=auth.uid() and tenant_id=auth.uid() and public.piloto_zelador_ativo(tenant_id));
drop policy if exists piloto_radar_owner_read on public.piloto_radar_perfis;
create policy piloto_radar_owner_read on public.piloto_radar_perfis for select to authenticated
 using(tenant_id=auth.uid() and public.piloto_zelador_ativo(tenant_id));

drop policy if exists pilot_owner_store_images on storage.objects;
create policy pilot_owner_store_images on storage.objects for select to authenticated
 using(bucket_id='loja_imagens' and public.piloto_zelador_ativo(auth.uid())
  and name like auth.uid()::text||'/%');

-- Private library access is tenant-derived for every manager and every active
-- child; no request-supplied identity is trusted.
create or replace function public.piloto_pode_ler_pdf(p_id uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(
  select 1 from public.piloto_biblioteca_privada b
  where b.id=p_id and (
   public.piloto_zelador_ativo(b.tenant_id)
   or (b.retired_at is null and exists(
    select 1 from public.filhos_de_santo f
    where (f.tenant_id=b.tenant_id or f.lider_id=b.tenant_id)
     and f.user_id=auth.uid()
     and lower(btrim(coalesce(f.status::text,''))) in ('ativo','active')
     and (b.visibilidade='casa' or b.destinatario=f.id)
   ))
  )
 );
$$;
revoke all on function public.piloto_pode_ler_pdf(uuid) from public,anon;
grant execute on function public.piloto_pode_ler_pdf(uuid) to authenticated;

create or replace function public.piloto_biblioteca_revisoes_disponiveis()
returns integer language sql stable security definer set search_path=public,pg_temp as $$
 select case when public.piloto_zelador_ativo(auth.uid()) or exists(
  select 1 from public.filhos_de_santo f
  where f.user_id=auth.uid()
   and lower(btrim(coalesce(f.status::text,''))) in ('ativo','active')
 ) then 1 else 0 end;
$$;
revoke all on function public.piloto_biblioteca_revisoes_disponiveis() from public,anon;
grant execute on function public.piloto_biblioteca_revisoes_disponiveis() to authenticated;

create or replace function public.piloto_finalizar_pdf(
 p_id uuid,p_destinatario uuid,p_titulo text,p_descricao text,p_categoria text,p_sha256 text,p_size integer)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare owner_id uuid;path text;previous public.piloto_biblioteca_privada;object_meta jsonb;
begin
 owner_id:=public.piloto_validar_zelador(auth.uid());
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
 if object_meta is null or coalesce(object_meta->>'mimetype','')<>'application/pdf'
  or (object_meta->>'size')::bigint is distinct from p_size::bigint then
  raise exception 'O armazenamento ainda não confirmou este PDF' using errcode='23505';end if;
 insert into public.piloto_biblioteca_privada(id,tenant_id,destinatario,titulo,descricao,categoria,storage_path,sha256,size_bytes)
 values(p_id,owner_id,p_destinatario,btrim(p_titulo),p_descricao,p_categoria,path,p_sha256,p_size);
 return jsonb_build_object('id',p_id,'visibilidade','individual','replayed',false);
end $$;
revoke all on function public.piloto_finalizar_pdf(uuid,uuid,text,text,text,text,integer) from public,anon,authenticated;
grant execute on function public.piloto_finalizar_pdf(uuid,uuid,text,text,text,text,integer) to authenticated;

create or replace function public.piloto_revisar_pdf(
 p_previous uuid,p_id uuid,p_destinatario uuid,p_visibilidade text,p_titulo text,p_descricao text,p_categoria text,p_sha256 text,p_size integer)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare owner_id uuid;prior public.piloto_biblioteca_privada;saved public.piloto_biblioteca_privada;
 object_meta jsonb;path text;root uuid;next_revision integer;
begin
 owner_id:=public.piloto_validar_zelador(auth.uid());
 if p_id is null or p_id is not distinct from p_previous or p_visibilidade is null
  or p_visibilidade not in ('casa','individual') or (p_visibilidade='casa' and p_destinatario is not null)
  or (p_visibilidade='individual' and (p_destinatario is null or not exists(
   select 1 from public.filhos_de_santo where id=p_destinatario
    and (tenant_id=owner_id or lider_id=owner_id)
    and lower(btrim(coalesce(status::text,''))) in ('ativo','active')))) then
  raise exception 'Confira o destinatário e o acesso ao PDF' using errcode='22023';end if;
 if p_titulo is null or length(btrim(p_titulo)) not between 1 and 300 or p_descricao is null or length(p_descricao)>4000
  or p_categoria is null or p_categoria not in ('Cantigas','História','Ervas','Orixás','Fundamentos')
  or p_sha256 is null or p_sha256 !~ '^[0-9a-f]{64}$' or p_size is null or p_size not between 5 and 20971520 then
  raise exception 'Confira os dados do PDF' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('pilot-private-pdf:'||p_id::text,0));
 select * into saved from public.piloto_biblioteca_privada where id=p_id;
 if found then
  if saved.tenant_id<>owner_id or saved.previous_id is distinct from p_previous
   or saved.destinatario is distinct from p_destinatario or saved.visibilidade<>p_visibilidade
   or saved.titulo<>btrim(p_titulo) or saved.descricao<>p_descricao or saved.categoria<>p_categoria
   or saved.sha256<>p_sha256 or saved.size_bytes<>p_size then
   raise exception 'Esta tentativa já foi usada com outros dados' using errcode='23505';end if;
  return jsonb_build_object('id',saved.id,'previous_id',saved.previous_id,'visibilidade',saved.visibilidade,'replayed',true);
 end if;
 if p_previous is not null then
  select * into prior from public.piloto_biblioteca_privada where id=p_previous for update;
  if not found or prior.tenant_id<>owner_id or prior.retired_at is not null then
   raise exception 'O material já foi alterado ou removido. Atualize o acervo.' using errcode='23505';end if;
  root:=prior.root_id;next_revision:=prior.revision+1;
 else root:=p_id;next_revision:=1;end if;
 path:=owner_id::text||'/private/'||p_id::text||'.pdf';
 select metadata into object_meta from storage.objects where bucket_id='piloto_biblioteca_privada' and name=path for share;
 if object_meta is null or coalesce(object_meta->>'mimetype','')<>'application/pdf'
  or (object_meta->>'size')::bigint is distinct from p_size::bigint then
  raise exception 'O armazenamento ainda não confirmou esta revisão' using errcode='23505';end if;
 if p_previous is not null then update public.piloto_biblioteca_privada set retired_at=now() where id=p_previous;end if;
 insert into public.piloto_biblioteca_privada(id,tenant_id,destinatario,titulo,descricao,categoria,
  storage_path,sha256,size_bytes,visibilidade,root_id,previous_id,revision)
 values(p_id,owner_id,p_destinatario,btrim(p_titulo),p_descricao,p_categoria,path,p_sha256,p_size,
  p_visibilidade,root,p_previous,next_revision);
 return jsonb_build_object('id',p_id,'previous_id',p_previous,'visibilidade',p_visibilidade,'replayed',false);
end $$;
revoke all on function public.piloto_revisar_pdf(uuid,uuid,uuid,text,text,text,text,text,integer) from public,anon,authenticated;
grant execute on function public.piloto_revisar_pdf(uuid,uuid,uuid,text,text,text,text,text,integer) to authenticated;

drop policy if exists pilot_pdf_insert on storage.objects;
create policy pilot_pdf_insert on storage.objects for insert to authenticated with check(
 bucket_id='piloto_biblioteca_privada' and public.piloto_zelador_ativo(auth.uid())
 and name ~ ('^'||auth.uid()::text||'/private/[0-9a-f-]{36}\.pdf$'));
drop policy if exists pilot_pdf_read on storage.objects;
create policy pilot_pdf_read on storage.objects for select to authenticated using(
 bucket_id='piloto_biblioteca_privada' and (
  public.piloto_zelador_ativo(auth.uid()) or exists(
   select 1 from public.piloto_biblioteca_privada b
   where b.storage_path=objects.name and public.piloto_pode_ler_pdf(b.id))));
drop policy if exists pilot_pdf_delete on storage.objects;
create policy pilot_pdf_delete on storage.objects for delete to authenticated using(
 bucket_id='piloto_biblioteca_privada' and public.piloto_zelador_ativo(auth.uid())
 and name like auth.uid()::text||'/private/%');
drop policy if exists pilot_pdf_read_guard on storage.objects;
create policy pilot_pdf_read_guard on storage.objects as restrictive for select to authenticated using(
 bucket_id<>'piloto_biblioteca_privada' or public.piloto_zelador_ativo(auth.uid())
 or exists(select 1 from public.piloto_biblioteca_privada b
  where b.storage_path=objects.name and public.piloto_pode_ler_pdf(b.id)));
drop policy if exists pilot_pdf_insert_guard on storage.objects;
create policy pilot_pdf_insert_guard on storage.objects as restrictive for insert to authenticated with check(
 bucket_id<>'piloto_biblioteca_privada' or public.piloto_zelador_ativo(auth.uid()));
drop policy if exists pilot_pdf_delete_guard on storage.objects;
create policy pilot_pdf_delete_guard on storage.objects as restrictive for delete to authenticated using(
 bucket_id<>'piloto_biblioteca_privada' or public.piloto_zelador_ativo(auth.uid()));
drop policy if exists pilot_pdf_operation_guard on storage.objects;
create policy pilot_pdf_operation_guard on storage.objects as restrictive for select to authenticated using(
 bucket_id<>'piloto_biblioteca_privada' or storage.allow_only_operation('object.get_authenticated')
 or (public.piloto_zelador_ativo(auth.uid())
  and storage.allow_any_operation(array['object.upload','object.delete','object.delete_many'])));

-- A structured Radar profile is canonical for every opted-in tenant. Legacy
-- directory readers receive a privacy-safe projection through these triggers.
create or replace function public.piloto_radar_projetar_legado()
returns trigger language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare p jsonb;visible boolean;insta text;
begin
 if tg_op='UPDATE' and old.claimed_by_tenant_id is not null
  and new.claimed_by_tenant_id is distinct from old.claimed_by_tenant_id
  and exists(select 1 from public.piloto_radar_perfis where tenant_id=old.claimed_by_tenant_id) then
  raise exception 'Revise o vínculo do Radar antes de transferir o perfil' using errcode='42501';
 end if;
 if new.claimed_by_tenant_id is null then return new;end if;
 select profile into p from public.piloto_radar_perfis where tenant_id=new.claimed_by_tenant_id;
 if not found then return new;end if;
 visible:=(p->>'showAddress')::boolean and (p->>'published')::boolean;
 new.nome:=p->>'publicName';new.cidade:=p->>'city';new.estado:=p->>'uf';
 new.cidade_slug:=trim(both '-' from regexp_replace(translate(lower(p->>'city'),'áàâãäéèêëíìîïóòôõöúùûüç','aaaaaeeeeiiiiooooouuuuc'),'[^a-z0-9]+','-','g'));
 new.endereco:=case when visible then concat_ws(', ',nullif(p->>'address',''),case when (p->>'noNumber')::boolean then 's/n' else nullif(p->>'number','') end,nullif(p->>'complement',''),nullif(p->>'neighborhood',''),nullif(p->>'cep','')) else null end;
 new.bairro:=case when visible then nullif(p->>'neighborhood','') else null end;new.bairro_slug:=null;
 new.cep:=case when visible then nullif(replace(p->>'cep','-',''),'') else null end;
 new.latitude:=case when visible then nullif(p->>'latitude','')::double precision else null end;
 new.longitude:=case when visible then nullif(p->>'longitude','')::double precision else null end;
 new.link_maps:=case when visible and new.id=(select id from public.terreiros_diretorio where claimed_by_tenant_id=new.claimed_by_tenant_id order by id limit 1) then nullif(p->>'mapsUrl','') else null end;
 new.coordinate_source:=null;new.telefone:=nullif(p->>'phone','');new.whatsapp_atendimento:=nullif(p->>'servicePhone','');
 select r->>'url' into insta from jsonb_array_elements(p->'socials') r where r->>'network'='instagram';new.instagram_url:=insta;
 new.owner_photo_url:=p->'portrait'->>'source';new.foto_url:=new.owner_photo_url;new.cover_photo_url:=p->'cover'->>'source';
 select coalesce(jsonb_agg(r->>'source'),'[]'::jsonb) into new.gallery_photo_urls from jsonb_array_elements(p->'gallery') r;
 new.descricao_publica:=p->>'description';new.orientacoes_visita:=p->>'instructions';
 new.tradicao:=case p->>'tradition' when 'Candomblé' then 'candomble' else lower(p->>'tradition') end;
 new.publicacao_status:=case when (p->>'published')::boolean then 'publicado' else 'oculto' end;
 select coalesce(jsonb_agg(jsonb_build_object('diaSemana',r->'day','horario',r->>'start','titulo',r->>'title')),'[]'::jsonb)
 into new.gira_horarios from jsonb_array_elements(p->'schedules') r where (r->>'enabled')::boolean;
 return new;
end $$;
revoke all on function public.piloto_radar_projetar_legado() from public,anon,authenticated;

create or replace function public.piloto_radar_proteger_bairro_portal()
returns trigger language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare p jsonb;
begin
 select profile into p from public.piloto_radar_perfis where tenant_id=new.id;
 if found then new.bairro_publico:=case when (p->>'showAddress')::boolean and (p->>'published')::boolean then p->>'neighborhood' else null end;end if;
 return new;
end $$;
revoke all on function public.piloto_radar_proteger_bairro_portal() from public,anon,authenticated;

create or replace function public.piloto_radar_publicos()
returns jsonb language sql stable security definer set search_path=pg_catalog,public,pg_temp as $$
 with aliases as (
  select d.id,d.slug,'directory'::text as kind,d.claimed_by_tenant_id as tenant_id
  from public.terreiros_diretorio d join public.piloto_radar_perfis r on r.tenant_id=d.claimed_by_tenant_id
  where d.slug is not null
  union all
  select p.id,p.public_slug,'portal'::text,p.id
  from public.perfil_lider p join public.piloto_radar_perfis r on r.tenant_id=p.id
  where p.public_slug is not null
 ), data as (
  select a.id,a.slug,a.kind,r.tenant_id,r.revision,r.profile,
   exists(select 1 from public.perfil_lider p where p.id=r.tenant_id
    and nullif(to_jsonb(p)->>'deleted_at','') is null
    and lower(coalesce(to_jsonb(p)->>'status','')) not in ('blocked','deleted')) as active
  from aliases a join public.piloto_radar_perfis r on r.tenant_id=a.tenant_id
 )
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'slug',slug,'kind',kind,'managed',true,'revision',revision,'profile',
  case when active and (profile->>'published')::boolean then
   (select jsonb_object_agg(k,case when k='schedules' then
    (select coalesce(jsonb_agg(s),'[]'::jsonb) from jsonb_array_elements(v) s where (s->>'enabled')::boolean) else v end)
    from jsonb_each(profile) e(k,v) where k=any(array['publicName','tradition','description','instructions','city','uf','phone','servicePhone','showAddress','socials','schedules','cover','portrait','gallery','coverPosition','published'])
     or ((profile->>'showAddress')::boolean and k=any(array['address','number','noNumber','complement','neighborhood','cep','latitude','longitude','mapsUrl'])))
  else null end) order by tenant_id,kind,id),'[]'::jsonb) from data
$$;
revoke all on function public.piloto_radar_publicos() from public,authenticated;
grant execute on function public.piloto_radar_publicos() to anon,authenticated;

-- Cancellation must clear delivery state for every tenant that has opted into
-- the modern delivery metadata, not only the original pilot.
create or replace function public.piloto_cancelar_entrega_com_pedido()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if new.status='cancelado' and exists(
  select 1 from public.piloto_entregas_pedidos e where e.pedido_id=new.id and e.tenant_id=new.tenant_id
 ) then
  update public.piloto_entregas_pedidos set entregue=false,updated_at=now()
   where pedido_id=new.id and tenant_id=new.tenant_id;
 end if;
 return new;
end $$;
revoke all on function public.piloto_cancelar_entrega_com_pedido() from public,anon,authenticated;

notify pgrst,'reload schema';
commit;
