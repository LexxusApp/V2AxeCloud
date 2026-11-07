-- Diagnostic regression: currently reproduces the production submission blocker.
-- No grants/schema changes. QA has no phone or email. All fixtures roll back.
-- A "blocked_auth_users" result is NOT an end-to-end success.
begin;
set local statement_timeout='30s';
set local lock_timeout='3s';
do $test$
declare pilot constant uuid:='fad75b91-d2eb-4805-b5a3-c19e8a073bed';
 member constant uuid:='ab2eef13-604c-4c8f-9d14-f3da41cc5a81';
 qa uuid:=gen_random_uuid();debt uuid:=gen_random_uuid();request_id uuid:=gen_random_uuid();message text;
begin
 if not exists(select 1 from public.perfil_lider where id=pilot) or not exists(select 1 from auth.users where id=member) then raise exception 'Pilot prerequisites missing';end if;
 insert into public.filhos_de_santo(id,tenant_id,lider_id,user_id,nome,email,whatsapp_phone,status)
 values(qa,pilot,pilot,member,'QA-RECEIPT-SERVICE-ROLE-ROLLBACK',null,null,'Ativo');
 insert into public.financeiro(id,tenant_id,lider_id,filho_id,tipo,categoria,status,valor,data,data_vencimento,descricao)
 values(debt,pilot,pilot,qa,'entrada','Mensalidade','pendente',102,'1906-01-10','1906-01-10','QA service-role rollback');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',pilot,'role','service_role')::text,true);
 execute 'set local role service_role';
 begin
  perform public.registrar_envio_comprovante(member,pilot,qa,debt,request_id,pilot||'/'||qa||'/'||request_id||'.png',md5(request_id::text)||md5(debt::text),'image/png',128);
  raise exception 'Blocker no longer reproduces; review this diagnostic before reporting success';
 exception when insufficient_privilege then
  get stacked diagnostics message=message_text;
  if message<>'permission denied for table users' then raise;end if;
 end;
 execute 'reset role';
 if exists(select 1 from public.mensalidade_comprovante_envios where financeiro_id=debt) then raise exception 'Failed submission left a receipt';end if;
end $test$;
rollback;
select 'blocked_auth_users' as service_role_submission, 'diagnosed; no access grants changed; all QA rolled back' as persistence;
