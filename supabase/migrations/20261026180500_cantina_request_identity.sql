alter table public.financeiro add column if not exists cantina_request jsonb;
create or replace function public.registrar_consumo_cantina(
  p_tenant_id uuid, p_lider_id uuid, p_filho_id uuid,
  p_itens jsonb, p_forma_pagamento text, p_comanda_id uuid
) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_filho public.filhos_de_santo%rowtype;
  v_tx public.financeiro%rowtype;
  v_total numeric := 0;
  v_saldo numeric := 0;
  v_limite numeric;
  v_item jsonb;
  v_quantidade numeric;
  v_preco numeric;
  v_request jsonb := jsonb_build_object('filho_id',p_filho_id,'itens',p_itens,'forma',p_forma_pagamento);
  v_resumo text := '';
begin
  if p_tenant_id is null or p_lider_id is null or p_comanda_id is null then
    raise exception 'Identificação da comanda inválida';
  end if;
  if p_forma_pagamento is null or p_forma_pagamento not in ('pago', 'fiado') then
    raise exception 'Forma de pagamento inválida';
  end if;
  if p_forma_pagamento = 'fiado' and p_filho_id is null then
    raise exception 'Selecione um membro para anotar na caderneta';
  end if;

  -- A mesma tentativa pode ser reenviada após queda de conexão, sem duplicar débito.
  perform pg_advisory_xact_lock(hashtextextended(p_tenant_id::text || p_comanda_id::text, 0));
  select * into v_tx from public.financeiro
    where tenant_id = p_tenant_id and cantina_comanda_id = p_comanda_id;
  if found then
    if (v_tx.cantina_request is not null and v_tx.cantina_request <> v_request)
      or v_tx.filho_id is distinct from p_filho_id or v_tx.cantina_itens is distinct from p_itens then
      raise exception 'Esta identificação já foi usada para outra comanda';
    end if;
    return to_jsonb(v_tx);
  end if;

  if p_itens is null or jsonb_typeof(p_itens) <> 'array' then
    raise exception 'Adicione itens à comanda';
  end if;
  if jsonb_array_length(p_itens) not between 1 and 100 then
    raise exception 'A comanda deve conter entre 1 e 100 itens';
  end if;
  for v_item in select * from jsonb_array_elements(p_itens) loop
    if jsonb_typeof(v_item->'quantidade') <> 'number'
      or jsonb_typeof(v_item->'preco') <> 'number'
      or nullif(btrim(v_item->>'nome'), '') is null then
      raise exception 'Item da comanda inválido';
    end if;
    v_quantidade := (v_item->>'quantidade')::numeric;
    v_preco := (v_item->>'preco')::numeric;
    if v_quantidade is null or v_preco is null
      or v_quantidade <= 0 or v_quantidade <> trunc(v_quantidade) or v_quantidade > 10000
      or v_preco <= 0 or v_preco > 1000000 or v_preco <> round(v_preco, 2) then
      raise exception 'Quantidade ou preço inválido';
    end if;
    v_total := v_total + v_quantidade * v_preco;
    v_resumo := v_resumo || case when v_resumo = '' then '' else ', ' end
      || v_quantidade::text || 'x ' || left(btrim(v_item->>'nome'), 160);
  end loop;

  if p_filho_id is not null then
    -- Serializa comanda e verificação de limite por membro.
    select * into v_filho from public.filhos_de_santo
      where id = p_filho_id and (tenant_id = p_tenant_id or lider_id = p_tenant_id)
      for update;
    if not found then raise exception 'Membro não encontrado nesta casa'; end if;
    if p_forma_pagamento = 'fiado' then
      if coalesce(v_filho.bloquear_fiado_loja, false) then
        raise exception 'Este membro está bloqueado para compras na caderneta';
      end if;
      select coalesce(sum(valor), 0) into v_saldo from public.financeiro
        where (tenant_id = p_tenant_id or lider_id = p_tenant_id)
          and filho_id = p_filho_id and categoria in ('Cantina', 'Loja') and status = 'pendente';
      v_limite := coalesce(v_filho.limite_lojinha, 100);
      if v_saldo + v_total > v_limite then
        raise exception 'Limite da caderneta excedido. Disponível: R$ %', greatest(0, v_limite - v_saldo);
      end if;
    end if;
  end if;

  insert into public.financeiro (
    tenant_id, lider_id, filho_id, tipo, categoria, data, descricao,
    valor, status, cantina_itens, cantina_comanda_id, cantina_request
  ) values (
    p_tenant_id, p_lider_id, p_filho_id, 'entrada', 'Cantina',
    (now() at time zone 'America/Sao_Paulo')::date,
    'Cantina - ' || coalesce(v_filho.nome, 'Venda avulsa') || ' - ' || v_resumo,
    v_total, case when p_forma_pagamento = 'pago' then 'pago' else 'pendente' end,
    p_itens, p_comanda_id, v_request
  ) returning * into v_tx;
  insert into public.comercio_eventos(tenant_id,actor_id,financeiro_id,acao,detalhes)
    values(p_tenant_id,p_lider_id,v_tx.id,'comanda_criada',jsonb_build_object('valor',v_total,'forma',p_forma_pagamento));
  return to_jsonb(v_tx);
end;
$$;

-- Apenas a API autenticada pode registrar consumos. O navegador não chama a função diretamente.
revoke all on function public.registrar_consumo_cantina(uuid, uuid, uuid, jsonb, text, uuid) from public, anon, authenticated;
grant execute on function public.registrar_consumo_cantina(uuid, uuid, uuid, jsonb, text, uuid) to service_role;
