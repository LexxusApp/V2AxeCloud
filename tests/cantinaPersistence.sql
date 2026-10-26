-- Executar após a migration, dentro de BEGIN/ROLLBACK. Nada permanece no banco.
do $$
declare
  v_filho uuid;
  v_owner uuid;
  v_key uuid := gen_random_uuid();
  v_tx jsonb;
  v_retry jsonb;
  v_count int;
  v_itens jsonb := '[{"nome":"Item de verificação A","quantidade":2,"preco":3.50},{"nome":"Item de verificação B","quantidade":1,"preco":7.50}]';
begin
  select f.id, p.id into v_filho, v_owner
    from public.filhos_de_santo f join public.perfil_lider p
      on f.lider_id = p.id or f.tenant_id = p.id
    limit 1;
  if v_filho is null then raise exception 'Sem vínculo para verificar a persistência'; end if;
  update public.filhos_de_santo set limite_lojinha = 1000000000, bloquear_fiado_loja = false where id = v_filho;

  v_tx := public.registrar_consumo_cantina(v_owner, v_owner, v_filho, v_itens, 'fiado', v_key);
  if (v_tx->>'valor')::numeric <> 14.50 or v_tx->>'status' <> 'pendente'
    or v_tx->'cantina_itens' <> v_itens then
    raise exception 'Falha em quantidade, preço ou saldo persistido';
  end if;
  select count(*) into v_count from public.financeiro
    where id = (v_tx->>'id')::uuid and filho_id = v_filho and tenant_id = v_owner
      and valor = 14.50 and cantina_itens = v_itens;
  if v_count <> 1 then raise exception 'Consumo não encontrado após gravação'; end if;
  v_retry := public.registrar_consumo_cantina(v_owner, v_owner, v_filho, v_itens, 'fiado', v_key);
  if v_retry->>'id' <> v_tx->>'id' then raise exception 'Reenvio duplicou a comanda'; end if;
  begin
    perform public.registrar_consumo_cantina(v_owner,v_owner,v_filho,v_itens,'pago',v_key);
    raise exception 'TEST_FAIL: reenvio mudou a forma de pagamento';
  exception when raise_exception then
    if SQLERRM not like '%identificação já foi usada%' then raise; end if;
  end;

  update public.financeiro set status = 'pago' where id = (v_tx->>'id')::uuid;
  select count(*) into v_count from public.financeiro
    where id = (v_tx->>'id')::uuid and status = 'pago' and cantina_itens = v_itens;
  if v_count <> 1 then raise exception 'Quitação perdeu o histórico dos itens'; end if;

  v_tx := public.registrar_consumo_cantina(v_owner, v_owner, null, v_itens, 'pago', gen_random_uuid());
  if v_tx->>'status' <> 'pago' or v_tx->>'filho_id' is not null then
    raise exception 'Venda avulsa não foi registrada como recebida';
  end if;

  update public.filhos_de_santo set bloquear_fiado_loja = true where id = v_filho;
  begin
    perform public.registrar_consumo_cantina(v_owner, v_owner, v_filho, v_itens, 'fiado', gen_random_uuid());
    raise exception 'TEST_FAIL: bloqueio ignorado';
  exception when raise_exception then
    if SQLERRM like 'TEST_FAIL:%' then raise; end if;
    if SQLERRM not like '%bloqueado%' then raise; end if;
  end;
  update public.filhos_de_santo set bloquear_fiado_loja = false, limite_lojinha = 0 where id = v_filho;
  begin
    perform public.registrar_consumo_cantina(v_owner, v_owner, v_filho, v_itens, 'fiado', gen_random_uuid());
    raise exception 'TEST_FAIL: limite ignorado';
  exception when raise_exception then
    if SQLERRM like 'TEST_FAIL:%' then raise; end if;
    if SQLERRM not like '%Limite%' then raise; end if;
  end;

  if has_function_privilege('authenticated', 'public.registrar_consumo_cantina(uuid,uuid,uuid,jsonb,text,uuid)', 'execute')
    or has_function_privilege('anon', 'public.registrar_consumo_cantina(uuid,uuid,uuid,jsonb,text,uuid)', 'execute') then
    raise exception 'Função indevidamente liberada ao navegador';
  end if;
end;
$$;
