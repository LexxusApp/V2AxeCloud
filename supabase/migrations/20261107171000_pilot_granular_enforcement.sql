begin;
-- Security boundary: disable legacy blanket leader privileges for pilot delegates.
-- The owner and every non-pilot tenant retain their former access.
create or replace function axecloud_private.auth_lider_tenant_ids()
returns setof uuid language sql stable security definer set search_path=public,axecloud_private,pg_temp as $$
 select coalesce(p.tenant_id,p.id)
 from public.perfil_lider p
 where p.id=(select auth.uid())
   and (
     coalesce(p.tenant_id,p.id) <> 'fad75b91-d2eb-4805-b5a3-c19e8a073bed'::uuid
     or p.id = 'fad75b91-d2eb-4805-b5a3-c19e8a073bed'::uuid
   );
$$;
grant execute on function axecloud_private.auth_lider_tenant_ids() to authenticated,service_role;

create or replace function public.piloto_zelador_ativo(p_tenant uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select p_tenant is not null and (select auth.uid())=p_tenant
 and exists(
  select 1 from public.perfil_lider p
  where p.id=(select auth.uid())
  and coalesce(nullif(to_jsonb(p)->>'tenant_id',''),p.id::text)=p_tenant::text
  and lower(coalesce(nullif(to_jsonb(p)->>'role',''),'')) in ('admin','zelador','lider','leader')
  and lower(coalesce(to_jsonb(p)->>'status','')) not in ('blocked','deleted')
  and coalesce((to_jsonb(p)->>'is_blocked')::boolean,false)=false
  and nullif(to_jsonb(p)->>'deleted_at','') is null
  and not exists(
   select 1 from public.subscriptions s where s.id=(select auth.uid())
   and (lower(coalesce(to_jsonb(s)->>'status','')) in ('blocked','deleted')
   or lower(coalesce(to_jsonb(s)->>'role',''))='filho')
  )
 );
$$;

-- The broad coadmin operational policies were installed before individual rights existed.
do $$
declare table_name text;
begin
 foreach table_name in array array['piloto_chat_preferencias','piloto_entregas_pedidos',
 'piloto_estoque_itens','piloto_estoque_movimentos','piloto_gira_preparacao'] loop
  execute format('drop policy if exists pilot_coadmin_operational_read on public.%I',table_name);
 end loop;
end $$;

-- Directly tenant-scoped tables. Legacy member self-access policies remain.
do $$
declare item record; cond_read text;cond_write text;
begin
 for item in select * from (values
 ('filhos_de_santo','members'),
 ('calendario_axe','giras'),
 ('evento_participantes','giras'),
 ('evento_senhas','giras'),
 ('gira_velas','giras'),
 ('preceito_ciclos','giras'),
 ('preceito_participantes','giras'),
 ('piloto_gira_preparacao','giras'),
 ('financeiro','finance'),
 ('caixinha_metas','finance'),
 ('piloto_financeiro_acoes','finance'),
 ('cantina_cardapio','cantina'),
 ('piloto_avisos_cantina','cantina'),
 ('piloto_entregas_pedidos','cantina'),
 ('almoxarifado','inventory'),
 ('piloto_estoque_itens','inventory'),
 ('piloto_estoque_movimentos','inventory'),
 ('mural_avisos','communications'),
 ('notificacoes','communications'),
 ('chat_conversations','communications'),
 ('chat_messages','communications'),
 ('piloto_comunicados','communications'),
 ('piloto_comunicados_envios','communications'),
 ('piloto_chat_preferencias','communications'),
 ('gallery_albums','gallery'),
 ('gallery_media','gallery'),
 ('piloto_capas_galeria','gallery'),
 ('biblioteca','library'),
 ('biblioteca_comentarios','library'),
 ('fundamentos_acervo','library'),
 ('fundamentos_acessos','library'),
 ('fundamentos_audit_logs','library'),
 ('produtos','store'),
 ('pedidos','store'),
 ('loja_pedidos','store'),
 ('piloto_radar_perfis','radar')
 ) as t(table_name,module_name) loop
  cond_read:=format('tenant_id = %L::uuid AND public.piloto_tem_permissao(tenant_id,(select auth.uid()),%L,''visualizar'')','fad75b91-d2eb-4805-b5a3-c19e8a073bed',item.module_name);
  cond_write:=format('tenant_id = %L::uuid AND public.piloto_tem_permissao(tenant_id,(select auth.uid()),%L,''gerenciar'')','fad75b91-d2eb-4805-b5a3-c19e8a073bed',item.module_name);
  execute format('drop policy if exists pilot_granular_read on public.%I',item.table_name);
  execute format('drop policy if exists pilot_granular_insert on public.%I',item.table_name);
  execute format('drop policy if exists pilot_granular_update on public.%I',item.table_name);
  execute format('drop policy if exists pilot_granular_delete on public.%I',item.table_name);
  execute format('create policy pilot_granular_read on public.%I for select to authenticated using (%s)',item.table_name,cond_read);
  execute format('create policy pilot_granular_insert on public.%I for insert to authenticated with check (%s)',item.table_name,cond_write);
  execute format('create policy pilot_granular_update on public.%I for update to authenticated using (%s) with check (%s)',item.table_name,cond_write,cond_write);
  execute format('create policy pilot_granular_delete on public.%I for delete to authenticated using (%s)',item.table_name,cond_write);
 end loop;
end $$;

-- Relationships whose tenant is stored on the parent row.
do $$
declare item record;cond_read text;cond_write text;
begin
 for item in select * from (values
 ('convidados_eventos','giras','calendario_axe','event_id'),
 ('ritual_tasks','giras','calendario_axe','event_id'),
 ('caixinha_doacoes','finance','caixinha_metas','meta_id'),
 ('itens_pedido','store','pedidos','pedido_id')
 ) as t(table_name,module_name,parent_table,parent_id_column) loop
  cond_read:=format('exists(select 1 from public.%I parent where parent.id=%I.%I and parent.tenant_id=%L::uuid and public.piloto_tem_permissao(parent.tenant_id,(select auth.uid()),%L,''visualizar''))',
   item.parent_table,item.table_name,item.parent_id_column,'fad75b91-d2eb-4805-b5a3-c19e8a073bed',item.module_name);
  cond_write:=replace(cond_read,'''visualizar''','''gerenciar''');
  execute format('drop policy if exists pilot_granular_read on public.%I',item.table_name);
  execute format('drop policy if exists pilot_granular_insert on public.%I',item.table_name);
  execute format('drop policy if exists pilot_granular_update on public.%I',item.table_name);
  execute format('drop policy if exists pilot_granular_delete on public.%I',item.table_name);
  execute format('create policy pilot_granular_read on public.%I for select to authenticated using (%s)',item.table_name,cond_read);
  execute format('create policy pilot_granular_insert on public.%I for insert to authenticated with check (%s)',item.table_name,cond_write);
  execute format('create policy pilot_granular_update on public.%I for update to authenticated using (%s) with check (%s)',item.table_name,cond_write,cond_write);
  execute format('create policy pilot_granular_delete on public.%I for delete to authenticated using (%s)',item.table_name,cond_write);
 end loop;
end $$;
commit;
