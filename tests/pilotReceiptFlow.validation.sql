-- Review before execution. Run as the linked project's administrative SQL role.
-- No HTTP/API calls, storage uploads, auth creation or real child/phone changes.
-- Canonical business assertions run as administrator, then authenticated + RLS.
-- This does NOT prove service-role submission; see the separate ServiceRole SQL
-- which reproduces its auth.users permission blocker without altering grants.
-- Any failure must abort the transaction; never continue to COMMIT.
begin;
set local statement_timeout='30s';
set local lock_timeout='3s';

do $test$
declare
 pilot constant uuid:='fad75b91-d2eb-4805-b5a3-c19e8a073bed';
 member constant uuid:='ab2eef13-604c-4c8f-9d14-f3da41cc5a81';
 qa uuid:=gen_random_uuid(); unrelated uuid:=gen_random_uuid();
 d1 uuid:=gen_random_uuid(); d2 uuid:=gen_random_uuid(); d3 uuid:=gen_random_uuid();
 d4 uuid:=gen_random_uuid(); d5 uuid:=gen_random_uuid(); hidden uuid:=gen_random_uuid();
 request_id uuid:=gen_random_uuid(); sha text:=md5(gen_random_uuid()::text)||md5(gen_random_uuid()::text);
 sha2 text:=md5(gen_random_uuid()::text)||md5(gen_random_uuid()::text);
 sha3 text:=md5(gen_random_uuid()::text)||md5(gen_random_uuid()::text);
 sha4 text:=md5(gen_random_uuid()::text)||md5(gen_random_uuid()::text);
 sha5 text:=md5(gen_random_uuid()::text)||md5(gen_random_uuid()::text);
 e1 uuid;e2 uuid;e3 uuid;e4 uuid;e5 uuid;result jsonb;replay jsonb;fields jsonb;
 tx text:='EQA'||replace(gen_random_uuid()::text,'-',''); n integer; stamp timestamptz;
