-- Importa a última cobrança conhecida de cada assinatura para que a central
-- administrativa já nasça com contexto. Valores antigos não são inferidos.
insert into public.payment_webhook_events (
  provider,
  external_id,
  tenant_id,
  event_type,
  status,
  payment_method,
  billing_cycle,
  charge_id,
  message,
  payload,
  occurred_at,
  processed_at
)
select
  coalesce(nullif(s.payment_provider, ''),
    case when s.efi_pix_txid is not null then 'efi_pix' else 'efi_card' end),
  'legacy:' || s.id::text || ':' || coalesce(
    nullif(s.last_activated_charge_id, ''),
    nullif(s.efi_charge_id, ''),
    nullif(s.efi_pix_txid, ''),
    nullif(s.efi_subscription_id, ''),
    'unknown'
  ),
  s.id,
  case when nullif(s.last_activated_charge_id, '') is not null
    then 'payment_confirmed' else 'legacy_charge_snapshot' end,
  case when nullif(s.last_activated_charge_id, '') is not null
    then 'paid' else 'pending' end,
  case when s.efi_pix_txid is not null or s.payment_provider ilike '%pix%'
    then 'pix' else 'card' end,
  coalesce(s.pending_billing_cycle, s.billing_cycle),
  coalesce(
    nullif(s.last_activated_charge_id, ''),
    nullif(s.efi_charge_id, ''),
    nullif(s.efi_pix_txid, ''),
    nullif(s.efi_subscription_id, '')
  ),
  case when nullif(s.last_activated_charge_id, '') is not null
    then 'Pagamento anterior importado da assinatura.'
    else 'Cobrança anterior importada da assinatura.' end,
  jsonb_build_object('source', 'subscriptions_backfill'),
  coalesce(s.updated_at, now()),
  now()
from public.subscriptions s
where s.efi_charge_id is not null
   or s.efi_pix_txid is not null
   or s.efi_subscription_id is not null
on conflict (provider, external_id) do nothing;
