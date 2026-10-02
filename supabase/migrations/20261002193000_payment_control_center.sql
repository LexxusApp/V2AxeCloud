-- Amplia a trilha idempotente da Efí para registrar toda a jornada de pagamento:
-- solicitação, cobrança criada, consulta de status, confirmação e falhas.
create table if not exists public.payment_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  external_id text not null,
  tenant_id uuid,
  payload jsonb,
  processed_at timestamptz default now(),
  unique (provider, external_id)
);

alter table public.payment_webhook_events
  add column if not exists event_type text,
  add column if not exists status text,
  add column if not exists payment_method text,
  add column if not exists amount_cents integer,
  add column if not exists billing_cycle text,
  add column if not exists charge_id text,
  add column if not exists error_code text,
  add column if not exists message text,
  add column if not exists occurred_at timestamptz;

update public.payment_webhook_events
set event_type = coalesce(event_type, 'webhook_received'),
    status = coalesce(status, 'processed'),
    payment_method = coalesce(payment_method, 'unknown'),
    occurred_at = coalesce(occurred_at, processed_at, now())
where event_type is null or status is null or payment_method is null or occurred_at is null;

alter table public.payment_webhook_events
  alter column event_type set default 'webhook_received',
  alter column event_type set not null,
  alter column status set default 'processed',
  alter column status set not null,
  alter column payment_method set default 'unknown',
  alter column payment_method set not null,
  alter column occurred_at set default now(),
  alter column occurred_at set not null;

alter table public.payment_webhook_events
  drop constraint if exists payment_webhook_events_amount_cents_check;
alter table public.payment_webhook_events
  add constraint payment_webhook_events_amount_cents_check
  check (amount_cents is null or amount_cents >= 0);

create index if not exists idx_payment_events_occurred_at
  on public.payment_webhook_events (occurred_at desc);
create index if not exists idx_payment_events_status_occurred
  on public.payment_webhook_events (status, occurred_at desc);
create index if not exists idx_payment_events_charge
  on public.payment_webhook_events (charge_id) where charge_id is not null;

comment on table public.payment_webhook_events is
  'Trilha administrativa idempotente de cobranças e pagamentos, incluindo eventos anteriores ao webhook.';
comment on column public.payment_webhook_events.external_id is
  'Chave idempotente do evento dentro do provedor.';
comment on column public.payment_webhook_events.status is
  'Estado normalizado: processing, pending, paid, failed, expired, cancelled ou processed.';

alter table public.payment_webhook_events enable row level security;
