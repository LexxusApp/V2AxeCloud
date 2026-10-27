-- Manual decisions must not be removed or repriced by recurring-billing synchronization.
alter table public.financeiro
  add column if not exists lancamento_manual boolean not null default false,
  add column if not exists data_vencimento date,
  add column if not exists manual_request_id uuid,
  add column if not exists manual_request jsonb;
create unique index if not exists financeiro_manual_request_key on public.financeiro(tenant_id,manual_request_id) where manual_request_id is not null;

create or replace function public.registrar_lancamento_manual(p_actor uuid,p_tenant uuid,p_request uuid,p_payload jsonb)
returns public.financeiro language plpgsql security invoker set search_path=public,pg_temp as $$
declare v_row public.financeiro; v_child uuid := nullif(p_payload->>'filho_id','')::uuid; v_leader uuid;
 v_date date := (p_payload->>'data')::date; v_status text := p_payload->>'status';
 v_monthly boolean := p_payload->>'categoria' = 'Mensalidade';
begin
 if p_actor is null or p_tenant is null or p_request is null then raise exception 'Identificação do lançamento obrigatória' using errcode='22023'; end if;
 select id into v_leader from public.perfil_lider where id=p_tenant or tenant_id=p_tenant order by (id=p_tenant) desc limit 1;
 if v_leader is null then raise exception 'Terreiro inválido' using errcode='22023'; end if;
 if v_child is not null and not exists(select 1 from public.filhos_de_santo where id=v_child and (tenant_id in (p_tenant,v_leader) or lider_id in (p_tenant,v_leader))) then
   raise exception 'O membro não pertence a este terreiro' using errcode='42501'; end if;
 if p_payload->>'tipo' not in ('entrada','saida') or (p_payload->>'valor')::numeric <= 0 or nullif(trim(p_payload->>'descricao'),'') is null then raise exception 'Dados financeiros inválidos' using errcode='22023'; end if;
 if v_monthly and (v_child is null or p_payload->>'tipo'<>'entrada' or v_status not in ('pendente','pago')) then raise exception 'Mensalidade exige membro, entrada e situação válida' using errcode='22023'; end if;
 if not v_monthly then v_status := 'pago'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_tenant::text||':manual-finance',0));
 select * into v_row from public.financeiro where tenant_id=p_tenant and manual_request_id=p_request;
 if found then
   if v_row.manual_request is distinct from p_payload then raise exception 'Identificador já utilizado para outro lançamento' using errcode='23505'; end if;
   return v_row;
 end if;
 if v_monthly then
   select * into v_row from public.financeiro
   where (tenant_id in(p_tenant,v_leader) or lider_id in(p_tenant,v_leader)) and categoria='Mensalidade'
     and (filho_id=v_child or (filho_id is null and descricao like '%(ID:'||v_child::text||')%'))
     and date_trunc('month',coalesce(data_vencimento,data))=date_trunc('month',v_date)
     and coalesce(status,'') not in ('cancelado','excluido','rejeitado')
   order by lancamento_manual desc,created_at desc limit 1 for update;
   if found then
     if v_row.lancamento_manual or coalesce(v_row.status,'') in ('pago','paid','confirmado') then
       raise exception 'Já existe uma mensalidade para este membro neste mês. Confira a aba Mensalidades antes de lançar novamente.' using errcode='23505'; end if;
     update public.financeiro set valor=(p_payload->>'valor')::numeric,status=v_status,data=v_date,data_vencimento=v_date,
       descricao=p_payload->>'descricao',filho_id=v_child,lancamento_manual=true,manual_request_id=p_request,manual_request=p_payload,
       data_pagamento=case when v_status='pago' then (now() at time zone 'America/Sao_Paulo')::date else null end
     where id=v_row.id returning * into v_row;
     return v_row;
   end if;
 end if;
 insert into public.financeiro(lider_id,tenant_id,tipo,valor,categoria,data,descricao,filho_id,status,data_vencimento,lancamento_manual,manual_request_id,manual_request,data_pagamento)
 values(p_actor,p_tenant,p_payload->>'tipo',(p_payload->>'valor')::numeric,p_payload->>'categoria',v_date,p_payload->>'descricao',v_child,v_status,
   case when v_monthly then v_date end,true,p_request,p_payload,
   case when v_status='pago' then case when v_monthly then (now() at time zone 'America/Sao_Paulo')::date else v_date end end)
 returning * into v_row;
 return v_row;
end; $$;
revoke all on function public.registrar_lancamento_manual(uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.registrar_lancamento_manual(uuid,uuid,uuid,jsonb) to service_role;
