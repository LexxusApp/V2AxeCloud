begin;
-- PROPOSTA: revisar antes de aplicar. Somente o tenant e as duas identidades
-- já autorizadas no piloto. Nenhuma alteração no acervo/bucket legado.
do $$ begin
 if (select public from storage.buckets where id='piloto_biblioteca_privada') is distinct from false then
  raise exception 'O bucket protegido precisa existir e estar privado antes da ativação';
 end if;
 if to_regprocedure('storage.allow_any_operation(text[])') is null
  or to_regprocedure('storage.allow_only_operation(text)') is null then
  raise exception 'O Storage precisa suportar políticas por operação antes da ativação';
 end if;
end $$;
alter table public.piloto_biblioteca_privada
 add column if not exists visibilidade text not null default 'individual',
 add column if not exists retired_at timestamptz,
 add column if not exists previous_id uuid references public.piloto_biblioteca_privada(id),
 add column if not exists root_id uuid,
 add column if not exists revision integer not null default 1;
update public.piloto_biblioteca_privada set root_id=id where root_id is null;
alter table public.piloto_biblioteca_privada alter column root_id set not null;
alter table public.piloto_biblioteca_privada alter column destinatario drop not null;
alter table public.piloto_biblioteca_privada drop constraint if exists pilot_revision_scope;
alter table public.piloto_biblioteca_privada add constraint pilot_revision_scope check(
 (visibilidade='individual' and destinatario is not null) or (visibilidade='casa' and destinatario is null));
alter table public.piloto_biblioteca_privada drop constraint if exists pilot_revision_number;
alter table public.piloto_biblioteca_privada add constraint pilot_revision_number check(revision>0);
create unique index if not exists pilot_revision_one_successor on public.piloto_biblioteca_privada(previous_id) where previous_id is not null;
create unique index if not exists pilot_revision_one_active on public.piloto_biblioteca_privada(root_id) where retired_at is null;

-- Every revision, including a metadata-only edit, owns a fresh path and comments.
-- No API role may mutate a version's bytes, audience or metadata in place.
revoke update on public.piloto_biblioteca_privada from authenticated;
revoke update(titulo,descricao,categoria,updated_at) on public.piloto_biblioteca_privada from authenticated;
create or replace function public.piloto_pdf_revisao_imutavel()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 if tg_op='INSERT' then new.root_id:=coalesce(new.root_id,new.id);return new;end if;
 if (to_jsonb(new)-'retired_at') is distinct from (to_jsonb(old)-'retired_at')
  or old.retired_at is not null or new.retired_at is null then
  raise exception 'Uma revisão publicada é imutável' using errcode='23514';
 end if;
 return new;
end $$;
drop trigger if exists pilot_pdf_immutable_revision on public.piloto_biblioteca_privada;
create trigger pilot_pdf_immutable_revision before insert or update on public.piloto_biblioteca_privada
 for each row execute function public.piloto_pdf_revisao_imutavel();

create or replace function public.piloto_pode_ler_pdf(p_id uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.piloto_biblioteca_privada b
 where b.id=p_id and b.tenant_id='fad75b91-d2eb-4805-b5a3-c19e8a073bed'::uuid
 and (auth.uid()=b.tenant_id or (b.retired_at is null
  and auth.uid()='ab2eef13-604c-4c8f-9d14-f3da41cc5a81'::uuid
  and exists(select 1 from public.filhos_de_santo f where
   f.id='3666b777-1066-4eb7-a0c3-f63c2e01ae90'::uuid
   and (f.tenant_id=b.tenant_id or f.lider_id=b.tenant_id)
   and f.user_id=auth.uid()
   and lower(btrim(coalesce(f.status::text,''))) in ('ativo','active')
   and (b.visibilidade='casa' or b.destinatario=f.id)))));
$$;
revoke all on function public.piloto_pode_ler_pdf(uuid) from public,anon;
grant execute on function public.piloto_pode_ler_pdf(uuid) to authenticated;

-- Older permissive storage policies cannot authorize overwrites of staged or
-- published objects. A retry must verify the existing bytes instead of upsert.
drop policy if exists pilot_pdf_update_guard on storage.objects;
create policy pilot_pdf_update_guard on storage.objects as restrictive for update to authenticated
 using(bucket_id<>'piloto_biblioteca_privada') with check(bucket_id<>'piloto_biblioteca_privada');
