-- Reparação / criação completa (idempotente). Preferir: supabase/scripts/run_audit_logs_in_sql_editor.sql

create extension if not exists "pgcrypto";

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

alter table public.audit_logs add column if not exists action text;
alter table public.audit_logs add column if not exists status text;
alter table public.audit_logs add column if not exists terreiro_id uuid;
alter table public.audit_logs add column if not exists details jsonb;
alter table public.audit_logs add column if not exists ip text;
alter table public.audit_logs add column if not exists user_agent text;
alter table public.audit_logs add column if not exists user_id uuid;
alter table public.audit_logs add column if not exists user_email text;

update public.audit_logs set action = coalesce(action, 'legacy.unknown') where action is null;
update public.audit_logs set status = coalesce(status, 'failed') where status is null;

alter table public.audit_logs alter column action set not null;
alter table public.audit_logs alter column status set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'audit_logs_status_check'
      and conrelid = 'public.audit_logs'::regclass
  ) then
    alter table public.audit_logs
      add constraint audit_logs_status_check check (status in ('success', 'failed'));
  end if;
end $$;

create index if not exists idx_audit_logs_created_at on public.audit_logs (created_at desc);
create index if not exists idx_audit_logs_action on public.audit_logs (action);
create index if not exists idx_audit_logs_status on public.audit_logs (status);
create index if not exists idx_audit_logs_terreiro on public.audit_logs (terreiro_id);
create index if not exists idx_audit_logs_user on public.audit_logs (user_id);

alter table public.audit_logs enable row level security;
