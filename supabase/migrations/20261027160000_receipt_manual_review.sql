-- Receipts are submitted for human review. OCR never settles a debt.
create table if not exists public.mensalidade_comprovante_envios (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null, filho_id uuid not null references public.filhos_de_santo(id),
 financeiro_id uuid not null references public.financeiro(id), submitted_by uuid not null,
 request_id uuid not null, storage_path text not null unique, arquivo_sha256 text not null,
 mime_type text not null check(mime_type in ('image/jpeg','image/png','image/webp')),
 file_size integer not null check(file_size between 1 and 5242880),
 status text not null default 'em_analise' check(status in ('em_analise','aceito','rejeitado','encerrado')),
 analysis_status text not null default 'pendente' check(analysis_status in ('pendente','concluida','indisponivel')),
 analysis jsonb not null default '{}'::jsonb, alerts jsonb not null default '[]'::jsonb,
 submitted_value numeric(12,2) not null, approved_fields jsonb,
 decided_by uuid, decided_at timestamptz, decision_reason text,
 created_at timestamptz not null default now(),
 unique(submitted_by,request_id)
);
create unique index if not exists mensalidade_comprovante_active_file on public.mensalidade_comprovante_envios(arquivo_sha256) where status in ('em_analise','aceito');
create unique index if not exists mensalidade_comprovante_open_due on public.mensalidade_comprovante_envios(financeiro_id) where status='em_analise';
create index if not exists mensalidade_comprovante_tenant_date on public.mensalidade_comprovante_envios(tenant_id,created_at desc,id desc);
create index if not exists mensalidade_comprovante_child_date on public.mensalidade_comprovante_envios(filho_id,created_at desc,id desc);
alter table public.mensalidade_comprovante_envios enable row level security;
revoke all on public.mensalidade_comprovante_envios from anon,authenticated;
grant all on public.mensalidade_comprovante_envios to service_role;

