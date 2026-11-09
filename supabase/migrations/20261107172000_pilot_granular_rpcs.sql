begin;
create or replace function public.piloto_validar_modulo(p_tenant uuid,p_modulo text,p_acao text default 'gerenciar')
returns uuid language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if public.piloto_zelador_ativo(p_tenant)
  or public.piloto_tem_permissao(p_tenant,auth.uid(),p_modulo,p_acao)
 then return auth.uid();end if;
 raise exception 'Permissão insuficiente para %',p_modulo using errcode='42501';
end;
$$;
revoke all on function public.piloto_validar_modulo(uuid,text,text) from public,anon;
grant execute on function public.piloto_validar_modulo(uuid,text,text) to authenticated,service_role;

-- piloto_agendar_lembrete_gira: giras (gerenciar)
CREATE OR REPLACE FUNCTION public.piloto_agendar_lembrete_gira(p_tenant uuid, p_event uuid, p_ativo boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare actor uuid;prefs jsonb;days int;on_day boolean;
begin
 actor:=public.piloto_validar_modulo(p_tenant,'giras','gerenciar');
 if p_ativo is null then raise exception 'Informe se o lembrete está ativo' using errcode='22023';end if;
 perform 1 from public.calendario_axe where id=p_event and tenant_id=p_tenant and tipo<>'Obrigação' for update;
 if not found then raise exception 'Gira não pertence a esta casa' using errcode='42501';end if;
 if p_ativo and exists(select 1 from public.piloto_gira_preparacao where event_id=p_event and encerrada) then raise exception 'Gira encerrada não recebe novos lembretes' using errcode='22023';end if;
 if not p_ativo then update public.calendario_axe set wa_reminder_interval_days=null where id=p_event;return jsonb_build_object('event_id',p_event,'active',false);end if;
 select public.piloto_ler_preferencias_whatsapp(metadata) into prefs from public.whatsapp_config where tenant_id=p_tenant;
 prefs:=coalesce(prefs,public.piloto_ler_preferencias_whatsapp('{}'));days:=(prefs->>'days')::int;on_day:=(prefs->>'sameDay')::boolean;
 update public.calendario_axe set wa_reminder_interval_days=days,wa_reminder_mode=case when on_day then 'quantidade' else 'antes' end,
 wa_reminder_count=case when on_day then 2 else null end,wa_reminder_window_kind='relativa',wa_reminder_window_start_days=days,wa_reminder_window_end_days=case when on_day then 0 else days end,
 wa_reminder_window_start_date=null,wa_reminder_window_end_date=null where id=p_event;
 return jsonb_build_object('event_id',p_event,'active',true,'days',days,'sameDay',on_day);
end $function$;

-- piloto_atualizar_senha: giras (gerenciar)
CREATE OR REPLACE FUNCTION public.piloto_atualizar_senha(p_tenant uuid, p_event uuid, p_senha uuid, p_status text, p_antes text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare actor uuid;t public.evento_senhas;
begin
 actor:=public.piloto_validar_modulo(p_tenant,'giras','gerenciar');
 if p_status not in ('chamado','atendido') or p_antes not in ('aguardando','presente','chamado') or p_status is null or p_antes is null then raise exception 'Situação de atendimento inválida' using errcode='22023';end if;
 perform 1 from public.calendario_axe where id=p_event and tenant_id=p_tenant for share;
 if not found then raise exception 'Gira não pertence a esta casa' using errcode='42501';end if;
 select * into t from public.evento_senhas where id=p_senha and event_id=p_event and tenant_id=p_tenant for update;
 if not found then raise exception 'Senha não pertence a esta gira' using errcode='42501';end if;
 if t.status=p_status then return jsonb_build_object('id',t.id,'status',t.status,'replayed',true);end if;
 if t.status<>p_antes then raise exception 'O atendimento foi atualizado em outro aparelho. Recarregue a fila.' using errcode='23505';end if;
 if (p_status='chamado' and t.status not in ('aguardando','presente')) or (p_status='atendido' and t.status<>'chamado') then raise exception 'Conclua as etapas do atendimento na ordem' using errcode='22023';end if;
 update public.evento_senhas set status=p_status,called_at=case when p_status='chamado' then now() else called_at end,attended_at=case when p_status='atendido' then now() else attended_at end where id=p_senha returning * into t;
 return jsonb_build_object('id',t.id,'status',t.status,'replayed',false);
end $function$;

-- piloto_emitir_senha: giras (gerenciar)
CREATE OR REPLACE FUNCTION public.piloto_emitir_senha(p_tenant uuid, p_event uuid, p_id uuid, p_nome text, p_telefone text DEFAULT ''::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare actor uuid;e public.calendario_axe;ticket public.evento_senhas;next_number int;used int;cap int;
begin
 actor:=public.piloto_validar_modulo(p_tenant,'giras','gerenciar');
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
end $function$;

-- piloto_preparar_gira: giras (gerenciar)
CREATE OR REPLACE FUNCTION public.piloto_preparar_gira(p_tenant uuid, p_event uuid, p_dados jsonb, p_antes jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare actor uuid;old public.piloto_gira_preparacao;current_state jsonb;canonical jsonb;tasks text[];
begin
 actor:=public.piloto_validar_modulo(p_tenant,'giras','gerenciar');
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
end $function$;

-- piloto_salvar_chamada: giras (gerenciar)
CREATE OR REPLACE FUNCTION public.piloto_salvar_chamada(p_tenant uuid, p_event uuid, p_chamada jsonb, p_antes jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare actor uuid;e public.calendario_axe;current_state jsonb;marks jsonb;v record;
begin
 actor:=public.piloto_validar_modulo(p_tenant,'giras','gerenciar');
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
end $function$;

-- piloto_situacao_gira: giras (gerenciar)
CREATE OR REPLACE FUNCTION public.piloto_situacao_gira(p_tenant uuid, p_event uuid, p_encerrada boolean, p_antes boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare actor uuid;old boolean;
begin
 actor:=public.piloto_validar_modulo(p_tenant,'giras','gerenciar');
 if p_encerrada is null or p_antes is null then raise exception 'Situação inválida' using errcode='22023';end if;
 perform 1 from public.calendario_axe where id=p_event and tenant_id=p_tenant and tipo<>'Obrigação' for update;
 if not found then raise exception 'Gira não pertence a esta casa' using errcode='42501';end if;
 select encerrada into old from public.piloto_gira_preparacao where event_id=p_event;old:=coalesce(old,false);
 if old=p_encerrada then return jsonb_build_object('event_id',p_event,'replayed',true);end if;
 if old<>p_antes then raise exception 'A situação mudou. Atualize a agenda.' using errcode='23505';end if;
 if p_encerrada then update public.calendario_axe set wa_reminder_interval_days=null,senhas_ativas=false where id=p_event;end if;
 insert into public.piloto_gira_preparacao(event_id,tenant_id,encerrada) values(p_event,p_tenant,p_encerrada) on conflict(event_id) do update set encerrada=excluded.encerrada,updated_at=now();
 return jsonb_build_object('event_id',p_event,'replayed',false);
end $function$;

-- piloto_arquivar_conversa: communications (gerenciar)
CREATE OR REPLACE FUNCTION public.piloto_arquivar_conversa(p_tenant uuid, p_conversa uuid, p_arquivada boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare actor uuid;
begin
 actor:=public.piloto_validar_modulo(p_tenant,'communications','gerenciar');
 if p_arquivada is null then raise exception 'Informe a situação da conversa' using errcode='22023';end if;
 if not exists(select 1 from public.chat_participants where conversation_id=p_conversa and tenant_id=p_tenant and user_id=actor) then
  raise exception 'Você não participa desta conversa' using errcode='42501';end if;
 insert into public.piloto_chat_preferencias(conversa_id,tenant_id,arquivada) values(p_conversa,p_tenant,p_arquivada)
 on conflict(conversa_id) do update set arquivada=excluded.arquivada,updated_at=now();
 return jsonb_build_object('id',p_conversa,'archived',p_arquivada);
end $function$;

-- piloto_marcar_conversa: communications (gerenciar)
CREATE OR REPLACE FUNCTION public.piloto_marcar_conversa(p_tenant uuid, p_conversa uuid, p_nao_lida boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare actor uuid;
begin
 actor:=public.piloto_validar_modulo(p_tenant,'communications','gerenciar');
 if p_nao_lida is null then raise exception 'Informe a situação de leitura' using errcode='22023';end if;
 if not exists(select 1 from public.chat_participants where conversation_id=p_conversa and tenant_id=p_tenant and user_id=actor) then raise exception 'Você não participa desta conversa' using errcode='42501';end if;
 insert into public.piloto_chat_preferencias(conversa_id,tenant_id,nao_lida) values(p_conversa,p_tenant,p_nao_lida)
 on conflict(conversa_id) do update set nao_lida=excluded.nao_lida,updated_at=now();
 return jsonb_build_object('id',p_conversa,'unread',p_nao_lida);
end $function$;

-- piloto_mensagens: communications (visualizar)
CREATE OR REPLACE FUNCTION public.piloto_mensagens(p_tenant uuid, p_conversa uuid, p_antes_data timestamp with time zone DEFAULT NULL::timestamp with time zone, p_antes_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare actor uuid;rows jsonb;
begin
 actor:=public.piloto_validar_modulo(p_tenant,'communications','visualizar');
 if (p_antes_data is null)<>(p_antes_id is null) then raise exception 'Cursor de mensagens incompleto' using errcode='22023';end if;
 if not exists(select 1 from public.chat_participants where conversation_id=p_conversa and tenant_id=p_tenant and user_id=actor) then raise exception 'Você não participa desta conversa' using errcode='42501';end if;
 select coalesce(jsonb_agg(to_jsonb(q) order by q.created_at desc,q.id desc),'[]'::jsonb) into rows from(
  select m.id,m.sender_user_id,m.sender_filho_id,m.body,m.message_type,m.media_url,m.media_path,m.media_mime,m.media_duration_sec,m.created_at
  from public.chat_messages m where m.conversation_id=p_conversa and m.tenant_id=p_tenant and m.deleted_at is null
   and (p_antes_data is null or (m.created_at,m.id)<(p_antes_data,p_antes_id)) order by m.created_at desc,m.id desc limit 101
 )q;
 return jsonb_build_object('messages',rows,'hasMore',jsonb_array_length(rows)>100);
end $function$;

-- piloto_comunicados_listar: communications (visualizar)
CREATE OR REPLACE FUNCTION public.piloto_comunicados_listar(p_tenant uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare manager boolean;member_id uuid;rows jsonb;
begin
 perform public.piloto_comunicados_autorizar(p_tenant);
 manager:=(public.piloto_zelador_ativo(p_tenant) or public.piloto_tem_permissao(p_tenant,auth.uid(),'communications','visualizar'));
 if not manager then member_id:=public.piloto_comunicados_membro(p_tenant);end if;
 select coalesce(jsonb_agg(public.piloto_comunicados_json(n,manager)
  order by n.published_at desc nulls last,n.updated_at desc,n.id),'[]'::jsonb)
 into rows from public.piloto_comunicados n where n.tenant_id=p_tenant and n.deleted_at is null and (manager or
  (member_id is not null and n.dados->>'status'='published' and n.published_at is not null
   and (nullif(n.dados->>'expires','') is null or (n.dados->>'expires')::date>=(now() at time zone 'America/Sao_Paulo')::date)
   and (n.dados->>'audience'='all' or n.dados->'memberIds' ? member_id::text)));
 return jsonb_build_object('data',rows);
end $function$;

-- piloto_comunicados_autorizar: communications (gerenciar)
CREATE OR REPLACE FUNCTION public.piloto_comunicados_autorizar(p_tenant uuid, p_manager boolean DEFAULT false)
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
 if public.piloto_zelador_ativo(p_tenant) or public.piloto_tem_permissao(p_tenant,auth.uid(),'communications',case when p_manager then 'gerenciar' else 'visualizar' end) then return auth.uid();end if;
 if not p_manager and public.piloto_comunicados_membro(p_tenant) is not null then return auth.uid();end if;
 raise exception 'Conta não autorizada ou vínculo inativo' using errcode='42501';
end $function$;

-- piloto_comunicados_zelador_ativo: communications (gerenciar)
CREATE OR REPLACE FUNCTION public.piloto_comunicados_zelador_ativo(p_tenant uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
 select (public.piloto_zelador_ativo(p_tenant) or public.piloto_tem_permissao(p_tenant,auth.uid(),'communications','gerenciar'))
$function$;

-- piloto_criar_grupo: communications (gerenciar)
CREATE OR REPLACE FUNCTION public.piloto_criar_grupo(p_tenant uuid, p_id uuid, p_titulo text, p_filhos uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare actor uuid;members uuid[];existing uuid[];c public.chat_conversations;
begin
 actor:=public.piloto_validar_modulo(p_tenant,'communications','gerenciar');
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
end $function$;

-- piloto_arquivar_produto: store (gerenciar)
CREATE OR REPLACE FUNCTION public.piloto_arquivar_produto(p_tenant uuid, p_produto uuid, p_arquivado boolean, p_antes boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare actor uuid;previous timestamptz;
begin
 actor:=public.piloto_validar_modulo(p_tenant,'store','gerenciar');
 if p_arquivado is null or p_antes is null then raise exception 'Informe a situação do produto' using errcode='22023';end if;
 select deleted_at into previous from public.produtos where id=p_produto and tenant_id=p_tenant for update;
 if not found then raise exception 'Produto não pertence a esta casa' using errcode='42501';end if;
 if (previous is not null)=p_arquivado then return jsonb_build_object('id',p_produto,'archived',p_arquivado,'replayed',true);end if;
 if (previous is not null)<>p_antes then raise exception 'O produto mudou. Atualize antes de arquivar.' using errcode='23505';end if;
 update public.produtos set deleted_at=case when p_arquivado then now() else null end where id=p_produto;
 return jsonb_build_object('id',p_produto,'archived',p_arquivado);
end $function$;

-- piloto_marcar_entrega: store (gerenciar)
CREATE OR REPLACE FUNCTION public.piloto_marcar_entrega(p_tenant uuid, p_pedido uuid, p_entregue boolean, p_antes boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare actor uuid;order_status text;old boolean;
begin
 actor:=public.piloto_validar_modulo(p_tenant,'store','gerenciar');
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
end $function$;

-- piloto_criar_mensalidade_quitada: finance (gerenciar)
CREATE OR REPLACE FUNCTION public.piloto_criar_mensalidade_quitada(p_tenant uuid, p_request uuid, p_input jsonb, p_data_pagamento date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare actor uuid; base numeric; interest numeric:=0; total numeric; mode text; extra numeric:=0; suffix text:='';
 description text; due date; child_id uuid; payload jsonb; f public.financeiro;
begin
 actor:=public.piloto_validar_modulo(p_tenant,'finance','gerenciar');
 if p_request is null or p_data_pagamento is null or p_data_pagamento>(now() at time zone 'America/Sao_Paulo')::date then
   raise exception 'Informe a identificação e a data efetiva do pagamento, sem data futura' using errcode='22023';
 end if;
 base:=(p_input->>'valor')::numeric;due:=(p_input->>'data')::date;child_id:=(p_input->>'filho_id')::uuid;
 description:=trim(p_input->>'descricao');mode:=coalesce(p_input->>'jurosTipo','nenhum');
 if base is null or base<=0 or base>999999999 or base*100<>trunc(base*100) or due is null or child_id is null
    or description is null or length(description) not between 1 and 1500 or mode not in ('nenhum','valor','porcentagem') then
   raise exception 'Confira membro, vencimento, valor, descrição e juros da mensalidade' using errcode='22023';
 end if;
 if mode<>'nenhum' then
   interest:=(p_input->>'jurosValor')::numeric;
   if interest is null or interest<0 or interest>999999999 or interest*100<>trunc(interest*100) or (mode='porcentagem' and interest>1000) then
     raise exception 'Juros ou multa inválidos' using errcode='22023';
   end if;
   extra:=round(case when mode='porcentagem' then base*interest/100 else interest end,2);
   suffix:=' (+ '||case when mode='porcentagem' then interest::text||'%: ' else '' end||'R$ '||extra::text||' juros/multa)';
 end if;
 total:=base+extra;
 if total>999999999 then raise exception 'Valor fora do limite' using errcode='22023';end if;
 payload:=jsonb_build_object('tipo','entrada','categoria','Mensalidade','valor',total,'data',due,'data_vencimento',due,
   'filho_id',child_id,'status','pago','data_pagamento',p_data_pagamento,
   'descricao',description||suffix||' (competência '||due::text||') (ID:'||child_id::text||')');
 select * into f from public.registrar_lancamento_manual(actor,p_tenant,p_request,payload);
 if f.data_pagamento is distinct from p_data_pagamento or f.data is distinct from p_data_pagamento then
   update public.financeiro set data=p_data_pagamento,data_pagamento=p_data_pagamento,data_vencimento=due where id=f.id returning * into f;
 end if;
 return jsonb_build_object('id',f.id,'status',f.status,'valor',f.valor,'data_pagamento',f.data_pagamento,'data_vencimento',f.data_vencimento);
end $function$;

-- piloto_liquidar_mensalidade: finance (gerenciar)
CREATE OR REPLACE FUNCTION public.piloto_liquidar_mensalidade(p_tenant uuid, p_financeiro uuid, p_data_pagamento date, p_valor numeric, p_request uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare actor uuid; f public.financeiro; child_id uuid; comp date; prior public.piloto_financeiro_acoes; payload jsonb; result jsonb;
begin
 actor:=public.piloto_validar_modulo(p_tenant,'finance','gerenciar');
 if p_request is null or p_financeiro is null or p_data_pagamento is null
    or p_data_pagamento>(now() at time zone 'America/Sao_Paulo')::date
    or p_valor is null or p_valor<=0 or p_valor>999999999 or p_valor*100<>trunc(p_valor*100) then
   raise exception 'Confira a identificação, a data efetiva e o valor do recebimento' using errcode='22023';
 end if;
 payload:=jsonb_build_object('id',p_financeiro,'date',p_data_pagamento,'valor',p_valor);
 perform pg_advisory_xact_lock(hashtextextended(p_tenant::text||':pilot-finance',0));
 select * into f from public.financeiro where id=p_financeiro for update;
 if not found or not(coalesce(f.tenant_id=p_tenant,false) or coalesce(f.lider_id=actor,false)) then
   raise exception 'Mensalidade não pertence a esta casa' using errcode='42501';
 end if;
 select * into prior from public.piloto_financeiro_acoes where request_id=p_request;
 if found then
   if prior.actor<>actor or prior.tenant_id<>p_tenant or prior.payload is distinct from payload then
     raise exception 'Identificador já utilizado em outra operação' using errcode='23505';
   end if;
   if f.status<>'pago' or f.data_pagamento is distinct from p_data_pagamento or f.valor is distinct from p_valor then
     raise exception 'A mensalidade mudou após esta operação; atualize a lista' using errcode='23505';
   end if;
   return prior.result||jsonb_build_object('replayed',true);
 end if;
 if f.categoria is distinct from 'Mensalidade' or f.valor is distinct from p_valor
    or not(coalesce(f.status,'') in ('pendente','pending','atrasado','overdue') or (f.status is null and f.descricao ilike '%(vencimento%')) then
   raise exception 'Valor ou situação da mensalidade mudou; atualize antes de dar baixa' using errcode='23505';
 end if;
 if exists(select 1 from public.mensalidade_comprovante_envios where financeiro_id=f.id and status='em_analise') then
   raise exception 'Confira o comprovante em análise antes de confirmar o recebimento' using errcode='23505';
 end if;
 child_id:=coalesce(f.filho_id,substring(f.descricao from '(?i)\(ID:([0-9a-f-]{36})\)')::uuid);
 if child_id is null or not exists(select 1 from public.filhos_de_santo where id=child_id and (tenant_id=p_tenant or lider_id=actor)) then
   raise exception 'O vínculo com o membro precisa ser conferido' using errcode='42501';
 end if;
 comp:=coalesce(f.data_vencimento,f.data);
 update public.financeiro set status='pago',tipo='entrada',data=p_data_pagamento,data_pagamento=p_data_pagamento,
   data_vencimento=comp,filho_id=child_id,lancamento_manual=true,
   descricao=case when descricao ~* '\(vencimento [0-9-]+\)' then regexp_replace(descricao,'\(vencimento [0-9-]+\)','(competência '||comp::text||')','i') else descricao end
   where id=f.id returning * into f;
 result:=jsonb_build_object('id',f.id,'status',f.status,'data_pagamento',f.data_pagamento,'valor',f.valor,'replayed',false);
 insert into public.piloto_financeiro_acoes(request_id,actor,tenant_id,financeiro_id,payload,result) values(p_request,actor,p_tenant,f.id,payload,result);
 return result;
end $function$;

-- piloto_reabrir_mensalidade: finance (gerenciar)
CREATE OR REPLACE FUNCTION public.piloto_reabrir_mensalidade(p_tenant uuid, p_financeiro uuid, p_data_pagamento date, p_valor numeric, p_request uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare actor uuid; f public.financeiro; prior public.piloto_financeiro_acoes; payload jsonb; result jsonb; due date; child_id uuid;
begin
 actor:=public.piloto_validar_modulo(p_tenant,'finance','gerenciar');
 if p_request is null or p_financeiro is null or p_data_pagamento is null or p_valor is null
    or p_valor<=0 or p_valor>999999999 or p_valor*100<>trunc(p_valor*100) then
  raise exception 'Confira a identificação e o recebimento antes de desfazer a baixa' using errcode='22023';end if;
 payload:=jsonb_build_object('operation','reopen','id',p_financeiro,'date',p_data_pagamento,'valor',p_valor);
 perform pg_advisory_xact_lock(hashtextextended(p_tenant::text||':pilot-finance',0));
 select * into f from public.financeiro where id=p_financeiro for update;
 if not found or not(coalesce(f.tenant_id=p_tenant,false) or coalesce(f.lider_id=actor,false)) then
  raise exception 'Mensalidade não pertence a esta casa' using errcode='42501';end if;
 select * into prior from public.piloto_financeiro_acoes where request_id=p_request;
 if found then
  if prior.actor<>actor or prior.tenant_id<>p_tenant or prior.payload is distinct from payload then
   raise exception 'Identificador já utilizado em outra operação' using errcode='23505';end if;
  if f.status<>'pendente' or f.data_pagamento is not null or f.valor is distinct from p_valor
     or f.data is distinct from f.data_vencimento or f.data_vencimento is distinct from (prior.result->>'data_vencimento')::date then
   raise exception 'A mensalidade mudou após esta operação; atualize a lista' using errcode='23505';end if;
  return prior.result||jsonb_build_object('replayed',true);
 end if;
 if f.categoria is distinct from 'Mensalidade' or f.tipo is distinct from 'entrada' or f.status is distinct from 'pago'
    or f.valor is distinct from p_valor or coalesce(f.data_pagamento,f.data) is distinct from p_data_pagamento then
  raise exception 'Valor, data ou situação da mensalidade mudou; atualize antes de desfazer a baixa' using errcode='23505';end if;
 -- A receipt/bank confirmation requires its own audited reversal. Never silently
 -- leave an accepted receipt attached to an unpaid charge or undo an automatic Pix.
 if not coalesce(f.lancamento_manual,false)
    or exists(select 1 from public.mensalidade_comprovante_envios where financeiro_id=f.id and status in ('em_analise','aceito'))
    or exists(select 1 from public.financeiro_comprovantes where financeiro_id=f.id and status='aceito') then
  raise exception 'Este recebimento tem confirmação automática ou comprovante. A reversão precisa preservar a conciliação; nenhuma baixa foi desfeita.' using errcode='23505';end if;
 child_id:=coalesce(f.filho_id,substring(f.descricao from '(?i)\(ID:([0-9a-f-]{36})\)')::uuid);
 if child_id is null or not exists(select 1 from public.filhos_de_santo where id=child_id and (tenant_id=p_tenant or lider_id=actor)) then
  raise exception 'O vínculo com o membro precisa ser conferido' using errcode='42501';end if;
 due:=f.data_vencimento;
 if due is null then raise exception 'Confira o vencimento original antes de reabrir esta mensalidade' using errcode='23505';end if;
 result:=jsonb_build_object('id',f.id,'status','pendente','data_pagamento',null,'data_vencimento',due,'valor',f.valor,'replayed',false,
   'previous_payment_date',f.data_pagamento,'previous_cash_date',f.data,'previous_description',f.descricao);
 update public.financeiro set status='pendente',data=due,data_pagamento=null where id=f.id;
 insert into public.piloto_financeiro_acoes(request_id,actor,tenant_id,financeiro_id,payload,result) values(p_request,actor,p_tenant,f.id,payload,result);
 return result;
end $function$;

-- piloto_definir_capa: gallery (gerenciar)
CREATE OR REPLACE FUNCTION public.piloto_definir_capa(p_tenant uuid, p_album uuid, p_media uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare actor uuid;
begin
 actor:=public.piloto_validar_modulo(p_tenant,'gallery','gerenciar');
 perform 1 from public.gallery_albums where id=p_album and tenant_id=p_tenant for update;
 if not found then raise exception 'Álbum não pertence a esta casa' using errcode='42501';end if;
 if p_media is not null and not exists(select 1 from public.gallery_media where id=p_media and tenant_id=p_tenant and album_id=p_album and media_type='image') then
  raise exception 'A capa precisa ser um registro deste álbum' using errcode='22023';end if;
 insert into public.piloto_capas_galeria(album_id,tenant_id,media_id) values(p_album,p_tenant,p_media)
 on conflict(album_id) do update set media_id=excluded.media_id,updated_at=now();
 return jsonb_build_object('album_id',p_album,'media_id',p_media);
end $function$;

-- piloto_finalizar_aviso_cantina: cantina (gerenciar)
CREATE OR REPLACE FUNCTION public.piloto_finalizar_aviso_cantina(p_tenant uuid, p_financeiro uuid, p_request uuid, p_external text, p_error text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare actor uuid;job public.piloto_avisos_cantina;
begin
 actor:=public.piloto_validar_modulo(p_tenant,'cantina','gerenciar');
 select * into job from public.piloto_avisos_cantina where financeiro_id=p_financeiro and tenant_id=p_tenant and request_id=p_request for update;
 if not found then raise exception 'Aviso não pertence a esta solicitação' using errcode='42501';end if;
 if length(coalesce(p_external,''))>300 or length(coalesce(p_error,''))>1000 then raise exception 'Resposta de envio inválida' using errcode='22023';end if;
 update public.piloto_avisos_cantina set estado=case when nullif(p_external,'') is not null and nullif(p_error,'') is null then 'solicitado' else 'incerto' end,external_id=nullif(p_external,''),error=nullif(p_error,''),updated_at=now() where financeiro_id=p_financeiro returning * into job;
 return jsonb_build_object('financeiro_id',job.financeiro_id,'state',job.estado);
end $function$;

-- piloto_iniciar_aviso_cantina: cantina (gerenciar)
CREATE OR REPLACE FUNCTION public.piloto_iniciar_aviso_cantina(p_tenant uuid, p_financeiro uuid, p_request uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare actor uuid;f public.financeiro;job public.piloto_avisos_cantina;pref jsonb;
begin
 actor:=public.piloto_validar_modulo(p_tenant,'cantina','gerenciar');
 if p_request is null then raise exception 'Identificação do aviso obrigatória' using errcode='22023';end if;
 select * into f from public.financeiro where id=p_financeiro and tenant_id=p_tenant for update;
 if not found or f.categoria<>'Cantina' or f.status<>'pendente' or f.filho_id is null then raise exception 'Consumo não está pendente na caderneta desta casa' using errcode='22023';end if;
 select public.piloto_ler_preferencias_whatsapp(metadata) into pref from public.whatsapp_config where tenant_id=p_tenant;
 if coalesce((pref->>'cantina')::boolean,false) is not true then return jsonb_build_object('send',false,'reason','disabled');end if;
 select * into job from public.piloto_avisos_cantina where financeiro_id=p_financeiro;
 if found then return jsonb_build_object('send',false,'reason',job.estado);end if;
 insert into public.piloto_avisos_cantina(financeiro_id,tenant_id,request_id,estado) values(p_financeiro,p_tenant,p_request,'solicitando');
 return jsonb_build_object('send',true,'member_id',f.filho_id,'amount',f.valor,'request_id',p_request);
end $function$;

-- piloto_liquidar_cantina: cantina (gerenciar)
CREATE OR REPLACE FUNCTION public.piloto_liquidar_cantina(p_tenant uuid, p_filho uuid, p_request uuid, p_transacoes jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare actor uuid;ids uuid[];pending uuid[];payload jsonb;prior public.piloto_financeiro_acoes;entry jsonb;f public.financeiro;result jsonb;total numeric:=0;affected integer:=0;
begin
 actor:=public.piloto_validar_modulo(p_tenant,'cantina','gerenciar');
 if p_filho is null or p_request is null or jsonb_typeof(p_transacoes) is distinct from 'array' then raise exception 'Confira o membro e as comandas do acerto' using errcode='22023';end if;
 if jsonb_array_length(p_transacoes) not between 1 and 1000 then raise exception 'Confira as comandas do acerto' using errcode='22023';end if;
 for entry in select * from jsonb_array_elements(p_transacoes) loop
  if jsonb_typeof(entry) is distinct from 'object' or coalesce(entry->>'id','')!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or jsonb_typeof(entry->'valor') is distinct from 'number' then raise exception 'Comanda inválida' using errcode='22023';end if;
  if (entry->>'valor')::numeric<=0 or (entry->>'valor')::numeric>999999999 or (entry->>'valor')::numeric*100<>trunc((entry->>'valor')::numeric*100) then raise exception 'Valor da comanda inválido' using errcode='22023';end if;
 end loop;
 select array_agg((value->>'id')::uuid order by (value->>'id')::uuid),jsonb_agg(jsonb_build_object('id',(value->>'id')::uuid,'valor',(value->>'valor')::numeric) order by (value->>'id')::uuid) into ids,payload from jsonb_array_elements(p_transacoes);
 if cardinality(ids)<>(select count(distinct unnest_id) from unnest(ids) unnest_id) then raise exception 'Há uma comanda repetida no acerto' using errcode='22023';end if;
 payload:=jsonb_build_object('operation','cantina-settlement','member',p_filho,'transactions',payload);
 perform pg_advisory_xact_lock(hashtextextended(p_tenant::text||':pilot-finance',0));
 perform 1 from public.filhos_de_santo where id=p_filho and (tenant_id=p_tenant or lider_id=actor) for update;
 if not found then raise exception 'Membro não pertence a esta casa' using errcode='42501';end if;
 -- Lock only Cantina rows; a Loja order is never included in this confirmation.
 perform id from public.financeiro where filho_id=p_filho and (tenant_id=p_tenant or lider_id=actor) and categoria='Cantina' order by id for update;
 select * into prior from public.piloto_financeiro_acoes where request_id=p_request;
 if found then
  if prior.actor<>actor or prior.tenant_id<>p_tenant or prior.payload is distinct from payload then raise exception 'Esta identificação já foi usada em outro acerto' using errcode='23505';end if;
  if exists(select 1 from jsonb_array_elements(p_transacoes) expected left join public.financeiro actual on actual.id=(expected->>'id')::uuid where actual.id is null or actual.status<>'pago' or actual.valor is distinct from (expected->>'valor')::numeric or actual.filho_id is distinct from p_filho or actual.categoria is distinct from 'Cantina' or not(coalesce(actual.tenant_id=p_tenant,false) or coalesce(actual.lider_id=actor,false))) then raise exception 'O acerto mudou; atualize a caderneta' using errcode='23505';end if;
  return prior.result||jsonb_build_object('replayed',true);
 end if;
 select array_agg(id order by id) into pending from public.financeiro where filho_id=p_filho and (tenant_id=p_tenant or lider_id=actor) and categoria='Cantina' and status='pendente';
 if pending is distinct from ids then raise exception 'A caderneta mudou. Atualize e confira o total antes de receber.' using errcode='23505';end if;
 for entry in select * from jsonb_array_elements(p_transacoes) loop
  select * into f from public.financeiro where id=(entry->>'id')::uuid;
  if f.filho_id is distinct from p_filho or f.categoria is distinct from 'Cantina' or f.valor is distinct from (entry->>'valor')::numeric or not(coalesce(f.tenant_id=p_tenant,false) or coalesce(f.lider_id=actor,false)) then raise exception 'O valor ou vínculo da comanda mudou' using errcode='23505';end if;
  if exists(select 1 from public.pedidos where financeiro_id=f.id) then raise exception 'Esta comanda está vinculada a um pedido. Confira pela Loja.' using errcode='23505';end if;
  if public.pagamento_caderneta(p_tenant,actor,p_filho,f.id,'liquidar')<>1 then raise exception 'O recebimento não foi confirmado' using errcode='23505';end if;
  total:=total+f.valor;affected:=affected+1;
 end loop;
 result:=jsonb_build_object('memberId',p_filho,'ids',to_jsonb(ids),'count',affected,'totalCents',total*100,'status','pago','replayed',false);
 insert into public.piloto_financeiro_acoes(request_id,actor,tenant_id,financeiro_id,payload,result) values(p_request,actor,p_tenant,ids[1],payload,result);
 return result;
end $function$;

-- piloto_salvar_estoque: inventory (gerenciar)
CREATE OR REPLACE FUNCTION public.piloto_salvar_estoque(p_tenant uuid, p_item uuid, p_input jsonb, p_before jsonb, p_movement jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare actor uuid; f public.almoxarifado; meta public.piloto_estoque_itens; previous public.piloto_estoque_movimentos;
 existing boolean; unit_name text; item_name text; category_name text; quantity bigint; minimum bigint; movement_id uuid;
 current_snapshot jsonb; normalized jsonb; movement_kind text; movement_note text; prior_quantity bigint;
begin
 actor:=public.piloto_validar_modulo(p_tenant,'inventory','gerenciar');
 if p_item is null then raise exception 'Identificação do item obrigatória' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_tenant::text||':pilot-stock',0));
 select * into f from public.almoxarifado where id=p_item for update;existing:=found;
 if existing and not(coalesce(f.tenant_id=p_tenant,false) or coalesce(f.lider_id=actor,false)) then
   raise exception 'Item não pertence a esta casa' using errcode='42501';end if;
 select * into meta from public.piloto_estoque_itens where item_id=p_item;
 prior_quantity:=case when existing then round(coalesce(f.quantidade_atual,0)::numeric*1000/coalesce(meta.escala,1))::bigint else 0 end;
 current_snapshot:=jsonb_build_object('id',p_item,'name',f.item,'category',coalesce(f.categoria,'Rituais'),'unit',coalesce(meta.unidade,'un.'),
   'quantity',prior_quantity,'minimum',round(coalesce(f.quantidade_minima,0)::numeric*1000/coalesce(meta.escala,1))::bigint,
   'location',coalesce(meta.localizacao,''),'notes',coalesce(meta.observacoes,''));
 if p_input is null then
   if not existing or current_snapshot is distinct from p_before then raise exception 'O item mudou; atualize antes de remover' using errcode='23505';end if;
   insert into public.piloto_estoque_itens(item_id,tenant_id,arquivado) values(p_item,p_tenant,true)
     on conflict(item_id) do update set arquivado=true;
   return jsonb_build_object('id',p_item,'archived',true);
 end if;
 unit_name:=p_input->>'unit';item_name:=btrim(p_input->>'name');category_name:=p_input->>'category';
 quantity:=(p_input->>'quantity')::bigint;minimum:=(p_input->>'minimum')::bigint;
 if unit_name is null or unit_name not in ('un.','kg','L','m','maços','garrafas') or item_name is null or length(item_name) not between 3 and 200
    or category_name is null or category_name not in ('Camarinha','Rituais','Cozinha de Santo','Vestuário','Limpeza')
    or quantity is null or quantity<0 or quantity>1000000000 or minimum is null or minimum<0 or minimum>1000000000
    or (unit_name not in ('kg','L','m') and (quantity%1000<>0 or minimum%1000<>0))
    or length(coalesce(p_input->>'location',''))>500 or length(coalesce(p_input->>'notes',''))>4000 then
   raise exception 'Confira os dados, a unidade e as quantidades do item' using errcode='22023';end if;
 normalized:=jsonb_build_object('id',p_item,'name',item_name,'category',category_name,'unit',unit_name,'quantity',quantity,'minimum',minimum,
   'location',coalesce(p_input->>'location',''),'notes',coalesce(p_input->>'notes',''));
 if p_movement is not null then
   movement_id:=(p_movement->>'id')::uuid;movement_kind:=p_movement->>'kind';movement_note:=btrim(p_movement->>'note');
   if movement_id is null or movement_kind is null or movement_kind not in ('initial','in','out','adjust') or movement_note is null or length(movement_note) not between 3 and 1500
      or p_movement->>'itemId' is distinct from p_item::text or p_movement->>'unit' is distinct from unit_name
      or (p_movement->>'after')::numeric is distinct from quantity::numeric then raise exception 'Movimentação inválida' using errcode='22023';end if;
   select * into previous from public.piloto_estoque_movimentos where id=movement_id;
   if found then
     if previous.tenant_id<>p_tenant or previous.item_ref<>p_item or previous.tipo<>movement_kind or previous.depois<>quantity
        or previous.antes::numeric is distinct from (p_movement->>'before')::numeric or previous.motivo<>movement_note
        or current_snapshot is distinct from normalized or coalesce(meta.arquivado,false) then
       raise exception 'Esta tentativa não corresponde ao movimento já salvo; atualize o estoque' using errcode='23505';end if;
     return jsonb_build_object('id',p_item,'replayed',true);
   end if;
 end if;
 if existing then
   if coalesce(meta.arquivado,false) and p_before is null then
     if current_snapshot is distinct from normalized or p_movement is not null then raise exception 'O item arquivado mudou; confira antes de restaurar' using errcode='23505';end if;
   elsif current_snapshot is distinct from p_before then raise exception 'O saldo ou cadastro mudou; atualize antes de salvar' using errcode='23505';end if;
   if unit_name is distinct from coalesce(meta.unidade,'un.') then raise exception 'A unidade de um item existente não pode ser trocada' using errcode='22023';end if;
 else
   if p_before is not null or movement_kind is distinct from 'initial' then raise exception 'Informe o saldo inicial para cadastrar o item' using errcode='22023';end if;
 end if;
 if (not existing or quantity<>prior_quantity) and p_movement is null then raise exception 'Informe o movimento para alterar o saldo' using errcode='22023';end if;
 if p_movement is not null then
   if (p_movement->>'before')::numeric is distinct from prior_quantity::numeric or
      (not existing and movement_kind<>'initial') or (existing and movement_kind='initial') or
      (movement_kind='in' and quantity<=prior_quantity) or (movement_kind='out' and quantity>=prior_quantity) or
      (movement_kind='adjust' and quantity=prior_quantity) then raise exception 'O saldo do movimento não corresponde ao estoque' using errcode='23505';end if;
 end if;
 if exists(select 1 from public.almoxarifado a left join public.piloto_estoque_itens m on m.item_id=a.id where a.id<>p_item
   and (a.tenant_id=p_tenant or a.lider_id=actor) and not coalesce(m.arquivado,false) and lower(btrim(a.item))=lower(item_name)) then
   raise exception 'Já existe um item com este nome' using errcode='23505';end if;
 if existing then update public.almoxarifado set item=item_name,categoria=category_name,quantidade_atual=case when unit_name in ('kg','L','m') then quantity else quantity/1000 end,quantidade_minima=case when unit_name in ('kg','L','m') then minimum else minimum/1000 end where id=p_item;
 else insert into public.almoxarifado(id,lider_id,tenant_id,item,categoria,quantidade_atual,quantidade_minima)
   values(p_item,actor,p_tenant,item_name,category_name,case when unit_name in ('kg','L','m') then quantity else quantity/1000 end,case when unit_name in ('kg','L','m') then minimum else minimum/1000 end);end if;
 insert into public.piloto_estoque_itens(item_id,tenant_id,unidade,escala,localizacao,observacoes,arquivado)
 values(p_item,p_tenant,unit_name,case when unit_name in ('kg','L','m') then 1000 else 1 end,normalized->>'location',normalized->>'notes',false)
 on conflict(item_id) do update set unidade=excluded.unidade,escala=excluded.escala,localizacao=excluded.localizacao,observacoes=excluded.observacoes,arquivado=false;
 if p_movement is not null then insert into public.piloto_estoque_movimentos(id,tenant_id,item_ref,nome,unidade,tipo,antes,depois,motivo)
   values(movement_id,p_tenant,p_item,item_name,unit_name,movement_kind,prior_quantity,quantity,movement_note);end if;
 return jsonb_build_object('id',p_item,'archived',false);
end $function$;

-- piloto_radar_autorizar: radar (gerenciar)
CREATE OR REPLACE FUNCTION public.piloto_radar_autorizar(p_tenant uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
begin
 perform public.piloto_validar_modulo(p_tenant,'radar','gerenciar');
end $function$;
commit;
