begin;

-- The legacy tenant ID was the requesting account. Keep its history available
-- to support even when the owner no longer has a leader profile.
do $$
declare
  legacy public.piloto_suporte_chamados;
  imported uuid;
begin
  for legacy in
    select previous.*
    from public.piloto_suporte_chamados previous
    where not exists (select from public.support_tickets where id = previous.id)
      and length(btrim(previous.dados->>'subject')) between 3 and 120
      and length(btrim(previous.dados->>'text')) between 5 and 4000
  loop
    insert into public.support_tickets
      (id, owner_id, tenant_id, house_name, owner_name, subject, description, status, created_at, updated_at)
    values (legacy.id, legacy.tenant_id, legacy.tenant_id,
      coalesce(nullif(legacy.dados->>'house', ''), 'Terreiro'),
      coalesce(nullif(legacy.dados->>'responsible', ''), 'Zeladoria'),
      legacy.dados->>'subject', legacy.dados->>'text', legacy.status, legacy.created_at, legacy.updated_at)
    on conflict (id) do nothing returning id into imported;
    if imported is null then continue; end if;

    insert into public.support_messages (id, ticket_id, author_id, author_role, body, created_at)
    select message.id, imported, legacy.tenant_id, 'owner', message.texto, message.created_at
    from public.piloto_suporte_complementos message
    where message.chamado_id = imported and message.tenant_id = legacy.tenant_id
    on conflict (id) do nothing;

    update public.support_tickets set status = legacy.status where id = imported;
  end loop;
end;
$$;

commit;
