-- Falhas de funções/recursos tentados pelos terreiros (monitor de saúde).
create table if not exists public.tenant_feature_failures (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  tenant_id uuid,
  feature text not null,
  route text,
  http_status int,
  source text not null default 'api',
  error_message text,
  error_fingerprint text,
  metadata jsonb not null default '{}'::jsonb,
  resolved_at timestamptz
);

create index if not exists tenant_feature_failures_created_idx on public.tenant_feature_failures (created_at desc);
create index if not exists tenant_feature_failures_tenant_created_idx on public.tenant_feature_failures (tenant_id, created_at desc);
create index if not exists tenant_feature_failures_feature_created_idx on public.tenant_feature_failures (feature, created_at desc);
create index if not exists tenant_feature_failures_fp_created_idx on public.tenant_feature_failures (error_fingerprint, created_at desc);
alter table public.tenant_feature_failures enable row level security;
notify pgrst, 'reload schema';
