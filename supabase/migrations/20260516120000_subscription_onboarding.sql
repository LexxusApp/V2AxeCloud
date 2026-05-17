-- Campos para onboarding público (registro + pagamento EFI)
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS efi_charge_id text,
  ADD COLUMN IF NOT EXISTS payment_provider text,
  ADD COLUMN IF NOT EXISTS pending_since timestamptz;

COMMENT ON COLUMN public.subscriptions.efi_charge_id IS 'ID da cobrança EFI vinculada ao cadastro';
COMMENT ON COLUMN public.subscriptions.payment_provider IS 'Gateway usado no onboarding (ex: efi)';
COMMENT ON COLUMN public.subscriptions.pending_since IS 'Quando o terreiro entrou em status pendente de pagamento';

CREATE TABLE IF NOT EXISTS public.payment_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  external_id text NOT NULL,
  tenant_id uuid,
  payload jsonb,
  processed_at timestamptz DEFAULT now(),
  UNIQUE (provider, external_id)
);

CREATE INDEX IF NOT EXISTS idx_payment_webhook_events_tenant
  ON public.payment_webhook_events (tenant_id);
