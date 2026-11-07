begin;
do $test$
declare owner_id uuid:='fad75b91-d2eb-4805-b5a3-c19e8a073bed';child_id uuid:='3666b777-1066-4eb7-a0c3-f63c2e01ae90';
 member_auth uuid; debt uuid:=gen_random_uuid(); action uuid:=gen_random_uuid(); result jsonb; replay jsonb;
begin
 select user_id into strict member_auth from public.filhos_de_santo where id=child_id and tenant_id=owner_id;
 insert into public.financeiro(id,tenant_id,lider_id,filho_id,tipo,categoria,status,valor,data,data_vencimento,data_pagamento,lancamento_manual,descricao)
 values(debt,owner_id,owner_id,child_id,'entrada','Mensalidade','pago',102,'1903-03-04','1903-02-10','1903-03-04',true,'Rollback reversal (+ 2%: R$ 2.00 juros/multa) (competência 1903-02-10)');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',member_auth,'role','authenticated')::text,true);
 execute 'set local role authenticated';
 begin perform public.piloto_reabrir_mensalidade(owner_id,debt,'1903-03-04',102,action);raise exception 'Member reopened payment';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated')::text,true);
 begin perform public.piloto_reabrir_mensalidade(gen_random_uuid(),debt,'1903-03-04',102,action);raise exception 'Wrong tenant accepted';exception when insufficient_privilege then null;end;
 begin perform public.piloto_reabrir_mensalidade(owner_id,debt,'1903-03-04',101,action);raise exception 'Changed amount accepted';exception when unique_violation then null;end;
 begin perform public.piloto_reabrir_mensalidade(owner_id,debt,'1903-03-05',102,action);raise exception 'Changed date accepted';exception when unique_violation then null;end;
 result:=public.piloto_reabrir_mensalidade(owner_id,debt,'1903-03-04',102,action);
 replay:=public.piloto_reabrir_mensalidade(owner_id,debt,'1903-03-04',102,action);
 if result->>'status'<>'pendente' or result->>'data_pagamento' is not null or result->>'data_vencimento'<>'1903-02-10'
    or (replay->>'replayed')::boolean is not true then raise exception 'Reversal/retry not confirmed';end if;
 if not exists(select 1 from public.financeiro where id=debt and status='pendente' and data='1903-02-10' and data_pagamento is null and valor=102
   and descricao like '%2.00 juros/multa%' and filho_id=child_id) then raise exception 'Due date, fees or payment state corrupted';end if;
 begin perform public.piloto_reabrir_mensalidade(owner_id,debt,'1903-03-04',102,gen_random_uuid());raise exception 'Already pending charge reopened twice';exception when unique_violation then null;end;
 begin perform public.piloto_liquidar_mensalidade(owner_id,debt,'1903-03-04',102,action);raise exception 'Action reused for settlement';exception when unique_violation then null;end;
 perform public.piloto_liquidar_mensalidade(owner_id,debt,'1903-03-06',102,gen_random_uuid());
 begin perform public.piloto_reabrir_mensalidade(owner_id,debt,'1903-03-04',102,action);raise exception 'Old retry reopened a newer payment';exception when unique_violation then null;end;
 execute 'reset role';
 update public.financeiro set lancamento_manual=false where id=debt;
 execute 'set local role authenticated';
 begin perform public.piloto_reabrir_mensalidade(owner_id,debt,'1903-03-06',102,gen_random_uuid());raise exception 'Automatic payment reopened';exception when unique_violation then null;end;
 execute 'reset role';
 update public.financeiro set lancamento_manual=true where id=debt;
 insert into public.financeiro_comprovantes(tenant_id,financeiro_id,filho_id,arquivo_sha256,id_transacao_norm,valor,data_pagamento,beneficiario_lido,status,accepted_at)
 values(owner_id,debt,child_id,gen_random_uuid()::text,gen_random_uuid()::text,102,'1903-03-06','Validation','aceito',now());
 execute 'set local role authenticated';
 begin perform public.piloto_reabrir_mensalidade(owner_id,debt,'1903-03-06',102,gen_random_uuid());raise exception 'Accepted receipt bypassed';exception when unique_violation then null;end;
 if has_function_privilege('anon','public.piloto_reabrir_mensalidade(uuid,uuid,date,numeric,uuid)','EXECUTE') then raise exception 'Anonymous privilege';end if;
 execute 'reset role';
end $test$;
rollback;
select 'passed' as manual_payment_reversal_validation,'all fixtures rolled back' as persistence;
