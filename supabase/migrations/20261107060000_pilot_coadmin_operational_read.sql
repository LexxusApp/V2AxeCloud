begin;
-- Read-only, test-tenant-only rights for currently active delegated operations.
-- Existing owner policies remain unchanged.
do $$
declare tab text;
begin
 foreach tab in array array[
   'piloto_gira_preparacao',
   'piloto_chat_preferencias',
   'piloto_entregas_pedidos',
   'piloto_estoque_itens',
   'piloto_estoque_movimentos'
 ] loop
   execute format('drop policy if exists pilot_coadmin_operational_read on public.%I', tab);
   execute format(
     'create policy pilot_coadmin_operational_read on public.%I for select to authenticated using (tenant_id = %L::uuid and public.piloto_is_coadministrador(tenant_id, (select auth.uid())))',
     tab, 'fad75b91-d2eb-4805-b5a3-c19e8a073bed'
   );
 end loop;
end $$;
commit;
