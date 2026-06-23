-- pedidos legado: filho só insere pedido próprio; gestão só zelador
drop policy if exists "pedidos tenant insert" on public.pedidos;
drop policy if exists "pedidos tenant select" on public.pedidos;
drop policy if exists "pedidos tenant update" on public.pedidos;

create policy "pedidos tenant insert"
  on public.pedidos for insert to authenticated
  with check (
    (
      filho_id in (select auth_filho_row_ids())
      and tenant_id in (select auth_user_tenant_ids())
    )
    or tenant_id in (select auth_lider_tenant_ids())
    or (select auth_is_global_admin())
  );

create policy "pedidos tenant select"
  on public.pedidos for select to authenticated
  using (
    tenant_id in (select auth_lider_tenant_ids())
    or filho_id in (select auth_filho_row_ids())
    or (select auth_is_global_admin())
  );

create policy "pedidos tenant update"
  on public.pedidos for update to authenticated
  using (
    tenant_id in (select auth_lider_tenant_ids())
    or (select auth_is_global_admin())
  )
  with check (
    tenant_id in (select auth_lider_tenant_ids())
    or (select auth_is_global_admin())
  );

-- itens_pedido alinhado aos pedidos
drop policy if exists "itens_pedido tenant access" on public.itens_pedido;

create policy "itens_pedido tenant read"
  on public.itens_pedido for select to authenticated
  using (
    exists (
      select 1 from public.pedidos p
      where p.id = itens_pedido.pedido_id
        and (
          p.tenant_id in (select auth_lider_tenant_ids())
          or p.filho_id in (select auth_filho_row_ids())
          or (select auth_is_global_admin())
        )
    )
  );

create policy "itens_pedido lider write"
  on public.itens_pedido for all to authenticated
  using (
    exists (
      select 1 from public.pedidos p
      where p.id = itens_pedido.pedido_id
        and (
          p.tenant_id in (select auth_lider_tenant_ids())
          or (select auth_is_global_admin())
        )
    )
  )
  with check (
    exists (
      select 1 from public.pedidos p
      where p.id = itens_pedido.pedido_id
        and (
          p.tenant_id in (select auth_lider_tenant_ids())
          or (select auth_is_global_admin())
        )
    )
  );

-- loja_produtos (se existir no projeto)
do $$
begin
  if to_regclass('public.loja_produtos') is not null then
    execute 'alter table public.loja_produtos enable row level security';
    execute 'drop policy if exists "loja_produtos tenant access" on public.loja_produtos';
    execute $p$
      create policy "loja_produtos tenant read"
        on public.loja_produtos for select to authenticated
        using (tenant_id in (select auth_user_tenant_ids()) or (select auth_is_global_admin()))
    $p$;
    execute $p$
      create policy "loja_produtos lider write"
        on public.loja_produtos for all to authenticated
        using (tenant_id in (select auth_lider_tenant_ids()) or (select auth_is_global_admin()))
        with check (tenant_id in (select auth_lider_tenant_ids()) or (select auth_is_global_admin()))
    $p$;
  end if;
end $$;
