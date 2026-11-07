-- Only the authorized house is touched; all fixtures and effects are rolled back.
begin;
do $test$
declare owner_id uuid:='fad75b91-d2eb-4805-b5a3-c19e8a073bed'; child_id uuid:='3666b777-1066-4eb7-a0c3-f63c2e01ae90';
 member_auth uuid; debt uuid:=gen_random_uuid(); review_debt uuid:=gen_random_uuid(); action uuid:=gen_random_uuid();
 create_action uuid:=gen_random_uuid(); receipt uuid:=gen_random_uuid(); result jsonb; replay jsonb; input jsonb; count_rows int;
begin
 select user_id into strict member_auth from public.filhos_de_santo where id=child_id and tenant_id=owner_id;
 if exists(select 1 from public.financeiro where tenant_id=owner_id and filho_id=child_id and categoria='Mensalidade' and coalesce(data_vencimento,data) between '1902-01-01' and '1902-12-31') then
   raise exception 'Mês de teste ocupado; nenhum dado existente foi modificado';end if;
 insert into public.financeiro(id,lider_id,tenant_id,tipo,valor,categoria,data,data_vencimento,descricao,filho_id,status)
 values(debt,owner_id,owner_id,'entrada',102,'Mensalidade','1902-02-10','1902-02-10','Teste (+ 2%: R$ 2.00 juros/multa) (vencimento 1902-02-10)',child_id,'pendente'),
       (review_debt,owner_id,owner_id,'entrada',100,'Mensalidade','1902-05-10','1902-05-10','Comprovante de teste (vencimento 1902-05-10)',child_id,'pendente');
 insert into public.mensalidade_comprovante_envios(id,tenant_id,filho_id,financeiro_id,submitted_by,request_id,storage_path,arquivo_sha256,mime_type,file_size,submitted_value)
 values(receipt,owner_id,child_id,review_debt,member_auth,gen_random_uuid(),'rollback-test/'||receipt,receipt::text,'image/png',1,100);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',member_auth,'role','authenticated')::text,true);
 execute 'set local role authenticated';
 begin perform public.piloto_liquidar_mensalidade(owner_id,debt,'1902-03-04',102,action);raise exception 'Membro conseguiu dar baixa';exception when insufficient_privilege then null;end;
 begin perform public.piloto_criar_mensalidade_quitada(owner_id,create_action,'{}','1902-03-04');raise exception 'Membro conseguiu criar quitação';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated')::text,true);
 begin perform public.piloto_liquidar_mensalidade(gen_random_uuid(),debt,'1902-03-04',102,action);raise exception 'Outro tenant aceito';exception when insufficient_privilege then null;end;
 begin perform public.piloto_liquidar_mensalidade(owner_id,debt,'1902-03-04',101,action);raise exception 'Valor divergente aceito';exception when unique_violation then null;end;
 begin perform public.piloto_liquidar_mensalidade(owner_id,debt,(now() at time zone 'America/Sao_Paulo')::date+1,102,action);raise exception 'Data futura aceita';exception when invalid_parameter_value then null;end;
 begin perform public.piloto_liquidar_mensalidade(owner_id,review_debt,'1902-06-01',100,gen_random_uuid());raise exception 'Baixa ignorou comprovante em análise';exception when unique_violation then null;end;
 result:=public.piloto_liquidar_mensalidade(owner_id,debt,'1902-03-04',102,action);
 replay:=public.piloto_liquidar_mensalidade(owner_id,debt,'1902-03-04',102,action);
 if result->>'status'<>'pago' or result->>'data_pagamento'<>'1902-03-04' or replay->>'id'<>result->>'id' or (replay->>'replayed')::boolean is not true then raise exception 'Baixa ou repetição inconsistente';end if;
 if not exists(select 1 from public.financeiro where id=debt and data='1902-03-04' and data_pagamento='1902-03-04' and data_vencimento='1902-02-10' and descricao like '%2.00 juros/multa%' and filho_id=child_id) then raise exception 'Competência, juros ou vínculo perdidos';end if;
 begin perform public.piloto_liquidar_mensalidade(owner_id,debt,'1902-03-05',102,action);raise exception 'Repetição alterou a baixa';exception when unique_violation then null;end;
 input:=jsonb_build_object('valor',100,'data','1902-04-10','filho_id',child_id,'descricao','Antiga quitada','jurosTipo','porcentagem','jurosValor',2);
 result:=public.piloto_criar_mensalidade_quitada(owner_id,create_action,input,'1902-04-05');
 replay:=public.piloto_criar_mensalidade_quitada(owner_id,create_action,input,'1902-04-05');
 if result->>'id'<>replay->>'id' or (result->>'valor')::numeric<>102 or result->>'data_vencimento'<>'1902-04-10' or result->>'data_pagamento'<>'1902-04-05' then raise exception 'Criação quitada incorreta';end if;
 begin perform public.piloto_criar_mensalidade_quitada(owner_id,create_action,input,'1902-04-06');raise exception 'Mesma tentativa aceitou outra data';exception when unique_violation then null;end;
 begin perform public.piloto_criar_mensalidade_quitada(owner_id,gen_random_uuid(),input,'1902-04-05');raise exception 'Competência duplicada';exception when unique_violation then null;end;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',member_auth,'role','authenticated')::text,true);
 select count(*) into count_rows from public.financeiro where id in(debt,(result->>'id')::uuid) and status='pago';
 if count_rows<>2 then raise exception 'O membro não vê as quitações vinculadas';end if;
 if has_function_privilege('anon','public.piloto_liquidar_mensalidade(uuid,uuid,date,numeric,uuid)','EXECUTE') or has_function_privilege('anon','public.piloto_criar_mensalidade_quitada(uuid,uuid,jsonb,date)','EXECUTE') then raise exception 'Operação exposta a anônimos';end if;
 execute 'reset role';
end $test$;
rollback;
select 'passed' as pilot_monthly_database_validation, 'all business fixtures rolled back' as persistence;
