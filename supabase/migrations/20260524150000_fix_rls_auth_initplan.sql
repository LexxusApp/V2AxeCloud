-- M7: otimiza policies RLS — auth.uid()/helpers avaliados uma vez por query (initplan).
-- Ref: https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select

create or replace function public.auth_user_tenant_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(p.tenant_id, p.id)
  from public.perfil_lider p
  where p.id = (select auth.uid())
  union
  select coalesce(f.tenant_id, f.lider_id)
  from public.filhos_de_santo f
  where f.user_id = (select auth.uid());
$$;

create or replace function public.auth_is_global_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select is_admin_global from public.perfil_lider where id = (select auth.uid())),
    false
  );
$$;

-- filhos_de_santo
drop policy if exists "filhos tenant read" on public.filhos_de_santo;
create policy "filhos tenant read"
  on public.filhos_de_santo for select to authenticated
  using (
    user_id = (select auth.uid())
    or tenant_id in (select auth_user_tenant_ids())
    or lider_id in (select auth_user_tenant_ids())
    or (select auth_is_global_admin())
  );

drop policy if exists "filhos tenant write" on public.filhos_de_santo;
create policy "filhos tenant write"
  on public.filhos_de_santo for all to authenticated
  using (
    tenant_id in (select auth_user_tenant_ids())
    or lider_id in (select auth_user_tenant_ids())
    or (select auth_is_global_admin())
  )
  with check (
    tenant_id in (select auth_user_tenant_ids())
    or lider_id in (select auth_user_tenant_ids())
    or (select auth_is_global_admin())
  );

-- perfil_lider
drop policy if exists "perfil self read" on public.perfil_lider;
create policy "perfil self read"
  on public.perfil_lider for select to authenticated
  using (
    id = (select auth.uid())
    or tenant_id in (select auth_user_tenant_ids())
    or (select auth_is_global_admin())
  );

drop policy if exists "perfil self write" on public.perfil_lider;
create policy "perfil self write"
  on public.perfil_lider for update to authenticated
  using (id = (select auth.uid()) or (select auth_is_global_admin()))
  with check (id = (select auth.uid()) or (select auth_is_global_admin()));

-- push_subscriptions
drop policy if exists "push own rows" on public.push_subscriptions;
create policy "push own rows"
  on public.push_subscriptions for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- subscriptions
drop policy if exists "subscriptions tenant read" on public.subscriptions;
create policy "subscriptions tenant read"
  on public.subscriptions for select to authenticated
  using (
    id = (select auth.uid())
    or id in (select auth_user_tenant_ids())
    or (select auth_is_global_admin())
  );

-- whatsapp
drop policy if exists "whatsapp_config tenant read" on public.whatsapp_config;
create policy "whatsapp_config tenant read"
  on public.whatsapp_config for select to authenticated
  using (tenant_id = (select auth.uid()) or (select auth_is_global_admin()));

drop policy if exists "whatsapp_config tenant write" on public.whatsapp_config;
create policy "whatsapp_config tenant write"
  on public.whatsapp_config for all to authenticated
  using (tenant_id = (select auth.uid()) or (select auth_is_global_admin()))
  with check (tenant_id = (select auth.uid()) or (select auth_is_global_admin()));

drop policy if exists "whatsapp_logs tenant read" on public.whatsapp_logs;
create policy "whatsapp_logs tenant read"
  on public.whatsapp_logs for select to authenticated
  using (tenant_id = (select auth.uid()) or (select auth_is_global_admin()));

-- preferencias_usuario (remove duplicata legada)
drop policy if exists "Users can manage their own preferences" on public.preferencias_usuario;
drop policy if exists "Users can view own preferences" on public.preferencias_usuario;
drop policy if exists "preferencias own rows" on public.preferencias_usuario;
create policy "preferencias own rows"
  on public.preferencias_usuario for all to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- loja_pedidos
drop policy if exists "loja_pedidos_insert_filho" on public.loja_pedidos;
create policy "loja_pedidos_insert_filho"
  on public.loja_pedidos for insert to authenticated
  with check (
    exists (
      select 1 from public.filhos_de_santo f
      where f.id = loja_pedidos.filho_id
        and f.user_id = (select auth.uid())
        and (loja_pedidos.tenant_id = f.tenant_id or loja_pedidos.tenant_id = f.lider_id)
    )
  );

