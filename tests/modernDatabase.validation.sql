-- Run only through validate-modern-database.mjs: every change is rolled back.
do $validation$
declare
  owner_id uuid; child_id uuid; member_auth uuid; other_id uuid; other_auth uuid;
  request_id uuid := gen_random_uuid(); cantina_request uuid := gen_random_uuid();
  row_one public.financeiro; row_two public.financeiro;
  payload jsonb; result jsonb; cantina_id uuid; count_rows int;
  library_one public.biblioteca; library_two public.biblioteca; shared public.biblioteca;
  sibling_library public.biblioteca; member_email text;
  product_id uuid := gen_random_uuid(); checkout_request uuid := gen_random_uuid(); order_id uuid;
  baseline numeric; order_result jsonb; denied boolean := false;
  marker text := 'VALIDACAO-LOCAL-' || gen_random_uuid()::text;
begin
  select id into strict owner_id from public.perfil_lider where lower(email)='vendasmercadolivrev1@gmail.com';
  select id,user_id into strict child_id,member_auth from public.filhos_de_santo
    where tenant_id=owner_id and user_id is not null order by id limit 1;
  select id,user_id into strict other_id,other_auth from public.filhos_de_santo
    where tenant_id=owner_id and user_id is not null and id<>child_id order by id limit 1;
  -- An isolated month avoids modifying any pre-existing monthly bill.
  if exists(select 1 from public.financeiro where tenant_id=owner_id and filho_id=child_id and categoria='Mensalidade' and data between '1901-01-01' and '1901-01-31') then raise exception 'Mês de teste ocupado'; end if;
  payload := jsonb_build_object('tipo','entrada','categoria','Mensalidade','valor',102,'data','1901-01-10','status','pendente','descricao',marker,'filho_id',child_id);
  execute 'set local role service_role';
  select * into row_one from public.registrar_lancamento_manual(owner_id,owner_id,request_id,payload);
  select * into row_two from public.registrar_lancamento_manual(owner_id,owner_id,request_id,payload);
  if not exists(select 1 from public.financeiro_revisoes where tenant_id=owner_id and revisao>0) then raise exception 'Lançamento não atualizou a revisão do extrato'; end if;
  if row_one.id<>row_two.id or row_one.valor<>102 or row_one.filho_id<>child_id or row_one.data_vencimento<>'1901-01-10' or row_one.status<>'pendente' or not row_one.lancamento_manual then raise exception 'Mensalidade manual inconsistente'; end if;
  begin
    perform public.registrar_lancamento_manual(owner_id,owner_id,request_id,payload||'{"valor":103}'::jsonb);
    raise exception 'Aceitou alteração da mesma tentativa';
  exception when unique_violation then null; end;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',member_auth,'role','authenticated')::text,true);
  execute 'set local role authenticated';
  select count(*) into count_rows from public.financeiro where id=row_one.id;
  if count_rows<>1 then raise exception 'Membro não vê a mensalidade vinculada'; end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',other_auth,'role','authenticated')::text,true);
  select count(*) into count_rows from public.financeiro where id=row_one.id;
  if count_rows<>0 then raise exception 'Outro membro leu a cobrança'; end if;
  execute 'reset role';
  execute 'set local role service_role';
  -- Regular entries and expenses persist as paid even if pending was requested.
  select * into row_two from public.registrar_lancamento_manual(owner_id,owner_id,gen_random_uuid(),jsonb_build_object('tipo','entrada','categoria','Doação','valor',200,'data','2026-10-31','status','pendente','descricao',marker,'filho_id',child_id));
  if row_two.status<>'pago' or row_two.valor<>200 then raise exception 'Entrada comum não registrada'; end if;
  select * into row_two from public.registrar_lancamento_manual(owner_id,owner_id,gen_random_uuid(),jsonb_build_object('tipo','saida','categoria','Contas','valor',30,'data','2026-10-31','status','pendente','descricao',marker,'filho_id',child_id));
  if row_two.status<>'pago' or row_two.valor<>30 then raise exception 'Saída não registrada'; end if;
  -- Cantina: item detail, retry identity, settlement and reversal share one row.
  result := public.registrar_consumo_cantina(owner_id,owner_id,child_id,jsonb_build_array(jsonb_build_object('nome',marker,'quantidade',2,'preco',0.01)),'fiado',cantina_request);
  cantina_id := (result->>'id')::uuid;
  if (result->>'valor')::numeric<>0.02 or result->>'status'<>'pendente' then raise exception 'Consumo não persistido'; end if;
  result := public.registrar_consumo_cantina(owner_id,owner_id,child_id,jsonb_build_array(jsonb_build_object('nome',marker,'quantidade',2,'preco',0.01)),'fiado',cantina_request);
  if (result->>'id')::uuid<>cantina_id then raise exception 'Consumo duplicado'; end if;
  perform public.pagamento_caderneta(owner_id,owner_id,null,cantina_id,'liquidar');
  if not exists(select 1 from public.financeiro where id=cantina_id and status='pago' and data_pagamento is not null) then raise exception 'Baixa não persistiu no financeiro'; end if;
  perform public.pagamento_caderneta(owner_id,owner_id,null,cantina_id,'estornar');
  if not exists(select 1 from public.financeiro where id=cantina_id and status='pendente' and data_pagamento is null) then raise exception 'Estorno não reabriu a caderneta'; end if;
  -- The shared credit ceiling and stock movement are tested with one disposable
  -- product and a temporary limit adjustment, both undone by the outer rollback.
  select coalesce(sum(valor),0) into baseline from public.financeiro
    where (tenant_id=owner_id or lider_id=owner_id) and filho_id=child_id and categoria in ('Cantina','Loja') and status='pendente';
  update public.filhos_de_santo set limite_lojinha=baseline+100,bloquear_fiado_loja=false where id=child_id;
  insert into public.produtos(id,tenant_id,nome,preco,estoque_atual,estoque_minimo) values(product_id,owner_id,marker,70,10,0);
  order_result := public.checkout_loja_seguro(owner_id,child_id,'mensalidade',jsonb_build_array(jsonb_build_object('produto_id',product_id,'quantidade',1)),checkout_request);
  order_id := (order_result->>'id')::uuid;
  if order_id is null or not exists(select 1 from public.produtos where id=product_id and estoque_atual=9) then raise exception 'Pedido não baixou estoque'; end if;
  result := public.checkout_loja_seguro(owner_id,child_id,'mensalidade',jsonb_build_array(jsonb_build_object('produto_id',product_id,'quantidade',1)),checkout_request);
  if (result->>'id')::uuid<>order_id or not exists(select 1 from public.produtos where id=product_id and estoque_atual=9) then raise exception 'Retry duplicou estoque/pedido'; end if;
  if not exists(select 1 from public.financeiro where id=(order_result->>'financeiro_id')::uuid and categoria='Loja' and valor=70 and status='pendente' and filho_id=child_id) then raise exception 'Loja não vinculou o financeiro'; end if;
  perform public.registrar_consumo_cantina(owner_id,owner_id,child_id,jsonb_build_array(jsonb_build_object('nome',marker,'quantidade',2,'preco',15)),'fiado',gen_random_uuid());
  begin
    perform public.registrar_consumo_cantina(owner_id,owner_id,child_id,jsonb_build_array(jsonb_build_object('nome',marker,'quantidade',1,'preco',0.01)),'fiado',gen_random_uuid());
  exception when others then
    if sqlerrm ilike '%Limite%' then denied := true; else raise; end if;
  end;
  if not denied then raise exception 'Cantina ignorou o consumo da Loja no limite'; end if;
  perform public.acao_pedido_loja(owner_id,owner_id,order_id,'cancelar');
  perform public.acao_pedido_loja(owner_id,owner_id,order_id,'cancelar');
  if not exists(select 1 from public.produtos where id=product_id and estoque_atual=10) then raise exception 'Cancelamento não devolveu estoque uma única vez'; end if;
  if not exists(select 1 from public.financeiro where id=(order_result->>'financeiro_id')::uuid and status='cancelado') then raise exception 'Cancelamento deixou cobrança ativa'; end if;
  -- The proposed migration is loaded in this transaction only.
  select * into library_one from public.finalizar_material_biblioteca(owner_id,owner_id||'/validation/'||marker||'.pdf',marker,'Fundamentos','individual',array[child_id]);
  select * into library_two from public.finalizar_material_biblioteca(owner_id,owner_id||'/validation/'||marker||'.pdf',marker,'Fundamentos','individual',array[child_id]);
  if library_one.id<>library_two.id then raise exception 'Publicação duplicada'; end if;
  begin
    perform public.finalizar_material_biblioteca(owner_id,owner_id||'/validation/'||marker||'.pdf',marker,'Fundamentos','individual',array[other_id]);
    raise exception 'Retry alterou o destinatário';
  exception when unique_violation then null; end;
  select * into shared from public.finalizar_material_biblioteca(owner_id,owner_id||'/validation/shared-'||marker||'.pdf',marker,'Fundamentos','casa',array[]::uuid[]);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',member_auth,'role','authenticated')::text,true);
  execute 'set local role authenticated';
  select count(*) into count_rows from public.biblioteca where id=library_one.id;
  if count_rows<>1 then raise exception 'Destinatário não lê o acervo privado'; end if;
  insert into public.biblioteca_comentarios(arquivo_id,user_id,tenant_id,texto) values(library_one.id,member_auth,owner_id,marker);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',other_auth,'role','authenticated')::text,true);
  select count(*) into count_rows from public.biblioteca where id=library_one.id;
  if count_rows<>0 then raise exception 'Acervo privado vazou para outro membro'; end if;
  select count(*) into count_rows from public.biblioteca_comentarios where arquivo_id=library_one.id;
  if count_rows<>0 then raise exception 'Comentário de PDF privado vazou para outro membro'; end if;
  begin
    insert into public.biblioteca_comentarios(arquivo_id,user_id,tenant_id,texto) values(library_one.id,other_auth,owner_id,marker);
    raise exception 'Não destinatário publicou comentário em PDF privado';
  exception when insufficient_privilege then null; end;
  select count(*) into count_rows from public.biblioteca where id=shared.id;
  if count_rows<>1 then raise exception 'Acervo compartilhado ficou incompatível'; end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated')::text,true);
  select count(*) into count_rows from public.biblioteca where id=library_one.id;
  if count_rows<>1 then raise exception 'Gestor não lê o acervo privado'; end if;
  execute 'reset role';
  -- Reproduce the legacy login: email/shadow match, no user_id binding, and
  -- an old leader profile. It must still behave as a member, never a manager.
  execute 'set local role service_role';
  select * into sibling_library from public.finalizar_material_biblioteca(owner_id,owner_id||'/validation/sibling-'||marker||'.pdf',marker,'Fundamentos','individual',array[other_id]);
  insert into public.biblioteca_comentarios(arquivo_id,user_id,tenant_id,texto) values(sibling_library.id,other_auth,owner_id,marker);
  execute 'reset role';
  select email into member_email from auth.users where id=member_auth;
  update public.filhos_de_santo set user_id=null,email=member_email where id=child_id;
  insert into public.perfil_lider(id,email,tenant_id,nome_terreiro,role,is_admin_global)
    values(member_auth,member_email,owner_id,marker,'admin',false)
    on conflict(id) do update set tenant_id=owner_id,role='admin',is_admin_global=false;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',member_auth,'role','authenticated')::text,true);
  execute 'set local role authenticated';
  select count(*) into count_rows from public.biblioteca where id=sibling_library.id;
  if count_rows<>0 then raise exception 'Perfil fantasma leu PDF de outro destinatário'; end if;
  select count(*) into count_rows from public.biblioteca_comentarios where arquivo_id=sibling_library.id;
  if count_rows<>0 then raise exception 'Perfil fantasma leu comentários privados'; end if;
  select count(*) into count_rows from public.biblioteca where id=library_one.id;
  if count_rows<>1 then raise exception 'Vínculo legado perdeu o próprio PDF'; end if;
  execute 'reset role';
end;
$validation$;
