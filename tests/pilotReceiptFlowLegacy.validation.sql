-- Regression for the corrected legacy monthly-charge acceptance flow.
-- Privileged canonical setup; member visibility checked as authenticated + RLS.
begin;
set local statement_timeout='30s';
set local lock_timeout='3s';
do $test$
declare pilot constant uuid:='fad75b91-d2eb-4805-b5a3-c19e8a073bed';
 member constant uuid:='ab2eef13-604c-4c8f-9d14-f3da41cc5a81';
 qa uuid:=gen_random_uuid();debt uuid:=gen_random_uuid();request_id uuid:=gen_random_uuid();receipt uuid;result jsonb;n integer;
begin
 if not exists(select 1 from public.perfil_lider where id=pilot) or not exists(select 1 from auth.users where id=member) then raise exception 'Pilot prerequisites missing';end if;
 insert into public.filhos_de_santo(id,tenant_id,lider_id,user_id,nome,email,whatsapp_phone,status)
 values(qa,pilot,pilot,member,'QA-RECEIPT-LEGACY-DIAGNOSTIC-ROLLBACK',null,null,'Ativo');
 insert into public.financeiro(id,tenant_id,lider_id,filho_id,tipo,categoria,status,valor,data,data_vencimento,descricao)
 values(debt,pilot,pilot,null,'entrada','Mensalidade','pendente',102,'1907-01-10','1907-01-10',
  'Mensalidade histórica (+ 2%: R$ 2.00 juros/multa) (vencimento 1907-01-10) (ID:'||qa||')');
 result:=public.registrar_envio_comprovante(member,pilot,qa,debt,request_id,pilot||'/'||qa||'/'||request_id||'.png',md5(request_id::text)||md5(debt::text),'image/png',128);
 receipt:=(result->>'id')::uuid;
 perform public.decidir_envio_comprovante(pilot,receipt,'aceito',jsonb_build_object('valor',102,'data_pagamento','1907-02-03','beneficiario','Casa QA','id_transacao','EQA'||replace(request_id::text,'-',''),'confirmo_recebimento',true,'motivo','Crédito conferido manualmente'));
 if not exists(select 1 from public.financeiro where id=debt and status='pago' and filho_id=qa
  and descricao like '%juros/multa%' and descricao like '%(competência 1907-01-10)%') then
  raise exception 'Legacy child link, competence or fee metadata was lost';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',member,'role','authenticated')::text,true);
 execute 'set local role authenticated';
 if not row_security_active('public.financeiro') then raise exception 'Member RLS inactive';end if;
 select count(*) into n from public.financeiro where id=debt;if n<>1 then raise exception 'Accepted legacy payment is hidden from the member';end if;
 execute 'reset role';
end $test$;
rollback;
select 'passed' as pilot_receipt_legacy_regression, 'all QA fixtures rolled back' as persistence;