drop policy if exists "loja_pedidos_select_gestor" on public.loja_pedidos;
create policy "loja_pedidos_select_gestor"
  on public.loja_pedidos for select to authenticated
  using (
    tenant_id in (select auth_user_tenant_ids())
    or (select auth_is_global_admin())
  );

-- pedidos / itens_pedido (substitui subqueries perfil_lider.id = auth.uid())
drop policy if exists "Isolamento por Terreiro - Pedidos Insert" on public.pedidos;
drop policy if exists "Isolamento por Terreiro - Pedidos Select" on public.pedidos;
drop policy if exists "Isolamento por Terreiro - Pedidos Update" on public.pedidos;

create policy "pedidos tenant insert"
  on public.pedidos for insert to authenticated
  with check (tenant_id in (select auth_user_tenant_ids()) or (select auth_is_global_admin()));

create policy "pedidos tenant select"
  on public.pedidos for select to authenticated
  using (
    tenant_id in (select auth_user_tenant_ids())
    or filho_id in (select id from public.filhos_de_santo where user_id = (select auth.uid()))
    or (select auth_is_global_admin())
  );

create policy "pedidos tenant update"
  on public.pedidos for update to authenticated
  using (tenant_id in (select auth_user_tenant_ids()) or (select auth_is_global_admin()))
  with check (tenant_id in (select auth_user_tenant_ids()) or (select auth_is_global_admin()));

drop policy if exists "Isolamento por Terreiro - Itens Pedido Insert" on public.itens_pedido;
drop policy if exists "Isolamento por Terreiro - Itens Pedido Select" on public.itens_pedido;

create policy "itens_pedido tenant access"
  on public.itens_pedido for all to authenticated
  using (
    exists (
      select 1 from public.pedidos p
      where p.id = itens_pedido.pedido_id
        and (
          p.tenant_id in (select auth_user_tenant_ids())
          or p.filho_id in (select id from public.filhos_de_santo where user_id = (select auth.uid()))
          or (select auth_is_global_admin())
        )
    )
  )
  with check (
    exists (
      select 1 from public.pedidos p
      where p.id = itens_pedido.pedido_id
        and (p.tenant_id in (select auth_user_tenant_ids()) or (select auth_is_global_admin()))
    )
  );

-- policies tenant-scoped: wrap auth_is_global_admin() em (select ...)
drop policy if exists "almoxarifado tenant access" on public.almoxarifado;
create policy "almoxarifado tenant access"
  on public.almoxarifado for all to authenticated
  using (
    tenant_id in (select auth_user_tenant_ids())
    or lider_id in (select auth_user_tenant_ids())
    or (select auth_is_global_admin())
  )
  with check (
    tenant_id in (select auth_user_tenant_ids())
    or lider_id in (select auth_user_tenant_ids())
    or (select auth_is_global_admin())
  );

drop policy if exists "biblioteca tenant access" on public.biblioteca;
create policy "biblioteca tenant access"
  on public.biblioteca for all to authenticated
  using (tenant_id in (select auth_user_tenant_ids()) or (select auth_is_global_admin()))
  with check (tenant_id in (select auth_user_tenant_ids()) or (select auth_is_global_admin()));

drop policy if exists "biblioteca_comentarios tenant access" on public.biblioteca_comentarios;
create policy "biblioteca_comentarios tenant access"
  on public.biblioteca_comentarios for all to authenticated
  using (
    tenant_id in (select auth_user_tenant_ids())
    or (select auth_is_global_admin())
    or user_id = (select auth.uid())
  )
  with check (
    tenant_id in (select auth_user_tenant_ids())
    or (select auth_is_global_admin())
    or user_id = (select auth.uid())
  );

drop policy if exists "caixinha_metas tenant access" on public.caixinha_metas;
create policy "caixinha_metas tenant access"
  on public.caixinha_metas for all to authenticated
  using (tenant_id in (select auth_user_tenant_ids()) or (select auth_is_global_admin()))
  with check (tenant_id in (select auth_user_tenant_ids()) or (select auth_is_global_admin()));

drop policy if exists "caixinha_doacoes tenant access" on public.caixinha_doacoes;
create policy "caixinha_doacoes tenant access"
  on public.caixinha_doacoes for all to authenticated
  using (
    exists (
      select 1 from public.caixinha_metas m
      where m.id = caixinha_doacoes.meta_id
        and (m.tenant_id in (select auth_user_tenant_ids()) or (select auth_is_global_admin()))
    )
    or (select auth_is_global_admin())
  )
  with check (
    exists (
      select 1 from public.caixinha_metas m
      where m.id = caixinha_doacoes.meta_id
        and (m.tenant_id in (select auth_user_tenant_ids()) or (select auth_is_global_admin()))
    )
    or (select auth_is_global_admin())
  );