-- SELECT alone also authorizes signing reusable URLs. Restrict this bucket to
-- authenticated downloads (and the owner's upload/delete implementation), so
-- object.sign / object.sign_many / copy / S3 cannot bypass future retirement.
-- Docs: https://supabase.com/docs/guides/storage/schema/helper-functions
drop policy if exists pilot_pdf_operation_guard on storage.objects;
create policy pilot_pdf_operation_guard on storage.objects as restrictive for select to authenticated using(
 bucket_id<>'piloto_biblioteca_privada' or storage.allow_only_operation('object.get_authenticated')
 or (auth.uid()='fad75b91-d2eb-4805-b5a3-c19e8a073bed'::uuid
  and storage.allow_any_operation(array['object.upload','object.delete','object.delete_many'])));

create or replace function public.piloto_biblioteca_revisoes_disponiveis()
returns integer language sql stable security definer set search_path=public,pg_temp as $$
 select case when auth.uid() in ('fad75b91-d2eb-4805-b5a3-c19e8a073bed'::uuid,
  'ab2eef13-604c-4c8f-9d14-f3da41cc5a81'::uuid) then 1 else 0 end;
$$;
revoke all on function public.piloto_biblioteca_revisoes_disponiveis() from public,anon;
grant execute on function public.piloto_biblioteca_revisoes_disponiveis() to authenticated;

create or replace function public.piloto_revisar_pdf(p_previous uuid,p_id uuid,p_destinatario uuid,
 p_visibilidade text,p_titulo text,p_descricao text,p_categoria text,p_sha256 text,p_size integer)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare owner_id uuid; prior public.piloto_biblioteca_privada; saved public.piloto_biblioteca_privada;
 object_meta jsonb; path text; root uuid; next_revision integer;
begin
 owner_id:=public.piloto_validar_zelador('fad75b91-d2eb-4805-b5a3-c19e8a073bed');
 if auth.uid() is distinct from 'fad75b91-d2eb-4805-b5a3-c19e8a073bed'::uuid
  or owner_id is distinct from auth.uid() then raise exception 'Acesso restrito ao piloto' using errcode='42501';end if;
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
 -- Readers see either the entire old revision or the entire new revision.
 if p_previous is not null then update public.piloto_biblioteca_privada set retired_at=now() where id=p_previous;end if;
 insert into public.piloto_biblioteca_privada(id,tenant_id,destinatario,titulo,descricao,categoria,
  storage_path,sha256,size_bytes,visibilidade,previous_id,root_id,revision)
 values(p_id,owner_id,p_destinatario,btrim(p_titulo),p_descricao,p_categoria,path,p_sha256,p_size,
  p_visibilidade,p_previous,root,next_revision);
 return jsonb_build_object('id',p_id,'previous_id',p_previous,'visibilidade',p_visibilidade,'replayed',false);
end $$;
revoke all on function public.piloto_revisar_pdf(uuid,uuid,uuid,text,text,text,text,text,integer) from public,anon,authenticated;
grant execute on function public.piloto_revisar_pdf(uuid,uuid,uuid,text,text,text,text,text,integer) to authenticated;

-- Lock the version before checking access. A concurrent retirement cannot
-- attach a member's new comment to a version they have already lost access to.
create or replace function public.piloto_comentar_pdf(p_material uuid,p_request uuid,p_text text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid:=auth.uid();material public.piloto_biblioteca_privada;
 prior public.piloto_biblioteca_comentarios;author text;leader boolean;
begin
 select * into material from public.piloto_biblioteca_privada where id=p_material for share;
 if not found or actor is null or not public.piloto_pode_ler_pdf(p_material)
  or (material.retired_at is not null and actor<>material.tenant_id) then
  raise exception 'Você não tem acesso a este estudo' using errcode='42501';end if;
 if p_request is null or p_text is null or length(btrim(p_text)) not between 1 and 2000 then
  raise exception 'Escreva um comentário de até 2.000 caracteres' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('pilot-pdf-comment:'||p_request::text,0));
 select * into prior from public.piloto_biblioteca_comentarios where id=p_request;
 if found then
  if prior.material_id<>p_material or prior.author_id<>actor or prior.texto<>btrim(p_text) then
   raise exception 'Esta tentativa já foi usada com outro comentário' using errcode='23505';end if;
  return jsonb_build_object('id',prior.id,'replayed',true);
 end if;
 leader:=actor=material.tenant_id;
 if leader then select coalesce(nullif(zelador,''),'Zeladoria') into author from public.perfil_lider where id=actor;
 else select nome into author from public.filhos_de_santo where id='3666b777-1066-4eb7-a0c3-f63c2e01ae90'::uuid and user_id=actor;end if;
 insert into public.piloto_biblioteca_comentarios(id,material_id,author_id,author_name,leadership,texto)
 values(p_request,p_material,actor,coalesce(nullif(author,''),'Membro'),leader,btrim(p_text));
 return jsonb_build_object('id',p_request,'replayed',false);
end $$;
revoke all on function public.piloto_comentar_pdf(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.piloto_comentar_pdf(uuid,uuid,text) to authenticated;
notify pgrst,'reload schema';
commit;
