-- Per-account inbox state shared by desktop and mobile; no notification content is copied.
create table if not exists public.notification_inbox_state (
  user_id uuid not null references auth.users(id) on delete cascade,
  tenant_id uuid not null,
  notification_id text not null check (length(notification_id) between 1 and 180),
  first_seen_at timestamptz not null default now(),
  read_at timestamptz,
  dismissed_at timestamptz,
  primary key (user_id, tenant_id, notification_id)
);
alter table public.notification_inbox_state enable row level security;
revoke all on public.notification_inbox_state from anon, authenticated;
grant select, insert, update on public.notification_inbox_state to authenticated;

drop policy if exists inbox_owner on public.notification_inbox_state;
create policy inbox_owner on public.notification_inbox_state for all to authenticated
using (
  user_id = (select auth.uid()) and
  (tenant_id in (select axecloud_private.auth_user_tenant_ids()) or (select axecloud_private.auth_is_global_admin()))
)
with check (
  user_id = (select auth.uid()) and
  (tenant_id in (select axecloud_private.auth_user_tenant_ids()) or (select axecloud_private.auth_is_global_admin()))
);

create or replace function public.sync_notification_inbox(
  p_tenant_id uuid, p_ids text[] default '{}', p_actions jsonb default '[]'
)
returns setof public.notification_inbox_state
language plpgsql security invoker set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null or p_tenant_id is null or not coalesce((
    p_tenant_id in (select axecloud_private.auth_user_tenant_ids()) or axecloud_private.auth_is_global_admin()
  ), false) then
    raise exception 'Acesso não autorizado' using errcode = '42501';
  end if;
  if coalesce(array_length(p_ids, 1), 0) > 100 or jsonb_typeof(p_actions) <> 'array'
     or jsonb_array_length(p_actions) > 1000 then
    raise exception 'Lote de notificações inválido' using errcode = '22023';
  end if;

  insert into public.notification_inbox_state (user_id, tenant_id, notification_id)
  select v_user, p_tenant_id, id from unnest(p_ids) id
  where length(id) between 1 and 180
  on conflict do nothing;

  insert into public.notification_inbox_state as existing
    (user_id, tenant_id, notification_id, read_at, dismissed_at)
  select v_user, p_tenant_id, action->>'id', now(),
    case when bool_or(action->>'action' = 'dismiss') then now() end
  from jsonb_array_elements(p_actions) action
  where action->>'action' in ('read', 'dismiss') and length(action->>'id') between 1 and 180
  group by action->>'id'
  on conflict (user_id, tenant_id, notification_id) do update
  set read_at = coalesce(existing.read_at, excluded.read_at),
      dismissed_at = coalesce(existing.dismissed_at, excluded.dismissed_at);

  return query select state.* from public.notification_inbox_state state
  where state.user_id = v_user and state.tenant_id = p_tenant_id;
end;
$$;
revoke all on function public.sync_notification_inbox(uuid, text[], jsonb) from public, anon;
grant execute on function public.sync_notification_inbox(uuid, text[], jsonb) to authenticated;
