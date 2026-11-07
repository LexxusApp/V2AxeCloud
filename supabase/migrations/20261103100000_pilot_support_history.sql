begin;
create table if not exists public.piloto_suporte_chamados(
 id uuid primary key,tenant_id uuid not null,dados jsonb not null,status text not null default 'open' check(status in ('open','closed')),
 envio_estado text not null default 'sending' check(envio_estado in ('sending','confirmed','uncertain','failed')),service_message_id text,envio_erro text,envio_tentativa uuid not null default gen_random_uuid(),created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table if not exists public.piloto_suporte_complementos(
 id uuid primary key,chamado_id uuid not null references public.piloto_suporte_chamados(id) on delete cascade,tenant_id uuid not null,texto text not null check(length(texto) between 5 and 2000),
 envio_estado text not null default 'sending' check(envio_estado in ('sending','confirmed','uncertain','failed')),service_message_id text,envio_erro text,envio_tentativa uuid not null default gen_random_uuid(),created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
do $$ declare tab text;begin
 foreach tab in array array['piloto_suporte_chamados','piloto_suporte_complementos'] loop
  execute format('alter table public.%I enable row level security',tab);
  execute format('revoke all on public.%I from public,anon,authenticated',tab);execute format('grant select on public.%I to authenticated',tab);
  execute format('create policy pilot_owner_read on public.%I for select to authenticated using(tenant_id=auth.uid() and auth.uid()=''fad75b91-d2eb-4805-b5a3-c19e8a073bed''::uuid)',tab);
 end loop;
end $$;
create or replace function public.piloto_suporte_iniciar(p_tenant uuid,p_ticket uuid,p_message uuid,p_dados jsonb,p_retry boolean default false)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid;ticket public.piloto_suporte_chamados;message public.piloto_suporte_complementos;canonical jsonb;body text;attempt uuid:=gen_random_uuid();
begin
 actor:=public.piloto_validar_zelador(p_tenant);
 if p_ticket is null or jsonb_typeof(p_dados) is distinct from 'object' then raise exception 'Confira a identificação do pedido' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_ticket::text,0));
 select * into ticket from public.piloto_suporte_chamados where id=p_ticket for update;
 if p_message is null then
  canonical:=jsonb_build_object('responsible',btrim(coalesce(p_dados->>'responsible','')),'house',btrim(coalesce(p_dados->>'house','')),'phone',regexp_replace(coalesce(p_dados->>'phone',''),'\D','','g'),'subject',btrim(coalesce(p_dados->>'subject','')),'text',btrim(coalesce(p_dados->>'text','')),'category',coalesce(p_dados->>'category',''));
  if length(canonical->>'responsible') not between 3 and 80 or length(canonical->>'house') not between 3 and 80 or (canonical->>'phone')!~'^[0-9]{10,13}$'
   or length(canonical->>'subject') not between 5 and 120 or length(canonical->>'text') not between 15 and 3000
   or canonical->>'category' not in ('Uso do sistema','Financeiro e Pix','Cadastro da corrente','Giras e presença','Acesso à conta','Sugestão') then raise exception 'Confira o contato, assunto e descrição do pedido' using errcode='22023';end if;
  if ticket.id is not null then
   if ticket.tenant_id<>p_tenant or ticket.dados is distinct from canonical then raise exception 'Identificação já usada para outro pedido' using errcode='23505';end if;
   if p_retry and ticket.envio_estado='failed' and ticket.status='open' then update public.piloto_suporte_chamados set envio_estado='sending',envio_erro=null,envio_tentativa=attempt,updated_at=now() where id=p_ticket;
   else return jsonb_build_object('id',p_ticket,'send',false,'state',ticket.envio_estado);end if;
  else
  insert into public.piloto_suporte_chamados(id,tenant_id,dados,envio_tentativa) values(p_ticket,p_tenant,canonical,attempt);
  end if;
  body:='Protocolo: '||p_ticket::text||E'\n'||(canonical->>'category')||' · '||(canonical->>'subject')||E'\n\n'||(canonical->>'text');
 else
  if ticket.id is null or ticket.tenant_id<>p_tenant then raise exception 'Pedido não pertence a esta casa' using errcode='42501';end if;
  body:=btrim(coalesce(p_dados->>'text',''));
  if length(body) not between 5 and 2000 then raise exception 'O complemento deve ter de 5 a 2000 caracteres' using errcode='22023';end if;
  select * into message from public.piloto_suporte_complementos where id=p_message;
  if found then
   if message.chamado_id<>p_ticket or message.tenant_id<>p_tenant or message.texto<>body then raise exception 'Identificação já usada para outro complemento' using errcode='23505';end if;
   if p_retry and message.envio_estado='failed' and ticket.status='open' then update public.piloto_suporte_complementos set envio_estado='sending',envio_erro=null,envio_tentativa=attempt,updated_at=now() where id=p_message;
   else return jsonb_build_object('id',p_ticket,'message_id',p_message,'send',false,'state',message.envio_estado);end if;
  else
  if ticket.status<>'open' then raise exception 'Reabra o acompanhamento antes de enviar um complemento' using errcode='23505';end if;
  insert into public.piloto_suporte_complementos(id,chamado_id,tenant_id,texto,envio_tentativa) values(p_message,p_ticket,p_tenant,body,attempt);
  end if;
  canonical:=ticket.dados;
  body:='Complemento do protocolo: '||p_ticket::text||E'\n'||(canonical->>'category')||' · '||(canonical->>'subject')||E'\n\n'||body;
 end if;
 return jsonb_build_object('id',p_ticket,'message_id',p_message,'send',true,'attempt',attempt,'payload',jsonb_build_object('nomeZelador',canonical->>'responsible','nomeTerreiro',canonical->>'house','whatsapp',canonical->>'phone','mensagem',body));