create table if not exists public.mensalidade_comprovante_eventos (
 id uuid primary key default gen_random_uuid(), envio_id uuid not null references public.mensalidade_comprovante_envios(id),
 tenant_id uuid not null, filho_id uuid not null, submitted_by uuid not null,
 tipo text not null check(tipo in ('enviado','aceito','rejeitado','encerrado')),
 created_at timestamptz not null default now(), unique(envio_id,tipo)
);
alter table public.mensalidade_comprovante_eventos enable row level security;
revoke all on public.mensalidade_comprovante_eventos from anon,authenticated;
grant all on public.mensalidade_comprovante_eventos to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('mensalidade-comprovantes','mensalidade-comprovantes',false,5242880,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
do $$ begin
 if exists(select 1 from storage.buckets where id='mensalidade-comprovantes' and public) then
  raise exception 'O bucket de comprovantes precisa ser privado';
 end if;
end $$;

create or replace function public.comprovante_actor_zelador(p_actor uuid,p_tenant uuid)
returns boolean language sql stable security invoker set search_path=public,pg_temp as $$
 select exists(select 1 from public.perfil_lider a join public.perfil_lider t on t.id=p_tenant
  where a.id=p_actor and (a.id=t.id or a.tenant_id=t.id or (t.tenant_id is not null and a.tenant_id=t.tenant_id)))
 and not exists(select 1 from public.filhos_de_santo where user_id=p_actor);
$$;

create or replace function public.registrar_envio_comprovante(p_actor uuid,p_tenant uuid,p_filho uuid,p_financeiro uuid,p_request uuid,p_path text,p_sha text,p_mime text,p_size integer)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare f public.financeiro; c public.filhos_de_santo; e public.mensalidade_comprovante_envios; v_auth_email text; v_tenant_ref uuid;
begin
 if p_actor is null or p_request is null or p_tenant is null or p_filho is null or p_financeiro is null then raise exception 'Identificação do envio obrigatória' using errcode='22023'; end if;
 select * into f from public.financeiro where id=p_financeiro for update;
 if not found then raise exception 'Mensalidade não encontrada' using errcode='22023'; end if;
 select tenant_id into v_tenant_ref from public.perfil_lider where id=p_tenant;
 select * into c from public.filhos_de_santo where id=p_filho;
 select lower(email) into v_auth_email from auth.users where id=p_actor;
 if c.id is null or not coalesce(c.user_id=p_actor or (c.email is not null and lower(c.email)=v_auth_email) or v_auth_email='f_'||c.id::text||'@axecloud.internal' or v_auth_email='filho_'||c.id::text||'@axecloud.com',false) then
  raise exception 'O comprovante deve ser enviado pelo próprio membro' using errcode='42501'; end if;
 if not(coalesce(c.tenant_id in(p_tenant,v_tenant_ref),false) or coalesce(c.lider_id in(p_tenant,v_tenant_ref),false)) or
    not(coalesce(f.tenant_id in(p_tenant,v_tenant_ref),false) or coalesce(f.lider_id in(p_tenant,v_tenant_ref),false)) or
    f.categoria is distinct from 'Mensalidade' or coalesce(f.filho_id::text,lower(substring(f.descricao from '\(ID:([0-9a-fA-F-]{36})\)'))) is distinct from c.id::text then
  raise exception 'Mensalidade não pertence a este membro e terreiro' using errcode='42501'; end if;
 select * into e from public.mensalidade_comprovante_envios where submitted_by=p_actor and request_id=p_request;
 if found then
  if e.financeiro_id<>p_financeiro or e.arquivo_sha256<>p_sha then raise exception 'Identificador já utilizado para outro envio' using errcode='23505'; end if;
  return to_jsonb(e)||jsonb_build_object('replayed',true);
 end if;
 select * into e from public.mensalidade_comprovante_envios where financeiro_id=p_financeiro and status='em_analise';
 if found then
  if e.submitted_by=p_actor and e.arquivo_sha256=p_sha then return to_jsonb(e)||jsonb_build_object('replayed',true); end if;
  raise exception 'Esta mensalidade já possui comprovante em análise' using errcode='23505';
 end if;
 if coalesce(f.status,'') not in ('pendente','pending','atrasado','overdue') and not coalesce(f.status is null and f.descricao ilike '%(vencimento%',false) then
  raise exception 'Esta mensalidade não está pendente' using errcode='23505'; end if;
 if exists(select 1 from public.financeiro_comprovantes where arquivo_sha256=p_sha) then raise exception 'Comprovante já utilizado' using errcode='23505'; end if;
 if p_path not like p_tenant::text||'/'||p_filho::text||'/%' or p_sha !~ '^[0-9a-f]{64}$' then raise exception 'Arquivo inválido' using errcode='22023'; end if;
 insert into public.mensalidade_comprovante_envios(tenant_id,filho_id,financeiro_id,submitted_by,request_id,storage_path,arquivo_sha256,mime_type,file_size,submitted_value)
 values(p_tenant,p_filho,p_financeiro,p_actor,p_request,p_path,p_sha,p_mime,p_size,f.valor) returning * into e;
 insert into public.mensalidade_comprovante_eventos(envio_id,tenant_id,filho_id,submitted_by,tipo) values(e.id,e.tenant_id,e.filho_id,e.submitted_by,'enviado');
 return to_jsonb(e)||jsonb_build_object('replayed',false);
end $$;

create or replace function public.decidir_envio_comprovante(p_actor uuid,p_envio uuid,p_decisao text,p_fields jsonb)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare e public.mensalidade_comprovante_envios; f public.financeiro; c public.filhos_de_santo; v_ref uuid; v_financeiro uuid; v_valor numeric; v_data date; v_tx text; v_benef text; v_reason text; v_count integer; v_nome text; v_comp date;
begin
 select financeiro_id into v_financeiro from public.mensalidade_comprovante_envios where id=p_envio;
 if not found then raise exception 'Comprovante não encontrado' using errcode='22023'; end if;
 select * into f from public.financeiro where id=v_financeiro for update;
 select * into e from public.mensalidade_comprovante_envios where id=p_envio for update;
 if not public.comprovante_actor_zelador(p_actor,e.tenant_id) then raise exception 'Somente o zelador deste terreiro pode decidir' using errcode='42501'; end if;
 if p_decisao not in ('aceito','rejeitado') then raise exception 'Decisão inválida' using errcode='22023'; end if;
 if e.status=p_decisao then return jsonb_build_object('id',e.id,'status',e.status,'replayed',true,'financeiro_id',e.financeiro_id); end if;
 if e.status<>'em_analise' then raise exception 'Comprovante já decidido ou mensalidade quitada por outra via' using errcode='23505'; end if;
 v_reason:=left(trim(coalesce(p_fields->>'motivo','')),500);
 if p_decisao='rejeitado' then
  if length(v_reason)<3 then raise exception 'Informe o motivo da rejeição' using errcode='22023'; end if;
 else
  if coalesce((p_fields->>'confirmo_recebimento')::boolean,false) is not true then raise exception 'Confirme o recebimento na conta do terreiro' using errcode='22023'; end if;
  if coalesce(f.status,'') not in ('pendente','pending','atrasado','overdue') and not coalesce(f.status is null and f.descricao ilike '%(vencimento%',false) then raise exception 'Mensalidade já quitada ou alterada' using errcode='23505'; end if;
  if f.categoria is distinct from 'Mensalidade' or coalesce(f.filho_id::text,lower(substring(f.descricao from '\(ID:([0-9a-fA-F-]{36})\)'))) is distinct from e.filho_id::text then raise exception 'Vínculo financeiro alterado' using errcode='23505'; end if;
  select tenant_id into v_ref from public.perfil_lider where id=e.tenant_id;
  select * into c from public.filhos_de_santo where id=e.filho_id;
  if not(coalesce(f.tenant_id in(e.tenant_id,v_ref),false) or coalesce(f.lider_id in(e.tenant_id,v_ref),false)) or
     not(coalesce(c.tenant_id in(e.tenant_id,v_ref),false) or coalesce(c.lider_id in(e.tenant_id,v_ref),false)) then
   raise exception 'O vínculo com o terreiro foi alterado; revise o cadastro' using errcode='23505'; end if;
  v_valor:=(p_fields->>'valor')::numeric; v_data:=(p_fields->>'data_pagamento')::date;
  v_tx:=regexp_replace(upper(coalesce(p_fields->>'id_transacao','')),'[^A-Z0-9]','','g'); v_benef:=trim(coalesce(p_fields->>'beneficiario',''));
  if v_valor is null or v_valor<=0 or v_valor*100<>trunc(v_valor*100) or v_valor is distinct from f.valor then raise exception 'O valor recebido deve corresponder ao total integral da mensalidade' using errcode='22023'; end if;
  if v_data is null or v_data>(now() at time zone 'America/Sao_Paulo')::date then raise exception 'Informe a data efetiva do pagamento, sem data futura' using errcode='22023'; end if;
  if length(v_tx)<10 or length(v_tx)>128 or length(v_benef)<2 or length(v_benef)>200 then raise exception 'Complete o identificador bancário e o beneficiário conferidos' using errcode='22023'; end if;
  if (jsonb_array_length(e.alerts)>0 or e.analysis_status<>'concluida') and length(v_reason)<3 then raise exception 'Justifique a confirmação dos alertas ou da leitura indisponível' using errcode='22023'; end if;
  insert into public.financeiro_comprovantes(tenant_id,financeiro_id,filho_id,arquivo_sha256,id_transacao_norm,valor,data_pagamento,beneficiario_lido,status,accepted_at)
  values(e.tenant_id,e.financeiro_id,e.filho_id,e.arquivo_sha256,v_tx,v_valor,v_data,v_benef,'aceito',now());
  -- Mark review accepted before updating finance; the finance trigger closes only OTHER open reviews.
  update public.mensalidade_comprovante_envios set status='aceito',decided_by=p_actor,decided_at=now(),decision_reason=nullif(v_reason,''),approved_fields=p_fields where id=e.id;
  select nome into v_nome from public.filhos_de_santo where id=e.filho_id;
  v_comp:=coalesce(f.data_vencimento,f.data);
  update public.financeiro set status='pago',tipo='entrada',valor=v_valor,data=v_data,data_pagamento=v_data,
   data_vencimento=v_comp,descricao='Mensalidade - '||coalesce(v_nome,'Filho')||' (competência '||v_comp::text||') (ID:'||e.filho_id::text||')'
  where id=f.id and (status in ('pendente','pending','atrasado','overdue') or (status is null and descricao ilike '%(vencimento%'));
  get diagnostics v_count=row_count;
  if v_count<>1 then raise exception 'A baixa não foi confirmada; atualize a mensalidade' using errcode='23505'; end if;
 end if;
 if p_decisao='rejeitado' then update public.mensalidade_comprovante_envios set status='rejeitado',decided_by=p_actor,decided_at=now(),decision_reason=v_reason,approved_fields=null where id=e.id; end if;
 insert into public.mensalidade_comprovante_eventos(envio_id,tenant_id,filho_id,submitted_by,tipo) values(e.id,e.tenant_id,e.filho_id,e.submitted_by,p_decisao);
 return jsonb_build_object('id',e.id,'status',p_decisao,'replayed',false,'financeiro_id',e.financeiro_id,'filho_id',e.filho_id,'tenant_id',e.tenant_id,'valor',v_valor,'competencia',coalesce(f.data_vencimento,f.data));
end $$;

create or replace function public.encerrar_revisoes_mensalidade_quitada()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if new.categoria='Mensalidade' and coalesce(new.status,'') in ('pago','paid','confirmado','cancelado','excluido') then
  with closed as (
   update public.mensalidade_comprovante_envios set status='encerrado',decided_at=now(),decision_reason='Mensalidade quitada ou encerrada por outra via'
    where financeiro_id=new.id and status='em_analise' returning *
  ) insert into public.mensalidade_comprovante_eventos(envio_id,tenant_id,filho_id,submitted_by,tipo)
    select id,tenant_id,filho_id,submitted_by,'encerrado' from closed on conflict do nothing;
 end if;
 return new;
end $$;
drop trigger if exists financeiro_encerrar_revisoes on public.financeiro;
create trigger financeiro_encerrar_revisoes after update of status on public.financeiro for each row execute function public.encerrar_revisoes_mensalidade_quitada();

revoke all on function public.comprovante_actor_zelador(uuid,uuid) from public,anon,authenticated;
revoke all on function public.registrar_envio_comprovante(uuid,uuid,uuid,uuid,uuid,text,text,text,integer) from public,anon,authenticated;
revoke all on function public.decidir_envio_comprovante(uuid,uuid,text,jsonb) from public,anon,authenticated;
revoke all on function public.encerrar_revisoes_mensalidade_quitada() from public,anon,authenticated;
grant execute on function public.comprovante_actor_zelador(uuid,uuid) to service_role;
grant execute on function public.registrar_envio_comprovante(uuid,uuid,uuid,uuid,uuid,text,text,text,integer) to service_role;
grant execute on function public.decidir_envio_comprovante(uuid,uuid,text,jsonb) to service_role;

-- Preserve old accepted receipts in the history without inventing old images.
create or replace view public.mensalidade_comprovante_lista with (security_invoker=true) as
 select id,tenant_id,filho_id,financeiro_id,submitted_by,status,created_at,decided_at,decision_reason,
  analysis_status,analysis,alerts,submitted_value,approved_fields,false as legacy
 from public.mensalidade_comprovante_envios
 union all
 select r.id,r.tenant_id,r.filho_id,r.financeiro_id,null::uuid,'aceito'::text,r.created_at,r.accepted_at,null::text,
  'concluida'::text,jsonb_build_object('valor',r.valor,'data',r.data_pagamento,'beneficiario',r.beneficiario_lido,'id_transacao',r.id_transacao_norm),
  '[]'::jsonb,r.valor,null::jsonb,true
 from public.financeiro_comprovantes r where r.status='aceito' and not exists
  (select 1 from public.mensalidade_comprovante_envios e where e.arquivo_sha256=r.arquivo_sha256 and e.status='aceito');
revoke all on public.mensalidade_comprovante_lista from anon,authenticated;
grant select on public.mensalidade_comprovante_lista to service_role;
