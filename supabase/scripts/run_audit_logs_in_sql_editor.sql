-- =============================================================================
-- COLE E EXECUTE ESTE FICHEIRO INTEIRO no Supabase → SQL Editor → Run
-- (cria a tabela do zero OU completa colunas em falta)
-- =============================================================================

create extension if not exists "pgcrypto";

-- 1) Criar tabela base (se não existir)
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

-- 2) Garantir todas as colunas
alter table public.audit_logs add column if not exists action text;
alter table public.audit_logs add column if not exists status text;
alter table public.audit_logs add column if not exists terreiro_id uuid;
alter table public.audit_logs add column if not exists details jsonb;
alter table public.audit_logs add column if not exists ip text;
alter table public.audit_logs add column if not exists user_agent text;
alter table public.audit_logs add column if not exists user_id uuid;
alter table public.audit_logs add column if not exists user_email text;

-- 3) Preencher linhas antigas (se houver) antes de NOT NULL
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

-- 4) Índices
create index if not exists idx_audit_logs_created_at on public.audit_logs (created_at desc);
create index if not exists idx_audit_logs_action on public.audit_logs (action);
create index if not exists idx_audit_logs_status on public.audit_logs (status);
create index if not exists idx_audit_logs_terreiro on public.audit_logs (terreiro_id);
create index if not exists idx_audit_logs_user on public.audit_logs (user_id);

-- 5) RLS (só backend com service_role escreve)
alter table public.audit_logs enable row level security;
