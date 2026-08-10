create table if not exists public.growth_prospects (
  id uuid primary key default gen_random_uuid(),
  terreiro_slug text not null unique,
  terreiro_nome text not null,
  phone_e164 text not null,
  cidade text not null default 'Suzano',
  bairro text,
  source_url text,
  consent_at timestamptz,
  consent_source text,
  opt_out_at timestamptz,
  status text not null default 'novo' check (status in ('novo','fila','contatado','respondeu','qualificado','teste','onboarding','cliente','perdido','bloqueado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists growth_prospects_phone_unique
  on public.growth_prospects (phone_e164);

create table if not exists public.growth_outreach_queue (
  id uuid primary key,
  prospect_id uuid not null references public.growth_prospects(id) on delete cascade,
  campaign text not null default 'suzano_2026',
  step smallint not null default 0 check (step between 0 and 2),
  scheduled_at timestamptz not null,
  status text not null default 'agendado' check (status in ('agendado','pronto','enviado','respondido','falhou','cancelado','bloqueado')),
  template_name text,
  external_id text,
  sent_at timestamptz,
  last_inbound_at timestamptz,
  last_inbound_preview text,
  followup_count smallint not null default 0,
  error text,
  attempts smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists growth_queue_due_idx
  on public.growth_outreach_queue (status, scheduled_at);
create index if not exists growth_queue_prospect_idx
  on public.growth_outreach_queue (prospect_id, created_at desc);

create table if not exists public.growth_outreach_events (
  id uuid primary key default gen_random_uuid(),
  queue_id uuid references public.growth_outreach_queue(id) on delete cascade,
  prospect_id uuid references public.growth_prospects(id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.growth_prospects enable row level security;
alter table public.growth_outreach_queue enable row level security;
alter table public.growth_outreach_events enable row level security;

comment on column public.growth_prospects.consent_at is
  'Momento do opt-in verificável para mensagens de marketing no WhatsApp.';
comment on table public.growth_outreach_queue is
  'Fila server-side do AxéCloud Growth; acessível apenas pelo backend service_role.';
