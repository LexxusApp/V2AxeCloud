begin;
do $test$
declare owner_id uuid:='fad75b91-d2eb-4805-b5a3-c19e8a073bed';child_id uuid:=gen_random_uuid();first_id uuid:=gen_random_uuid();second_id uuid:=gen_random_uuid();store_id uuid:=gen_random_uuid();request_id uuid:=gen_random_uuid();r jsonb;expected jsonb;original_cash numeric;
begin
 select coalesce(sum(valor),0) into original_cash from public.financeiro where tenant_id=owner_id and status='pago' and tipo='entrada';
 insert into public.filhos_de_santo(id,tenant_id,lider_id,nome,status) values(child_id,owner_id,owner_id,'VALIDACAO-CODEX-CANTINA-ROLLBACK','Ativo');
 insert into public.financeiro(id,tenant_id,lider_id,filho_id,descricao,valor,data,data_venda,tipo,categoria,status) values
 (first_id,owner_id,owner_id,child_id,'VALIDACAO-CODEX-CANTINA-ROLLBACK',1,'2026-01-01','2026-01-01','entrada','Cantina','pendente'),
 (second_id,owner_id,owner_id,child_id,'VALIDACAO-CODEX-CANTINA-ROLLBACK',2,'2026-01-01','2026-01-01','entrada','Cantina','pendente'),
 (store_id,owner_id,owner_id,child_id,'VALIDACAO-CODEX-LOJA-ROLLBACK',7,'2026-01-01','2026-01-01','entrada','Loja','pendente');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated')::text,true);execute 'set local role authenticated';
 expected:=jsonb_build_array(jsonb_build_object('id',first_id,'valor',1),jsonb_build_object('id',second_id,'valor',2));
 begin perform public.piloto_liquidar_cantina(owner_id,child_id,request_id,jsonb_build_array(jsonb_build_object('id',first_id,'valor',1)));raise exception 'Acerto parcial desatualizado aceito';exception when unique_violation then null;end;
 begin perform public.piloto_liquidar_cantina(owner_id,child_id,request_id,jsonb_build_array(jsonb_build_object('id',first_id,'valor',1),jsonb_build_object('id',second_id,'valor',9)));raise exception 'Valor divergente aceito';exception when unique_violation then null;end;
 if exists(select 1 from public.financeiro where id in(first_id,second_id,store_id) and status<>'pendente') then raise exception 'Falha deixou pagamento parcial';end if;
 r:=public.piloto_liquidar_cantina(owner_id,child_id,request_id,expected);
 if r->>'count'<>'2' or (r->>'totalCents')::numeric<>300 or jsonb_array_length(r->'ids')<>2 then raise exception 'Resultado do acerto divergente';end if;
 if (select status from public.financeiro where id=store_id)<>'pendente' then raise exception 'Acerto da cantina quitou a Loja';end if;
 if exists(select 1 from public.financeiro where id in(first_id,second_id) and (status<>'pago' or data_pagamento is distinct from (now() at time zone 'America/Sao_Paulo')::date or data_venda is distinct from '2026-01-01'::date)) then raise exception 'Data de consumo ou de recebimento incorreta';end if;
 r:=public.piloto_liquidar_cantina(owner_id,child_id,request_id,expected);if r->>'replayed'<>'true' then raise exception 'Repetição não reconhecida';end if;
 execute 'reset role';
 if (select count(*) from public.comercio_eventos where financeiro_id in(first_id,second_id) and acao='liquidar')<>2 then raise exception 'Repetição duplicou recebimento/auditoria';end if;
 if (select coalesce(sum(valor),0) from public.financeiro where tenant_id=owner_id and status='pago' and tipo='entrada')<>original_cash+3 then raise exception 'Caixa não mudou exatamente R$3';end if;
 execute 'set local role authenticated';
 perform set_config('request.jwt.claims',jsonb_build_object('sub','ab2eef13-604c-4c8f-9d14-f3da41cc5a81','role','authenticated')::text,true);
 begin perform public.piloto_liquidar_cantina(owner_id,child_id,gen_random_uuid(),expected);raise exception 'Membro deu baixa';exception when insufficient_privilege then null;end;
 execute 'reset role';
end $test$;
rollback;
select 'passed' as pilot_cantina_settlement_validation,'all fixtures and payments rolled back; no external sends' as persistence;
