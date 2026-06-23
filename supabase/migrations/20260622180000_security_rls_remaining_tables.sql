-- Endurece auth_lider_tenant_ids (exclui filhos com perfil shadow) e RLS de escrita
-- nas tabelas que ainda usavam auth_user_tenant_ids() para INSERT/UPDATE/DELETE.

create or replace function public.auth_lider_tenant_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(p.tenant_id, p.id)
  from public.perfil_lider p
  where p.id = (select auth.uid())
    and lower(coalesce(p.role, 'admin')) <> 'filho'
    and not exists (
      select 1 from public.filhos_de_santo f
      where f.user_id = (select auth.uid())
    );
$$;

-- configuracoes_pix: leitura tenant (filhos pagam mensalidade); escrita só zelador
drop policy if exists "pix zelador delete" on public.configuracoes_pix;
drop policy if exists "pix zelador update" on public.configuracoes_pix;
drop policy if exists "pix zelador write" on public.configuracoes_pix;

create policy "pix zelador delete"
  on public.configuracoes_pix for delete to authenticated
  using (
    terreiro_id in (select auth_lider_tenant_ids())
    or (select auth_is_global_admin())
  );

create policy "pix zelador update"
  on public.configuracoes_pix for update to authenticated
  using (
    terreiro_id in (select auth_lider_tenant_ids())
    or (select auth_is_global_admin())
  )
  with check (
    terreiro_id in (select auth_lider_tenant_ids())
    or (select auth_is_global_admin())
  );

create policy "pix zelador write"
  on public.configuracoes_pix for insert to authenticated
  with check (
    terreiro_id in (select auth_lider_tenant_ids())
    or (select auth_is_global_admin())
  );

-- produtos
drop policy if exists "produtos tenant access" on public.produtos;

create policy "produtos tenant read"
  on public.produtos for select to authenticated
  using (tenant_id in (select auth_user_tenant_ids()) or (select auth_is_global_admin()));

create policy "produtos lider insert"
  on public.produtos for insert to authenticated
  with check (tenant_id in (select auth_lider_tenant_ids()) or (select auth_is_global_admin()));

create policy "produtos lider update"
  on public.produtos for update to authenticated
  using (tenant_id in (select auth_lider_tenant_ids()) or (select auth_is_global_admin()))
  with check (tenant_id in (select auth_lider_tenant_ids()) or (select auth_is_global_admin()));

create policy "produtos lider delete"
  on public.produtos for delete to authenticated
  using (tenant_id in (select auth_lider_tenant_ids()) or (select auth_is_global_admin()));

-- caixinha_metas
drop policy if exists "caixinha_metas tenant access" on public.caixinha_metas;

create policy "caixinha_metas tenant read"
  on public.caixinha_metas for select to authenticated
  using (tenant_id in (select auth_user_tenant_ids()) or (select auth_is_global_admin()));

create policy "caixinha_metas lider insert"
  on public.caixinha_metas for insert to authenticated
  with check (tenant_id in (select auth_lider_tenant_ids()) or (select auth_is_global_admin()));

create policy "caixinha_metas lider update"
  on public.caixinha_metas for update to authenticated
  using (tenant_id in (select auth_lider_tenant_ids()) or (select auth_is_global_admin()))
  with check (tenant_id in (select auth_lider_tenant_ids()) or (select auth_is_global_admin()));

create policy "caixinha_metas lider delete"
  on public.caixinha_metas for delete to authenticated
  using (tenant_id in (select auth_lider_tenant_ids()) or (select auth_is_global_admin()));

-- caixinha_doacoes
drop policy if exists "caixinha_doacoes tenant access" on public.caixinha_doacoes;

create policy "caixinha_doacoes tenant read"
  on public.caixinha_doacoes for select to authenticated
  using (
    exists (
      select 1 from public.caixinha_metas m
      where m.id = caixinha_doacoes.meta_id
        and (m.tenant_id in (select auth_user_tenant_ids()) or (select auth_is_global_admin()))
    )
  );

