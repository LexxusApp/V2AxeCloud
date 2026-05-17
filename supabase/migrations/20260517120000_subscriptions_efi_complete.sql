-- Colunas EFI / onboarding (idempotente — corrige projetos onde só parte das migrations rodou)
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS efi_charge_id text,
  ADD COLUMN IF NOT EXISTS payment_provider text,
  ADD COLUMN IF NOT EXISTS pending_since timestamptz,
  ADD COLUMN IF NOT EXISTS efi_pix_txid text,
  ADD COLUMN IF NOT EXISTS efi_subscription_id text;

COMMENT ON COLUMN public.subscriptions.efi_charge_id IS 'ID da cobrança EFI (pix:txid ou charge id cartão)';
COMMENT ON COLUMN public.subscriptions.efi_pix_txid IS 'txid da cobrança PIX imediata (API Pix EFI)';
COMMENT ON COLUMN public.subscriptions.efi_subscription_id IS 'ID da assinatura recorrente EFI (cartão)';