end $$;
create or replace function public.piloto_suporte_finalizar(p_tenant uuid,p_ticket uuid,p_message uuid,p_state text,p_external text,p_error text,p_attempt uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid;previous text;attempt uuid;
begin
 actor:=public.piloto_validar_zelador(p_tenant);
 if p_attempt is null or p_state is null or p_state not in ('confirmed','uncertain','failed') or length(coalesce(p_external,''))>500 or length(coalesce(p_error,''))>1000 or (p_state='confirmed' and nullif(p_external,'') is null) then raise exception 'Resposta do suporte inválida' using errcode='22023';end if;
 if p_message is null then
  select envio_estado,envio_tentativa into previous,attempt from public.piloto_suporte_chamados where id=p_ticket and tenant_id=p_tenant for update;
  if not found then raise exception 'Pedido não pertence a esta casa' using errcode='42501';end if;
  if attempt is distinct from p_attempt then raise exception 'Esta resposta pertence a outra tentativa' using errcode='23505';end if;
  if previous<>'confirmed' then update public.piloto_suporte_chamados set envio_estado=p_state,service_message_id=nullif(p_external,''),envio_erro=nullif(p_error,''),updated_at=now() where id=p_ticket;end if;
 else
  select envio_estado,envio_tentativa into previous,attempt from public.piloto_suporte_complementos where id=p_message and chamado_id=p_ticket and tenant_id=p_tenant for update;
  if not found then raise exception 'Complemento não pertence a esta casa' using errcode='42501';end if;
  if attempt is distinct from p_attempt then raise exception 'Esta resposta pertence a outra tentativa' using errcode='23505';end if;
  if previous<>'confirmed' then update public.piloto_suporte_complementos set envio_estado=p_state,service_message_id=nullif(p_external,''),envio_erro=nullif(p_error,''),updated_at=now() where id=p_message;end if;
 end if;
 return jsonb_build_object('id',p_ticket,'message_id',p_message,'state',case when previous='confirmed' then previous else p_state end);
end $$;
create or replace function public.piloto_suporte_situacao(p_tenant uuid,p_ticket uuid,p_status text,p_antes text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid;previous text;
begin
 actor:=public.piloto_validar_zelador(p_tenant);
 if p_status is null or p_antes is null or p_status not in ('open','closed') or p_antes not in ('open','closed') then raise exception 'Situação inválida' using errcode='22023';end if;
 select status into previous from public.piloto_suporte_chamados where id=p_ticket and tenant_id=p_tenant for update;
 if not found then raise exception 'Pedido não pertence a esta casa' using errcode='42501';end if;
 if previous<>p_status and previous<>p_antes then raise exception 'O acompanhamento mudou. Atualize antes de salvar.' using errcode='23505';end if;
 update public.piloto_suporte_chamados set status=p_status,updated_at=now() where id=p_ticket;
 return jsonb_build_object('id',p_ticket,'status',p_status);
end $$;
revoke all on function public.piloto_suporte_iniciar(uuid,uuid,uuid,jsonb,boolean),public.piloto_suporte_finalizar(uuid,uuid,uuid,text,text,text,uuid),public.piloto_suporte_situacao(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.piloto_suporte_iniciar(uuid,uuid,uuid,jsonb,boolean),public.piloto_suporte_finalizar(uuid,uuid,uuid,text,text,text,uuid),public.piloto_suporte_situacao(uuid,uuid,text,text) to authenticated;
notify pgrst,'reload schema';
commit;
