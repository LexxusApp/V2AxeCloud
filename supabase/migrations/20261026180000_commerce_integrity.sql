-- Pedido, estoque, débito e trilha de ações pertencem à mesma transação.
alter table public.pedidos
  add column if not exists checkout_id uuid,
  add column if not exists checkout_request jsonb,
  add column if not exists financeiro_id uuid references public.financeiro(id),
  add column if not exists estoque_devolvido boolean not null default false;
create unique index if not exists pedidos_checkout_unique on public.pedidos(tenant_id, checkout_id) where checkout_id is not null;
create unique index if not exists pedidos_financeiro_unique on public.pedidos(financeiro_id) where financeiro_id is not null;
alter table public.pedidos drop constraint if exists pedidos_metodo_pagamento_check;
alter table public.pedidos add constraint pedidos_metodo_pagamento_check check (metodo_pagamento in ('mensalidade','pix','cartao','dinheiro','reserva'));
alter table public.pedidos drop constraint if exists pedidos_status_check;
alter table public.pedidos add constraint pedidos_status_check check (status in ('pendente','pago','entregue','cancelado','reservado'));
alter table public.loja_pedidos add column if not exists pedido_id uuid references public.pedidos(id);
create unique index if not exists loja_pedidos_pedido_unique on public.loja_pedidos(pedido_id) where pedido_id is not null;
alter table public.financeiro add column if not exists data_venda date, add column if not exists data_pagamento date;
update public.financeiro set data_venda = coalesce((created_at at time zone 'America/Sao_Paulo')::date, data),
  data_pagamento = case when lower(status) in ('pago','paid','confirmado','confirmada') then data end
where categoria in ('Loja','Cantina') and data_venda is null;

create table if not exists public.cantina_cardapio (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references auth.users(id) on delete cascade,
  nome text not null check(length(btrim(nome)) between 1 and 160),
  preco numeric(12,2) not null check(preco > 0), icon text not null default '☕', cat text not null default 'comidas',
  badge text, legacy_id text, ativo boolean not null default true, updated_at timestamptz not null default now(),
  unique(tenant_id, legacy_id)
);
create index if not exists cantina_cardapio_tenant_idx on public.cantina_cardapio(tenant_id, ativo);
alter table public.cantina_cardapio enable row level security;
revoke all on public.cantina_cardapio from anon, authenticated;
grant all on public.cantina_cardapio to service_role;

create table if not exists public.comercio_eventos (
  id bigint generated always as identity primary key,
  tenant_id uuid not null, actor_id uuid not null, pedido_id uuid, financeiro_id uuid,
  acao text not null, detalhes jsonb not null default '{}', created_at timestamptz not null default now()
);
alter table public.comercio_eventos enable row level security;
revoke all on public.comercio_eventos from anon, authenticated;
grant all on public.comercio_eventos to service_role;
grant usage, select on sequence public.comercio_eventos_id_seq to service_role;

create or replace function public.comercio_datas_financeiro() returns trigger language plpgsql set search_path=public as $$
begin
  if new.categoria not in ('Loja','Cantina') then return new; end if;
  if tg_op = 'UPDATE' then
    new.data_venda := coalesce(old.data_venda, (old.created_at at time zone 'America/Sao_Paulo')::date, old.data);
    -- Baixar uma dívida não desloca a venda nem o vencimento para outro mês.
    new.data := old.data;
  else
    new.data_venda := coalesce(new.data_venda, (now() at time zone 'America/Sao_Paulo')::date);
  end if;
  if lower(coalesce(new.status,'')) in ('pago','paid','confirmado','confirmada') then
    new.data_pagamento := coalesce(new.data_pagamento, (now() at time zone 'America/Sao_Paulo')::date);
  else
    new.data_pagamento := null;
  end if;
  if tg_op = 'UPDATE' and new.status in ('excluido','cancelado') and exists (
    select 1 from public.pedidos where financeiro_id=old.id and status <> 'cancelado'
  ) then raise exception 'Cancele o pedido pela Loja para devolver o estoque e cancelar o débito juntos'; end if;
  return new;
