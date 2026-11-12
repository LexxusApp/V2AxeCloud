begin;

alter table public.support_tickets
  add column category text check (category in ('duvida', 'financeiro', 'filhos', 'gira', 'sugestao'));

-- Only invalidation markers are published. The API remains the source of ticket data.
create table public.support_activity (
  audience_id uuid primary key,
  changed_at timestamptz not null default clock_timestamp()
);
alter table public.support_activity enable row level security;
revoke all on public.support_activity from public, anon, authenticated;
grant select on public.support_activity to authenticated;

create policy "support activity by recipient"
on public.support_activity for select to authenticated using (
  audience_id = (select auth.uid())
  or (audience_id = '00000000-0000-0000-0000-000000000000' and (select axecloud_private.auth_is_global_admin()))
);

alter publication supabase_realtime add table public.support_activity;

create function axecloud_private.signal_support_activity()
returns trigger language plpgsql security definer set search_path = pg_catalog, pg_temp as $$
begin
  insert into public.support_activity as activity (audience_id)
  select distinct audience from unnest(array[new.owner_id, '00000000-0000-0000-0000-000000000000'::uuid]) as audience
  order by audience
  on conflict (audience_id) do update set changed_at = clock_timestamp();
  return new;
end;
$$;
revoke all on function axecloud_private.signal_support_activity() from public, anon, authenticated;

-- Replies already update the ticket atomically, so one trigger covers all changes.
create trigger support_ticket_signal_activity
after insert or update on public.support_tickets
for each row execute function axecloud_private.signal_support_activity();

notify pgrst, 'reload schema';
commit;
