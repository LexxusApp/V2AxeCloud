-- Dentro de BEGIN/ROLLBACK: usa o banco real, sem deixar vendas ou cobranças de teste.
do $$
declare
  owner_id uuid; child_id uuid; product_id uuid:=gen_random_uuid(); attempt uuid:=gen_random_uuid();
  ord jsonb; retry jsonb; tx jsonb; n int; stock int; old_date date;
begin
  select f.id,p.id into child_id,owner_id from public.filhos_de_santo f join public.perfil_lider p on f.tenant_id=p.id or f.lider_id=p.id limit 1;
  if child_id is null then raise exception 'Sem vínculo para teste'; end if;
  update public.filhos_de_santo set limite_lojinha=1000000000,bloquear_fiado_loja=false where id=child_id;
  insert into public.produtos(id,tenant_id,nome,preco,estoque_atual) values(product_id,owner_id,'Verificação transacional',10,20);
  ord:=public.checkout_loja_seguro(owner_id,child_id,'mensalidade',jsonb_build_array(jsonb_build_object('produto_id',product_id,'quantidade',2,'preco',0.01)),attempt);
  if (ord->>'total')::numeric<>20 or ord->>'status'<>'pendente' then raise exception 'Total ou estado incorreto'; end if;
  retry:=public.checkout_loja_seguro(owner_id,child_id,'mensalidade',jsonb_build_array(jsonb_build_object('produto_id',product_id,'quantidade',2)),attempt);
  if retry->>'id'<>ord->>'id' then raise exception 'Reenvio duplicou pedido'; end if;
  select count(*) into n from public.financeiro where id=(ord->>'financeiro_id')::uuid;
  if n<>1 then raise exception 'Débito não é único'; end if;
  select estoque_atual into stock from public.produtos where id=product_id;
  if stock<>18 then raise exception 'Reenvio alterou estoque'; end if;
  begin
    perform public.checkout_loja_seguro(owner_id,child_id,'mensalidade',jsonb_build_array(jsonb_build_object('produto_id',product_id,'quantidade',100)),gen_random_uuid());
    raise exception 'TEST_FAIL: vendeu sem estoque';
  exception when raise_exception then
    if SQLERRM not like 'Estoque insuficiente%' then raise; end if;
  end;
  begin
    perform public.checkout_loja_seguro(owner_id,child_id,'mensalidade',jsonb_build_array(jsonb_build_object('produto_id',product_id,'quantidade',3)),attempt);
    raise exception 'TEST_FAIL: chave reutilizada';
  exception when raise_exception then if SQLERRM like 'TEST_FAIL:%' then raise; end if; end;
  old_date:=(ord->>'created_at')::timestamptz::date;
  if public.pagamento_caderneta(owner_id,owner_id,child_id,(ord->>'financeiro_id')::uuid,'liquidar')<>1 then raise exception 'Baixa falhou'; end if;
  if public.pagamento_caderneta(owner_id,owner_id,child_id,(ord->>'financeiro_id')::uuid,'liquidar')<>0 then raise exception 'Baixa repetida alterou dados'; end if;
  select to_jsonb(f) into tx from public.financeiro f where id=(ord->>'financeiro_id')::uuid;
  if tx->>'status'<>'pago' or tx->>'data_pagamento' is null then raise exception 'Recebimento sem data'; end if;
  ord:=public.acao_pedido_loja(owner_id,owner_id,(ord->>'id')::uuid,'estornar');
  ord:=public.acao_pedido_loja(owner_id,owner_id,(ord->>'id')::uuid,'cancelar');
  retry:=public.acao_pedido_loja(owner_id,owner_id,(ord->>'id')::uuid,'cancelar');
  select estoque_atual into stock from public.produtos where id=product_id;
  if stock<>20 then raise exception 'Cancelamento não devolveu estoque uma vez'; end if;
  ord:=public.checkout_loja_seguro(owner_id,child_id,'reserva',jsonb_build_array(jsonb_build_object('produto_id',product_id,'quantidade',1)),gen_random_uuid());
  if ord->>'financeiro_id' is not null or ord->>'status'<>'reservado' then raise exception 'Reserva gerou dívida'; end if;
  ord:=public.acao_pedido_loja(owner_id,owner_id,(ord->>'id')::uuid,'converter_dinheiro');
  retry:=public.acao_pedido_loja(owner_id,owner_id,(ord->>'id')::uuid,'converter_dinheiro');
  select estoque_atual into stock from public.produtos where id=product_id;
  if stock<>19 or ord->>'status'<>'pago' or retry->>'financeiro_id'<>ord->>'financeiro_id' then raise exception 'Conversão duplicou estoque ou recebimento'; end if;
  update public.filhos_de_santo set bloquear_fiado_loja=true where id=child_id;
  begin
    perform public.checkout_loja_seguro(owner_id,child_id,'mensalidade',jsonb_build_array(jsonb_build_object('produto_id',product_id,'quantidade',1)),gen_random_uuid());
    raise exception 'TEST_FAIL: bloqueio ignorado';
  exception when raise_exception then if SQLERRM like 'TEST_FAIL:%' then raise; end if; end;
  if has_function_privilege('authenticated','public.checkout_loja_seguro(uuid,uuid,text,jsonb,uuid)','execute') then raise exception 'Checkout público indevido'; end if;
  insert into public.financeiro(tenant_id,lider_id,filho_id,tipo,categoria,valor,status,data,data_venda)
    values(owner_id,owner_id,child_id,'entrada','Cantina',1,'pendente','2026-09-20','2026-09-20') returning to_jsonb(financeiro.*) into tx;
  perform public.pagamento_caderneta(owner_id,owner_id,child_id,(tx->>'id')::uuid,'liquidar');
  select to_jsonb(f) into tx from public.financeiro f where id=(tx->>'id')::uuid;
  if tx->>'data'<>'2026-09-20' or tx->>'data_venda'<>'2026-09-20' or (tx->>'data_pagamento')::date<>(now() at time zone 'America/Sao_Paulo')::date then raise exception 'Baixa deslocou data de venda'; end if;
end $$;