create policy "caixinha_doacoes lider write"
  on public.caixinha_doacoes for all to authenticated
  using (
    exists (
      select 1 from public.caixinha_metas m
      where m.id = caixinha_doacoes.meta_id
        and (m.tenant_id in (select auth_lider_tenant_ids()) or (select auth_is_global_admin()))
    )
  )
  with check (
    exists (
      select 1 from public.caixinha_metas m
      where m.id = caixinha_doacoes.meta_id
        and (m.tenant_id in (select auth_lider_tenant_ids()) or (select auth_is_global_admin()))
    )
  );

-- convidados_eventos
drop policy if exists "convidados via calendario tenant" on public.convidados_eventos;

create policy "convidados tenant read"
  on public.convidados_eventos for select to authenticated
  using (
    exists (
      select 1 from public.calendario_axe e
      where e.id = convidados_eventos.event_id
        and (
          e.tenant_id in (select auth_user_tenant_ids())
          or e.lider_id in (select auth_user_tenant_ids())
          or (select auth_is_global_admin())
        )
    )
  );

create policy "convidados lider insert"
  on public.convidados_eventos for insert to authenticated
  with check (
    exists (
      select 1 from public.calendario_axe e
      where e.id = convidados_eventos.event_id
        and (
          e.tenant_id in (select auth_lider_tenant_ids())
          or e.lider_id in (select auth_lider_tenant_ids())
          or (select auth_is_global_admin())
        )
    )
  );

create policy "convidados lider update"
  on public.convidados_eventos for update to authenticated
  using (
    exists (
      select 1 from public.calendario_axe e
      where e.id = convidados_eventos.event_id
        and (
          e.tenant_id in (select auth_lider_tenant_ids())
          or e.lider_id in (select auth_lider_tenant_ids())
          or (select auth_is_global_admin())
        )
    )
  )
  with check (
    exists (
      select 1 from public.calendario_axe e
      where e.id = convidados_eventos.event_id
        and (
          e.tenant_id in (select auth_lider_tenant_ids())
          or e.lider_id in (select auth_lider_tenant_ids())
          or (select auth_is_global_admin())
        )
    )
  );

create policy "convidados lider delete"
  on public.convidados_eventos for delete to authenticated
  using (
    exists (
      select 1 from public.calendario_axe e
      where e.id = convidados_eventos.event_id
        and (
          e.tenant_id in (select auth_lider_tenant_ids())
          or e.lider_id in (select auth_lider_tenant_ids())
          or (select auth_is_global_admin())
        )
    )
  );

-- ritual_tasks
drop policy if exists "ritual_tasks via calendario tenant" on public.ritual_tasks;

create policy "ritual_tasks tenant read"
  on public.ritual_tasks for select to authenticated
  using (
    exists (
      select 1 from public.calendario_axe e
      where e.id = ritual_tasks.event_id
        and (
          e.tenant_id in (select auth_user_tenant_ids())
          or e.lider_id in (select auth_user_tenant_ids())
          or (select auth_is_global_admin())
        )
    )
  );

create policy "ritual_tasks lider write"
  on public.ritual_tasks for all to authenticated
  using (
    exists (
      select 1 from public.calendario_axe e
      where e.id = ritual_tasks.event_id
        and (
          e.tenant_id in (select auth_lider_tenant_ids())
          or e.lider_id in (select auth_lider_tenant_ids())
          or (select auth_is_global_admin())
        )
    )
  )
  with check (
    exists (
      select 1 from public.calendario_axe e
      where e.id = ritual_tasks.event_id
        and (
          e.tenant_id in (select auth_lider_tenant_ids())
          or e.lider_id in (select auth_lider_tenant_ids())
          or (select auth_is_global_admin())
        )
    )
  );

-- notificacoes
drop policy if exists "notificacoes tenant access" on public.notificacoes;

create policy "notificacoes tenant read"
  on public.notificacoes for select to authenticated
  using (tenant_id in (select auth_user_tenant_ids()) or (select auth_is_global_admin()));

create policy "notificacoes lider insert"
  on public.notificacoes for insert to authenticated
  with check (tenant_id in (select auth_lider_tenant_ids()) or (select auth_is_global_admin()));