end; $$;
drop trigger if exists comercio_datas_financeiro on public.financeiro;
create trigger comercio_datas_financeiro before insert or update on public.financeiro for each row execute function public.comercio_datas_financeiro();

create or replace function public.checkout_loja_seguro(
  p_tenant_id uuid, p_filho_id uuid, p_metodo_pagamento text, p_itens jsonb, p_checkout_id uuid
) returns jsonb language plpgsql set search_path=public as $$
declare
  v_pedido public.pedidos%rowtype; v_filho public.filhos_de_santo%rowtype; v_produto public.produtos%rowtype;
  v_itens jsonb; v_request jsonb; v_item jsonb; v_total numeric:=0; v_saldo numeric:=0;
  v_financeiro uuid; v_resumo text:=''; v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if p_tenant_id is null or p_checkout_id is null or p_metodo_pagamento is null
    or p_metodo_pagamento not in ('mensalidade','pix','reserva','dinheiro') then raise exception 'Pedido ou forma de pagamento inválidos'; end if;
  if jsonb_typeof(p_itens) is distinct from 'array' then raise exception 'Informe uma lista de itens'; end if;
  if jsonb_array_length(p_itens) not between 1 and 100 then raise exception 'Informe entre 1 e 100 itens'; end if;
  for v_item in select * from jsonb_array_elements(p_itens) loop
    if coalesce(v_item->>'produto_id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or jsonb_typeof(v_item->'quantidade') is distinct from 'number'
      or (v_item->>'quantidade')::numeric not between 1 and 10000
      or (v_item->>'quantidade')::numeric <> trunc((v_item->>'quantidade')::numeric) then raise exception 'Produto ou quantidade inválidos'; end if;
  end loop;
  select jsonb_agg(jsonb_build_object('produto_id', produto_id, 'quantidade', quantidade) order by produto_id) into v_itens
  from (select (i->>'produto_id')::uuid produto_id, sum((i->>'quantidade')::int) quantidade from jsonb_array_elements(p_itens) i group by 1) s;
  v_request := jsonb_build_object('filho_id',p_filho_id,'metodo',p_metodo_pagamento,'itens',v_itens);
  perform pg_advisory_xact_lock(hashtextextended(p_tenant_id::text || p_checkout_id::text,0));
  select * into v_pedido from public.pedidos where tenant_id=p_tenant_id and checkout_id=p_checkout_id;
  if found then
    if v_pedido.checkout_request <> v_request then raise exception 'Esta identificação já foi usada para outro carrinho'; end if;
    return to_jsonb(v_pedido);
  end if;
  if p_metodo_pagamento='mensalidade' and p_filho_id is null then raise exception 'Selecione um membro para comprar na caderneta'; end if;
  if p_metodo_pagamento='pix' and not exists(select 1 from public.configuracoes_pix where terreiro_id=p_tenant_id and nullif(btrim(chave_pix),'') is not null) then raise exception 'O terreiro precisa configurar sua chave Pix antes da compra'; end if;
  if p_filho_id is not null then
    select * into v_filho from public.filhos_de_santo where id=p_filho_id and (tenant_id=p_tenant_id or lider_id=p_tenant_id) for update;
    if not found then raise exception 'Membro não encontrado nesta casa'; end if;
  end if;
  -- Bloqueios dos produtos sempre na mesma ordem, inclusive carrinhos com itens repetidos.
  for v_item in select * from jsonb_array_elements(v_itens) loop
    if (v_item->>'quantidade')::numeric > 10000 then raise exception 'Quantidade máxima excedida'; end if;
    select * into v_produto from public.produtos where id=(v_item->>'produto_id')::uuid and tenant_id=p_tenant_id and deleted_at is null for update;
    if not found then raise exception 'Produto não encontrado nesta casa'; end if;
    if v_produto.preco is null or v_produto.preco < 0 then raise exception 'Preço do produto inválido'; end if;
    if coalesce(v_produto.estoque_atual,0) < (v_item->>'quantidade')::int then raise exception 'Estoque insuficiente para %',v_produto.nome; end if;
    v_total := v_total + v_produto.preco * (v_item->>'quantidade')::int;
    v_resumo := v_resumo || case when v_resumo='' then '' else ', ' end || (v_item->>'quantidade') || '× ' || v_produto.nome;
  end loop;
  if p_metodo_pagamento='mensalidade' then
    if coalesce(v_filho.bloquear_fiado_loja,false) then raise exception 'Este membro está bloqueado para compras na caderneta'; end if;
    select coalesce(sum(valor),0) into v_saldo from public.financeiro where (tenant_id=p_tenant_id or lider_id=p_tenant_id) and filho_id=p_filho_id and categoria in ('Loja','Cantina') and status='pendente';
    if v_saldo+v_total > coalesce(v_filho.limite_lojinha,100) then raise exception 'Limite da caderneta excedido'; end if;
  end if;
  insert into public.pedidos(tenant_id,filho_id,total,status,metodo_pagamento,checkout_id,checkout_request)
  values(p_tenant_id,p_filho_id,v_total,case when p_metodo_pagamento='reserva' then 'reservado' when p_metodo_pagamento='dinheiro' or v_total=0 then 'pago' else 'pendente' end,p_metodo_pagamento,p_checkout_id,v_request) returning * into v_pedido;
  for v_item in select * from jsonb_array_elements(v_itens) loop
    update public.produtos set estoque_atual=estoque_atual-(v_item->>'quantidade')::int where id=(v_item->>'produto_id')::uuid;
    insert into public.itens_pedido(pedido_id,produto_id,quantidade,preco_unitario)
      select v_pedido.id,id,(v_item->>'quantidade')::int,preco from public.produtos where id=(v_item->>'produto_id')::uuid;
  end loop;
  if p_metodo_pagamento <> 'reserva' and v_total > 0 then
    insert into public.financeiro(tenant_id,lider_id,filho_id,tipo,valor,categoria,descricao,data,status,data_venda,data_pagamento)
      values(p_tenant_id,p_tenant_id,p_filho_id,'entrada',v_total,'Loja','Compra na Loja - Pedido '||v_pedido.id,v_hoje,case when p_metodo_pagamento='dinheiro' then 'pago' else 'pendente' end,v_hoje,case when p_metodo_pagamento='dinheiro' then v_hoje end)
      returning id into v_financeiro;
    update public.pedidos set financeiro_id=v_financeiro where id=v_pedido.id returning * into v_pedido;
  end if;
  insert into public.loja_pedidos(tenant_id,filho_id,filho_nome,tipo,metodo_pagamento,resumo_itens,valor_total,pedido_id)
    values(p_tenant_id,p_filho_id,coalesce(v_filho.nome,'Venda avulsa'),case when p_metodo_pagamento='reserva' then 'reserva' else 'compra' end,p_metodo_pagamento,v_resumo,v_total,v_pedido.id);
  insert into public.comercio_eventos(tenant_id,actor_id,pedido_id,financeiro_id,acao,detalhes)
    values(p_tenant_id,coalesce(v_filho.user_id,p_tenant_id),v_pedido.id,v_financeiro,'pedido_criado',jsonb_build_object('total',v_total,'metodo',p_metodo_pagamento));
  return to_jsonb(v_pedido);
end; $$;
revoke all on function public.checkout_loja_seguro(uuid,uuid,text,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.checkout_loja_seguro(uuid,uuid,text,jsonb,uuid) to service_role;

create or replace function public.acao_pedido_loja(p_tenant_id uuid,p_actor_id uuid,p_pedido_id uuid,p_acao text)
returns jsonb language plpgsql set search_path=public as $$
declare v_pedido public.pedidos%rowtype; v_item record; v_fin public.financeiro%rowtype; v_filho public.filhos_de_santo%rowtype;
  v_metodo text; v_saldo numeric; v_financeiro uuid; v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if p_actor_id is null or p_acao is null or p_acao not in ('confirmar','cancelar','estornar','converter_pix','converter_mensalidade','converter_dinheiro') then raise exception 'Ação inválida'; end if;
  select * into v_pedido from public.pedidos where id=p_pedido_id and tenant_id=p_tenant_id for update;
  if not found then raise exception 'Pedido não encontrado nesta casa'; end if;
  if v_pedido.checkout_id is null and v_pedido.financeiro_id is null then
    if v_pedido.metodo_pagamento<>'pix' or v_pedido.total is distinct from
      (select sum(quantidade*preco_unitario) from public.itens_pedido where pedido_id=v_pedido.id) then
      raise exception 'Pedido legado: itens e total exigem revisão no Financeiro';
    end if;
  end if;
  select * into v_fin from public.financeiro where id=v_pedido.financeiro_id for update;
  if p_acao='cancelar' then
    if v_pedido.status='cancelado' then return to_jsonb(v_pedido); end if;
    if (v_pedido.total>0 and v_pedido.status in ('pago','entregue')) or v_fin.status='pago' then raise exception 'Estorne a baixa do pagamento antes de cancelar este pedido'; end if;
    update public.pedidos set status='cancelado' where id=v_pedido.id;
    if not v_pedido.estoque_devolvido then
      for v_item in select produto_id,sum(quantidade) quantidade from public.itens_pedido where pedido_id=v_pedido.id group by produto_id order by produto_id loop
        update public.produtos set estoque_atual=estoque_atual+v_item.quantidade where id=v_item.produto_id and tenant_id=p_tenant_id;
      end loop;
    end if;
    update public.pedidos set estoque_devolvido=true where id=v_pedido.id;
    update public.financeiro set status='cancelado' where id=v_pedido.financeiro_id;
  elsif p_acao like 'converter_%' then
    v_metodo:=substring(p_acao from 11);
    if v_pedido.status<>'reservado' then
      if v_pedido.metodo_pagamento=v_metodo and v_pedido.status<>'cancelado' then return to_jsonb(v_pedido); end if;
      raise exception 'Somente uma reserva ativa pode ser convertida em venda';
    end if;
    if v_metodo='pix' and not exists(select 1 from public.configuracoes_pix where terreiro_id=p_tenant_id and nullif(btrim(chave_pix),'') is not null) then raise exception 'Configure a chave Pix do terreiro antes de vender'; end if;
    if v_metodo='mensalidade' then
      select * into v_filho from public.filhos_de_santo where id=v_pedido.filho_id and (tenant_id=p_tenant_id or lider_id=p_tenant_id) for update;
      if not found then raise exception 'A reserva precisa de um membro para anotar na caderneta'; end if;
      if coalesce(v_filho.bloquear_fiado_loja,false) then raise exception 'Este membro está bloqueado para compras na caderneta'; end if;
      select coalesce(sum(valor),0) into v_saldo from public.financeiro where (tenant_id=p_tenant_id or lider_id=p_tenant_id) and filho_id=v_pedido.filho_id and categoria in ('Loja','Cantina') and status='pendente';
      if v_saldo+v_pedido.total > coalesce(v_filho.limite_lojinha,100) then raise exception 'Limite da caderneta excedido'; end if;
    end if;
    if v_pedido.total>0 then
      insert into public.financeiro(tenant_id,lider_id,filho_id,tipo,valor,categoria,descricao,data,status,data_venda)
        values(p_tenant_id,p_tenant_id,v_pedido.filho_id,'entrada',v_pedido.total,'Loja','Venda de reserva - Pedido '||v_pedido.id,v_hoje,case when v_metodo='dinheiro' then 'pago' else 'pendente' end,v_hoje) returning id into v_financeiro;
    end if;
    update public.pedidos set metodo_pagamento=v_metodo,financeiro_id=v_financeiro,status=case when v_metodo='dinheiro' or total=0 then 'pago' else 'pendente' end where id=v_pedido.id;
    update public.loja_pedidos set tipo='compra',metodo_pagamento=v_metodo where pedido_id=v_pedido.id;
  elsif p_acao='confirmar' then
    if v_pedido.status in ('pago','entregue') then return to_jsonb(v_pedido); end if;
    if v_pedido.status in ('cancelado','reservado') then raise exception 'Este pedido não aguarda pagamento; para vender uma reserva, cancele-a e finalize uma compra'; end if;
    if v_pedido.financeiro_id is null and v_pedido.checkout_id is null and v_pedido.metodo_pagamento='pix' then
      insert into public.financeiro(tenant_id,lider_id,filho_id,tipo,valor,categoria,descricao,data,status,data_venda)
        values(p_tenant_id,p_tenant_id,v_pedido.filho_id,'entrada',v_pedido.total,'Loja','Recebimento de pedido Pix legado - Pedido '||v_pedido.id,v_hoje,'pendente',(v_pedido.created_at at time zone 'America/Sao_Paulo')::date) returning id into v_financeiro;
      update public.pedidos set financeiro_id=v_financeiro where id=v_pedido.id returning * into v_pedido;
    end if;
    if v_pedido.financeiro_id is null then raise exception 'Pedido sem lançamento financeiro: requer revisão'; end if;
    update public.financeiro set status='pago' where id=v_pedido.financeiro_id and status='pendente';
    if not found then raise exception 'Lançamento financeiro não está pendente. Revise o pedido'; end if;
    update public.pedidos set status='pago' where id=v_pedido.id;
  else
    if v_pedido.status='pendente' then return to_jsonb(v_pedido); end if;
    if v_pedido.status not in ('pago','entregue') or v_pedido.financeiro_id is null then raise exception 'Este pedido não tem pagamento para estornar'; end if;
    update public.financeiro set status='pendente' where id=v_pedido.financeiro_id;
    update public.pedidos set status='pendente' where id=v_pedido.id;
  end if;
  insert into public.comercio_eventos(tenant_id,actor_id,pedido_id,financeiro_id,acao)
    values(p_tenant_id,p_actor_id,v_pedido.id,coalesce(v_financeiro,v_pedido.financeiro_id),p_acao);
  select * into v_pedido from public.pedidos where id=p_pedido_id;
  return to_jsonb(v_pedido);
end; $$;
revoke all on function public.acao_pedido_loja(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.acao_pedido_loja(uuid,uuid,uuid,text) to service_role;

create or replace function public.pagamento_caderneta(p_tenant_id uuid,p_actor_id uuid,p_filho_id uuid,p_transacao_id uuid,p_acao text)
returns integer language plpgsql set search_path=public as $$
declare v_tx public.financeiro%rowtype; v_count int:=0; v_pedido uuid;
begin
  if p_actor_id is null or p_acao is null or p_acao not in ('liquidar','estornar','cancelar') or (p_filho_id is null and p_transacao_id is null)
    or (p_acao<>'liquidar' and p_transacao_id is null) then raise exception 'Ação de pagamento inválida'; end if;
  -- Mesma ordem de bloqueio da Loja: pedido antes do financeiro.
  perform p.id from public.pedidos p join public.financeiro f on f.id=p.financeiro_id
    where p.tenant_id=p_tenant_id and (p_transacao_id is null or f.id=p_transacao_id)
    and (p_filho_id is null or f.filho_id=p_filho_id) order by p.id for update of p;
  for v_tx in select * from public.financeiro where (tenant_id=p_tenant_id or lider_id=p_tenant_id)
    and categoria in ('Loja','Cantina') and (p_transacao_id is null or id=p_transacao_id)
    and (p_filho_id is null or filho_id=p_filho_id)
    and status=case when p_acao='estornar' then 'pago' else 'pendente' end order by id for update loop
    select id into v_pedido from public.pedidos where financeiro_id=v_tx.id;
    if p_acao='cancelar' and v_pedido is not null then raise exception 'Cancele este pedido pela Loja para devolver o estoque'; end if;
    update public.financeiro set status=case when p_acao='liquidar' then 'pago' when p_acao='cancelar' then 'cancelado' else 'pendente' end where id=v_tx.id;
    if v_pedido is not null then update public.pedidos set status=case when p_acao='liquidar' then 'pago' else 'pendente' end where id=v_pedido and status<>'cancelado'; end if;
    insert into public.comercio_eventos(tenant_id,actor_id,pedido_id,financeiro_id,acao)
      values(p_tenant_id,p_actor_id,v_pedido,v_tx.id,p_acao);
    v_count:=v_count+1;
  end loop;
  return v_count;
end; $$;
revoke all on function public.pagamento_caderneta(uuid,uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.pagamento_caderneta(uuid,uuid,uuid,uuid,text) to service_role;
