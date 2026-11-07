begin;
create table if not exists public.piloto_capas_galeria(
 album_id uuid primary key references public.gallery_albums(id) on delete cascade,
 tenant_id uuid not null,media_id uuid references public.gallery_media(id) on delete set null,updated_at timestamptz not null default now()
);
create table if not exists public.piloto_gira_preparacao(
 event_id uuid primary key references public.calendario_axe(id) on delete cascade,
 tenant_id uuid not null,encerrada boolean not null default false,destaque boolean not null default false,tarefas text[] not null default '{}',
 aviso_rascunho text not null default '' check(length(aviso_rascunho)<=2000),aviso_salvo boolean not null default false,updated_at timestamptz not null default now()
);
create table if not exists public.piloto_entregas_pedidos(
 pedido_id uuid primary key references public.pedidos(id) on delete cascade,
 tenant_id uuid not null,entregue boolean not null default false,updated_at timestamptz not null default now()
);
create table if not exists public.piloto_chat_preferencias(
 conversa_id uuid primary key references public.chat_conversations(id) on delete cascade,
 tenant_id uuid not null,arquivada boolean not null default false,nao_lida boolean not null default false,updated_at timestamptz not null default now()
);
do $$ declare tab text;begin
 foreach tab in array array['piloto_capas_galeria','piloto_gira_preparacao','piloto_entregas_pedidos','piloto_chat_preferencias'] loop
  execute format('alter table public.%I enable row level security',tab);
  execute format('revoke all on public.%I from public,anon,authenticated',tab);
  execute format('grant select on public.%I to authenticated',tab);
  execute format('drop policy if exists pilot_owner_read on public.%I',tab);
  execute format('create policy pilot_owner_read on public.%I for select to authenticated using(tenant_id=auth.uid() and auth.uid()=''fad75b91-d2eb-4805-b5a3-c19e8a073bed''::uuid)',tab);
 end loop;
end $$;
drop policy if exists pilot_member_cover_read on public.piloto_capas_galeria;
create policy pilot_member_cover_read on public.piloto_capas_galeria for select to authenticated using(exists(
 select 1 from public.filhos_de_santo f where f.tenant_id=piloto_capas_galeria.tenant_id and f.user_id=auth.uid() and lower(coalesce(f.status::text,'')) in ('ativo','active')));
create or replace function public.piloto_pode_ler_entrega(p_pedido uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.pedidos p where p.id=p_pedido and (p.tenant_id=auth.uid() or exists(
  select 1 from public.filhos_de_santo f join auth.users u on u.id=auth.uid() where f.id=p.filho_id and f.tenant_id=p.tenant_id
   and lower(coalesce(f.status::text,'')) in ('ativo','active') and (f.user_id=u.id or lower(f.email)=lower(u.email) or lower(u.email)='f_'||f.id::text||'@axecloud.internal'))));
$$;
revoke all on function public.piloto_pode_ler_entrega(uuid) from public,anon;
grant execute on function public.piloto_pode_ler_entrega(uuid) to authenticated;
drop policy if exists pilot_member_delivery_read on public.piloto_entregas_pedidos;
create policy pilot_member_delivery_read on public.piloto_entregas_pedidos for select to authenticated using(public.piloto_pode_ler_entrega(pedido_id));

