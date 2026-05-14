-- Monitoramento continuo da auditoria (Fase 4).
-- Permite cadastrar alvos (URLs/dominios) e armazenar historico das execucoes
-- (manuais ou agendadas via Vercel Cron).

create extension if not exists "pgcrypto";

-- ---------------- audit_targets ----------------

create table if not exists public.audit_targets (
  id uuid primary key default gen_random_uuid(),
  url text not null,
  label text,
  enabled boolean not null default true,
  run_dns boolean not null default true,
  run_psi boolean not null default false,
  alert_webhook text,
  alert_threshold int not null default 60,
  alert_grade text,
  schedule text not null default 'hourly',
  last_run_at timestamptz,
  last_score int,
  last_grade text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  notes text
);

create unique index if not exists idx_audit_targets_url_unique on public.audit_targets (url);
create index if not exists idx_audit_targets_enabled on public.audit_targets (enabled);
create index if not exists idx_audit_targets_schedule on public.audit_targets (schedule);

drop trigger if exists trg_audit_targets_updated_at on public.audit_targets;
create or replace function public._audit_targets_set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;
create trigger trg_audit_targets_updated_at
  before update on public.audit_targets
  for each row execute function public._audit_targets_set_updated_at();

alter table public.audit_targets enable row level security;

-- ---------------- audit_runs ----------------

create table if not exists public.audit_runs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  target_id uuid references public.audit_targets(id) on delete cascade,
  url text not null,
  source text not null default 'manual',           -- 'manual' | 'cron' | 'webhook'
  run_by uuid,                                      -- user_id (manual) ou null (cron)
  status text not null default 'ok',                -- 'ok' | 'error'
  error text,

  score_total int,
  score_grade text,

  security_grade text,
  security_score int,
  security_max int,

  performance_score int,                            -- PSI mobile, quando rodado
  accessibility_score int,
  best_practices_score int,
  seo_score int,

  http_status int,
  is_http2 boolean,

  issues_count int,
  issues_errors int,
  issues_warns int,

  dns_ok boolean,
  has_spf boolean,
  has_dmarc boolean,
  dkim_selectors int,
  domain_expires_at timestamptz,
  ssl_expires_at timestamptz,

  ran_dns boolean not null default false,
  ran_psi boolean not null default false,

  duration_ms int,
  delta_total int,                                  -- diff com a run anterior do mesmo url
  alerted boolean not null default false,

  result jsonb                                      -- snapshot completo (scan + dns + psi)
);

create index if not exists idx_audit_runs_target_created on public.audit_runs (target_id, created_at desc);
create index if not exists idx_audit_runs_url_created on public.audit_runs (url, created_at desc);
create index if not exists idx_audit_runs_created on public.audit_runs (created_at desc);

alter table public.audit_runs enable row level security;

-- Service role bypassa RLS. UI consome via backend autenticado.
