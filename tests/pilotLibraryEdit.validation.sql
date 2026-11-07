-- PROPOSTA para revisão. Não executado no projeto remoto.
-- Rodar somente após revisar/aplicar a migration 20261103130000.
-- Testa metadados, locks/constraints e RLS; os objetos abaixo são fixtures de
-- catálogo, não arquivos reais. A validação HTTP do Storage continua necessária.
begin;
do $test$
declare v_owner uuid:='fad75b91-d2eb-4805-b5a3-c19e8a073bed';
 member_auth uuid:='ab2eef13-604c-4c8f-9d14-f3da41cc5a81';
 child_id uuid:='3666b777-1066-4eb7-a0c3-f63c2e01ae90';
 a uuid:=gen_random_uuid();b uuid:=gen_random_uuid();c uuid:=gen_random_uuid();d uuid:=gen_random_uuid();
 comment_id uuid:=gen_random_uuid();other_child uuid:=gen_random_uuid();other_actor uuid:=gen_random_uuid();
 result jsonb;n integer;original_count integer;op text;
begin
 if not exists(select 1 from public.filhos_de_santo where id=child_id and user_id=member_auth
  and tenant_id=v_owner and lower(status::text) in ('ativo','active')) then
  raise exception 'Validação exige o membro piloto ativo com vínculo exato';end if;
 select count(*) into original_count from public.biblioteca where tenant_id=v_owner;
 insert into public.filhos_de_santo(id,tenant_id,lider_id,nome,status)
 values(other_child,v_owner,v_owner,'VALIDACAO-REVISAO-ROLLBACK','Ativo');
 insert into storage.objects(bucket_id,name,metadata)
 select 'piloto_biblioteca_privada',v_owner::text||'/private/'||id::text||'.pdf',
  jsonb_build_object('mimetype','application/pdf','size',8) from unnest(array[a,b,c]) ids(id);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',v_owner,'role','authenticated')::text,true);
 execute 'set local role authenticated';
 result:=public.piloto_revisar_pdf(null,a,child_id,'individual','Revision A','','Fundamentos',repeat('a',64),8);
 if result->>'id'<>a::text then raise exception 'Creation unconfirmed';end if;
 begin update public.piloto_biblioteca_privada set titulo='Unsafe edit' where id=a;
  raise exception 'Direct metadata edit allowed';exception when insufficient_privilege then null;end;
 perform public.piloto_comentar_pdf(a,comment_id,'Comment belongs only to A');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',member_auth,'role','authenticated')::text,true);
 if not public.piloto_pode_ler_pdf(a) then raise exception 'Intended member cannot read A';end if;
 select count(*) into n from public.piloto_biblioteca_comentarios where material_id=a;
 if n<>1 then raise exception 'Original comment unavailable';end if;
 begin perform public.piloto_revisar_pdf(a,b,child_id,'individual','Member write','','Fundamentos',repeat('b',64),8);
  raise exception 'Member revised PDF';exception when insufficient_privilege then null;end;
 -- Signing and copying are separate Storage operations; SELECT for a download
 -- must not silently grant any of them, even for an authorized recipient.
 foreach op in array array['object.sign','storage.object.sign_many','object.copy','s3.object.get','object.list'] loop
  perform set_config('storage.operation',op,true);
  select count(*) into n from storage.objects where bucket_id='piloto_biblioteca_privada' and name=v_owner::text||'/private/'||a::text||'.pdf';
  if n<>0 then raise exception 'Unsafe storage operation allowed: %',op;end if;
 end loop;
 perform set_config('storage.operation','object.get_authenticated',true);
 select count(*) into n from storage.objects where bucket_id='piloto_biblioteca_privada' and name=v_owner::text||'/private/'||a::text||'.pdf';
 if n<>1 then raise exception 'Authenticated storage download denied';end if;
 -- A failed switch must roll back retirement as well as insertion.
 perform set_config('request.jwt.claims',jsonb_build_object('sub',v_owner,'role','authenticated')::text,true);
 begin perform public.piloto_revisar_pdf(a,d,other_child,'individual','Missing PDF','','Fundamentos',repeat('d',64),8);
  raise exception 'Unstored revision accepted';exception when unique_violation then null;end;
 if exists(select 1 from public.piloto_biblioteca_privada where id=a and retired_at is not null) then raise exception 'Failed edit retired original';end if;
 result:=public.piloto_revisar_pdf(a,b,other_child,'individual','Revision B','','Fundamentos',repeat('b',64),8);
 if result->>'previous_id'<>a::text then raise exception 'Wrong revision lineage';end if;
 result:=public.piloto_revisar_pdf(a,b,other_child,'individual','Revision B','','Fundamentos',repeat('b',64),8);
 if (result->>'replayed')::boolean is not true then raise exception 'Retry duplicated revision';end if;
 begin perform public.piloto_revisar_pdf(a,b,child_id,'individual','Changed retry','','Fundamentos',repeat('b',64),8);
  raise exception 'Retry changed recipient';exception when unique_violation then null;end;
 begin perform public.piloto_revisar_pdf(a,c,null,'casa','Stale edit','','Fundamentos',repeat('c',64),8);
  raise exception 'Stale revision accepted';exception when unique_violation then null;end;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',member_auth,'role','authenticated')::text,true);
 if public.piloto_pode_ler_pdf(a) or public.piloto_pode_ler_pdf(b) then raise exception 'Former recipient retains authenticated access';end if;
 select count(*) into n from public.piloto_biblioteca_comentarios where material_id in (a,b);
 if n<>0 then raise exception 'Former recipient sees retired comments';end if;
 select count(*) into n from storage.objects where bucket_id='piloto_biblioteca_privada' and name in (v_owner::text||'/private/'||a::text||'.pdf',v_owner::text||'/private/'||b::text||'.pdf');
 if n<>0 then raise exception 'Former recipient reads old or new object';end if;
 begin perform public.piloto_comentar_pdf(a,gen_random_uuid(),'Retired');
  raise exception 'Member commented on retired material';exception when insufficient_privilege then null;end;
 -- Releasing the latest version to the house still keeps all older discussion private.
 perform set_config('request.jwt.claims',jsonb_build_object('sub',v_owner,'role','authenticated')::text,true);
 perform public.piloto_revisar_pdf(b,c,null,'casa','Revision C','','Fundamentos',repeat('c',64),8);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',member_auth,'role','authenticated')::text,true);
 if not public.piloto_pode_ler_pdf(c) then raise exception 'Pilot member cannot read house revision';end if;
 select count(*) into n from public.piloto_biblioteca_comentarios where material_id in(a,b,c);
 if n<>0 then raise exception 'New audience sees previous comments';end if;
 result:=public.piloto_comentar_pdf(c,gen_random_uuid(),'Comment on C');
 select count(*) into n from public.piloto_biblioteca_comentarios where material_id=c and author_id=member_auth and author_name<>'Membro';
 if n<>1 then raise exception 'House discussion lost member identity';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',other_actor,'role','authenticated')::text,true);
 if public.piloto_pode_ler_pdf(c) then raise exception 'House scope expanded pilot allowlist';end if;
 execute 'reset role';
 -- Simulate even a privileged attempt to change historical content in place.
 begin update public.piloto_biblioteca_privada set destinatario=child_id where id=b;
  raise exception 'Privileged mutation changed immutable version';exception when check_violation then null;end;
 update public.filhos_de_santo set status='Inativo' where id=child_id;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',member_auth,'role','authenticated')::text,true);
 execute 'set local role authenticated';
 if public.piloto_pode_ler_pdf(c) then raise exception 'Inactive pilot can read house revision';end if;
 execute 'reset role';execute 'set local role anon';
 begin perform public.piloto_biblioteca_revisoes_disponiveis();raise exception 'Anonymous revision RPC allowed';exception when insufficient_privilege then null;end;
 select count(*) into n from storage.objects where bucket_id='piloto_biblioteca_privada' and name=v_owner::text||'/private/'||c::text||'.pdf';
 if n<>0 then raise exception 'Anonymous storage read allowed';end if;
 execute 'reset role';
 if (select count(*) from public.biblioteca where tenant_id=v_owner)<>original_count then raise exception 'Legacy acervo was modified';end if;
end $test$;
rollback;
select 'passed; all fixtures rolled back' as pilot_library_edit_validation;
