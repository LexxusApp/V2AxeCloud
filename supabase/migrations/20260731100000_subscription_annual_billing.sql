-- Ciclos mensal/anual do Premium e rastreio idempotente da última cobrança ativada.
alter table public.subscriptions
  add column if not exists billing_cycle text not null default 'monthly',
  add column if not exists pending_billing_cycle text,
  add column if not exists last_activated_charge_id text;

alter table public.subscriptions
  drop constraint if exists subscriptions_billing_cycle_check;
alter table public.subscriptions
  add constraint subscriptions_billing_cycle_check
  check (billing_cycle in ('monthly', 'annual'));

alter table public.subscriptions
  drop constraint if exists subscriptions_pending_billing_cycle_check;
alter table public.subscriptions
  add constraint subscriptions_pending_billing_cycle_check
  check (pending_billing_cycle is null or pending_billing_cycle in ('monthly', 'annual'));

comment on column public.subscriptions.billing_cycle is
  'Ciclo vigente da assinatura Premium: monthly ou annual.';
comment on column public.subscriptions.pending_billing_cycle is
  'Ciclo escolhido no checkout, efetivado somente após confirmação do pagamento.';
comment on column public.subscriptions.last_activated_charge_id is
  'Identificador da última cobrança que estendeu a validade; evita ativação duplicada.';

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'global_settings' and column_name = 'data'
  ) then
    update public.global_settings
    set data = jsonb_set(
      coalesce(data, '{}'::jsonb),
      '{premium}',
      coalesce(data -> 'premium', '{}'::jsonb) ||
        jsonb_build_object('annual_price', 699.00, 'annual_price_cents', 69900),
      true
    ),
    updated_at = now()
    where id = 'plans';
  elsif exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'global_settings' and column_name = 'value'
  ) then
    update public.global_settings
    set value = jsonb_set(
      coalesce(value, '{}'::jsonb),
      '{premium}',
      coalesce(value -> 'premium', '{}'::jsonb) ||
        jsonb_build_object('annual_price', 699.00, 'annual_price_cents', 69900),
      true
    ),
    updated_at = now()
    where id = 'plans';
  end if;
end $$;
