begin;
-- PRIVATE PILOT ONLY. Never put draft/selected content in mural_avisos: its legacy
-- API uses service_role. This migration does not change that table or its policies.
create table if not exists public.piloto_comunicados(
 id uuid primary key,tenant_id uuid not null check(tenant_id='fad75b91-d2eb-4805-b5a3-c19e8a073bed'::uuid),
 dados jsonb not null,revision bigint not null default 1 check(revision>0),
 published_at timestamptz,updated_at timestamptz not null default now(),deleted_at timestamptz,
 legacy_origin boolean not null default false
);
create table if not exists public.piloto_comunicados_envios(
 notice_id uuid not null references public.piloto_comunicados(id),revision bigint not null,
 tenant_id uuid not null check(tenant_id='fad75b91-d2eb-4805-b5a3-c19e8a073bed'::uuid),
 recipient uuid not null,request_key uuid not null,attempt uuid not null default gen_random_uuid(),
 state text not null default 'pending' check(state in ('pending','sending','confirmed','uncertain','failed','skipped')),
 external_id text,error text,updated_at timestamptz not null default now(),
 primary key(notice_id,revision,recipient)
);
alter table public.piloto_comunicados drop constraint if exists piloto_comunicados_tenant_id_check;
alter table public.piloto_comunicados add constraint piloto_comunicados_tenant_id_check
 check(tenant_id='fad75b91-d2eb-4805-b5a3-c19e8a073bed'::uuid);
alter table public.piloto_comunicados_envios drop constraint if exists piloto_comunicados_envios_tenant_id_check;
alter table public.piloto_comunicados_envios add constraint piloto_comunicados_envios_tenant_id_check
 check(tenant_id='fad75b91-d2eb-4805-b5a3-c19e8a073bed'::uuid);
create index if not exists piloto_comunicados_tenant_updated on public.piloto_comunicados(tenant_id,updated_at desc,id);
alter table public.piloto_comunicados enable row level security;
alter table public.piloto_comunicados_envios enable row level security;
revoke all on public.piloto_comunicados,public.piloto_comunicados_envios from public,anon,authenticated;
grant select on public.piloto_comunicados,public.piloto_comunicados_envios to authenticated;
-- Members read ONLY the sanitized RPC, never the audience list or delivery log.
drop policy if exists pilot_notice_owner_read on public.piloto_comunicados;
create policy pilot_notice_owner_read on public.piloto_comunicados for select to authenticated
 using(tenant_id=auth.uid() and auth.uid()='fad75b91-d2eb-4805-b5a3-c19e8a073bed'::uuid);
drop policy if exists pilot_notice_delivery_owner_read on public.piloto_comunicados_envios;
create policy pilot_notice_delivery_owner_read on public.piloto_comunicados_envios for select to authenticated
 using(tenant_id=auth.uid() and auth.uid()='fad75b91-d2eb-4805-b5a3-c19e8a073bed'::uuid);

