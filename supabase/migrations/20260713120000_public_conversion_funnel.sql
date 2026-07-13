create table if not exists public.public_conversion_events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  event_name text not null check (event_name in ('cta_click', 'register_view', 'register_started', 'register_failed', 'register_completed')),
  visitor_id uuid not null,
  session_id uuid not null,
  tenant_id uuid null,
  path text not null default '/',
  cta_id text null,
  cta_label text null,
  referrer text null,
  user_agent text null,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists public_conversion_events_created_at_idx
  on public.public_conversion_events (created_at desc);
create index if not exists public_conversion_events_event_created_idx
  on public.public_conversion_events (event_name, created_at desc);
create index if not exists public_conversion_events_visitor_idx
  on public.public_conversion_events (visitor_id, created_at desc);

alter table public.public_conversion_events enable row level security;
revoke all on table public.public_conversion_events from anon, authenticated;
revoke all on sequence public.public_conversion_events_id_seq from anon, authenticated;
