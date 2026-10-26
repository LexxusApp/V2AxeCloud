-- Corrige somente os dois lançamentos extras identificados na auditoria.
-- As duas compras e seus débitos originais permanecem. Nenhum registro é apagado.
do $$
declare tx public.financeiro%rowtype; extra_id uuid; p record; feed_id uuid;
begin
  for extra_id in select unnest(array['1548f6d3-4e1c-46bd-8a4d-ef7a7e6f7cf5'::uuid,'eb6a3fbe-0fa2-4363-9b5e-2fffd144f09d'::uuid]) loop
    select * into tx from public.financeiro where id=extra_id for update;
    if not found then raise exception 'Duplicidade auditada não encontrada; interrompendo reconciliação'; end if;
    if tx.status='cancelado' and exists(select 1 from public.comercio_eventos where financeiro_id=extra_id and acao='duplicidade_legada_cancelada') then continue; end if;
    if tx.status<>'pendente' or tx.valor<>50 or tx.categoria<>'Loja'
       or tx.tenant_id<>'d6bd4829-a1a8-4d33-bc4d-e929455735b1'::uuid
       or tx.filho_id<>'f146c639-9506-4d69-ae25-18be8ebd64ce'::uuid or tx.descricao not like 'Loja - %' then
      raise exception 'Duplicidade mudou desde a auditoria; revisão necessária';
    end if;
    if (select count(*) from public.financeiro f join public.pedidos o on f.descricao like '%Pedido '||o.id::text
       where o.id in ('aa79d20e-9f24-44ae-9d85-853456f942da'::uuid,'3b4286a3-1242-442f-acd8-3ecaee3c3d19'::uuid)
       and f.tenant_id=tx.tenant_id and f.filho_id=tx.filho_id and f.valor=tx.valor and f.status='pendente')<>2 then
      raise exception 'Débitos originais não conferem com a auditoria';
    end if;
    insert into public.comercio_eventos(tenant_id,actor_id,financeiro_id,acao,detalhes)
      values(tx.tenant_id,tx.tenant_id,tx.id,'duplicidade_legada_cancelada',jsonb_build_object('antes',to_jsonb(tx),'motivo','API antiga gravava novamente o débito já criado pelo checkout SQL'));
    update public.financeiro set status='cancelado' where id=tx.id;
  end loop;
  -- O status antigo "pago" da função de checkout significava apenas compra criada.
  -- Usa a evidência financeira pendente para corrigir o status, preservando o valor.
  for p in select o.*,f.id fid,f.status fstatus from public.pedidos o join public.financeiro f
    on f.descricao like '%Pedido '||o.id::text and f.tenant_id=o.tenant_id and f.filho_id=o.filho_id and f.valor=o.total
    where o.checkout_id is null and o.metodo_pagamento='mensalidade' and f.status='pendente'
    and o.id in ('23346c9d-99f1-4589-9416-a0caa44793a2'::uuid,'aa79d20e-9f24-44ae-9d85-853456f942da'::uuid,'3b4286a3-1242-442f-acd8-3ecaee3c3d19'::uuid)
    order by o.created_at loop
    update public.pedidos set financeiro_id=p.fid,status='pendente' where id=p.id;
    select l.id into feed_id from public.loja_pedidos l where l.pedido_id is null and l.tenant_id=p.tenant_id
      and l.filho_id=p.filho_id and l.valor_total=p.total and l.tipo='compra' and l.metodo_pagamento='mensalidade'
      and abs(extract(epoch from l.created_at-p.created_at))<5 order by l.created_at limit 1 for update;
    if feed_id is not null then update public.loja_pedidos set pedido_id=p.id where id=feed_id; end if;
    insert into public.comercio_eventos(tenant_id,actor_id,pedido_id,financeiro_id,acao,detalhes)
      values(p.tenant_id,p.tenant_id,p.id,p.fid,'pedido_legado_conciliado',jsonb_build_object('status_anterior',p.status,'total',p.total));
  end loop;
end $$;

-- Um pedido Pix antigo existe sem registro no feed e sem evidência de pagamento.
-- Exibi-lo como pendente permite ao responsável conferir o extrato ou cancelá-lo.
insert into public.loja_pedidos(tenant_id,filho_id,filho_nome,tipo,metodo_pagamento,resumo_itens,valor_total,pedido_id,created_at)
 select o.tenant_id,o.filho_id,coalesce(f.nome,'Venda avulsa'),'compra',o.metodo_pagamento,
   coalesce((select string_agg(i.quantidade||'× '||coalesce(p.nome,'Produto anterior'),', ') from public.itens_pedido i left join public.produtos p on p.id=i.produto_id where i.pedido_id=o.id),'Pedido anterior'),o.total,o.id,o.created_at
 from public.pedidos o left join public.filhos_de_santo f on f.id=o.filho_id
 where o.id='1dda2908-b7bf-4168-b01c-cf2fdc79df83'::uuid and o.metodo_pagamento='pix' and o.status='pendente'
 and not exists(select 1 from public.loja_pedidos l where l.pedido_id=o.id);
