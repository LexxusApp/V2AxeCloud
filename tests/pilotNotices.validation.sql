begin;
-- No HTTP calls, jobs or notifications. Execute only after migration review.
-- All fixtures, membership changes and notice operations roll back together.
do $test$
declare owner_id uuid:='fad75b91-d2eb-4805-b5a3-c19e8a073bed';member_auth uuid:='ab2eef13-604c-4c8f-9d14-f3da41cc5a81';
 child_id uuid:='3666b777-1066-4eb7-a0c3-f63c2e01ae90';other_child uuid:=gen_random_uuid();outsider uuid:=gen_random_uuid();
 draft_id uuid:=gen_random_uuid();selected_id uuid:=gen_random_uuid();all_id uuid:=gen_random_uuid();expired_id uuid:=gen_random_uuid();other_id uuid:=gen_random_uuid();
 payload jsonb;result jsonb;listing jsonb;claim jsonb;receipt jsonb;request_key uuid:=gen_random_uuid();n integer;original_count integer;rev bigint;
begin
 select count(*) into original_count from public.mural_avisos where tenant_id=owner_id;
 if not exists(select 1 from public.filhos_de_santo where id=child_id and user_id=member_auth and tenant_id=owner_id) then
  raise exception 'Pilot member fixture is unavailable';end if;
 insert into public.filhos_de_santo(id,tenant_id,lider_id,nome,email,status,whatsapp_phone)
 values(other_child,owner_id,owner_id,'PILOT-NOTICE-ROLLBACK-FIXTURE','pilot-notice-fixture@example.invalid','Ativo','11900000000');
 update public.filhos_de_santo set status='Ativo',whatsapp_phone='11900000000' where id=child_id;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated')::text,true);
 execute 'set local role authenticated';
 payload:=jsonb_build_object('id',draft_id,'title','Private draft','body','Private technical fixture only','status','draft','audience','selected',
  'memberIds',jsonb_build_array(child_id),'giraId','','category','Doutrina','expires','');
 result:=public.piloto_comunicados_salvar(owner_id,payload,null);
 if result->>'status'<>'draft' or result->>'publishedAt'<>'' or (result->>'revision')::bigint<>1 then raise exception 'Draft was not private/unpublished';end if;
 result:=public.piloto_comunicados_salvar(owner_id,payload,null);
 if (result->>'revision')::bigint<>1 then raise exception 'Lost-response save retry changed revision';end if;
 begin perform public.piloto_comunicados_salvar(owner_id,payload||jsonb_build_object('body','Changed stale content'),9);
  raise exception 'Stale edit accepted';exception when unique_violation then null;end;
 begin perform public.piloto_comunicados_salvar(owner_id,payload||jsonb_build_object('memberIds',jsonb_build_array(gen_random_uuid())),1);
  raise exception 'Foreign recipient accepted';exception when invalid_parameter_value then null;end;
 begin perform public.piloto_comunicados_salvar(owner_id,payload||jsonb_build_object('giraId',gen_random_uuid()),1);
  raise exception 'Foreign gira accepted';exception when invalid_parameter_value then null;end;
 begin perform public.piloto_comunicados_salvar(owner_id,payload||jsonb_build_object('expires','2026-02-30'),1);
  raise exception 'Invalid calendar date accepted';exception when invalid_parameter_value then null;end;
 begin perform public.piloto_comunicados_salvar(outsider,payload,null);
  raise exception 'Foreign tenant accepted';exception when insufficient_privilege then null;end;
 payload:=payload||jsonb_build_object('id',selected_id,'status','published','expires',((now() at time zone 'America/Sao_Paulo')::date+1)::text);
 result:=public.piloto_comunicados_salvar(owner_id,payload,null);
 if nullif(result->>'publishedAt','') is null then raise exception 'Published timestamp absent';end if;
 perform public.piloto_comunicados_salvar(owner_id,payload||jsonb_build_object('id',all_id,'audience','all','memberIds','[]'::jsonb),null);
 perform public.piloto_comunicados_salvar(owner_id,payload||jsonb_build_object('id',expired_id,'expires',((now() at time zone 'America/Sao_Paulo')::date-1)::text),null);
 perform public.piloto_comunicados_salvar(owner_id,payload||jsonb_build_object('id',other_id,'memberIds',jsonb_build_array(other_child)),null);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',member_auth,'role','authenticated')::text,true);
 listing:=public.piloto_comunicados_listar(owner_id);
 select count(*) into n from jsonb_array_elements(listing->'data') x where x->>'id' in (draft_id::text,expired_id::text,other_id::text);
 if n<>0 then raise exception 'Member saw draft, expired notice or another audience';end if;
 select count(*) into n from jsonb_array_elements(listing->'data') x where x->>'id' in (selected_id::text,all_id::text);
 if n<>2 then raise exception 'Intended member did not see selected/all notices';end if;
 if exists(select 1 from jsonb_array_elements(listing->'data') x where x ? 'memberIds' or x ? 'deliveryCounts') then raise exception 'Member received private audience/delivery metadata';end if;
 select count(*) into n from public.piloto_comunicados;if n<>0 then raise exception 'Member read raw private table';end if;
 select count(*) into n from public.piloto_comunicados_envios;if n<>0 then raise exception 'Member read delivery table';end if;
 begin perform public.piloto_comunicados_salvar(owner_id,payload,null);raise exception 'Member wrote a notice';exception when insufficient_privilege then null;end;
 begin perform public.piloto_comunicados_iniciar_envio(owner_id,selected_id,1,request_key);raise exception 'Member started a send';exception when insufficient_privilege then null;end;
 begin insert into public.piloto_comunicados(id,tenant_id,dados) values(gen_random_uuid(),owner_id,payload);raise exception 'Raw write bypassed RPC';exception when insufficient_privilege then null;end;
 execute 'reset role';update public.filhos_de_santo set status='Inativo' where id=child_id;execute 'set local role authenticated';
 begin perform public.piloto_comunicados_listar(owner_id);raise exception 'Inactive pilot retained access';exception when insufficient_privilege then null;end;
 execute 'reset role';update public.filhos_de_santo set status='Ativo' where id=child_id;execute 'set local role authenticated';
 perform set_config('request.jwt.claims',jsonb_build_object('sub',outsider,'role','authenticated')::text,true);
 begin perform public.piloto_comunicados_listar(owner_id);raise exception 'Other authenticated account retained access';exception when insufficient_privilege then null;end;
 select count(*) into n from public.piloto_comunicados;if n<>0 then raise exception 'Other account read raw notices';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated')::text,true);
 result:=public.piloto_comunicados_excluir(owner_id,selected_id,1);rev:=(result->>'revision')::bigint;
 if rev<>2 then raise exception 'Deletion did not increment revision';end if;
 result:=public.piloto_comunicados_excluir(owner_id,selected_id,1);if (result->>'revision')::bigint<>2 then raise exception 'Delete retry was not idempotent';end if;
 begin perform public.piloto_comunicados_restaurar(owner_id,selected_id,1);raise exception 'Stale undo accepted';exception when unique_violation then null;end;
 result:=public.piloto_comunicados_restaurar(owner_id,selected_id,rev);
 if (result->>'revision')::bigint<>3 or result->>'delivery'<>'none' then raise exception 'Undo changed delivery or incorrect revision';end if;
 result:=public.piloto_comunicados_restaurar(owner_id,selected_id,rev);if (result->>'revision')::bigint<>3 then raise exception 'Undo retry duplicated';end if;
 claim:=public.piloto_comunicados_iniciar_envio(owner_id,selected_id,3,request_key);
 if (claim->>'send')::boolean is not true or claim->'recipients'<>jsonb_build_array(child_id) then raise exception 'Selected active send audience incorrect';end if;
 result:=public.piloto_comunicados_iniciar_envio(owner_id,selected_id,3,gen_random_uuid());if (result->>'send')::boolean is not false then raise exception 'New key repeated campaign';end if;
 receipt:=public.piloto_comunicados_assumir_destinatario(owner_id,selected_id,3,child_id,request_key);
 if (receipt->>'send')::boolean is not true or receipt->'payload'->>'filhoId'<>child_id::text then raise exception 'Recipient claim unconfirmed';end if;
 result:=public.piloto_comunicados_assumir_destinatario(owner_id,selected_id,3,child_id,request_key);if (result->>'send')::boolean is not false then raise exception 'Recipient claimed twice';end if;
 begin perform public.piloto_comunicados_finalizar_envio(owner_id,selected_id,3,child_id,gen_random_uuid(),'confirmed','mock',null);
  raise exception 'Wrong attempt finalized';exception when insufficient_privilege then null;end;
 perform public.piloto_comunicados_finalizar_envio(owner_id,selected_id,3,child_id,(receipt->>'attempt')::uuid,'uncertain',null,'Technical lost-response fixture');
 result:=public.piloto_comunicados_iniciar_envio(owner_id,selected_id,3,gen_random_uuid());if (result->>'send')::boolean is not false then raise exception 'Uncertain delivery was retried';end if;
 -- Recheck activity at the per-recipient claim, after campaign creation.
 claim:=public.piloto_comunicados_iniciar_envio(owner_id,other_id,1,request_key);
 execute 'reset role';update public.filhos_de_santo set status='Inativo' where id=other_child;execute 'set local role authenticated';
 result:=public.piloto_comunicados_assumir_destinatario(owner_id,other_id,1,other_child,request_key);if (result->>'send')::boolean is not false then raise exception 'Inactive recipient was sent a message';end if;
 execute 'reset role';execute 'set local role anon';
 begin perform public.piloto_comunicados_listar(owner_id);raise exception 'Anonymous called notice RPC';exception when insufficient_privilege then null;end;
 begin select count(*) into n from public.piloto_comunicados;raise exception 'Anonymous read private table';exception when insufficient_privilege then null;end;
 execute 'reset role';
 if (select count(*) from public.mural_avisos where tenant_id=owner_id)<>original_count then raise exception 'Legacy table was modified';end if;
end $test$;
rollback;
select 'passed' as pilot_notices_validation,'fixtures rolled back; no external sends; legacy mural unchanged' as persistence;
