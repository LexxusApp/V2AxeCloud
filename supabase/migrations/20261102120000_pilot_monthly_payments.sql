begin;
-- Only the already-authorized pilot owner can execute these additive operations.
-- Existing API routes and all other houses retain their current behavior.
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

create table if not exists public.piloto_financeiro_acoes(
 request_id uuid primary key,actor uuid not null,tenant_id uuid not null,
 financeiro_id uuid not null,payload jsonb not null,result jsonb not null,
 created_at timestamptz not null default now()
);
alter table public.piloto_financeiro_acoes enable row level security;
revoke all on public.piloto_financeiro_acoes from public,anon,authenticated;
grant select on public.piloto_financeiro_acoes to authenticated;
drop policy if exists piloto_financeiro_own_read on public.piloto_financeiro_acoes;
create policy piloto_financeiro_own_read on public.piloto_financeiro_acoes for select to authenticated
 using(actor=auth.uid() and tenant_id=auth.uid() and auth.uid()='fad75b91-d2eb-4805-b5a3-c19e8a073bed'::uuid);

create or replace function public.piloto_liquidar_mensalidade(p_tenant uuid,p_financeiro uuid,p_data_pagamento date,p_valor numeric,p_request uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid; f public.financeiro; child_id uuid; comp date; prior public.piloto_financeiro_acoes; payload jsonb; result jsonb;
begin
 actor:=public.piloto_validar_zelador(p_tenant);
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
end $$;
revoke all on function public.piloto_liquidar_mensalidade(uuid,uuid,date,numeric,uuid) from public,anon,authenticated;
grant execute on function public.piloto_liquidar_mensalidade(uuid,uuid,date,numeric,uuid) to authenticated;

create or replace function public.piloto_criar_mensalidade_quitada(p_tenant uuid,p_request uuid,p_input jsonb,p_data_pagamento date)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid; base numeric; interest numeric:=0; total numeric; mode text; extra numeric:=0; suffix text:='';
 description text; due date; child_id uuid; payload jsonb; f public.financeiro;
begin
 actor:=public.piloto_validar_zelador(p_tenant);
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
end $$;
revoke all on function public.piloto_criar_mensalidade_quitada(uuid,uuid,jsonb,date) from public,anon,authenticated;
grant execute on function public.piloto_criar_mensalidade_quitada(uuid,uuid,jsonb,date) to authenticated;
notify pgrst, 'reload schema';
commit;