create or replace function public.piloto_comunicados_zelador_ativo(p_tenant uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select p_tenant='fad75b91-d2eb-4805-b5a3-c19e8a073bed'::uuid and auth.uid()=p_tenant
  and exists(select 1 from auth.users u join public.perfil_lider p on p.id=u.id where u.id=auth.uid()
   and lower(u.email)='vendasmercadolivrev1@gmail.com'
   and coalesce(nullif(to_jsonb(p)->>'tenant_id',''),p.id::text)=p_tenant::text
   and lower(coalesce(to_jsonb(p)->>'role','zelador'))<>'filho'
   and lower(coalesce(to_jsonb(p)->>'status','')) not in ('blocked','deleted'))
  and not exists(select 1 from public.subscriptions s where s.id=auth.uid()
   and (lower(coalesce(to_jsonb(s)->>'status','')) in ('blocked','deleted') or lower(coalesce(to_jsonb(s)->>'role',''))='filho'));
$$;
alter policy pilot_notice_owner_read on public.piloto_comunicados using(tenant_id=auth.uid() and public.piloto_comunicados_zelador_ativo(tenant_id));
alter policy pilot_notice_delivery_owner_read on public.piloto_comunicados_envios using(tenant_id=auth.uid() and public.piloto_comunicados_zelador_ativo(tenant_id));

create or replace function public.piloto_comunicados_autorizar(p_tenant uuid,p_manager boolean default false)
returns uuid language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if p_tenant is distinct from 'fad75b91-d2eb-4805-b5a3-c19e8a073bed'::uuid then
  raise exception 'Casa não autorizada no piloto' using errcode='42501';end if;
 if public.piloto_comunicados_zelador_ativo(p_tenant) then return auth.uid();end if;
 if not p_manager and auth.uid()='ab2eef13-604c-4c8f-9d14-f3da41cc5a81'::uuid and exists(
  select 1 from public.filhos_de_santo f join auth.users u on u.id=auth.uid() where f.id='3666b777-1066-4eb7-a0c3-f63c2e01ae90'::uuid
   and f.user_id=auth.uid() and f.tenant_id=p_tenant
   and lower(f.email)='lucasteste@gmail.com'
   and lower(u.email) in ('lucasteste@gmail.com','f_3666b777-1066-4eb7-a0c3-f63c2e01ae90@axecloud.internal')
   and lower(btrim(coalesce(f.status::text,''))) in ('ativo','active')) then return auth.uid();end if;
 raise exception 'Conta não autorizada ou membro inativo' using errcode='42501';
end $$;

create or replace function public.piloto_comunicados_validar(p_tenant uuid,p_notice jsonb)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare canonical jsonb;recipients uuid[];gira uuid;expires date;
begin
 perform public.piloto_comunicados_autorizar(p_tenant,true);
 if jsonb_typeof(p_notice) is distinct from 'object' or jsonb_typeof(p_notice->'memberIds') is distinct from 'array'
  or jsonb_array_length(p_notice->'memberIds')>2000 then raise exception 'Confira o público do comunicado' using errcode='22023';end if;
 if length(btrim(coalesce(p_notice->>'title',''))) not between 3 and 110
  or length(btrim(coalesce(p_notice->>'body',''))) not between 10 and 3000
  or coalesce(p_notice->>'status','') not in ('draft','published')
  or coalesce(p_notice->>'audience','') not in ('all','selected')
  or coalesce(p_notice->>'category','Geral') not in ('Geral','Urgente','Festas','Doutrina') then
  raise exception 'Confira título, mensagem, categoria e situação' using errcode='22023';end if;
 begin
  select coalesce(array_agg(distinct value::uuid order by value::uuid),'{}'::uuid[]) into recipients
   from jsonb_array_elements_text(p_notice->'memberIds');
  gira:=nullif(p_notice->>'giraId','')::uuid;
  if nullif(p_notice->>'expires','') is not null then
   if (p_notice->>'expires')!~'^\d{4}-\d{2}-\d{2}$' then raise invalid_datetime_format;end if;
   expires:=(p_notice->>'expires')::date;
  end if;
 exception when invalid_text_representation or invalid_datetime_format or datetime_field_overflow then
  raise exception 'Data, gira ou destinatário inválido' using errcode='22023';end;
 if p_notice->>'audience'='all' then recipients:='{}'::uuid[];
 elsif cardinality(recipients)=0 or exists(select 1 from unnest(recipients) r(id) where not exists(
  select 1 from public.filhos_de_santo f where f.id=r.id and (f.tenant_id=p_tenant or f.lider_id=p_tenant)
   and lower(btrim(coalesce(f.status::text,''))) in ('ativo','active'))) then
  raise exception 'Selecione apenas membros ativos desta casa' using errcode='22023';end if;
 if gira is not null and not exists(select 1 from public.calendario_axe e where e.id=gira and e.tenant_id=p_tenant) then
  raise exception 'A gira não pertence a esta casa' using errcode='22023';end if;
 canonical:=jsonb_build_object('title',btrim(p_notice->>'title'),'body',btrim(p_notice->>'body'),
  'audience',p_notice->>'audience','memberIds',to_jsonb(recipients),'giraId',coalesce(gira::text,''),
  'status',p_notice->>'status','category',coalesce(p_notice->>'category','Geral'),'expires',coalesce(expires::text,''));
 return canonical;
end $$;

create or replace function public.piloto_comunicados_json(p_row public.piloto_comunicados,p_manager boolean)
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select (case when p_manager then p_row.dados else p_row.dados-'memberIds' end)
  ||jsonb_build_object('id',p_row.id,'revision',p_row.revision,'updated',p_row.updated_at,
    'publishedAt',coalesce(p_row.published_at::text,''))
  ||case when p_manager then jsonb_build_object('delivery',coalesce((select case when count(*)=0 then 'none'
    when bool_or(e.state in ('pending','sending') and e.updated_at>now()-interval '2 minutes') then 'sending'
    when bool_or(e.state in ('pending','sending','uncertain')) then 'uncertain'
    when bool_and(e.state='confirmed') then 'confirmed' else 'failed' end
    from public.piloto_comunicados_envios e where e.notice_id=p_row.id and e.revision=p_row.revision),'none'),
   'deliveryCounts',(select jsonb_build_object('total',count(*),'confirmed',count(*) filter(where e.state='confirmed'),
    'failed',count(*) filter(where e.state in ('failed','skipped')),'uncertain',count(*) filter(where e.state='uncertain' or e.state in ('pending','sending') and e.updated_at<=now()-interval '2 minutes'))
    from public.piloto_comunicados_envios e where e.notice_id=p_row.id and e.revision=p_row.revision)) else '{}'::jsonb end;
$$;
-- Internal serializer must never be an authenticated data-exfiltration RPC.
revoke all on function public.piloto_comunicados_json(public.piloto_comunicados,boolean) from public,anon,authenticated;

create or replace function public.piloto_comunicados_listar(p_tenant uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare actor uuid;manager boolean;rows jsonb;
begin
 actor:=public.piloto_comunicados_autorizar(p_tenant);manager:=actor=p_tenant;
 select coalesce(jsonb_agg(public.piloto_comunicados_json(n,manager) order by n.published_at desc nulls last,n.updated_at desc,n.id),'[]'::jsonb)
 into rows from public.piloto_comunicados n where n.tenant_id=p_tenant and n.deleted_at is null and (manager or
  (n.dados->>'status'='published' and n.published_at is not null
   and (nullif(n.dados->>'expires','') is null or (n.dados->>'expires')::date>=(now() at time zone 'America/Sao_Paulo')::date)
   and (n.dados->>'audience'='all' or n.dados->'memberIds' ? '3666b777-1066-4eb7-a0c3-f63c2e01ae90')));
 return jsonb_build_object('data',rows);
end $$;

create or replace function public.piloto_comunicados_salvar(p_tenant uuid,p_notice jsonb,p_expected bigint default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare canonical jsonb;record public.piloto_comunicados;notice_id uuid;
begin
 canonical:=public.piloto_comunicados_validar(p_tenant,p_notice);
 begin notice_id:=(p_notice->>'id')::uuid;exception when invalid_text_representation then
  raise exception 'Identificação inválida' using errcode='22023';end;
 if notice_id is null then raise exception 'Identificação obrigatória' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(notice_id::text,0));
 select * into record from public.piloto_comunicados where id=notice_id for update;
 if found then
  if record.tenant_id<>p_tenant or record.deleted_at is not null then raise exception 'Registro removido ou indisponível' using errcode='23505';end if;
  if record.dados=canonical then return public.piloto_comunicados_json(record,true);end if;
  if record.revision is distinct from p_expected then raise exception 'O comunicado mudou. Atualize antes de salvar' using errcode='23505';end if;
  if exists(select 1 from public.piloto_comunicados_envios where notice_id=record.id and revision=record.revision and state in ('pending','sending') and updated_at>now()-interval '2 minutes') then
   raise exception 'Aguarde a conclusão do envio antes de editar' using errcode='23505';end if;
  update public.piloto_comunicados_envios set state='skipped',error='Versão substituída antes do envio',updated_at=clock_timestamp() where notice_id=record.id and revision=record.revision and state='pending';
  update public.piloto_comunicados set dados=canonical,revision=revision+1,updated_at=clock_timestamp(),
   published_at=case when canonical->>'status'='published' then coalesce(published_at,clock_timestamp()) else null end
   where id=notice_id returning * into record;
 else
  if p_expected is not null then raise exception 'Registro não encontrado. Atualize o mural' using errcode='23505';end if;
  insert into public.piloto_comunicados(id,tenant_id,dados,published_at) values(notice_id,p_tenant,canonical,
   case when canonical->>'status'='published' then clock_timestamp() else null end) returning * into record;
 end if;
 return public.piloto_comunicados_json(record,true);
end $$;

create or replace function public.piloto_comunicados_excluir(p_tenant uuid,p_id uuid,p_expected bigint)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare record public.piloto_comunicados;
begin
 perform public.piloto_comunicados_autorizar(p_tenant,true);
 select * into record from public.piloto_comunicados where id=p_id and tenant_id=p_tenant for update;
 if not found then raise exception 'Comunicado não encontrado' using errcode='42501';end if;
 if record.deleted_at is not null and record.revision=p_expected+1 then return jsonb_build_object('id',p_id,'revision',record.revision,'deleted',true);end if;
 if record.deleted_at is not null or record.revision is distinct from p_expected then raise exception 'O comunicado mudou. Atualize antes de remover' using errcode='23505';end if;
 update public.piloto_comunicados set deleted_at=clock_timestamp(),updated_at=clock_timestamp(),revision=revision+1 where id=p_id returning * into record;
 -- Pending targets have never been sent. Sending targets cannot be recalled.
 update public.piloto_comunicados_envios set state='skipped',error='Comunicado removido',updated_at=clock_timestamp() where notice_id=p_id and state='pending';
 return jsonb_build_object('id',p_id,'revision',record.revision,'deleted',true);
end $$;

create or replace function public.piloto_comunicados_restaurar(p_tenant uuid,p_id uuid,p_expected bigint)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare record public.piloto_comunicados;
begin
 perform public.piloto_comunicados_autorizar(p_tenant,true);
 select * into record from public.piloto_comunicados where id=p_id and tenant_id=p_tenant for update;
 if not found then raise exception 'Comunicado não encontrado' using errcode='42501';end if;
 if record.deleted_at is null and record.revision=p_expected+1 then return public.piloto_comunicados_json(record,true);end if;
 if record.deleted_at is null or record.revision is distinct from p_expected then raise exception 'O comunicado mudou. Atualize antes de restaurar' using errcode='23505';end if;
 perform public.piloto_comunicados_validar(p_tenant,record.dados);
 update public.piloto_comunicados set deleted_at=null,updated_at=clock_timestamp(),revision=revision+1 where id=p_id returning * into record;
 return public.piloto_comunicados_json(record,true);
end $$;

-- A campaign is immutable per notice revision; another key cannot repeat it.
-- Each recipient must claim pending->sending before using the existing targeted
-- WhatsApp endpoint. Lost responses stay uncertain, never automatically resent.
create or replace function public.piloto_comunicados_iniciar_envio(p_tenant uuid,p_id uuid,p_revision bigint,p_key uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare record public.piloto_comunicados;ids jsonb;previous_key uuid;
begin
 perform public.piloto_comunicados_autorizar(p_tenant,true);
 if p_key is null then raise exception 'Identificação do envio obrigatória' using errcode='22023';end if;
 select * into record from public.piloto_comunicados where id=p_id and tenant_id=p_tenant for update;
 if not found or record.deleted_at is not null or record.revision is distinct from p_revision or record.dados->>'status'<>'published'
  or (nullif(record.dados->>'expires','') is not null and (record.dados->>'expires')::date<(now() at time zone 'America/Sao_Paulo')::date) then
  raise exception 'O comunicado precisa estar publicado, vigente e atualizado' using errcode='23505';end if;
 select request_key into previous_key from public.piloto_comunicados_envios where notice_id=p_id and revision=p_revision limit 1;
 if found then return jsonb_build_object('id',p_id,'send',false,'notice',public.piloto_comunicados_json(record,true),'recipients','[]'::jsonb);end if;
 insert into public.piloto_comunicados_envios(notice_id,revision,tenant_id,recipient,request_key)
 select p_id,p_revision,p_tenant,f.id,p_key from public.filhos_de_santo f
 where (f.tenant_id=p_tenant or f.lider_id=p_tenant) and lower(btrim(coalesce(f.status::text,''))) in ('ativo','active')
  and nullif(btrim(f.whatsapp_phone),'') is not null
  and (record.dados->>'audience'='all' or record.dados->'memberIds' ? f.id::text);
 select coalesce(jsonb_agg(recipient order by recipient),'[]'::jsonb) into ids from public.piloto_comunicados_envios where notice_id=p_id and revision=p_revision;
 if jsonb_array_length(ids)=0 then raise exception 'Nenhum destinatário ativo com WhatsApp cadastrado' using errcode='22023';end if;
 return jsonb_build_object('id',p_id,'send',true,'recipients',ids);
end $$;

create or replace function public.piloto_comunicados_assumir_destinatario(p_tenant uuid,p_id uuid,p_revision bigint,p_recipient uuid,p_key uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare record public.piloto_comunicados;delivery public.piloto_comunicados_envios;
begin
 perform public.piloto_comunicados_autorizar(p_tenant,true);
 select * into record from public.piloto_comunicados where id=p_id and tenant_id=p_tenant for update;
 select * into delivery from public.piloto_comunicados_envios where notice_id=p_id and revision=p_revision and recipient=p_recipient and tenant_id=p_tenant for update;
 if delivery.notice_id is null or delivery.request_key is distinct from p_key then raise exception 'Envio não autorizado' using errcode='42501';end if;
 if delivery.state<>'pending' then return jsonb_build_object('id',p_id,'send',false);end if;
 if record.deleted_at is not null or record.revision<>p_revision or record.dados->>'status'<>'published'
  or (nullif(record.dados->>'expires','') is not null and (record.dados->>'expires')::date<(now() at time zone 'America/Sao_Paulo')::date)
  or not exists(select 1 from public.filhos_de_santo f where f.id=p_recipient and (f.tenant_id=p_tenant or f.lider_id=p_tenant)
   and lower(btrim(coalesce(f.status::text,''))) in ('ativo','active')
   and (record.dados->>'audience'='all' or record.dados->'memberIds' ? f.id::text)) then
  update public.piloto_comunicados_envios set state='skipped',error='Publicação ou destinatário indisponível',updated_at=clock_timestamp()
   where notice_id=p_id and revision=p_revision and recipient=p_recipient;
  return jsonb_build_object('id',p_id,'send',false);
 end if;
 update public.piloto_comunicados_envios set state='sending',updated_at=clock_timestamp() where notice_id=p_id and revision=p_revision and recipient=p_recipient;
 return jsonb_build_object('id',p_id,'send',true,'attempt',delivery.attempt,'payload',jsonb_build_object('tipo','mural_aviso','filhoId',p_recipient,
  'variables',jsonb_build_object('titulo_aviso',record.dados->>'title','conteudo_aviso',record.dados->>'body',
   'comunicado','*'||(record.dados->>'title')||E'*\n\n'||(record.dados->>'body'))));
end $$;

create or replace function public.piloto_comunicados_finalizar_envio(p_tenant uuid,p_id uuid,p_revision bigint,p_recipient uuid,p_attempt uuid,p_state text,p_external text,p_error text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare delivery public.piloto_comunicados_envios;
begin
 perform public.piloto_comunicados_autorizar(p_tenant,true);
 if p_state is null or p_state not in ('confirmed','uncertain','failed') or length(coalesce(p_external,''))>500 or length(coalesce(p_error,''))>1000
  or (p_state='confirmed' and nullif(btrim(p_external),'') is null) then raise exception 'Resposta do envio inválida' using errcode='22023';end if;
 select * into delivery from public.piloto_comunicados_envios where notice_id=p_id and revision=p_revision and recipient=p_recipient and tenant_id=p_tenant for update;
 if not found or delivery.attempt is distinct from p_attempt then raise exception 'Tentativa não autorizada' using errcode='42501';end if;
 if delivery.state='sending' then update public.piloto_comunicados_envios set state=p_state,external_id=p_external,error=p_error,updated_at=clock_timestamp()
  where notice_id=p_id and revision=p_revision and recipient=p_recipient returning * into delivery;end if;
 return jsonb_build_object('id',p_id,'state',delivery.state);
end $$;

-- Import public history once. Original legacy rows remain untouched and never
-- receive private content. Worker adapters must intercept the pilot legacy reads.
insert into public.piloto_comunicados(id,tenant_id,dados,published_at,updated_at,legacy_origin)
select m.id,m.tenant_id,jsonb_build_object('title',coalesce(m.titulo,''),'body',coalesce(m.conteudo,''),'audience','all','memberIds','[]'::jsonb,
 'giraId','','status','published','category',case when m.categoria in ('Geral','Urgente','Festas','Doutrina') then m.categoria else 'Geral' end,
 'expires',coalesce(left(m.expiracao::text,10),'')),coalesce(m.data_publicacao,now()),coalesce(m.data_publicacao,now()),true
from public.mural_avisos m where m.tenant_id='fad75b91-d2eb-4805-b5a3-c19e8a073bed'::uuid on conflict(id) do nothing;

do $$ declare fn record;begin
 for fn in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname like 'piloto_comunicados_%' and p.proname<>'piloto_comunicados_json' loop
  execute format('revoke all on function %s from public,anon',fn.signature);
  execute format('grant execute on function %s to authenticated',fn.signature);
 end loop;
end $$;
notify pgrst,'reload schema';
commit;
