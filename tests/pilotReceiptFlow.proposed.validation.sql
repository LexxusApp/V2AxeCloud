-- Regression for pilotReceiptFlowMigration.proposed.sql AFTER principal review.
-- Never apply that proposal merely to make this test pass. No real child changed.
begin;
set local statement_timeout='30s';
set local lock_timeout='3s';
do $test$
declare pilot constant uuid:='fad75b91-d2eb-4805-b5a3-c19e8a073bed';
 member constant uuid:='ab2eef13-604c-4c8f-9d14-f3da41cc5a81';
 child_id uuid:=gen_random_uuid();debt uuid:=gen_random_uuid();request_id uuid:=gen_random_uuid();
 sha text:=md5(gen_random_uuid()::text)||md5(gen_random_uuid()::text);receipt uuid;result jsonb;fields jsonb;n integer;
begin
 if to_regprocedure('public.piloto_preservar_cobranca_comprovante()') is null
    or to_regprocedure('public.piloto_registrar_envio_comprovante(uuid,uuid,uuid,uuid,uuid,text,text,text,integer)') is null then
  raise exception 'Proposal not installed: legacy linkage/fee regression remains pending review';end if;
 if not exists(select 1 from public.perfil_lider where id=pilot) or not exists(select 1 from auth.users where id=member) then raise exception 'Pilot prerequisites missing';end if;
 insert into public.filhos_de_santo(id,tenant_id,lider_id,user_id,nome,email,whatsapp_phone,status)
 values(child_id,pilot,pilot,member,'QA-LEGACY-RECEIPT-ROLLBACK',null,null,'Ativo');
 insert into public.financeiro(id,tenant_id,lider_id,filho_id,tipo,categoria,status,valor,data,data_vencimento,descricao)
 values(debt,pilot,pilot,null,'entrada','Mensalidade','pendente',102,'1905-01-10','1905-01-10',
  'Mensalidade histórica (+ 2%: R$ 2.00 juros/multa) (vencimento 1905-01-10) (ID:'||child_id||')');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',pilot,'role','service_role')::text,true);execute 'set local role service_role';
 -- The pilot bridge must reject QA/other children; its happy path is reserved
 -- for the real authorized member's UI test by the principal, never this SQL.
 begin perform public.piloto_registrar_envio_comprovante(member,pilot,child_id,debt,request_id,pilot||'/'||child_id||'/'||request_id||'.png',sha,'image/png',128);raise exception 'Pilot bridge accepted a non-allowlisted QA child';exception when insufficient_privilege then null;end;
 execute 'reset role';
 -- Privileged canonical fixture setup avoids granting service_role auth.users.
 result:=public.registrar_envio_comprovante(member,pilot,child_id,debt,request_id,pilot||'/'||child_id||'/'||request_id||'.png',sha,'image/png',128);
 receipt:=(result->>'id')::uuid;
 fields:=jsonb_build_object('valor',102,'data_pagamento','1905-02-03','beneficiario','Casa QA','id_transacao','EQA'||replace(request_id::text,'-',''),'confirmo_recebimento',true,'motivo','Crédito e juros conferidos');
 perform public.decidir_envio_comprovante(pilot,receipt,'aceito',fields);
 if not exists(select 1 from public.financeiro where id=debt and filho_id=child_id and valor=102 and data_vencimento='1905-01-10' and data_pagamento='1905-02-03'
  and descricao like '%2.00 juros/multa%' and descricao like '%(competência 1905-01-10)%') then raise exception 'Legacy RLS link, fees or historical dates lost';end if;
 execute 'reset role';
 perform set_config('request.jwt.claims',jsonb_build_object('sub',member,'role','authenticated')::text,true);execute 'set local role authenticated';
 if not row_security_active('public.financeiro') then raise exception 'Member RLS is inactive';end if;
 select count(*) into n from public.financeiro where id=debt and status='pago' and filho_id=child_id;if n<>1 then raise exception 'Legacy accepted payment hidden from member';end if;
 execute 'reset role';
 perform set_config('request.jwt.claims',jsonb_build_object('sub',pilot,'role','authenticated')::text,true);execute 'set local role authenticated';
 -- Accepted-proof reversal remains intentionally blocked, even if manual=true.
 update public.financeiro set lancamento_manual=true where id=debt;
 begin perform public.piloto_reabrir_mensalidade(pilot,debt,'1905-02-03',102,gen_random_uuid());raise exception 'Accepted-proof reversal guard bypassed';exception when unique_violation then null;end;
 if has_function_privilege('authenticated','public.piloto_preservar_cobranca_comprovante()','EXECUTE') or has_function_privilege('anon','public.piloto_preservar_cobranca_comprovante()','EXECUTE') then raise exception 'Trigger-only helper exposed';end if;
 if has_function_privilege('authenticated','public.piloto_registrar_envio_comprovante(uuid,uuid,uuid,uuid,uuid,text,text,text,integer)','EXECUTE') or has_function_privilege('anon','public.piloto_registrar_envio_comprovante(uuid,uuid,uuid,uuid,uuid,text,text,text,integer)','EXECUTE') then raise exception 'Service-only pilot bridge exposed';end if;
 execute 'reset role';
end $test$;
rollback;
select 'passed' as pilot_receipt_legacy_regression, 'all QA fixtures rolled back' as persistence;