drop policy if exists "calendario tenant access" on public.calendario_axe;
create policy "calendario tenant access"
  on public.calendario_axe for all to authenticated
  using (
    tenant_id in (select auth_user_tenant_ids())
    or lider_id in (select auth_user_tenant_ids())
    or (select auth_is_global_admin())
  )
  with check (
    tenant_id in (select auth_user_tenant_ids())
    or lider_id in (select auth_user_tenant_ids())
    or (select auth_is_global_admin())
  );

drop policy if exists "pix tenant read" on public.configuracoes_pix;
drop policy if exists "pix zelador delete" on public.configuracoes_pix;
drop policy if exists "pix zelador update" on public.configuracoes_pix;
drop policy if exists "pix zelador write" on public.configuracoes_pix;

create policy "pix tenant read"
  on public.configuracoes_pix for select to authenticated
  using (terreiro_id in (select auth_user_tenant_ids()) or (select auth_is_global_admin()));

create policy "pix zelador delete"
  on public.configuracoes_pix for delete to authenticated
  using (terreiro_id in (select auth_user_tenant_ids()) or (select auth_is_global_admin()));

create policy "pix zelador update"
  on public.configuracoes_pix for update to authenticated
  using (terreiro_id in (select auth_user_tenant_ids()) or (select auth_is_global_admin()))
  with check (terreiro_id in (select auth_user_tenant_ids()) or (select auth_is_global_admin()));

create policy "pix zelador write"
  on public.configuracoes_pix for insert to authenticated
  with check (terreiro_id in (select auth_user_tenant_ids()) or (select auth_is_global_admin()));

drop policy if exists "convidados via calendario tenant" on public.convidados_eventos;
create policy "convidados via calendario tenant"
  on public.convidados_eventos for all to authenticated
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
  )
  with check (
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

drop policy if exists "financeiro tenant access" on public.financeiro;
create policy "financeiro tenant access"
  on public.financeiro for all to authenticated
  using (
    tenant_id in (select auth_user_tenant_ids())
    or lider_id in (select auth_user_tenant_ids())
    or (select auth_is_global_admin())
  )
  with check (
    tenant_id in (select auth_user_tenant_ids())
    or lider_id in (select auth_user_tenant_ids())
    or (select auth_is_global_admin())
  );

drop policy if exists "gallery_albums tenant access" on public.gallery_albums;
create policy "gallery_albums tenant access"
  on public.gallery_albums for all to authenticated
  using (tenant_id in (select auth_user_tenant_ids()) or (select auth_is_global_admin()))
  with check (tenant_id in (select auth_user_tenant_ids()) or (select auth_is_global_admin()));

drop policy if exists "gallery_media tenant access" on public.gallery_media;
create policy "gallery_media tenant access"
  on public.gallery_media for all to authenticated
  using (tenant_id in (select auth_user_tenant_ids()) or (select auth_is_global_admin()))
  with check (tenant_id in (select auth_user_tenant_ids()) or (select auth_is_global_admin()));

drop policy if exists "mural tenant access" on public.mural_avisos;
create policy "mural tenant access"
  on public.mural_avisos for all to authenticated
  using (tenant_id in (select auth_user_tenant_ids()) or (select auth_is_global_admin()))
  with check (tenant_id in (select auth_user_tenant_ids()) or (select auth_is_global_admin()));

drop policy if exists "notificacoes tenant access" on public.notificacoes;
create policy "notificacoes tenant access"
  on public.notificacoes for all to authenticated
  using (tenant_id in (select auth_user_tenant_ids()) or (select auth_is_global_admin()))
  with check (tenant_id in (select auth_user_tenant_ids()) or (select auth_is_global_admin()));

drop policy if exists "produtos tenant access" on public.produtos;
create policy "produtos tenant access"
  on public.produtos for all to authenticated
  using (tenant_id in (select auth_user_tenant_ids()) or (select auth_is_global_admin()))
  with check (tenant_id in (select auth_user_tenant_ids()) or (select auth_is_global_admin()));

drop policy if exists "ritual_tasks via calendario tenant" on public.ritual_tasks;
create policy "ritual_tasks via calendario tenant"
  on public.ritual_tasks for all to authenticated
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
  )
  with check (
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

notify pgrst, 'reload schema';