create policy "notificacoes filho insert own"
  on public.notificacoes for insert to authenticated
  with check (
    tenant_id in (select auth_user_tenant_ids())
    and tipo in ('biblioteca_duvida')
    and exists (select 1 from public.filhos_de_santo f where f.user_id = (select auth.uid()))
  );

create policy "notificacoes lider update"
  on public.notificacoes for update to authenticated
  using (tenant_id in (select auth_lider_tenant_ids()) or (select auth_is_global_admin()))
  with check (tenant_id in (select auth_lider_tenant_ids()) or (select auth_is_global_admin()));

create policy "notificacoes lider delete"
  on public.notificacoes for delete to authenticated
  using (tenant_id in (select auth_lider_tenant_ids()) or (select auth_is_global_admin()));

-- pedidos_reza
drop policy if exists "pedidos_reza_select_gestor" on public.pedidos_reza;
drop policy if exists "pedidos_reza_update_gestor" on public.pedidos_reza;

create policy "pedidos_reza_select_gestor"
  on public.pedidos_reza for select to authenticated
  using (
    tenant_id in (select auth_lider_tenant_ids())
    or lider_id = (select auth.uid())
    or (select auth_is_global_admin())
  );

create policy "pedidos_reza_update_gestor"
  on public.pedidos_reza for update to authenticated
  using (
    tenant_id in (select auth_lider_tenant_ids())
    or lider_id = (select auth.uid())
    or (select auth_is_global_admin())
  )
  with check (
    tenant_id in (select auth_lider_tenant_ids())
    or lider_id = (select auth.uid())
    or (select auth_is_global_admin())
  );

-- pedidos_reza_mensagens
drop policy if exists "pedidos_reza_mensagens_select_gestor" on public.pedidos_reza_mensagens;
drop policy if exists "pedidos_reza_mensagens_insert_gestor" on public.pedidos_reza_mensagens;

create policy "pedidos_reza_mensagens_select_gestor"
  on public.pedidos_reza_mensagens for select to authenticated
  using (
    exists (
      select 1 from public.pedidos_reza p
      where p.id = pedidos_reza_mensagens.pedido_id
        and (
          p.tenant_id in (select auth_lider_tenant_ids())
          or p.lider_id = (select auth.uid())
          or (select auth_is_global_admin())
        )
    )
  );

create policy "pedidos_reza_mensagens_insert_gestor"
  on public.pedidos_reza_mensagens for insert to authenticated
  with check (
    exists (
      select 1 from public.pedidos_reza p
      where p.id = pedidos_reza_mensagens.pedido_id
        and (
          p.tenant_id in (select auth_lider_tenant_ids())
          or p.lider_id = (select auth.uid())
          or (select auth_is_global_admin())
        )
    )
  );

-- subscriptions: filho não lê billing do zelador
drop policy if exists "subscriptions tenant read" on public.subscriptions;

create policy "subscriptions tenant read"
  on public.subscriptions for select to authenticated
  using (
    id = (select auth.uid())
    or id in (select auth_lider_tenant_ids())
    or (select auth_is_global_admin())
  );

-- loja_pedidos
drop policy if exists "loja_pedidos_select_gestor" on public.loja_pedidos;

create policy "loja_pedidos_select_gestor"
  on public.loja_pedidos for select to authenticated
  using (
    tenant_id in (select auth_lider_tenant_ids())
    or filho_id in (select auth_filho_row_ids())
    or (select auth_is_global_admin())
  );

-- perfil_lider: update só para zeladores reais (não filhos com shadow)
drop policy if exists "perfil self write" on public.perfil_lider;

create policy "perfil lider self write"
  on public.perfil_lider for update to authenticated
  using (
    id = (select auth.uid())
    and id in (select auth_lider_tenant_ids())
  )
  with check (
    id = (select auth.uid())
    and id in (select auth_lider_tenant_ids())
  );

-- global_settings: deny-by-default para authenticated (só service_role)
alter table if exists public.global_settings enable row level security;
