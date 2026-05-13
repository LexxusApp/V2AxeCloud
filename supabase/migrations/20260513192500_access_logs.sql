-- Tabela rica de logs de auditoria/acesso.
-- Eventos suportados: login.success, login.failure, filho.login, tenant.created, tenant.blocked,
-- tenant.unblocked, tenant.deleted, tenant.plan-changed, tenant.renewed, tenant.set-lifetime,
-- tenant.password-reset, demo.created, whatsapp.connect, whatsapp.disconnect,
-- whatsapp.test-message, welcome-message.updated, plans.updated, etc.

create extension if not exists "pgcrypto";

create table if not exists public.access_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  event_type text not null,
  user_id uuid,
  user_email text,
  target_type text,
  target_id text,
  description text,
  ip text,
  user_agent text,
  city text,
  region text,
  country text,
  metadata jsonb,
  tenant_id uuid
);

create index if not exists idx_access_logs_created_at on public.access_logs (created_at desc);
create index if not exists idx_access_logs_user on public.access_logs (user_id);
create index if not exists idx_access_logs_event on public.access_logs (event_type);
create index if not exists idx_access_logs_tenant on public.access_logs (tenant_id);
create index if not exists idx_access_logs_target on public.access_logs (target_type, target_id);

-- RLS ligado: clientes anon/authenticated não vêem nada. Service role bypassa RLS,
-- portanto apenas o backend (que usa SERVICE_ROLE_KEY) consegue ler/escrever.
alter table public.access_logs enable row level security;

-- (Opcional) policy para permitir que cada usuário veja apenas os seus próprios eventos.
-- Descomente caso queira expor o histórico para o filho/zelador no app:
-- drop policy if exists "owner_can_read_own_access_logs" on public.access_logs;
-- create policy "owner_can_read_own_access_logs"
--   on public.access_logs for select
--   using (auth.uid() = user_id);
