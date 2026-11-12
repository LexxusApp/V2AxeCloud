begin;

create sequence public.support_ticket_protocol_seq as integer;
revoke all on sequence public.support_ticket_protocol_seq from public, anon, authenticated;
grant usage on sequence public.support_ticket_protocol_seq to service_role;

alter table public.support_tickets
  add column protocol integer,
  add column waiting_on text not null default 'support' check (waiting_on in ('owner', 'support'));

alter sequence public.support_ticket_protocol_seq owned by public.support_tickets.protocol;

with numbered as materialized (
  select id, nextval('public.support_ticket_protocol_seq') as protocol
  from public.support_tickets
  order by created_at, id
)
update public.support_tickets ticket
set protocol = numbered.protocol,
    waiting_on = case when latest.author_role = 'support' then 'owner' else 'support' end
from numbered
left join lateral (
  select author_role from public.support_messages
  where ticket_id = numbered.id
  order by created_at desc, id desc
  limit 1
) latest on true
where ticket.id = numbered.id;

alter table public.support_tickets
  alter column protocol set default nextval('public.support_ticket_protocol_seq'),
  alter column protocol set not null,
  add constraint support_ticket_protocol_unique unique (protocol);

create index support_tickets_status_recent on public.support_tickets (status, updated_at desc, id desc);
create index support_tickets_owner_status_recent on public.support_tickets (owner_id, status, updated_at desc, id desc);

create or replace function public.touch_support_ticket()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  update public.support_tickets
  set updated_at = greatest(updated_at, clock_timestamp()),
      waiting_on = case when new.author_role = 'support' then 'owner' else 'support' end
  where id = new.ticket_id and status = 'open';
  if not found then
    raise exception 'Chamado finalizado. Reabra para enviar uma mensagem.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

notify pgrst, 'reload schema';
commit;