create or replace function public.piloto_definir_capa(p_tenant uuid,p_album uuid,p_media uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid;
begin
 actor:=public.piloto_validar_zelador(p_tenant);
 perform 1 from public.gallery_albums where id=p_album and tenant_id=p_tenant for update;
 if not found then raise exception 'Álbum não pertence a esta casa' using errcode='42501';end if;
 if p_media is not null and not exists(select 1 from public.gallery_media where id=p_media and tenant_id=p_tenant and album_id=p_album and media_type='image') then
  raise exception 'A capa precisa ser um registro deste álbum' using errcode='22023';end if;
 insert into public.piloto_capas_galeria(album_id,tenant_id,media_id) values(p_album,p_tenant,p_media)
 on conflict(album_id) do update set media_id=excluded.media_id,updated_at=now();
 return jsonb_build_object('album_id',p_album,'media_id',p_media);
end $$;

create or replace function public.piloto_preparar_gira(p_tenant uuid,p_event uuid,p_dados jsonb,p_antes jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid;old public.piloto_gira_preparacao;current_state jsonb;canonical jsonb;tasks text[];
begin
 actor:=public.piloto_validar_zelador(p_tenant);
 perform 1 from public.calendario_axe where id=p_event and tenant_id=p_tenant and tipo<>'Obrigação' for update;
 if not found then raise exception 'Gira não pertence a esta casa' using errcode='42501';end if;
 if jsonb_typeof(p_dados) is distinct from 'object' or jsonb_typeof(p_dados->'tasks') is distinct from 'array'
  or jsonb_typeof(p_dados->'highlight') is distinct from 'boolean' or jsonb_typeof(p_dados->'noticeSaved') is distinct from 'boolean'
  or jsonb_typeof(p_dados->'noticeDraft') is distinct from 'string' or length(p_dados->>'noticeDraft')>2000 then
  raise exception 'Confira os dados da preparação da gira' using errcode='22023';end if;
 select coalesce(array_agg(value),array[]::text[]) into tasks from jsonb_array_elements_text(p_dados->'tasks');
 if not tasks<@array['materiais','presenca','memoria']::text[] or cardinality(tasks)<> (select count(distinct value) from unnest(tasks) value) then
  raise exception 'Etapas de preparação inválidas' using errcode='22023';end if;
 canonical:=jsonb_build_object('highlight',(p_dados->>'highlight')::boolean,'tasks',to_jsonb(tasks),'noticeDraft',p_dados->>'noticeDraft','noticeSaved',(p_dados->>'noticeSaved')::boolean);
 select * into old from public.piloto_gira_preparacao where event_id=p_event;
 current_state:=jsonb_build_object('highlight',coalesce(old.destaque,false),'tasks',to_jsonb(coalesce(old.tarefas,array[]::text[])),'noticeDraft',coalesce(old.aviso_rascunho,''),'noticeSaved',coalesce(old.aviso_salvo,false));
 if current_state=canonical then return jsonb_build_object('event_id',p_event,'replayed',true);end if;
 if current_state is distinct from p_antes then raise exception 'A preparação mudou em outro aparelho. Atualize antes de salvar.' using errcode='23505';end if;
 insert into public.piloto_gira_preparacao(event_id,tenant_id,destaque,tarefas,aviso_rascunho,aviso_salvo)
 values(p_event,p_tenant,(canonical->>'highlight')::boolean,tasks,canonical->>'noticeDraft',(canonical->>'noticeSaved')::boolean)
 on conflict(event_id) do update set destaque=excluded.destaque,tarefas=excluded.tarefas,aviso_rascunho=excluded.aviso_rascunho,aviso_salvo=excluded.aviso_salvo,updated_at=now();
 return jsonb_build_object('event_id',p_event,'replayed',false);
end $$;

create or replace function public.piloto_arquivar_produto(p_tenant uuid,p_produto uuid,p_arquivado boolean,p_antes boolean)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid;previous timestamptz;
begin
 actor:=public.piloto_validar_zelador(p_tenant);
 if p_arquivado is null or p_antes is null then raise exception 'Informe a situação do produto' using errcode='22023';end if;
 select deleted_at into previous from public.produtos where id=p_produto and tenant_id=p_tenant for update;
 if not found then raise exception 'Produto não pertence a esta casa' using errcode='42501';end if;
 if (previous is not null)=p_arquivado then return jsonb_build_object('id',p_produto,'archived',p_arquivado,'replayed',true);end if;
 if (previous is not null)<>p_antes then raise exception 'O produto mudou. Atualize antes de arquivar.' using errcode='23505';end if;
 update public.produtos set deleted_at=case when p_arquivado then now() else null end where id=p_produto;
 return jsonb_build_object('id',p_produto,'archived',p_arquivado);
end $$;

create or replace function public.piloto_marcar_entrega(p_tenant uuid,p_pedido uuid,p_entregue boolean,p_antes boolean)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid;order_status text;old boolean;
begin
 actor:=public.piloto_validar_zelador(p_tenant);
 if p_entregue is null or p_antes is null then raise exception 'Informe a situação da entrega' using errcode='22023';end if;
 select status into order_status from public.pedidos where id=p_pedido and tenant_id=p_tenant for update;
 if not found then raise exception 'Pedido não pertence a esta casa' using errcode='42501';end if;
 if order_status='cancelado' and p_entregue then raise exception 'Um pedido cancelado não pode ser entregue' using errcode='22023';end if;
 select entregue into old from public.piloto_entregas_pedidos where pedido_id=p_pedido;old:=coalesce(old,false);
 if old=p_entregue then return jsonb_build_object('id',p_pedido,'delivered',p_entregue,'replayed',true);end if;
 if old<>p_antes then raise exception 'A entrega mudou em outro aparelho. Atualize o pedido.' using errcode='23505';end if;
 insert into public.piloto_entregas_pedidos(pedido_id,tenant_id,entregue) values(p_pedido,p_tenant,p_entregue)
 on conflict(pedido_id) do update set entregue=excluded.entregue,updated_at=now();
 return jsonb_build_object('id',p_pedido,'delivered',p_entregue);
end $$;
create or replace function public.piloto_cancelar_entrega_com_pedido()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if new.tenant_id='fad75b91-d2eb-4805-b5a3-c19e8a073bed'::uuid and new.status='cancelado' then
  update public.piloto_entregas_pedidos set entregue=false,updated_at=now() where pedido_id=new.id;
 end if;return new;
end $$;
drop trigger if exists piloto_pedido_entrega_cancelada on public.pedidos;
create trigger piloto_pedido_entrega_cancelada after update of status on public.pedidos for each row execute function public.piloto_cancelar_entrega_com_pedido();

create or replace function public.piloto_arquivar_conversa(p_tenant uuid,p_conversa uuid,p_arquivada boolean)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid;
begin
 actor:=public.piloto_validar_zelador(p_tenant);
 if p_arquivada is null then raise exception 'Informe a situação da conversa' using errcode='22023';end if;
 if not exists(select 1 from public.chat_participants where conversation_id=p_conversa and tenant_id=p_tenant and user_id=actor) then
  raise exception 'Você não participa desta conversa' using errcode='42501';end if;
 insert into public.piloto_chat_preferencias(conversa_id,tenant_id,arquivada) values(p_conversa,p_tenant,p_arquivada)
 on conflict(conversa_id) do update set arquivada=excluded.arquivada,updated_at=now();
 return jsonb_build_object('id',p_conversa,'archived',p_arquivada);
end $$;

revoke all on function public.piloto_definir_capa(uuid,uuid,uuid),public.piloto_preparar_gira(uuid,uuid,jsonb,jsonb),public.piloto_arquivar_produto(uuid,uuid,boolean,boolean),public.piloto_marcar_entrega(uuid,uuid,boolean,boolean),public.piloto_arquivar_conversa(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.piloto_definir_capa(uuid,uuid,uuid),public.piloto_preparar_gira(uuid,uuid,jsonb,jsonb),public.piloto_arquivar_produto(uuid,uuid,boolean,boolean),public.piloto_marcar_entrega(uuid,uuid,boolean,boolean),public.piloto_arquivar_conversa(uuid,uuid,boolean) to authenticated;
-- The owner already reads these files through the product API. Permit the same
-- owner to sign its archived products' images; no other account gains access.
drop policy if exists pilot_owner_store_images on storage.objects;
create policy pilot_owner_store_images on storage.objects for select to authenticated using(bucket_id='loja_imagens' and auth.uid()='fad75b91-d2eb-4805-b5a3-c19e8a073bed'::uuid and name like auth.uid()::text||'/%');

create or replace function public.piloto_emitir_senha(p_tenant uuid,p_event uuid,p_id uuid,p_nome text,p_telefone text default '')
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid;e public.calendario_axe;ticket public.evento_senhas;next_number int;used int;cap int;
begin
 actor:=public.piloto_validar_zelador(p_tenant);
 if p_id is null or length(btrim(coalesce(p_nome,''))) not between 2 and 120 or length(coalesce(p_telefone,''))>30 then raise exception 'Informe o nome do consulente' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
 select * into e from public.calendario_axe where id=p_event and tenant_id=p_tenant and tipo<>'Obrigação' for update;
 if not found then raise exception 'Gira não pertence a esta casa' using errcode='42501';end if;
 select * into ticket from public.evento_senhas where id=p_id;
 if found then
  if ticket.tenant_id<>p_tenant or ticket.event_id<>p_event or ticket.nome<>btrim(p_nome) or coalesce(ticket.telefone,'')<>coalesce(p_telefone,'') then raise exception 'Esta solicitação já foi usada para outra senha' using errcode='23505';end if;
  return to_jsonb(ticket)||'{"replayed":true}'::jsonb;
 end if;
 if lower(coalesce(e.status_confirmacao,''))='cancelado' or exists(select 1 from public.piloto_gira_preparacao where event_id=p_event and encerrada) then raise exception 'A gira já foi encerrada' using errcode='22023';end if;
 select coalesce(max(numero),0)+1,count(*) filter(where status<>'cancelado') into next_number,used from public.evento_senhas where event_id=p_event;
 cap:=coalesce(nullif(e.senhas_maximas,0),nullif(e.vagas_maximas,0),0);
 if cap>0 and used>=cap then raise exception 'O limite de senhas deste encontro foi atingido' using errcode='22023';end if;
 insert into public.evento_senhas(id,event_id,tenant_id,numero,nome,telefone,status)
 values(p_id,p_event,p_tenant,next_number,btrim(p_nome),nullif(p_telefone,''),'aguardando') returning * into ticket;
 return to_jsonb(ticket)||'{"replayed":false}'::jsonb;
end $$;

create or replace function public.piloto_criar_grupo(p_tenant uuid,p_id uuid,p_titulo text,p_filhos uuid[])
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid;members uuid[];existing uuid[];c public.chat_conversations;
begin
 actor:=public.piloto_validar_zelador(p_tenant);
 if p_id is null or length(btrim(coalesce(p_titulo,''))) not between 3 and 100 or coalesce(cardinality(p_filhos),0)=0 or cardinality(p_filhos)>500 then raise exception 'Informe o título e os participantes do grupo' using errcode='22023';end if;
 select array_agg(distinct v order by v) into members from unnest(p_filhos) v;
 if cardinality(members)<>cardinality(p_filhos) or exists(select 1 from unnest(members) v where v is null) then raise exception 'Participantes duplicados ou inválidos' using errcode='22023';end if;
 perform 1 from public.filhos_de_santo where tenant_id=p_tenant and id=any(members) order by id for share;
 if exists(select 1 from unnest(members) v where not exists(select 1 from public.filhos_de_santo f where f.id=v and f.tenant_id=p_tenant and f.user_id is not null and lower(coalesce(f.status::text,'')) in ('ativo','active'))) then raise exception 'Escolha somente membros ativos com acesso desta casa' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
 select * into c from public.chat_conversations where id=p_id;
 if found then
  select array_agg(filho_id order by filho_id) into existing from public.chat_participants where conversation_id=p_id and participant_type='filho';
  if c.tenant_id<>p_tenant or c.created_by<>actor or c.type<>'group' or c.title<>btrim(p_titulo) or existing is distinct from members then raise exception 'Esta solicitação já foi usada para outra conversa' using errcode='23505';end if;
  return jsonb_build_object('conversationId',p_id,'replayed',true);
 end if;
 insert into public.chat_conversations(id,tenant_id,type,title,created_by) values(p_id,p_tenant,'group',btrim(p_titulo),actor);
 insert into public.chat_participants(conversation_id,tenant_id,participant_type,user_id) values(p_id,p_tenant,'admin',actor);
 insert into public.chat_participants(conversation_id,tenant_id,participant_type,filho_id,user_id)
 select p_id,p_tenant,'filho',f.id,f.user_id from public.filhos_de_santo f where f.id=any(members) and f.tenant_id=p_tenant;
 return jsonb_build_object('conversationId',p_id,'replayed',false);
end $$;

create or replace function public.piloto_salvar_chamada(p_tenant uuid,p_event uuid,p_chamada jsonb,p_antes jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid;e public.calendario_axe;current_state jsonb;marks jsonb;v record;
begin
 actor:=public.piloto_validar_zelador(p_tenant);
 select * into e from public.calendario_axe where id=p_event and tenant_id=p_tenant and tipo<>'Obrigação' for update;
 if not found then raise exception 'Gira não pertence a esta casa' using errcode='42501';end if;
 if jsonb_typeof(p_chamada->'marks') is distinct from 'object' or jsonb_typeof(p_chamada->'closed') is distinct from 'boolean' then raise exception 'Chamada inválida' using errcode='22023';end if;
 for v in select key,value from jsonb_each_text(p_chamada->'marks') loop
  if v.value not in ('present','absent','excused') or not exists(select 1 from public.filhos_de_santo where id::text=v.key and tenant_id=p_tenant) then raise exception 'Pessoa ou presença inválida' using errcode='22023';end if;
 end loop;
 select coalesce(jsonb_object_agg(filho_id::text,case when status='presente' then 'present' when justificativa='Ausência justificada pela zeladoria' then 'excused' else 'absent' end),'{}'::jsonb) into marks
 from public.evento_participantes where event_id=p_event and tenant_id=p_tenant and status in ('presente','recusado');
 current_state:=jsonb_build_object('marks',marks,'closed',coalesce((select encerrada from public.piloto_gira_preparacao where event_id=p_event),false));
 if current_state=p_chamada then return jsonb_build_object('event_id',p_event,'replayed',true);end if;
 if current_state is distinct from p_antes then raise exception 'A chamada mudou em outro aparelho. Atualize antes de salvar.' using errcode='23505';end if;
 update public.evento_participantes set status='pendente',justificativa=null where event_id=p_event and tenant_id=p_tenant and status in ('presente','recusado') and not (p_chamada->'marks' ? filho_id::text);
 for v in select key,value from jsonb_each_text(p_chamada->'marks') loop
  insert into public.evento_participantes(event_id,tenant_id,filho_id,status,justificativa)
  values(p_event,p_tenant,v.key::uuid,case when v.value='present' then 'presente' else 'recusado' end,case when v.value='excused' then 'Ausência justificada pela zeladoria' else null end)
  on conflict(event_id,filho_id) do update set status=excluded.status,justificativa=excluded.justificativa;
 end loop;
 if (p_chamada->>'closed')::boolean then update public.calendario_axe set wa_reminder_interval_days=null,senhas_ativas=false where id=p_event;end if;
 insert into public.piloto_gira_preparacao(event_id,tenant_id,encerrada) values(p_event,p_tenant,(p_chamada->>'closed')::boolean) on conflict(event_id) do update set encerrada=excluded.encerrada,updated_at=now();
 return jsonb_build_object('event_id',p_event,'replayed',false);
end $$;
revoke all on function public.piloto_emitir_senha(uuid,uuid,uuid,text,text),public.piloto_criar_grupo(uuid,uuid,text,uuid[]),public.piloto_salvar_chamada(uuid,uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.piloto_emitir_senha(uuid,uuid,uuid,text,text),public.piloto_criar_grupo(uuid,uuid,text,uuid[]),public.piloto_salvar_chamada(uuid,uuid,jsonb,jsonb) to authenticated;

create or replace function public.piloto_marcar_conversa(p_tenant uuid,p_conversa uuid,p_nao_lida boolean)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid;
begin
 actor:=public.piloto_validar_zelador(p_tenant);
 if p_nao_lida is null then raise exception 'Informe a situação de leitura' using errcode='22023';end if;
 if not exists(select 1 from public.chat_participants where conversation_id=p_conversa and tenant_id=p_tenant and user_id=actor) then raise exception 'Você não participa desta conversa' using errcode='42501';end if;
 insert into public.piloto_chat_preferencias(conversa_id,tenant_id,nao_lida) values(p_conversa,p_tenant,p_nao_lida)
 on conflict(conversa_id) do update set nao_lida=excluded.nao_lida,updated_at=now();
 return jsonb_build_object('id',p_conversa,'unread',p_nao_lida);
end $$;
revoke all on function public.piloto_marcar_conversa(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.piloto_marcar_conversa(uuid,uuid,boolean) to authenticated;

create or replace function public.piloto_mensagens(p_tenant uuid,p_conversa uuid,p_antes_data timestamptz default null,p_antes_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare actor uuid;rows jsonb;
begin
 actor:=public.piloto_validar_zelador(p_tenant);
 if (p_antes_data is null)<>(p_antes_id is null) then raise exception 'Cursor de mensagens incompleto' using errcode='22023';end if;
 if not exists(select 1 from public.chat_participants where conversation_id=p_conversa and tenant_id=p_tenant and user_id=actor) then raise exception 'Você não participa desta conversa' using errcode='42501';end if;
 select coalesce(jsonb_agg(to_jsonb(q) order by q.created_at desc,q.id desc),'[]'::jsonb) into rows from(
  select m.id,m.sender_user_id,m.sender_filho_id,m.body,m.message_type,m.media_url,m.media_path,m.media_mime,m.media_duration_sec,m.created_at
  from public.chat_messages m where m.conversation_id=p_conversa and m.tenant_id=p_tenant and m.deleted_at is null
   and (p_antes_data is null or (m.created_at,m.id)<(p_antes_data,p_antes_id)) order by m.created_at desc,m.id desc limit 101
 )q;
 return jsonb_build_object('messages',rows,'hasMore',jsonb_array_length(rows)>100);
end $$;
revoke all on function public.piloto_mensagens(uuid,uuid,timestamptz,uuid) from public,anon,authenticated;
grant execute on function public.piloto_mensagens(uuid,uuid,timestamptz,uuid) to authenticated;

create or replace function public.piloto_situacao_gira(p_tenant uuid,p_event uuid,p_encerrada boolean,p_antes boolean)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid;old boolean;
begin
 actor:=public.piloto_validar_zelador(p_tenant);
 if p_encerrada is null or p_antes is null then raise exception 'Situação inválida' using errcode='22023';end if;
 perform 1 from public.calendario_axe where id=p_event and tenant_id=p_tenant and tipo<>'Obrigação' for update;
 if not found then raise exception 'Gira não pertence a esta casa' using errcode='42501';end if;
 select encerrada into old from public.piloto_gira_preparacao where event_id=p_event;old:=coalesce(old,false);
 if old=p_encerrada then return jsonb_build_object('event_id',p_event,'replayed',true);end if;
 if old<>p_antes then raise exception 'A situação mudou. Atualize a agenda.' using errcode='23505';end if;
 if p_encerrada then update public.calendario_axe set wa_reminder_interval_days=null,senhas_ativas=false where id=p_event;end if;
 insert into public.piloto_gira_preparacao(event_id,tenant_id,encerrada) values(p_event,p_tenant,p_encerrada) on conflict(event_id) do update set encerrada=excluded.encerrada,updated_at=now();
 return jsonb_build_object('event_id',p_event,'replayed',false);
end $$;
revoke all on function public.piloto_situacao_gira(uuid,uuid,boolean,boolean) from public,anon,authenticated;
grant execute on function public.piloto_situacao_gira(uuid,uuid,boolean,boolean) to authenticated;
notify pgrst,'reload schema';
commit;
