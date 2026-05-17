-- Campos extras para checkout EFI (PIX + assinatura cartão)
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS efi_pix_txid text,
  ADD COLUMN IF NOT EXISTS efi_subscription_id text;

COMMENT ON COLUMN public.subscriptions.efi_pix_txid IS 'txid da cobrança PIX imediata (API Pix EFI)';
COMMENT ON COLUMN public.subscriptions.efi_subscription_id IS 'ID da assinatura recorrente EFI (cartão)';