begin
 if not exists(select 1 from public.perfil_lider where id=pilot)
    or not exists(select 1 from auth.users where id=member)
    or not exists(select 1 from public.filhos_de_santo where id='3666b777-1066-4eb7-a0c3-f63c2e01ae90' and user_id=member and (tenant_id=pilot or lider_id=pilot)) then
  raise exception 'Authorized pilot identity prerequisites do not match';end if;
 -- Do not alter the real member. These two QA children have NO contact channels.
 insert into public.filhos_de_santo(id,tenant_id,lider_id,user_id,nome,email,whatsapp_phone,status)
 values(qa,pilot,pilot,member,'QA-COMPROVANTE-ROLLBACK',null,null,'Ativo'),
       (unrelated,pilot,pilot,null,'QA-OUTRO-ROLLBACK',null,null,'Ativo');
 if exists(select 1 from public.filhos_de_santo where id in(qa,unrelated) and (nullif(whatsapp_phone,'') is not null or email is not null)) then
  raise exception 'QA fixture has a contact channel';end if;
 insert into public.financeiro(id,tenant_id,lider_id,filho_id,tipo,categoria,status,valor,data,data_vencimento,descricao)
 values(d1,pilot,pilot,qa,'entrada','Mensalidade','pendente',102,'1904-01-10','1904-01-10','QA (vencimento 1904-01-10)'),
       (d2,pilot,pilot,qa,'entrada','Mensalidade','pendente',102,'1904-02-10','1904-02-10','QA (vencimento 1904-02-10)'),
       (d3,pilot,pilot,qa,'entrada','Mensalidade','pendente',102,'1904-03-10','1904-03-10','QA (vencimento 1904-03-10)'),
       (d4,pilot,pilot,qa,'entrada','Mensalidade','pendente',102,'1904-04-10','1904-04-10','QA (vencimento 1904-04-10)'),
       (d5,pilot,pilot,qa,'entrada','Mensalidade','pendente',102,'1904-05-10','1904-05-10','QA (vencimento 1904-05-10)'),
       (hidden,pilot,pilot,unrelated,'entrada','Mensalidade','pendente',102,'1904-06-10','1904-06-10','QA outro membro');
 if exists(select 1 from pg_class where oid in('public.financeiro'::regclass,'public.mensalidade_comprovante_envios'::regclass,'public.mensalidade_comprovante_eventos'::regclass,'public.financeiro_comprovantes'::regclass) and not relrowsecurity) then
  raise exception 'Canonical table without RLS';end if;
 if not exists(select 1 from storage.buckets where id='mensalidade-comprovantes' and not public) then
  raise exception 'Receipt bucket is not private';end if;

 perform set_config('request.jwt.claims',jsonb_build_object('sub',pilot,'role','service_role')::text,true);
 result:=public.registrar_envio_comprovante(member,pilot,qa,d1,request_id,pilot||'/'||qa||'/'||request_id||'.png',sha,'image/png',128);
 e1:=(result->>'id')::uuid;stamp:=(result->>'created_at')::timestamptz;
 if result->>'status'<>'em_analise' or not exists(select 1 from public.financeiro where id=d1 and status='pendente' and data_pagamento is null) then
  raise exception 'Submission settled the debt';end if;
 if exists(select 1 from public.financeiro_comprovantes where financeiro_id=d1) then raise exception 'Submission created a settlement audit';end if;
 -- AI may describe a fully completed payment; it must NEVER perform settlement.
 update public.mensalidade_comprovante_envios set analysis_status='concluida',analysis=jsonb_build_object('valor',102,'estado_pagamento','concluido'),alerts='[]' where id=e1;
 replay:=public.registrar_envio_comprovante(member,pilot,qa,d1,request_id,pilot||'/'||qa||'/ignored.png',sha,'image/png',128);
 if (replay->>'replayed')::boolean is not true or replay->>'id'<>e1::text or (replay->>'created_at')::timestamptz<>stamp
    or not exists(select 1 from public.financeiro where id=d1 and status='pendente') then raise exception 'Replay or AI changed pending debt/timestamp';end if;
 begin perform public.registrar_envio_comprovante(member,pilot,qa,d1,request_id,pilot||'/'||qa||'/changed.png',sha2,'image/png',128);raise exception 'Request accepted a different hash';exception when unique_violation then null;end;
 begin perform public.registrar_envio_comprovante(member,pilot,qa,d2,gen_random_uuid(),pilot||'/'||qa||'/duplicate.png',sha,'image/png',128);raise exception 'Active duplicate hash accepted';exception when unique_violation then null;end;
 -- Unlike registration, the decision RPC must work with the real API DB role.
 execute 'set local role service_role';
 fields:=jsonb_build_object('valor',102,'data_pagamento','1904-02-29','beneficiario','Casa QA','id_transacao',tx,'confirmo_recebimento',true,'motivo','Crédito conferido');
 begin perform public.decidir_envio_comprovante(member,e1,'aceito',fields);raise exception 'Member decided own payment';exception when insufficient_privilege then null;end;
 begin perform public.decidir_envio_comprovante(pilot,e1,'aceito',fields||'{"valor":101.99}');raise exception 'Partial amount accepted';exception when invalid_parameter_value then null;end;
 begin perform public.decidir_envio_comprovante(pilot,e1,'aceito',fields||'{"valor":102.001}');raise exception 'Fractional cent accepted';exception when invalid_parameter_value then null;end;
 begin perform public.decidir_envio_comprovante(pilot,e1,'aceito',fields||jsonb_build_object('data_pagamento',(now() at time zone 'America/Sao_Paulo')::date+1));raise exception 'Future date accepted';exception when invalid_parameter_value then null;end;
 result:=public.decidir_envio_comprovante(pilot,e1,'aceito',fields);
 replay:=public.decidir_envio_comprovante(pilot,e1,'aceito',fields);
 if result->>'status'<>'aceito' or (replay->>'replayed')::boolean is not true then raise exception 'Acceptance/replay not confirmed';end if;
 if not exists(select 1 from public.financeiro where id=d1 and status='pago' and tipo='entrada' and valor=102 and data='1904-02-29' and data_pagamento='1904-02-29' and data_vencimento='1904-01-10' and filho_id=qa) then raise exception 'Cash/member payment dates, amount or linkage inconsistent';end if;
 select count(*) into n from public.financeiro_comprovantes where financeiro_id=d1;if n<>1 then raise exception 'Settlement audit missing or duplicated';end if;
 select count(*) into n from public.mensalidade_comprovante_eventos where envio_id=e1;if n<>2 then raise exception 'Acceptance events missing or duplicated';end if;
 if not exists(select 1 from public.mensalidade_comprovante_envios where id=e1 and created_at=stamp and decided_at>=created_at and decided_by=pilot) then raise exception 'Acceptance timestamps/actor invalid';end if;
 begin perform public.decidir_envio_comprovante(pilot,e1,'rejeitado','{"motivo":"Decisão antiga"}');raise exception 'Old rejection changed accepted payment';exception when unique_violation then null;end;
 execute 'reset role';
 begin perform public.registrar_envio_comprovante(member,pilot,qa,d2,gen_random_uuid(),pilot||'/'||qa||'/used.png',sha,'image/png',128);raise exception 'Accepted hash reused';exception when unique_violation then null;end;

 result:=public.registrar_envio_comprovante(member,pilot,qa,d2,gen_random_uuid(),pilot||'/'||qa||'/e2e.png',sha2,'image/png',128);e2:=(result->>'id')::uuid;
 begin perform public.decidir_envio_comprovante(pilot,e2,'aceito',fields||jsonb_build_object('id_transacao',lower(substr(tx,1,8))||'-'||substr(tx,9)));raise exception 'Duplicate normalized E2E accepted';exception when unique_violation then null;end;
 if not exists(select 1 from public.financeiro where id=d2 and status='pendente') or not exists(select 1 from public.mensalidade_comprovante_envios where id=e2 and status='em_analise') then raise exception 'Duplicate E2E partially settled';end if;
 result:=public.registrar_envio_comprovante(member,pilot,qa,d3,gen_random_uuid(),pilot||'/'||qa||'/reject.png',sha3,'image/png',128);e3:=(result->>'id')::uuid;
 begin perform public.decidir_envio_comprovante(pilot,e3,'rejeitado','{"motivo":""}');raise exception 'Rejection without reason accepted';exception when invalid_parameter_value then null;end;
 result:=public.decidir_envio_comprovante(pilot,e3,'rejeitado','{"motivo":"Agendado; crédito ausente"}');
 replay:=public.decidir_envio_comprovante(pilot,e3,'rejeitado','{"motivo":"Agendado; crédito ausente"}');
 if (replay->>'replayed')::boolean is not true or not exists(select 1 from public.financeiro where id=d3 and status='pendente' and data_pagamento is null)
    or exists(select 1 from public.financeiro_comprovantes where financeiro_id=d3) then raise exception 'Rejection affected cash or replay';end if;
 if not exists(select 1 from public.mensalidade_comprovante_envios where id=e3 and decided_at>=created_at and decided_by=pilot and decision_reason='Agendado; crédito ausente') then raise exception 'Rejection audit is incomplete';end if;
 begin perform public.decidir_envio_comprovante(pilot,e3,'aceito',fields);raise exception 'Stale acceptance changed rejection';exception when unique_violation then null;end;
 result:=public.registrar_envio_comprovante(member,pilot,qa,d4,gen_random_uuid(),pilot||'/'||qa||'/closed.png',sha4,'image/png',128);e4:=(result->>'id')::uuid;
 update public.financeiro set status='cancelado' where id=d4;
 if not exists(select 1 from public.mensalidade_comprovante_envios where id=e4 and status='encerrado') then raise exception 'Cancelled debt left an open review';end if;
 begin perform public.decidir_envio_comprovante(pilot,e4,'aceito',fields);raise exception 'Stale acceptance settled cancelled debt';exception when unique_violation then null;end;
 result:=public.registrar_envio_comprovante(member,pilot,qa,d5,gen_random_uuid(),pilot||'/'||qa||'/amount.png',sha5,'image/png',128);e5:=(result->>'id')::uuid;
 update public.financeiro set valor=103 where id=d5;
 begin perform public.decidir_envio_comprovante(pilot,e5,'aceito',fields);raise exception 'Stale amount accepted';exception when invalid_parameter_value then null;end;
 execute 'reset role';

 -- Authenticated clients get no direct proof/RPC write access. Member finance
 -- reads below MUST go through RLS; running them as postgres is not a proof.
 if has_function_privilege('authenticated','public.decidir_envio_comprovante(uuid,uuid,text,jsonb)','EXECUTE')
    or has_function_privilege('anon','public.decidir_envio_comprovante(uuid,uuid,text,jsonb)','EXECUTE')
    or has_function_privilege('authenticated','public.registrar_envio_comprovante(uuid,uuid,uuid,uuid,uuid,text,text,text,integer)','EXECUTE') then raise exception 'Canonical RPC exposed directly';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',member,'role','authenticated')::text,true);
 execute 'set local role authenticated';
 if not row_security_active('public.financeiro') then raise exception 'Member RLS is inactive';end if;
 select count(*) into n from public.financeiro where id=d1 and filho_id=qa and status='pago';if n<>1 then raise exception 'Member cannot see accepted payment under RLS';end if;
 select count(*) into n from public.financeiro where id=hidden;if n<>0 then raise exception 'Member sees unrelated child payment';end if;
 begin perform 1 from public.mensalidade_comprovante_envios where id=e1;raise exception 'Raw private receipt exposed';exception when insufficient_privilege then null;end;
 update public.financeiro set valor=999 where id=d1;get diagnostics n=row_count;if n<>0 then raise exception 'Member changed own accepted payment';end if;
 execute 'reset role';
 perform set_config('request.jwt.claims',jsonb_build_object('sub',pilot,'role','authenticated')::text,true);
 execute 'set local role authenticated';
 if not row_security_active('public.financeiro') then raise exception 'Leader RLS is inactive';end if;
 select count(*) into n from public.financeiro where id=d1 and status='pago' and tipo='entrada';if n<>1 then raise exception 'Leader cash does not see accepted receipt';end if;
 execute 'reset role';
end $test$;
rollback;
select 'passed' as pilot_receipt_flow, 'all QA fixtures rolled back; no external calls' as persistence;
