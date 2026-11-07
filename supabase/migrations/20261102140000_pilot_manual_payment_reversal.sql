begin;
-- Additive pilot-only correction. Shared API routes and other houses are unchanged.
create or replace function public.piloto_reabrir_mensalidade(p_tenant uuid,p_financeiro uuid,p_data_pagamento date,p_valor numeric,p_request uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid; f public.financeiro; prior public.piloto_financeiro_acoes; payload jsonb; result jsonb; due date; child_id uuid;
begin
 actor:=public.piloto_validar_zelador(p_tenant);
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
end $$;
revoke all on function public.piloto_reabrir_mensalidade(uuid,uuid,date,numeric,uuid) from public,anon,authenticated;
grant execute on function public.piloto_reabrir_mensalidade(uuid,uuid,date,numeric,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
