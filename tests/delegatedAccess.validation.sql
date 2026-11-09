-- Execute after the refinement DDL, in the same transaction. Always rollback.
do $test$
declare owner_id uuid:='fad75b91-d2eb-4805-b5a3-c19e8a073bed';
 child_id uuid:='3666b777-1066-4eb7-a0c3-f63c2e01ae90';member_id uuid;other_tenant uuid;
 r jsonb;rights jsonb;entry jsonb;m text; n int;
 other_child uuid;other_member uuid;stock_id uuid:=gen_random_uuid();pdf_id uuid:=gen_random_uuid();
begin
 select user_id into strict member_id from public.filhos_de_santo where id=child_id and tenant_id=owner_id;
 select id into other_tenant from public.perfil_lider where id<>owner_id and coalesce(tenant_id,id)=id limit 1;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated')::text,true);
 execute 'set local role authenticated';
 begin perform public.piloto_salvar_permissoes_coadministrador(owner_id,child_id,'{"finance":null}',true);raise exception 'NULL right accepted';exception when invalid_parameter_value then null;end;
 begin perform public.piloto_salvar_permissoes_coadministrador(owner_id,child_id,'{"owner":"gerenciar"}',true);raise exception 'Unknown right accepted';exception when invalid_parameter_value then null;end;
 begin perform public.piloto_salvar_permissoes_coadministrador(owner_id,child_id,'{}',true);raise exception 'Empty grant accepted';exception when invalid_parameter_value then null;end;
 foreach m in array array['members','giras','finance','cantina','inventory','communications','gallery','library','store','radar'] loop
  rights:=jsonb_build_object(m,'visualizar');
  perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated')::text,true);
  r:=public.piloto_salvar_permissoes_coadministrador(owner_id,child_id,rights,true);
  if r->'permissoes'<>rights then raise exception 'Permissions not saved';end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',member_id,'role','authenticated')::text,true);
  if not public.piloto_tem_permissao(owner_id,member_id,m,'visualizar') then raise exception 'Granted module denied: %',m;end if;
  if public.piloto_tem_permissao(owner_id,member_id,m,'gerenciar') then raise exception 'Read elevated to write: %',m;end if;
  if public.piloto_tem_permissao(other_tenant,member_id,m,'visualizar') then raise exception 'Cross-tenant right';end if;
  if public.piloto_zelador_ativo(owner_id) then raise exception 'Delegate became titular owner';end if;
  begin perform public.piloto_listar_coadministradores(owner_id);raise exception 'Delegate listed team grants';exception when insufficient_privilege then null;end;
  begin perform public.piloto_salvar_permissoes_coadministrador(owner_id,child_id,'{"finance":"gerenciar"}',true);raise exception 'Delegate escalated own rights';exception when insufficient_privilege then null;end;
  if m='finance' then
   r:=public.piloto_referencias_membros(owner_id);
   for entry in select * from jsonb_array_elements(r) loop
    if entry ?| array['cpf','email','telefone','notas_sigilosas','orixa_frente','user_id'] then raise exception 'Sensitive profile data in references';end if;
   end loop;
   update public.financeiro set valor=valor where tenant_id=owner_id and filho_id is distinct from child_id;
   get diagnostics n=row_count;
   if n<>0 then raise exception 'Read-only delegate mutated financial rows';end if;
  end if;
  if m='cantina' then
   r:=public.piloto_cantina_lancamentos(owner_id);
   for entry in select * from jsonb_array_elements(r) loop
    if entry->>'categoria'<>'Cantina' or coalesce(entry->>'tenant_id',entry->>'lider_id')<>owner_id::text then raise exception 'Cantina exposed unrelated financial data';end if;
   end loop;
   begin perform public.piloto_credito_loja(owner_id);raise exception 'Cantina obtained store credit data';exception when insufficient_privilege then null;end;
  end if;
  if m='store' then
   r:=public.piloto_credito_loja(owner_id);
   for entry in select value from jsonb_each(r) loop
    if (select count(*) from jsonb_object_keys(entry))<>3 or not entry ?& array['limitCents','blocked','outstandingCents'] then raise exception 'Store credit exposed unrelated fields';end if;
   end loop;
   begin perform public.piloto_cantina_lancamentos(owner_id);raise exception 'Store obtained full Cantina ledger';exception when insufficient_privilege then null;end;
  end if;
 end loop;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated')::text,true);
 perform public.piloto_salvar_permissoes_coadministrador(owner_id,child_id,'{"finance":"gerenciar"}',true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',member_id,'role','authenticated')::text,true);
 if not public.piloto_tem_permissao(owner_id,member_id,'finance','gerenciar') then raise exception 'Write grant denied';end if;
 execute 'reset role';
 update public.filhos_de_santo set status='Inativo' where id=child_id;
 execute 'set local role authenticated';
 if public.piloto_tem_permissao(owner_id,member_id,'finance','gerenciar') then raise exception 'Inactive member retained access';end if;
 execute 'reset role';
 update public.filhos_de_santo set status='Ativo' where id=child_id;
 execute 'set local role authenticated';
 perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated')::text,true);
 perform public.piloto_definir_coadministrador(owner_id,child_id,false);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',member_id,'role','authenticated')::text,true);
 if public.piloto_tem_permissao(owner_id,member_id,'finance','visualizar') then raise exception 'Revoked right remains active';end if;
 select count(*) into n from public.filhos_de_santo where id=child_id;
 if n<>1 then raise exception 'Revocation removed personal member access';end if;
 execute 'reset role';
 -- Exercise a real module write and its canonical tenant, without persisting it.
 perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated')::text,true);
 execute 'set local role authenticated';
 perform public.piloto_salvar_permissoes_coadministrador(owner_id,child_id,'{"inventory":"gerenciar","library":"gerenciar","radar":"visualizar"}',true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',member_id,'role','authenticated')::text,true);
 r:=public.piloto_salvar_estoque(owner_id,stock_id,jsonb_build_object('name','VALIDACAO COADMIN ROLLBACK','category','Rituais','unit','un.','quantity',1000,'minimum',0),null,
 jsonb_build_object('id',gen_random_uuid(),'kind','initial','note','Validação com rollback','itemId',stock_id,'unit','un.','before',0,'after',1000));
 if r->>'id'<>stock_id::text then raise exception 'Inventory write not confirmed';end if;
 r:=public.piloto_radar_ler(owner_id);
 if public.piloto_biblioteca_gestor_tenant()<>owner_id then raise exception 'Library confused actor and tenant';end if;
 execute 'reset role';
 if not exists(select 1 from public.almoxarifado where id=stock_id and lider_id=owner_id and tenant_id=owner_id) then raise exception 'Inventory assigned to member instead of house';end if;
 insert into storage.objects(bucket_id,name,metadata) values('piloto_biblioteca_privada',owner_id::text||'/private/'||pdf_id::text||'.pdf','{"mimetype":"application/pdf","size":10}');
 execute 'set local role authenticated';
 r:=public.piloto_revisar_pdf(null,pdf_id,null,'casa','VALIDACAO COADMIN ROLLBACK','','Fundamentos',repeat('a',64),10);
 if r->>'id'<>pdf_id::text or not public.piloto_pode_ler_pdf(pdf_id) then raise exception 'Library delegated publication failed';end if;
 execute 'reset role';
 -- Also prove that the same flow works outside the original pilot tenant.
 select f.id,f.user_id,f.tenant_id into other_child,other_member,other_tenant from public.filhos_de_santo f
 join public.perfil_lider p on p.id=f.tenant_id where f.tenant_id<>owner_id and f.user_id is not null and f.user_id<>f.tenant_id
 and lower(btrim(coalesce(f.status,''))) in ('ativo','active') and coalesce((to_jsonb(p)->>'is_blocked')::boolean,false)=false
 and nullif(to_jsonb(p)->>'deleted_at','') is null limit 1;
 if other_child is null then raise exception 'No second active house available for validation';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',other_tenant,'role','authenticated')::text,true);
 execute 'set local role authenticated';
 perform public.piloto_salvar_permissoes_coadministrador(other_tenant,other_child,'{"inventory":"visualizar"}',true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',other_member,'role','authenticated')::text,true);
 if not public.piloto_tem_permissao(other_tenant,other_member,'inventory','visualizar') then raise exception 'Non-pilot grant failed';end if;
 if public.piloto_tem_permissao(owner_id,other_member,'inventory','visualizar') then raise exception 'Non-pilot delegation crossed houses';end if;
 execute 'reset role';
end $test$;
rollback;
select 'passed' as delegated_access_validation,'DDL, permissions, audit records and test mutations rolled back' as persistence;
