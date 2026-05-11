-- WhatsApp integration tables (Evolution API)
-- whatsapp_config: per-tenant configuration and message templates
-- whatsapp_logs:   audit log of outbound messages

create table if not exists public.whatsapp_config (
  id uuid primary key,
  tenant_id uuid not null unique,
  templates jsonb not null default '{}'::jsonb,
  instance_name text,
  phone_number text,
  status text default 'DISCONNECTED',
  qr_code text,
  evolution_api_url text,
  evolution_api_token text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists whatsapp_config_tenant_idx on public.whatsapp_config (tenant_id);

create table if not exists public.whatsapp_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  filho_id uuid,
  tipo text,
  telefone text,
  mensagem text,
  status text not null default 'sent',
  external_id text unique,
  created_at timestamptz not null default now()
);

create index if not exists whatsapp_logs_tenant_idx on public.whatsapp_logs (tenant_id);
create index if not exists whatsapp_logs_external_idx on public.whatsapp_logs (external_id);

alter table public.whatsapp_config enable row level security;
alter table public.whatsapp_logs enable row level security;

drop policy if exists "whatsapp_config tenant read" on public.whatsapp_config;
create policy "whatsapp_config tenant read"
  on public.whatsapp_config
  for select
  to authenticated
  using (tenant_id = auth.uid());

drop policy if exists "whatsapp_config tenant write" on public.whatsapp_config;
create policy "whatsapp_config tenant write"
  on public.whatsapp_config
  for all
  to authenticated
  using (tenant_id = auth.uid())
  with check (tenant_id = auth.uid());

drop policy if exists "whatsapp_logs tenant read" on public.whatsapp_logs;
create policy "whatsapp_logs tenant read"
  on public.whatsapp_logs
  for select
  to authenticated
  using (tenant_id = auth.uid());

-- service_role bypassa RLS automaticamente; inserts são feitos pelo backend via supabaseAdmin.

notify pgrst, 'reload schema';
